"""Convert the recorded CC0 MakeHuman skin sources to compact local runtime UV maps."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

root = Path(__file__).resolve().parent
destination = root / 'skins'
destination.mkdir(exist_ok=True)
report = []
for preset in ('young-man', 'elder-man', 'young-woman', 'elder-woman'):
    source = root / 'source' / f'{preset}-skin-original.png'
    target = destination / f'{preset}.webp'
    with Image.open(source) as image:
        image = image.convert('RGB')
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=86, method=6)
        size = list(image.size)
    report.append({'preset': preset, 'source': str(source.relative_to(root)).replace('\\','/'), 'sourceSha256': sha256(source.read_bytes()).hexdigest(), 'runtime': f'skins/{preset}.webp', 'runtimeSha256': sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size, 'size': size})
(destination / 'skin-build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
