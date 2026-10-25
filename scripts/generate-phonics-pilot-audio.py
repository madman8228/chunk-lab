"""Word candidate only. Never synthesize isolated phonemes from IPA text."""
import asyncio
import hashlib
import json
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'drafts/zero-english/phonics-interactive-v1/audio-v1'

async def main():
    DEST.mkdir(parents=True, exist_ok=False)
    target = DEST / 'sat-jenny-v1.mp3'
    await asyncio.wait_for(edge_tts.Communicate('sat', 'en-US-JennyNeural', rate='+0%', pitch='+0Hz').save(str(target)), timeout=45)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True, capture_output=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(target)], check=True, capture_output=True, text=True)
    duration = float(json.loads(probe.stdout)['format']['duration'])
    assert 0.2 < duration < 10
    data = target.read_bytes()
    manifest = {'assetId':'pilot-sat-v1', 'text':'sat', 'kind':'whole-word', 'engine':'edge-tts',
        'voice':'en-US-JennyNeural', 'localFile':target.name, 'sha256':hashlib.sha256(data).hexdigest(),
        'size':len(data), 'durationSeconds':duration, 'audioReview':'pending', 'publication':'pending'}
    with (DEST / 'manifest.json').open('x', encoding='utf-8') as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2)
    print(json.dumps({'destination':str(DEST), 'decodable':True, 'audioReview':'pending'}))

if __name__ == '__main__':
    asyncio.run(main())
