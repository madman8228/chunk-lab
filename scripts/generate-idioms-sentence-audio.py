"""Generate resumable Kokoro sentence masters and compact Opus course audio."""
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'output/audio-production/freq-idioms-sentences-v1'

def main():
    source = json.loads((BATCH / 'source.json').read_text(encoding='utf-8'))
    models = ROOT / 'output/audio-production/kokoro-model-v1'
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    engine = Kokoro.from_session(ort.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
    records = []
    (BATCH / 'masters').mkdir(exist_ok=True)
    (BATCH / 'delivery').mkdir(exist_ok=True)
    for index, item in enumerate(source['items'], 1):
        text = item['sentence'].strip()
        fingerprint = hashlib.sha256(('af_heart|1.0|' + text).encode()).hexdigest()[:20]
        stem = 'idiom-' + item['cid'] + '-' + fingerprint
        master = BATCH / 'masters' / (stem + '.wav')
        delivery = BATCH / 'delivery' / (stem + '.ogg')
        if not master.exists():
            samples, rate = engine.create(text, voice='af_heart', speed=1.0, lang='en-us', trim=False)
            if rate != 24000 or not np.isfinite(samples).all() or len(samples) < 6000 or np.max(np.abs(samples)) < .01:
                raise ValueError('Invalid audio: ' + item['cid'])
            sf.write(master, samples, rate, subtype='PCM_16')
        samples, rate = sf.read(master)
        if not delivery.exists():
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-i', str(master), '-c:a', 'libopus', '-b:a', '24k', '-application', 'voip', str(delivery)], check=True)
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(delivery), '-f', 'null', '-'], check=True)
        records.append({'cid':item['cid'], 'text':text, 'file':delivery.name, 'sha256':hashlib.sha256(delivery.read_bytes()).hexdigest(), 'bytes':delivery.stat().st_size, 'durationSeconds':len(samples)/rate})
        (BATCH / 'audio-manifest.json').write_text(json.dumps({'voice':'af_heart','engine':'kokoro-onnx','records':records}, ensure_ascii=False, indent=2), encoding='utf-8')
        if index % 20 == 0 or index == len(source['items']):
            print(f'Generated and decoded {index}/{len(source["items"])}', flush=True)

if __name__ == '__main__':
    main()
