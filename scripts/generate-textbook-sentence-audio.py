"""Generate local-only sentence WAV masters for a verified textbook package."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parents[1]
COMPARISON = ROOT / "drafts/scene-wordbooks/borrow-things-v1/audio-compare-v2/masters.json"
MODEL_DIR = ROOT / "output/audio-production/kokoro-model-v1"
VOICE = "af_heart"
VOICE_LABEL = "en-US"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sentence_text(item: dict) -> str:
    parts = item.get("exercise", {}).get("parts", [])
    text = "".join(part.get("text", (part.get("answers") or [""])[0]) for part in parts).strip()
    if not text:
        raise ValueError(f"Empty example sentence for {item.get('itemId')}")
    return text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    source = args.package.resolve(strict=True)
    output = args.out.resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite audio batch: {output}")

    package = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    snapshot = json.loads((source / package["content"]["courseSnapshot"]).read_text(encoding="utf-8"))
    items = [item for draft in snapshot["drafts"] for item in draft["items"]]
    if len(items) != 628 or len({item["itemId"] for item in items}) != len(items):
        raise ValueError(f"Expected 628 unique textbook items, got {len(items)}")
    if any(any(row["itemId"] == item["itemId"] and row["kind"] == "sentence" for row in package["audioAssets"]) for item in items):
        raise ValueError("Source package already has sentence audio; refusing duplicate generation")

    previous = json.loads(COMPARISON.read_text(encoding="utf-8"))
    model_path = MODEL_DIR / "kokoro-v1.0.onnx"
    voices_path = MODEL_DIR / "voices-v1.0.bin"
    for file, expected in ((model_path, previous["model"]["sha256"]), (voices_path, previous["voices"]["sha256"])):
        actual = digest(file)
        if actual != expected:
            raise ValueError(f"Model asset hash mismatch: {file}")

    masters = output / "masters"
    masters.mkdir(parents=True, exist_ok=False)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    engine = Kokoro.from_session(
        ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"]),
        str(voices_path),
    )

    records = []
    for index, item in enumerate(items, start=1):
        text = sentence_text(item)
        samples, rate = engine.create(text, voice=VOICE, speed=1.0, lang="en-us", trim=False)
        if rate != 24000 or not np.isfinite(samples).all() or len(samples) < rate * 0.25 or np.max(np.abs(samples)) < 0.01:
            raise ValueError(f"Invalid generated audio for {item['itemId']}")
        item_slug = re.sub(r"[^a-z0-9-]+", "-", item["itemId"].lower()).strip("-")
        filename = f"{item_slug}-sentence-af-heart-v1.wav"
        path = masters / filename
        sf.write(path, samples, rate, subtype="PCM_16")
        records.append({
            "itemId": item["itemId"], "unitId": item["unitId"], "word": item["word"],
            "kind": "sentence", "text": text, "voice": VOICE, "speed": 1.0,
            "language": "en-US", "phonemes": engine.tokenizer.phonemize(text, "en-us"),
            "path": f"masters/{filename}", "sampleRateHz": rate,
            "durationSeconds": len(samples) / rate, "bytes": path.stat().st_size,
            "sha256": digest(path), "listeningReview": "pending-sample",
        })
        if index % 25 == 0 or index == len(items):
            print(f"Generated {index}/{len(items)} sentence masters", flush=True)

    metadata = {
        "format": "textbook-sentence-audio-masters", "schemaVersion": 1,
        "stage": "draft", "publishable": False, "itemCount": len(records),
        "voice": VOICE, "language": VOICE_LABEL, "speed": 1.0,
        "engine": "kokoro-onnx",
        "packages": {name: importlib.metadata.version(name) for name in ["kokoro-onnx", "onnxruntime", "phonemizer", "soundfile"]},
        "model": previous["model"], "voices": previous["voices"], "records": records,
    }
    with (output / "generation-manifest.json").open("x", encoding="utf-8") as stream:
        json.dump(metadata, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"output": str(output), "sentences": len(records), "model": metadata["model"]["name"], "voice": VOICE}, ensure_ascii=False))


if __name__ == "__main__":
    main()
