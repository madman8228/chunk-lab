"""Produce complete-word pronunciation candidates, never IPA-as-TTS phonemes."""
import asyncio
import hashlib
import json
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'drafts/zero-english/fv-pronunciation-v1/audio-v1'

async def main():
    DEST.mkdir(parents=True, exist_ok=False)
    rows = []
    for speaker, voice in [('jenny', 'en-US-JennyNeural'), ('guy', 'en-US-GuyNeural')]:
        for word in ['fan', 'van', 'fine', 'vine']:
            target = DEST / f'{word}-{speaker}.mp3'
            await asyncio.wait_for(edge_tts.Communicate(word, voice, rate='+0%', pitch='+0Hz').save(str(target)), timeout=45)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(target), '-f', 'null', '-'], check=True, capture_output=True)
            probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(target)], check=True, capture_output=True, text=True)
            duration = float(json.loads(probe.stdout)['format']['duration'])
            assert 0.2 < duration < 10
            data = target.read_bytes()
            rows.append({'id':f'{word}-{speaker}', 'word':word, 'kind':'whole-word', 'voice':voice,
                'file':target.name, 'sha256':hashlib.sha256(data).hexdigest(), 'size':len(data),
                'durationSeconds':duration, 'audioReview':'pending'})
            print(f'Generated {word} / {speaker}', flush=True)
    with (DEST / 'manifest.json').open('x', encoding='utf-8') as stream:
        json.dump({'engine':'edge-tts','publication':'pending','audio':rows}, stream, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    asyncio.run(main())
