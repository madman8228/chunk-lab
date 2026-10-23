"""Generate resumable local Kokoro WAV masters from a textbook audio task queue."""
from __future__ import annotations

import argparse
import atexit
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import tempfile

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parents[1]
COMPARISON = ROOT / "drafts/scene-wordbooks/borrow-things-v1/audio-compare-v2/masters.json"
MODEL_DIR = ROOT / "output/audio-production/kokoro-model-v1"


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_file(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def queue_fingerprint(queue: dict) -> str:
    inputs = [{"taskId": task["taskId"], "inputFingerprint": task["inputFingerprint"]} for task in queue["tasks"]]
    payload = {"bookId": queue["book"]["bookId"], "sourceSha256": queue["source"]["sha256"], "tasks": inputs}
    return digest_bytes(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def write_json_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def acquire_batch_lock(output: Path):
    lock_path = output / ".generation.lock"
    stream = lock_path.open("a+b")
    if lock_path.stat().st_size == 0:
        stream.write(b"0")
        stream.flush()
    stream.seek(0)
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            unlock = lambda: msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            unlock = lambda: fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
    except OSError as error:
        stream.close()
        raise RuntimeError(f"Another generator is active for this batch: {output}") from error
    atexit.register(lambda: (unlock(), stream.close()))
    return stream


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--queue", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--limit", type=int, help="Generate at most this many ready tasks in this run")
    parser.add_argument("--kind", choices=["word", "sentence"], default="word")
    args = parser.parse_args()

    queue_path = args.queue.resolve(strict=True)
    output = args.out.resolve()
    queue = json.loads(queue_path.read_text(encoding="utf-8"))
    if queue.get("format") != "textbook-audio-task-queue" or queue.get("schemaVersion") != 1:
        raise ValueError("Unsupported textbook audio task queue")
    if args.limit is not None and args.limit < 1:
        raise ValueError("--limit must be positive")
    tasks = [task for task in queue["tasks"] if task.get("kind") == args.kind and task.get("status") == "ready"]
    if not tasks:
        queue["counts"]["ready"] = sum(task["status"] == "ready" and task["kind"] == "word" for task in queue["tasks"])
        queue["counts"]["generatedWords"] = sum(task["status"] == "generated" and task["kind"] == "word" for task in queue["tasks"])
        queue["counts"]["sentenceReady"] = sum(task["status"] == "ready" and task["kind"] == "sentence" for task in queue["tasks"])
        queue["counts"]["generatedSentences"] = sum(task["status"] == "generated" and task["kind"] == "sentence" for task in queue["tasks"])
        queue["counts"]["pendingFinalText"] = sum(task["status"] == "pending-final-text" and task["kind"] == "sentence" for task in queue["tasks"])
        write_json_atomic(queue_path, queue)
        print(json.dumps({"output": str(output), "generated": 0, "message": "No ready tasks"}, ensure_ascii=False))
        return
    if args.limit is not None:
        tasks = tasks[:args.limit]

    output.mkdir(parents=True, exist_ok=True)
    acquire_batch_lock(output)
    masters = output / "masters"
    masters.mkdir(exist_ok=True)
    state_path = output / "generation-manifest.json"
    queue_hash = queue_fingerprint(queue)
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        if state.get("queueFingerprint") != queue_hash or state.get("bookId") != queue["book"]["bookId"]:
            raise ValueError("Queue changed since this batch began; start a new versioned output directory")
    else:
        state = {
            "format": "textbook-audio-masters", "schemaVersion": 1,
            "stage": "draft", "publishable": False, "bookId": queue["book"]["bookId"],
            "queuePath": str(queue_path), "queueFingerprint": queue_hash,
            "engine": "kokoro-onnx", "voice": "af_heart", "language": "en-US", "speed": 1,
            "sampleRateHz": 24000, "channels": 1, "records": [],
        }

    previous = json.loads(COMPARISON.read_text(encoding="utf-8"))
    model_path = MODEL_DIR / "kokoro-v1.0.onnx"
    voices_path = MODEL_DIR / "voices-v1.0.bin"
    model = {"path": str(model_path), "sha256": digest_file(model_path)}
    voices = {"path": str(voices_path), "sha256": digest_file(voices_path)}
    for actual, expected in ((model, previous["model"]["sha256"]), (voices, previous["voices"]["sha256"])):
        if actual["sha256"] != expected:
            raise ValueError(f"Model asset hash mismatch: {actual['path']}")
    state["model"] = previous["model"]
    state["voices"] = previous["voices"]
    state["packages"] = {name: importlib.metadata.version(name) for name in ["kokoro-onnx", "onnxruntime", "phonemizer", "soundfile"]}

    done = {row["taskId"]: row for row in state["records"]}
    queued_by_id = {task["taskId"]: task for task in queue["tasks"]}
    if len(done) != len(state["records"]):
        raise ValueError("Duplicate task IDs in generation checkpoints")
    for task_id, row in done.items():
        task = queued_by_id.get(task_id)
        relative = Path(row["path"])
        if not task or relative.is_absolute() or ".." in relative.parts or row.get("inputFingerprint") != task.get("inputFingerprint") or task.get("status") not in ("ready", "generated"):
            raise ValueError(f"Checkpoint does not match the queue: {task_id}")
        audio_path = output / relative
        if not audio_path.is_file() or digest_file(audio_path) != row["sha256"] or audio_path.stat().st_size != row["bytes"]:
            raise ValueError(f"Existing checkpoint failed verification; preserve it and start a new batch version: {task_id}")
        task["status"] = "generated"
    for task in tasks:
        if task.get("status") not in ("ready", "generated") or not task.get("spokenText", "").strip():
            raise ValueError(f"Task is not ready or has no final spoken text: {task.get('taskId')}")
        if task.get("kind") != args.kind or task.get("bookId") != state["bookId"]:
            raise ValueError(f"Task book/kind mismatch: {task.get('taskId')}")
        recorded = done.get(task["taskId"])
        if recorded:
            audio_path = output / recorded["path"]
            if recorded["inputFingerprint"] != task["inputFingerprint"] or not audio_path.is_file() or digest_file(audio_path) != recorded["sha256"] or audio_path.stat().st_size != recorded["bytes"]:
                raise ValueError(f"Existing checkpoint failed verification; preserve it and start a new batch version: {task['taskId']}")
            task["status"] = "generated"
            continue

    pending = [task for task in tasks if task["taskId"] not in done]
    if pending:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 4
        options.inter_op_num_threads = 1
        engine = Kokoro.from_session(
            ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"]),
            str(voices_path),
        )
        for task in pending:
            text = task["spokenText"].strip()
            suffix = hashlib.sha256(task["taskId"].encode("utf-8")).hexdigest()[:20]
            filename = f"{suffix}-{re.sub(r'[^a-z0-9-]+', '-', task['kind'].lower()).strip('-')}-af-heart-v1.wav"
            relative = f"masters/{filename}"
            audio_path = output / relative
            if audio_path.exists():
                samples, rate = sf.read(audio_path, dtype="float32", always_2d=False)
                if rate != 24000 or not np.isfinite(samples).all() or len(samples) < rate * 0.12 or np.max(np.abs(samples)) < 0.01:
                    raise ValueError(f"Untracked output exists but failed recovery checks; preserve it: {audio_path}")
            else:
                samples, rate = engine.create(text, voice=task["voice"], speed=float(task["speed"]), lang="en-us", trim=False)
                if rate != 24000 or not np.isfinite(samples).all() or len(samples) < rate * 0.12 or np.max(np.abs(samples)) < 0.01:
                    raise ValueError(f"Invalid generated audio for {task['taskId']}")
                temporary = audio_path.with_suffix(audio_path.suffix + ".tmp")
                sf.write(temporary, samples, rate, subtype="PCM_16", format="WAV")
                os.replace(temporary, audio_path)
            row = {
                "taskId": task["taskId"], "bookId": task["bookId"], "unitId": task["unitId"],
                "itemId": task["itemId"], "kind": task["kind"], "displayText": task["displayText"],
                "text": text, "inputFingerprint": task["inputFingerprint"], "voice": task["voice"],
                "pronunciationRule": task.get("pronunciationRule", "default-g2p"),
                "speed": float(task["speed"]), "language": task["language"],
                "phonemes": engine.tokenizer.phonemize(text, "en-us"),
                "path": relative, "sampleRateHz": rate, "channels": 1,
                "durationSeconds": len(samples) / rate, "bytes": audio_path.stat().st_size,
                "sha256": digest_file(audio_path), "listeningReview": "pending-sample",
            }
            state["records"].append(row)
            done[task["taskId"]] = row
            task["status"] = "generated"
            write_json_atomic(state_path, state)
            write_json_atomic(queue_path, queue)
            if len(done) % 25 == 0 or len(done) == len(queue["tasks"]) // 2:
                print(f"Checkpointed {len(done)} task(s); latest {task['itemId']} {task['displayText']}", flush=True)

    queue["counts"]["ready"] = sum(task["status"] == "ready" and task["kind"] == "word" for task in queue["tasks"])
    queue["counts"]["generatedWords"] = sum(task["status"] == "generated" and task["kind"] == "word" for task in queue["tasks"])
    queue["counts"]["sentenceReady"] = sum(task["status"] == "ready" and task["kind"] == "sentence" for task in queue["tasks"])
    queue["counts"]["generatedSentences"] = sum(task["status"] == "generated" and task["kind"] == "sentence" for task in queue["tasks"])
    queue["counts"]["pendingFinalText"] = sum(task["status"] == "pending-final-text" and task["kind"] == "sentence" for task in queue["tasks"])
    write_json_atomic(queue_path, queue)
    print(json.dumps({"output": str(output), "bookId": state["bookId"], "kind": args.kind, "generatedThisRun": len(pending), "totalCheckpoints": len(state["records"]), "remainingReady": queue["counts"]["ready"], "publishable": False}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
