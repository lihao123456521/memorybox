"""Bake the generated v5 turnarounds onto the existing MakeHuman UVs.

This is an offline reference-guided material pass, not AI image-to-3D. The
photographs were generated first. Anatomical shape and UV topology remain the
MakeHuman CC0 assets; only masked facial colour/detail and garment materials
are baked here. Eyes, eyebrows, hair, glasses and new garment inserts stay
separate meshes/materials. Runtime has no Python/network dependency.
"""
from pathlib import Path
from hashlib import sha256
import json
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[3]
OUT = ROOT / 'reference-materials-v5'
OUT.mkdir(exist_ok=True)
SIZE = 2048
FABRIC_SIZE = 1024
PREVIEWS = '--previews' in sys.argv
PRESETS = {
    'elder-woman': dict(target='asian-female-old', garment='male_casualsuit03', material='elder-shirt',
        eyes=(1492, 1590, 211), nose=(1540, 275), mouth=(1540, 316), chin=(1540, 379), forehead=(1540, 130),
        lips=(1497, 1586), face=(1435, 120, 1647, 392), swatch=(115, 217, 171, 283), side=(1530, 670, 1575, 730),
        top=(133, 144, 126), bottom=(47, 48, 48), kind='knit', elder=True),
    'elder-man': dict(target='asian-male-old', garment='male_casualsuit03', material='male_casualsuit03',
        eyes=(1509, 1601, 177), nose=(1555, 240), mouth=(1556, 283), chin=(1557, 351), forehead=(1555, 104),
        lips=(1512, 1600), face=(1445, 85, 1667, 367), swatch=(132, 187, 188, 247), side=(1550, 680, 1600, 727),
        top=(181, 179, 171), bottom=(43, 50, 61), kind='check', elder=True),
    'young-woman': dict(target='asian-female-young', garment='female_elegantsuit01', material='female_elegantsuit01',
        eyes=(1292, 1388, 212), nose=(1341, 275), mouth=(1341, 319), chin=(1340, 386), forehead=(1340, 135),
        lips=(1299, 1383), face=(1229, 128, 1453, 397), swatch=(72, 224, 122, 278), side=(1390, 705, 1435, 765),
        top=(168, 113, 109), bottom=(43, 49, 59), kind='knit', elder=False),
    'young-man': dict(target='asian-male-young', garment='male_casualsuit01', material='male_casualsuit01',
        eyes=(1470, 1560, 199), nose=(1516, 256), mouth=(1517, 302), chin=(1515, 369), forehead=(1518, 134),
        lips=(1477, 1558), face=(1408, 123, 1630, 385), swatch=(103, 230, 157, 290), side=(1535, 660, 1590, 720),
        top=(53, 75, 104), bottom=(49, 66, 82), kind='twill', elder=False),
}

def read_obj(filename):
    vertices, uvs, faces, groups = [], [], [], {}
    group = ''
    for line in filename.read_text(encoding='utf8').splitlines():
        q = line.strip().split()
        if not q: continue
        if q[0] == 'v': vertices.append([float(v) for v in q[1:4]])
        elif q[0] == 'vt': uvs.append([float(v) for v in q[1:3]])
        elif q[0] == 'g': group = q[1]
        elif q[0] == 'f':
            corners = [[int(c.split('/')[0])-1, int(c.split('/')[1])-1] for c in q[1:]]
            groups.setdefault(group, []).extend(c[0] for c in corners)
            for i in range(1, len(corners)-1): faces.append((group, [corners[0], corners[i], corners[i+1]]))
    return np.asarray(vertices, np.float32), np.asarray(uvs, np.float32), faces, groups

BASE, UV, FACES, GROUPS = read_obj(ROOT/'makehuman-base.obj')
BODY = [corners for group, corners in FACES if group == 'body']

def targeted(name):
    points = BASE.copy()
    for line in (ROOT/'source'/f'{name}.target').read_text(encoding='utf8').splitlines():
        if not line or not line[0].isdigit(): continue
        a = line.split(); points[int(a[0])] += np.asarray(a[1:4], np.float32)
    return points

def uv_point(points, image_uv):
    """Interpolate a hand-checked landmark in the original UV, independent of shape."""
    p = np.asarray([image_uv[0], 1-image_uv[1]], np.float32)
    best = (1e9, None)
    for corners in BODY:
        ids = np.asarray(corners)
        t = UV[ids[:, 1]]
        m = np.column_stack((t[0]-t[2], t[1]-t[2]))
        if abs(np.linalg.det(m)) < 1e-12: continue
        b = np.linalg.solve(m, p-t[2]); w = np.r_[b, 1-b.sum()]
        if w.min() >= -1e-5: return w @ points[ids[:, 0]]
        for vertex, tex in corners:
            d = np.sum((UV[tex]-p)**2)
            if d < best[0]: best = (d, points[vertex])
    return best[1]

def raster_uv(points, texcoords, faces, size):
    """CPU rasterization preserves OBJ per-corner UV seams and supplies world positions."""
    xyz = np.zeros((size, size, 3), np.float32)
    nn = np.zeros_like(xyz)
    mask = np.zeros((size, size), bool)
    for corners in faces:
        ids = np.asarray(corners); p = points[ids[:, 0]]
        uv = texcoords[ids[:, 1]] * (size-1); uv[:, 1] = size-1-uv[:, 1]
        lo = np.maximum(np.floor(uv.min(0)).astype(int), 0); hi = np.minimum(np.ceil(uv.max(0)).astype(int), size-1)
        if np.any(hi < lo): continue
        m = np.column_stack((uv[0]-uv[2], uv[1]-uv[2]))
        if abs(np.linalg.det(m)) < 1e-9: continue
        y, x = np.mgrid[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        sample = np.stack((x, y), -1).astype(np.float32)
        b = (sample-uv[2]) @ np.linalg.inv(m).T
        w = np.concatenate((b, 1-b.sum(-1, keepdims=True)), -1)
        inside = w.min(-1) >= -.002
        target = xyz[lo[1]:hi[1]+1, lo[0]:hi[0]+1]
        target[inside] = (w @ p)[inside]
        n = np.cross(p[1]-p[0], p[2]-p[0]); n /= max(float(np.linalg.norm(n)), 1e-9)
        nn[lo[1]:hi[1]+1, lo[0]:hi[0]+1][inside] = n
        mask[lo[1]:hi[1]+1, lo[0]:hi[0]+1] |= inside
    return xyz, nn, mask

def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)

def bilinear(array, x, y):
    x = np.clip(x, 0, array.shape[1]-1.001); y = np.clip(y, 0, array.shape[0]-1.001)
    ix = x.astype(np.int32); iy = y.astype(np.int32); fx = x-ix; fy = y-iy
    if array.ndim == 3: fx = fx[..., None]; fy = fy[..., None]
    return (array[iy, ix]*(1-fx)+array[iy, ix+1]*fx)*(1-fy)+(array[iy+1, ix]*(1-fx)+array[iy+1, ix+1]*fx)*fy

def blur(array, radius):
    return np.asarray(Image.fromarray(np.clip(array, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius)), np.float32)

def normal_from_height(height, strength, size=None):
    gy, gx = np.gradient(height)
    normal = np.stack((-gx*strength, gy*strength, np.ones_like(gx)), -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    result = Image.fromarray(np.uint8(np.clip((normal*.5+.5)*255, 0, 255)))
    return result.resize((size, size), Image.Resampling.LANCZOS) if size else result

def save_webp(image, filename, quality=90, lossless=False):
    target = OUT/filename
    image.save(target, 'WEBP', quality=quality, method=6, lossless=lossless)
    return {'path': '/assets/models/reference-materials-v5/'+filename, 'bytes': target.stat().st_size,
            'sha256': sha256(target.read_bytes()).hexdigest(), 'size': list(image.size)}

def edge_dilate(image, mask, steps=5):
    """Pad islands before mipmapping; transparent/black backgrounds never bleed onto skin."""
    a = image.copy(); known = mask.copy()
    for _ in range(steps):
        sums = np.zeros_like(a); count = np.zeros(known.shape, np.float32)
        for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
            valid = np.roll(known, (dy,dx), (0,1))
            sums += np.roll(a, (dy,dx), (0,1))*valid[...,None]
            count += valid
        grow = (~known)&(count>0)
        a[grow] = sums[grow]/count[grow,None]; known |= grow
    return a

def face_material(preset, cfg, reference, points):
    source_path = ROOT/'source'/f'{preset}-skin-original.png'
    base_img = Image.open(source_path).convert('RGB').resize((SIZE,SIZE), Image.Resampling.LANCZOS)
    base = np.asarray(base_img, np.float32)
    xyz, normals, uv_mask = raster_uv(points, UV, BODY, SIZE)
    x,y,z = xyz[...,0], xyz[...,1], xyz[...,2]
    # The landmarks are explicit in the original hm08 UV, not guessed from a face rectangle.
    anchors = {k:uv_point(points,p) for k,p in {
        'left_eye':(.836,.550),'right_eye':(.836,.482),'nose':(.880,.516),
        'lip':(.909,.516),'chin':(.958,.516),'forehead':(.777,.516),
        'left_lip':(.908,.536),'right_lip':(.908,.497)}.items()}
    eye = (anchors['left_eye']+anchors['right_eye'])*.5
    photo = np.asarray(reference.convert('RGB'), np.float32)
    eleft, eright, ey = cfg['eyes']; cx = (eleft+eright)*.5
    # Piecewise projection aligns eye, nose, mouth and chin vertically on the actual mesh.
    ys = [anchors[k][1] for k in ('chin','lip','nose')] + [eye[1], anchors['forehead'][1]]
    photo_ys = [cfg[k][1] for k in ('chin','mouth','nose')] + [ey,cfg['forehead'][1]]
    order = np.argsort(ys)
    sy = np.interp(y, np.asarray(ys)[order], np.asarray(photo_ys)[order])
    eye_scale = (eright-eleft)/abs(anchors['right_eye'][0]-anchors['left_eye'][0])
    # Stay at the same camera scale horizontally; lip boundaries are softly retained below.
    sx = cx+x*eye_scale
    sample = bilinear(photo,sx,sy)
    # Sample median cheek colour in the front and profile. Profile is used only for tone,
    # because orthographic side-to-UV transfer without matched cameras would create seams.
    cheek = photo[max(0,int(cfg['nose'][1]-10)):int(cfg['mouth'][1]+10),int(cx-85):int(cx-45)]
    valid_cheek=(cheek[...,0]>cheek[...,1]+7)&(cheek[...,0]>cheek[...,2]+13)
    tone=np.median(cheek[valid_cheek],axis=0) if valid_cheek.any() else np.asarray((205,162,137))
    side=np.asarray(reference.crop(cfg['side']),np.float32)
    valid_side=(side[...,0]>side[...,1]+7)&(side[...,0]>side[...,2]+13)&(side[...,0]>125)
    if valid_side.any(): tone=tone*.85+np.median(side[valid_side],axis=0)*.15
    # Preserve original all-around pores/ears/hands while making the base match the reference.
    original_head=base[(y>eye[1]-.35)&(y<eye[1]-.12)&(z>1)&uv_mask]
    original_tone=np.median(original_head,axis=0)
    # Match chroma conservatively. A raw RGB median subtraction can contaminate
    # untargeted skin if the source sample contains an oral/UV seam island.
    weights=np.asarray((.2126,.7152,.0722),np.float32)
    luma=base@weights
    photo_chroma=tone-float(tone@weights)
    base=np.clip(luma[...,None]+(base-luma[...,None])*.80+photo_chroma*.20,0,255)
    # Conservative photo mask: no hair/background, no eyeballs/brows or spectacle frames.
    skin=(photo[...,0]>photo[...,1]+5)&(photo[...,0]>photo[...,2]+12)&(photo[...,0]>115)
    mask=Image.fromarray((skin*255).astype(np.uint8))
    polygon=Image.new('L',reference.size);d=ImageDraw.Draw(polygon)
    x0,y0,x1,y1=cfg['face'];d.ellipse((x0,y0,x1,y1),fill=255)
    valid=np.minimum(np.asarray(mask),np.asarray(polygon)).astype(np.uint8)
    exclusions=Image.new('L',reference.size);d=ImageDraw.Draw(exclusions)
    for ex in (eleft,eright):
        d.ellipse((ex-35,ey-20,ex+35,ey+20),fill=255)
        d.rectangle((ex-40,ey-52,ex+40,ey-24),fill=255)
    # Continuous exclusion avoids a second eyebrow between the per-eye masks.
    d.rectangle((eleft-55,ey-58,eright+55,ey-20),fill=255)
    if cfg['elder']:
        # Rims/bridge plus their shadow, conservatively excluding covered cheek pixels.
        for ex in (eleft,eright):
            d.ellipse((ex-53,ey-25,ex+53,ey+34),outline=255,width=17)
        d.line((eleft+42,ey-9,eright-42,ey-9),fill=255,width=20)
        d.line((x0-8,ey-12,eleft-42,ey-3),fill=255,width=20)
        d.line((eright+42,ey-3,x1+8,ey-12),fill=255,width=20)
        d.rectangle((eleft-65,ey-28,eright+65,ey+38),fill=255)
    valid[np.asarray(exclusions)>0]=0
    valid=np.asarray(Image.fromarray(valid).filter(ImageFilter.GaussianBlur(3.5)),np.float32)/255
    photo_weight=bilinear(valid,sx,sy)
    # Front-facing only, smoothly fading before the ear and jaw silhouette.
    chin_y=anchors['chin'][1]; forehead_y=anchors['forehead'][1]
    photo_weight*=smooth(.45,1.15,z)*(1-smooth(.65,.90,np.abs(x)))
    photo_weight*=smooth(chin_y-.03,chin_y+.16,y)*(1-smooth(forehead_y-.06,forehead_y+.08,y))*uv_mask
    # Hair crossing the forehead cannot be reliably separated by colour alone.
    # Keep the existing real skin detail there rather than baking loose hair.
    photo_weight*=smooth(ey-53,ey-36,sy)
    photo_weight*=.48
    # Retain subtle camera-derived creases, reduce broad photographic illumination.
    low=bilinear(blur(photo,18),sx,sy)
    cleaned=np.clip(sample*.70+(sample-low)*.25+tone*.30,0,255)
    # Lips are the sole intentional dark feature transferred onto skin; brows/eyes are meshes.
    mouth=np.exp(-(((sx-cfg['mouth'][0])/((cfg['lips'][1]-cfg['lips'][0])*.56))**4+((sy-cfg['mouth'][1])/14)**4))
    photo_weight=np.maximum(photo_weight,mouth*.75*uv_mask*(z>.95)*(y>chin_y))
    result=base*(1-photo_weight[...,None])+cleaned*photo_weight[...,None]
    result=edge_dilate(result,uv_mask,4)
    rgb=Image.fromarray(np.uint8(np.clip(result,0,255)))
    color=save_webp(rgb,preset+'-skin-color.webp',92)
    # Low-amplitude pores and creases; independent normal map has no baked lighting.
    luminance=result@np.asarray((.2126,.7152,.0722),np.float32)
    high=luminance-blur(luminance,2.0)
    normal=save_webp(normal_from_height(high,.075,1024),preset+'-skin-normal.webp',88)
    # A CPU front projection is a useful UV/mapping check; final sign-off is in-engine.
    if PREVIEWS: preview_skin(points,BODY,UV,np.asarray(rgb),OUT/('_'+preset+'-face-preview.png'))
    return dict(id=preset+'-skin',preset=preset,material='skin',color=color['path'],normal=normal['path'],
        colorBytes=color['bytes'],normalBytes=normal['bytes'],colorSha256=color['sha256'],normalSha256=normal['sha256'],
        colorSize=color['size'],normalSize=normal['size'],referenceSkinMedian=np.round(tone,2).tolist(),
        projectedTexels=int((photo_weight>.1).sum()),uvCoveredTexels=int(uv_mask.sum()),
        sourceSkin='source/'+source_path.name,sourceSkinSha256=sha256(source_path.read_bytes()).hexdigest(),
        referenceLandmarks={k:cfg[k] for k in ('eyes','nose','mouth','chin','forehead')},originalSkinMedian=np.round(original_tone,2).tolist(),
        modelFaceLandmarkPositions={k:[float(v) for v in a] for k,a in anchors.items()},
        sourcePhoto=reference_path(preset),sourcePhotoSha256=sha256(Path(reference_path(preset)).read_bytes()).hexdigest(),
        method='Original CC0 UV base + masked landmark-aligned frontal photo tone/creases/lips; profile cheek tone; independent eyes and brows retained',
        limitations='Conservative face mask deliberately omits photograph glasses, brows, hair and eyeballs; not a calibrated photogrammetric identity reconstruction')

def reference_path(preset):
    return str(PROJECT/'docs'/'character-references'/'v5'/(preset+'-turnaround.png'))

def proxy(cfg,points):
    folder=ROOT/'source'/'system-cc0'/'clothes'/cfg['garment']
    header={};rows=[];state='header'
    for line in (folder/(cfg['garment']+'.mhclo')).read_text(encoding='utf8').splitlines():
        q=line.split()
        if not q or q[0].startswith('#'):continue
        if q[0]=='verts':state='verts';continue
        if q[0]=='delete_verts':break
        if state=='verts' and q[0][0].isdigit():rows.append([float(x) for x in q])
        else:header[q[0]]=q[1:]
    scale=[]
    for axis,key in enumerate(('x_scale','y_scale','z_scale')):
        q=header.get(key);scale.append(abs(points[int(q[1]),axis]-points[int(q[0]),axis])/float(q[2]) if q else 1)
    fitted=[]
    for row in rows:
        if len(row)==1:fitted.append(points[int(row[0])])
        else:fitted.append(points[np.asarray(row[:3],int)].T@np.asarray(row[3:6])+np.asarray(row[6:9])*scale)
    _,texcoords,faces,_=read_obj(folder/' '.join(header['obj_file']))
    return np.asarray(fitted,np.float32),texcoords,[corners for _,corners in faces]

def fabric_material(preset,cfg,reference,points):
    fitted,texcoords,faces=proxy(cfg,points)
    xyz,normals,mask=raster_uv(fitted,texcoords,faces,FABRIC_SIZE)
    x,y,z=xyz[...,0],xyz[...,1],xyz[...,2]
    # Reference swatch contributes its actual fine fibre variation; low-frequency folds
    # are removed, and original procedural yarn adds seamless woven structure.
    swatch=np.asarray(reference.crop(cfg['swatch']).convert('RGB').resize((128,128)),np.float32)
    swatch_luma=swatch@np.asarray((.2126,.7152,.0722),np.float32)
    detail=swatch_luma-blur(swatch_luma,5)
    # Blend reflected copies to avoid an abrupt tiled photographic edge.
    detail=(detail+np.flip(detail,0)+np.flip(detail,1)+np.flip(detail,(0,1)))*.25
    v,u=np.mgrid[:FABRIC_SIZE,:FABRIC_SIZE]
    tile=detail[v%128,u%128]
    rng=np.random.default_rng(3907+list(PRESETS).index(preset))
    noise=rng.normal(0,.9,(FABRIC_SIZE,FABRIC_SIZE)).astype(np.float32)
    # Existing garment triangles are measured in source decimetres. A ~1 mm weave
    # occupies ~.01 of these units; coarse pattern remains visible at middle distance.
    circum=np.where(np.abs(normals[...,2])>.45,x,z)
    warp=np.sin(circum*800);weft=np.sin(y*850)
    micro=(warp+weft)*.75+tile*.35+noise*.4
    if cfg['kind']=='knit':
        stitches=(np.cos(circum*360+np.sin(y*480)*.55)+np.sin(y*480))*.85
        relief=stitches+micro*.35
        modulation=relief*1.25
    elif cfg['kind']=='check':
        # Fine muted grey checks, with no red/black source stripe texture remaining.
        major=((np.cos(circum*72)>.82).astype(float)+(np.cos(y*76)>.82).astype(float))
        minor=((np.cos(circum*145)>.90).astype(float)+(np.cos(y*150)>.90).astype(float))
        relief=micro*.55
        modulation=micro*.6-major*9-minor*3
    else:
        relief=np.sin((circum+y)*900)*.7+micro*.5
        modulation=relief+tile*.25
    # Classify whole connected garment surfaces. Arms in the source A-pose can
    # reach the hip height, so a height-only mask would incorrectly darken cuffs.
    pelvis=float(np.mean(points[list(set(GROUPS['joint-pelvis']))],axis=0)[1])
    parent=np.arange(len(fitted))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    for corners in faces:
        a,b,c=[corner[0] for corner in corners]
        parent[find(b)]=find(a);parent[find(c)]=find(a)
    components={}
    for i in range(len(fitted)):components.setdefault(find(i),[]).append(i)
    top_components={k for k,ids in components.items() if fitted[ids,1].max()>pelvis+1.5}
    top_faces=[face for face in faces if find(face[0][0]) in top_components]
    _,_,is_top=raster_uv(fitted,texcoords,top_faces,FABRIC_SIZE)
    if preset=='young-man':
        # This system asset joins shirt/trousers/shoes into a single OBJ surface.
        # Its two documented denim UV islands occupy the middle atlas column;
        # combine that known layout with height to preserve sleeves at the sides.
        denim_islands=(u>FABRIC_SIZE*.36)&(u<FABRIC_SIZE*.74)&(y<pelvis+1.1)
        footwear=y<pelvis-6.4
        is_top=mask&(~denim_islands)&(~footwear)
    colors=np.where(is_top[...,None],np.asarray(cfg['top']),np.asarray(cfg['bottom'])).astype(np.float32)
    # Use the photographed swatch to check palette; cap hue displacement to preserve
    # the chosen semantic colours under the reference's soft studio illumination.
    swatch_median=np.median(swatch.reshape(-1,3),axis=0)
    adjusted=np.asarray(cfg['top'])*.65+swatch_median*.35
    colors[is_top]=adjusted
    # Subtle fabric-scale irregularity, never painted shadows from a studio backdrop.
    large=(np.sin(y*6+x*7)+np.sin(y*15-z*8))*.6
    colors+=(modulation+large)[...,None]
    # The skirt and trousers use their own tighter twill grain and lower contrast.
    colors[~is_top]=np.asarray(cfg['bottom'])+(micro[~is_top]*.42+large[~is_top])[...,None]
    if preset=='young-man':
        # Preserve the original CC0 denim seams, pockets and wear. Only the
        # outer shirt is rebuilt; a plain procedural trouser would lose detail.
        denim=np.asarray(Image.open(ROOT/'materials'/'male_casualsuit01-color.webp').convert('RGB').resize((FABRIC_SIZE,FABRIC_SIZE)),np.float32)
        denim_luma=denim@np.asarray((.2126,.7152,.0722),np.float32)
        jeans=mask&(~is_top)
        grain=(denim_luma-blur(denim_luma,12))*.65
        colors[jeans]=denim[jeans]*.70+np.asarray(cfg['bottom'])*.30+grain[jeans,None]*.20
    colors[~mask]=np.asarray(cfg['top'])
    colors=edge_dilate(colors,mask,6)
    rgb=Image.fromarray(np.uint8(np.clip(colors,0,255)))
    color=save_webp(rgb,preset+'-outfit-color.webp',91)
    height=np.where(is_top,relief,micro*.42)
    height[~mask]=0
    normal=save_webp(normal_from_height(height,.15),preset+'-outfit-normal.webp',88)
    # CPU swatch proof records the real texture output, rather than a claimed shader.
    if PREVIEWS: rgb.save(OUT/('_'+preset+'-outfit-uv.png'))
    return dict(id=preset+'-outfit',preset=preset,material='cc0:'+cfg['material'],color=color['path'],normal=normal['path'],
        colorBytes=color['bytes'],normalBytes=normal['bytes'],colorSha256=color['sha256'],normalSha256=normal['sha256'],
        colorSize=color['size'],normalSize=normal['size'],sourcePhoto=reference_path(preset),
        swatchRectangle=cfg['swatch'],referenceSwatchMedian=np.round(swatch_median,2).tolist(),
        topColor=np.round(adjusted,2).tolist(),bottomColor=cfg['bottom'],uvCoveredTexels=int(mask.sum()),topConnectedComponents=len(top_components),
        method='Original offline woven/knit/twill patterns with reference photo fibre high-pass; actual MHCLO UV/world garment partition; no old red stripe diffuse',
        fabric=cfg['kind'])

def preview_skin(points,faces,texcoords,texture,target):
    """Orthographic CPU z-buffer, for mapping inspection only (no runtime dependency)."""
    size=640; image=np.full((size,size,3),228,np.uint8);depth=np.full((size,size),-1e9,np.float32)
    texture=texture.astype(np.float32)
    # Exact source coordinates keep this independent of GLTF/runtime pose updates.
    head=points[np.asarray([c[0] for f in faces for c in f])]
    ymax=float(head[:,1].max());ymin=ymax-3.0;scale=188
    for corners in faces:
        ids=np.asarray(corners);p=points[ids[:,0]]
        if p[:,1].max()<ymin or p[:,1].min()>ymax:continue
        projected=np.column_stack((size*.5+p[:,0]*scale,40+(ymax-p[:,1])*scale))
        lo=np.maximum(np.floor(projected.min(0)).astype(int),0);hi=np.minimum(np.ceil(projected.max(0)).astype(int),size-1)
        if np.any(hi<lo):continue
        m=np.column_stack((projected[0]-projected[2],projected[1]-projected[2]))
        if abs(np.linalg.det(m))<1e-8:continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];q=np.stack((xx,yy),-1)
        b=(q-projected[2])@np.linalg.inv(m).T;w=np.concatenate((b,1-b.sum(-1,keepdims=True)),-1)
        zz=w@p[:,2];zbuf=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        good=(w.min(-1)>=0)&(zz>zbuf)
        tx=w@texcoords[ids[:,1]];col=bilinear(texture,tx[...,0]*(texture.shape[1]-1),(1-tx[...,1])*(texture.shape[0]-1))
        n=np.cross(p[1]-p[0],p[2]-p[0]);n/=max(float(np.linalg.norm(n)),1e-8)
        lighting=.72+.28*max(0,np.dot(n,np.asarray((-.35,.45,.82))))
        image[lo[1]:hi[1]+1,lo[0]:hi[0]+1][good]=np.uint8(np.clip(col[good]*lighting,0,255));zbuf[good]=zz[good]
    Image.fromarray(image).save(target)

if __name__=='__main__':
    report=[]
    for preset,cfg in PRESETS.items():
        photo=Image.open(reference_path(preset)).convert('RGB')
        points=targeted(cfg['target'])
        report.append(face_material(preset,cfg,photo,points))
        report.append(fabric_material(preset,cfg,photo,points))
        print(preset,'material maps built',flush=True)
    total=sum(row['colorBytes']+row['normalBytes'] for row in report)
    manifest={'version':5,'pipeline':'generated turnarounds first -> manual landmark/mask review -> CPU UV bake -> independent glTF material binding',
              'sourceAttribution':'MakeHuman Community CC0 base/proxy UV assets plus original AI-generated v5 character turnarounds and original procedural fabric patterns',
              'runtimeNetwork':False,'totalBytes':total,'assets':report}
    (ROOT/'reference-materials-v5.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'totalBytes':total,'maps':len(report),'files':len(report)*2},ensure_ascii=False))
