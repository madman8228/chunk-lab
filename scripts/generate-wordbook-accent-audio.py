#!/usr/bin/env python3
"""Generate review-only en-GB sentence audio variants; never edits source packages."""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "wordbook-phonetics-supplement-full-20261025-v5"
OUT = ROOT / "output" / "wordbook-phonetics-en-gb-audio-20261026-v1"
MODEL = ROOT / "output" / "audio-production" / "kokoro-model-v1" / "kokoro-v1.0.onnx"
VOICES = MODEL.parent / "voices-v1.0.bin"
RUNTIME = Path(os.environ.get("KOKORO_RUNTIME", Path(os.environ["TEMP"]) / "phonetics-kokoro-runtime-23eb83043e3a4f68a5ffcb0e3a764265"))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_json(path, payload):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def load_inputs():
    report = json.loads((SOURCE / "report.json").read_text(encoding="utf-8"))
    candidates = sorted(SOURCE.glob("*/candidate.json"))
    if len(candidates) != 21 or len(report.get("books", [])) != 21:
        raise RuntimeError("Source package count differs from the reviewed 21-book batch")
    items, books = [], []
    for path in candidates:
        package = json.loads(path.read_text(encoding="utf-8"))
        if package.get("published") is not False:
            raise RuntimeError("Refusing a published source package: " + str(path))
        books.append({"path": str(path.relative_to(SOURCE)), "sha256": sha256(path), "bookId": package["index"]["books"][0]["bookId"]})
        for item in package["items"]:
            activity = item.get("learning", {}).get("sentenceAudio")
            if activity:
                if not activity.get("text") or not activity.get("audio", {}).get("url"):
                    raise RuntimeError("Incomplete existing sentence audio: " + item["itemId"])
                sentence = "".join(part.get("text", (part.get("answers") or [""])[0]) for part in item.get("exercise", {}).get("parts", []))
                if activity["text"] != sentence:
                    raise RuntimeError("Authored audio text differs from the exercise sentence: " + item["itemId"])
                items.append({"itemId": item["itemId"], "bookId": package["index"]["books"][0]["bookId"], "text": activity["text"]})
    if len(items) != 4174:
        raise RuntimeError(f"Expected the reviewed 4,174 configured sentence clips, found {len(items)}")
    return report, books, items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Generate at most this many unique texts, for a benchmark")
    args = parser.parse_args()
    sys.path.insert(0, str(RUNTIME))
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    report, books, items = load_inputs()
    OUT.mkdir(parents=True, exist_ok=True)
    audio_dir = OUT / "assets"
    audio_dir.mkdir(exist_ok=True)
    manifest_path = OUT / "generation-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {
        "format": "wordbook-accent-audio-generation", "schemaVersion": 1, "published": False,
        "stage": "review-only", "accent": "en-GB", "voice": "bf_emma", "engine": "kokoro-onnx 0.6.1",
        "modelSha256": sha256(MODEL), "voicesSha256": sha256(VOICES), "source": str(SOURCE),
        "sourceReportSha256": sha256(SOURCE / "report.json"), "books": books,
        "expectedItems": len(items), "items": {}, "clips": {}, "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    if manifest["sourceReportSha256"] != sha256(SOURCE / "report.json") or manifest["books"] != books:
        raise RuntimeError("Source batch changed since generation started")
    manifest.setdefault("failures", {})
    for clip in manifest["clips"].values():
        if isinstance(clip.get("phonemes"), int):
            clip.pop("phonemes")
    unique = {}
    for item in items:
        unique.setdefault(item["text"], []).append(item)
    pending_texts = [text for text in unique if hashlib.sha256(text.encode("utf-8")).hexdigest() not in manifest["clips"]]
    if args.limit:
        pending_texts = pending_texts[:args.limit]

    remaining = []
    for text in pending_texts:
        key = hashlib.sha256(text.encode("utf-8")).hexdigest()
        filename = "en-gb-bf_emma-" + key + ".ogg"
        target = audio_dir / filename
        if not target.exists():
            remaining.append(text)
            continue
        info = sf.info(str(target))
        if info.format != "OGG" or info.channels != 1 or info.samplerate != 24000 or info.frames <= 0:
            raise RuntimeError("Untracked existing audio failed resume validation: " + str(target))
        manifest["clips"][key] = {"text": text, "path": "assets/" + filename, "sha256": sha256(target),
                                  "bytes": target.stat().st_size, "mimeType": "audio/ogg", "sampleRateHz": info.samplerate,
                                  "durationSeconds": round(info.frames / info.samplerate, 3), "accent": "en-GB", "voice": "bf_emma"}
        for item in unique[text]:
            manifest["items"][item["itemId"]] = key
    if len(remaining) != len(pending_texts):
        manifest["completedUniqueTexts"] = len(manifest["clips"])
        manifest["completedItems"] = len(manifest["items"])
        manifest["lastUpdatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        atomic_json(manifest_path, manifest)
        print(f"adopted and verified {len(pending_texts)-len(remaining)} complete audio files after interruption", flush=True)
    pending_texts = remaining

    model = Kokoro(str(MODEL), str(VOICES))
    started = time.time()
    for index, text in enumerate(pending_texts, 1):
        key = hashlib.sha256(text.encode("utf-8")).hexdigest()
        filename = "en-gb-bf_emma-" + key + ".ogg"
        target = audio_dir / filename
        if target.exists():
            raise RuntimeError("Refusing to overwrite an untracked output file: " + str(target))
        try:
            samples, sample_rate = model.create(text, voice="bf_emma", speed=1.0, lang="en-gb")
            pcm = np.asarray(samples, dtype=np.float32)
            if pcm.size == 0 or sample_rate != 24000:
                raise RuntimeError(f"Empty audio or unexpected sample rate: {sample_rate}")
        except Exception as error:
            manifest["failures"][key] = {"text": text, "error": f"{type(error).__name__}: {error}", "itemIds": [item["itemId"] for item in unique[text]]}
            manifest["lastUpdatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            atomic_json(manifest_path, manifest)
            print(f"deferred {key[:12]} for retry: {type(error).__name__}: {error}", flush=True)
            continue
        sf.write(str(target), pcm, sample_rate, format="OGG", subtype="VORBIS")
        clip_hash = sha256(target)
        manifest["clips"][key] = {"text": text, "path": "assets/" + filename, "sha256": clip_hash,
                                  "bytes": target.stat().st_size, "mimeType": "audio/ogg", "sampleRateHz": sample_rate,
                                  "durationSeconds": round(len(pcm) / sample_rate, 3),
                                  "accent": "en-GB", "voice": "bf_emma"}
        manifest["failures"].pop(key, None)
        for item in unique[text]:
            manifest["items"][item["itemId"]] = key
        if index % 20 == 0 or index == len(pending_texts):
            manifest["completedUniqueTexts"] = len(manifest["clips"])
            manifest["completedItems"] = len(manifest["items"])
            manifest["lastUpdatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            atomic_json(manifest_path, manifest)
            print(f"generated {index}/{len(pending_texts)} new unique texts; total {len(manifest['items'])}/{len(items)} items; elapsed {time.time()-started:.1f}s", flush=True)
    manifest["completedUniqueTexts"] = len(manifest["clips"])
    manifest["completedItems"] = len(manifest["items"])
    manifest["complete"] = len(manifest["items"]) == len(items) and not manifest["failures"]
    manifest["lastUpdatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    atomic_json(manifest_path, manifest)
    print(f"ready={manifest['complete']} uniqueClips={len(manifest['clips'])} items={len(manifest['items'])} failedTexts={len(manifest['failures'])} elapsed={time.time()-started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
