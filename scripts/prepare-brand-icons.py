"""Export approved artwork for web delivery; retain all original concepts."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'output/logo-concepts-20261016'
target = root / 'assets/brand'
target.mkdir(parents=True, exist_ok=True)

def artwork(name):
    image = Image.open(source / name).convert('RGBA')
    return image.crop(image.getchannel('A').getbbox())

wordmark = artwork('logo-three-card-v2.png')
wordmark.thumbnail((640, 200), Image.Resampling.LANCZOS)
wordmark.save(target / 'jqka-logo-v1.webp', lossless=True)
icon = artwork('logo-icon-master-v1.png')
for size in (32, 64, 180, 192, 512):
    thumb = icon.copy()
    thumb.thumbnail((int(size*.92), int(size*.92)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size))
    canvas.alpha_composite(thumb, ((size-thumb.width)//2, (size-thumb.height)//2))
    canvas.save(target / f'icon-{size}-v1.png')
Image.open(target / 'icon-512-v1.png').save(target / 'favicon-v1.ico', sizes=[(16,16),(32,32),(48,48),(64,64)])
print('Approved logo and icons exported to assets/brand; originals retained.')
