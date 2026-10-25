"""Build a new audio candidate from the approved lesson design; preserve sources."""
import asyncio
import hashlib
import json
import subprocess
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'drafts/zero-english/progressive-building-v1'

async def main():
    raw = (BASE / 'lesson-design.json').read_bytes()
    design = json.loads(raw)
    target = BASE / 'audio-v1'
    target.mkdir(exist_ok=False)
    scripts = [(s['id'], s['text']) for s in design['chain']]
    scripts += [('word-water', 'water'), ('word-food', 'food'), ('word-tea', 'tea'),
                ('transfer-tea', 'I need some tea, please.'), ('transfer-food', 'I need some food.')]
    rows = []
    for asset_id, text in scripts:
        file = target / f'{asset_id}.mp3'
        await asyncio.wait_for(edge_tts.Communicate(text, 'en-US-JennyNeural', rate='+0%', pitch='+0Hz').save(str(file)), timeout=45)
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(file), '-f', 'null', '-'], check=True, capture_output=True)
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(file)], check=True, capture_output=True, text=True)
        duration = float(json.loads(probe.stdout)['format']['duration'])
        assert 0.2 < duration < 20
        data = file.read_bytes()
        rows.append({'id':asset_id, 'text':text, 'file':file.name, 'voice':'en-US-JennyNeural',
            'sha256':hashlib.sha256(data).hexdigest(), 'size':len(data), 'durationSeconds':duration, 'review':'pending'})
        print(f'Generated {asset_id}', flush=True)
    assert (BASE / 'lesson-design.json').read_bytes() == raw
    with (target / 'manifest.json').open('x', encoding='utf-8') as stream:
        json.dump({'sourceFileSha256':hashlib.sha256(raw).hexdigest(), 'engine':'edge-tts', 'audioReview':'pending', 'publication':'not-authorized', 'audio':rows}, stream, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    asyncio.run(main())
