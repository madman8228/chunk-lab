"""Resumable parallel sentence audio production using the established af_heart voice."""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[1]
ENGINE = None

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def initialize():
    global ENGINE
    models = ROOT / 'output/audio-production/kokoro-model-v1'
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    ENGINE = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))

def generate(job):
    batch, item = job
    batch = Path(batch)
    text = item['sentence'].strip()
    fingerprint = hashlib.sha256(('af_heart|1.0|' + text).encode()).hexdigest()[:20]
    stem = 'oral-' + item['cid'] + '-' + fingerprint
    master = batch / 'masters' / (stem + '.wav')
    delivery = batch / 'delivery' / (stem + '.ogg')
    reused = item.get('reuse')
    if reused:
        previous = Path(reused['delivery'])
        if digest(previous) != reused['sha256']:
            raise ValueError('Reused audio changed: ' + item['cid'])
        if not delivery.exists():
            shutil.copyfile(previous, delivery)
        duration = reused['durationSeconds']
    else:
        if not master.exists():
            samples, rate = ENGINE.create(text, voice='af_heart', speed=1.0, lang='en-us', trim=False)
            if rate != 24000 or not np.isfinite(samples).all() or len(samples) < 6000 or np.max(np.abs(samples)) < .01:
                raise ValueError('Invalid audio: ' + item['cid'])
            temporary = master.with_suffix('.tmp.wav')
            sf.write(temporary, samples, rate, subtype='PCM_16')
            os.replace(temporary, master)
        samples, rate = sf.read(master)
        if rate != 24000 or not np.isfinite(samples).all() or len(samples) < 6000:
            raise ValueError('Invalid recovered master: ' + item['cid'])
        duration = len(samples) / rate
        if not delivery.exists():
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-i', str(master), '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', str(delivery)], check=True)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(delivery), '-f', 'null', '-'], check=True)
    return {'deckId':item['deckId'], 'cid':item['cid'], 'text':text, 'file':delivery.name, 'sha256':digest(delivery), 'bytes':delivery.stat().st_size, 'durationSeconds':duration, 'reused':bool(reused)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch', required=True, type=Path)
    parser.add_argument('--workers', type=int, default=4, choices=range(1,5))
    args = parser.parse_args()
    batch = args.batch.resolve()
    source_bytes = (batch / 'source.json').read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    source = json.loads(source_bytes)
    items = source['items']
    if len({(item['deckId'],item['cid']) for item in items}) != len(items):
        raise ValueError('Duplicate source identity')
    (batch / 'masters').mkdir(exist_ok=True)
    (batch / 'delivery').mkdir(exist_ok=True)
    checkpoint = batch / 'audio-manifest.json'
    model_root = ROOT / 'output/audio-production/kokoro-model-v1'
    provenance = {'modelSha256':digest(model_root/'kokoro-v1.0.onnx'), 'voicesSha256':digest(model_root/'voices-v1.0.bin')}
    state = {'voice':'af_heart','speed':1.0,'language':'en-US','engine':'kokoro-onnx','codec':'opus','bitrate':24000,'sourceSha256':source_hash,**provenance,'records':[]}
    if checkpoint.exists():
        previous = json.loads(checkpoint.read_text(encoding='utf-8'))
        for key in ('sourceSha256','modelSha256','voicesSha256','voice','speed','codec'):
            if previous.get(key) != state[key]:
                raise ValueError('Checkpoint mismatch: '+key)
        state = previous
    done = {(row['deckId'],row['cid']):row for row in state['records']}
    for row in done.values():
        if digest(batch/'delivery'/row['file']) != row['sha256']:
            raise ValueError('Checkpoint file changed')
    pending = [item for item in items if (item['deckId'],item['cid']) not in done]
    with ProcessPoolExecutor(max_workers=args.workers, initializer=initialize) as executor:
        futures = [executor.submit(generate,(str(batch),item)) for item in pending]
        for future in as_completed(futures):
            row = future.result()
            state['records'].append(row)
            temporary = checkpoint.with_suffix('.tmp.json')
            temporary.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
            os.replace(temporary,checkpoint)
            if len(state['records']) % 50 == 0 or len(state['records']) == len(items):
                print(f'Generated and decoded {len(state["records"])}/{len(items)}',flush=True)

if __name__ == '__main__':
    main()
