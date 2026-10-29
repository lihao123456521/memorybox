"""Convert recorded CC0 MakeHuman system clothing and hair textures to local WebP.

No network access or MakeHuman application code is required. MHCLO and source
materials retain the upstream explicit September 2020 CC0 release statement.
"""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, ImageOps, ImageChops

root = Path(__file__).resolve().parent
source = root / 'source' / 'system-cc0'
destination = root / 'materials'
destination.mkdir(exist_ok=True)
assets = [
    'clothes/male_casualsuit01/male_casualsuit01',
    'clothes/male_casualsuit03/male_casualsuit03',
    'clothes/female_elegantsuit01/female_elegantsuit01',
    'clothes/shoes04/shoes04',
    'hair/short04/short04', 'hair/short02/short02',
    'hair/ponytail01/ponytail01', 'hair/braid01/braid01',
    'eyes/materials/brown',
    'eyebrows/eyebrow001/eyebrow001',
    'eyelashes/eyelashes01/eyelashes01',
]
records = []
variants = [(asset, Path(asset).stem) for asset in assets]
variants.append(('clothes/male_casualsuit03/male_casualsuit03', 'elder-shirt'))
for asset, identifier in variants:
    material = source / (asset + '.mhmat')
    params = {}
    for line in material.read_text(encoding='utf-8').splitlines():
        parts = line.strip().split(maxsplit=1)
        if len(parts) == 2:
            params[parts[0]] = parts[1]
    diffuse = material.parent / params['diffuseTexture']
    color_file = destination / (identifier + '-color.webp')
    image = Image.open(diffuse).convert('RGBA')
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    if identifier in ('braid01', 'short02'):
        alpha = image.getchannel('A')
        image = ImageOps.colorize(ImageOps.grayscale(image), '#585953', '#d6d3c6').convert('RGBA')
        image.putalpha(alpha)
    if identifier == 'elder-shirt':
        alpha = image.getchannel('A')
        red, green, blue, _ = image.split()
        shirt_mask = ImageChops.subtract(red, green).point(lambda value: min(255, value * 14))
        sage = ImageOps.colorize(ImageOps.grayscale(image), '#14251d', '#c1cfaf').convert('RGBA')
        image = Image.composite(sage, image, shirt_mask)
        image.putalpha(alpha)
    if identifier == 'brown':
        alpha = image.getchannel('A')
        red, green, blue, _ = image.split()
        iris_mask = ImageChops.subtract(red, green).point(lambda value: min(255, value * 9))
        umber = ImageOps.colorize(ImageOps.grayscale(image), '#090a08', '#bbaa84').convert('RGBA')
        image = Image.composite(umber, image, iris_mask)
        image.putalpha(alpha)
    image.save(color_file, 'WEBP', quality=87, method=6)
    normal_file = destination / (identifier + '-normal.webp')
    if 'normalmapTexture' in params:
        normal = Image.open(material.parent / params['normalmapTexture']).convert('RGB')
        normal.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    else:
        normal = Image.new('RGB', (8, 8), (128, 128, 255))
    normal.save(normal_file, 'WEBP', quality=95, method=6)
    records.append({
        'id': identifier, 'asset': asset,
        'sourceMaterial': material.relative_to(root).as_posix(),
        'sourceDiffuse': diffuse.relative_to(root).as_posix(),
        'color': f'/assets/models/materials/{identifier}-color.webp',
        'normal': f'/assets/models/materials/{identifier}-normal.webp',
        'colorBytes': color_file.stat().st_size,
        'normalBytes': normal_file.stat().st_size,
        'sourceSha256': sha256(diffuse.read_bytes()).hexdigest(),
        'colorSha256': sha256(color_file.read_bytes()).hexdigest(),
        'normalSha256': sha256(normal_file.read_bytes()).hexdigest(),
    })
(root / 'character-materials.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print(json.dumps({'runtimeBytes': sum(r['colorBytes'] + r['normalBytes'] for r in records), 'materials': len(records)}))
