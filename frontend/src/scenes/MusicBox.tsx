import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneProps } from '../types';

type V3 = [number, number, number];
type Surface = THREE.Material;

function walnutMaps() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const b = document.createElement('canvas'); b.width = 1024; b.height = 512;
  const ctx = c.getContext('2d')!, bump = b.getContext('2d')!;
  const image = ctx.createImageData(1024, 512), height = bump.createImageData(1024, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const wave = y + 13 * Math.sin(x * .0044 + y * .008) + 4 * Math.sin(x * .013 + y * .026);
    const ribbons = Math.sin(wave * .12) * .45 + Math.sin(wave * .7 + Math.sin(x * .002)) * .18;
    const pores = Math.sin(wave * 2.75 + Math.sin(x * .012) * 2) * .13;
    const curl = Math.sin(Math.hypot((x - 670) * .12, (y - 175) * .6) * .46) * Math.exp(-Math.pow((y - 175) / 125, 2)) * .16;
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = ribbons + pores + curl + n * .065, i = (y * 1024 + x) * 4;
    image.data[i] = 83 + v * 31; image.data[i + 1] = 47 + v * 21; image.data[i + 2] = 28 + v * 15; image.data[i + 3] = 255;
    const h = 125 + pores * 68 + n * 14;
    height.data[i] = height.data[i + 1] = height.data[i + 2] = h; height.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); bump.putImageData(height, 0, 0);
  const color = new THREE.CanvasTexture(c), relief = new THREE.CanvasTexture(b);
  color.colorSpace = THREE.SRGBColorSpace;
  for (const t of [color, relief]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { color, relief };
}

function plaqueMap() {
  const c = document.createElement('canvas'); c.width = 768; c.height = 192;
  const x = c.getContext('2d')!; x.fillStyle = '#c7ac6b'; x.fillRect(0, 0, 768, 192);
  x.strokeStyle = '#6f552b'; x.lineWidth = 2; x.strokeRect(14, 14, 740, 164); x.strokeRect(21, 21, 726, 150);
  x.fillStyle = '#4d3b23'; x.textAlign = 'center'; x.font = '34px Georgia'; x.fillText('M E M O R Y B O X', 384, 91);
  x.font = '18px Georgia'; x.fillText('A  M O M E N T  K E P T  I N  T I M E', 384, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function useSurfaces() {
  const materials = useMemo(() => {
    const wood = walnutMaps(), plaque = plaqueMap();
    return {
      wood: new THREE.MeshPhysicalMaterial({ map: wood.color, bumpMap: wood.relief, bumpScale: .003, color: '#dfc2a0', roughness: .38, clearcoat: .4, clearcoatRoughness: .28 }),
      ebony: new THREE.MeshPhysicalMaterial({ map: wood.color, color: '#4b382a', roughness: .28, clearcoat: .85, clearcoatRoughness: .17 }),
      edge: new THREE.MeshPhysicalMaterial({ map: wood.color, color: '#a67a4e', roughness: .3, clearcoat: .8, clearcoatRoughness: .22 }),
      brass: new THREE.MeshStandardMaterial({ color: '#cfa95f', metalness: .9, roughness: .35, envMapIntensity: 1.5 }),
      gold: new THREE.MeshStandardMaterial({ color: '#e4c581', metalness: .96, roughness: .2, envMapIntensity: 1.3 }),
      aged: new THREE.MeshStandardMaterial({ color: '#6d542c', metalness: .88, roughness: .43 }),
      steel: new THREE.MeshStandardMaterial({ color: '#bdc5c7', metalness: 1, roughness: .24, envMapIntensity: 1.3 }),
      blueSteel: new THREE.MeshStandardMaterial({ color: '#657a83', metalness: 1, roughness: .28 }),
      velvet: new THREE.MeshPhysicalMaterial({ color: '#41151d', roughness: .96, metalness: 0, sheen: 1, sheenColor: '#8c3e4d', sheenRoughness: .8 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: '#f2e7d4', roughness: .23, metalness: .35, clearcoat: 1, iridescence: .75, iridescenceIOR: 1.34, iridescenceThicknessRange: [190, 410] }),
      crystal: new THREE.MeshPhysicalMaterial({ color: '#d99298', roughness: .18, metalness: .28, clearcoat: 1, ior: 1.54, iridescence: .18, flatShading: true, side: THREE.DoubleSide }),
      enamel: new THREE.MeshPhysicalMaterial({ color: '#284d3b', roughness: .25, metalness: .45, clearcoat: 1, side: THREE.DoubleSide }),
      portal: new THREE.MeshBasicMaterial({ color: '#ffe2ae', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      jewel: new THREE.MeshPhysicalMaterial({ color: '#692d2b', roughness: .12, metalness: .38, clearcoat: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#d3e6dc', transparent: true, opacity: .15, ior: 1.48, roughness: .08, metalness: .2, clearcoat: 1, depthWrite: false }),
      paper: new THREE.MeshStandardMaterial({ color: '#e5d1a1', roughness: .94 }),
      red: new THREE.MeshStandardMaterial({ color: '#8d2d30', roughness: .94 }),
      plaque: new THREE.MeshStandardMaterial({ map: plaque, color: '#e1c991', metalness: .65, roughness: .38 }),
      maps: [wood.color, wood.relief, plaque],
    };
  }, []);
  useEffect(() => () => { for (const [key, m] of Object.entries(materials)) if (key !== 'maps' && m instanceof THREE.Material) m.dispose(); materials.maps.forEach(t => t.dispose()); }, [materials]);
  return materials;
}
type Materials = ReturnType<typeof useSurfaces>;

function Block({ p = [0, 0, 0], s, material, r = .025, rotation = [0, 0, 0], name }: { p?: V3; s: V3; material: Surface; r?: number; rotation?: V3; name?: string }) {
  return <RoundedBox name={name} position={p} rotation={rotation} args={s} radius={Math.max(.001, Math.min(r, ...s.map(n => n / 3)))} smoothness={3} material={material} castShadow receiveShadow />;
}
function Cylinder({ p = [0, 0, 0], radius, height, material, rotation = [0, 0, 0], top }: { p?: V3; radius: number; top?: number; height: number; material: Surface; rotation?: V3 }) {
  return <mesh position={p} rotation={rotation} material={material} castShadow receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, 40]} /></mesh>;
}
function Ring({ p = [0, 0, 0], radius, tube = .009, material, rotation = [Math.PI / 2, 0, 0], scale }: { p?: V3; radius: number; tube?: number; material: Surface; rotation?: V3; scale?: V3 }) {
  return <mesh position={p} rotation={rotation} scale={scale} material={material} castShadow><torusGeometry args={[radius, tube, 8, 64]} /></mesh>;
}
function Screw({ p, material, rotation = [0, 0, 0], size = 1 }: { p: V3; material: Surface; rotation?: V3; size?: number }) {
  return <group position={p} rotation={rotation} scale={size}><Cylinder radius={.035} height={.018} material={material} /><Block p={[0, .0105, 0]} s={[.049, .0025, .007]} material={darkSlot} r={.001} /></group>;
}
const darkSlot = new THREE.MeshStandardMaterial({ color: '#211b11', metalness: .4, roughness: .7 });

function Stroke({ points, material, radius = .009 }: { points: V3[]; material: Surface; radius?: number }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 40, radius, 6, false), [points, radius]);
  return <mesh geometry={geometry} material={material} castShadow />;
}

function Filigree({ p, material, scale = 1, top = false, mirror = false }: { p: V3; material: Surface; scale?: number; top?: boolean; mirror?: boolean }) {
  const geometry = useMemo(() => {
    const curves: V3[][] = [
    [[0, 0, 0], [.15, .09, 0], [.43, .06, 0], [.56, .21, 0], [.51, .38, 0], [.34, .34, 0], [.37, .23, 0], [.43, .25, 0]],
    [[.04, -.025, 0], [.27, -.13, 0], [.56, -.12, 0], [.75, .03, 0], [.76, .16, 0], [.66, .16, 0]],
    [[.16, .045, 0], [.19, .24, 0], [.08, .39, 0], [-.08, .35, 0], [-.07, .24, 0], [0, .22, 0]],
    ];
    const parts: THREE.BufferGeometry[] = curves.map((points, i) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v))), 36, i ? .0065 : .009, 5, false));
    for (let i = 0; i < 5; i++) {
      const g = new THREE.SphereGeometry(1, 10, 6);
      g.scale(.022, .065, .007); g.rotateZ(-.75 + i * .16); g.translate(.18 + i * .095, -.045 - Math.sin(i * .6) * .045, .003); parts.push(g);
    }
    const merged = mergeGeometries(parts); parts.forEach(g => g.dispose()); return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={p} rotation={top ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} scale={[mirror ? -scale : scale, scale, scale]} geometry={geometry} material={material} castShadow />;
}

function PearlVine({ p, scale = 1, mirror = false, top = false, m }: { p: V3; scale?: number; mirror?: boolean; top?: boolean; m: Materials }) {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
      const leaf = new THREE.Shape(), x = i * .14;
      leaf.moveTo(0, -.092); leaf.quadraticCurveTo(.067, -.012, 0, .092); leaf.quadraticCurveTo(-.067, -.012, 0, -.092);
      const g = new THREE.ExtrudeGeometry(leaf, { depth: .003, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1, curveSegments: 7 });
      g.scale(1 + i * .025, 1 - i * .04, 1); g.rotateZ(side * -.68);
      g.translate(x + side * .012, Math.sin(x * 3) * .08 + side * .068, .004); parts.push(g);
    }
    const merged = mergeGeometries(parts); parts.forEach(g => g.dispose()); return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={p} scale={[mirror ? -scale : scale, scale, scale]} rotation={top ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
    <Stroke points={[[0, 0, 0], [.3, .07, 0], [.6, .08, 0], [.94, -.01, 0]]} material={m.gold} radius={.004} />
    <mesh geometry={geometry} material={m.pearl} />
  </group>;
}

function Foot({ x, z, m }: { x: number; z: number; m: Materials }) {
  const profile = useMemo(() => [[.15, 0], [.20, .028], [.19, .06], [.115, .115], [.10, .19], [.17, .24], [.16, .29]].map(([r, y]) => new THREE.Vector2(r, y)), []);
  return <group position={[x, .015, z]}><mesh material={m.aged} castShadow><latheGeometry args={[profile, 40]} /></mesh><Ring p={[0, .054, 0]} radius={.181} tube={.012} material={m.gold} /><Ring p={[0, .235, 0]} radius={.15} tube={.011} material={m.gold} />{[0, 1, 2, 3, 4, 5].map(i => <group key={i} rotation={[0, i * Math.PI / 3, 0]}><Block p={[.113, .16, 0]} s={[.018, .11, .028]} material={m.brass} r={.009} rotation={[0, 0, -.24]} /></group>)}</group>;
}

function Body({ m }: { m: Materials }) {
  return <group name="musicbox-hollow-walnut-case">
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Foot key={`${x}${z}`} x={x * 1.7} z={z * 1.02} m={m} />))}
    <Block p={[0, .31, 0]} s={[4.36, .16, 2.94]} material={m.ebony} r={.09} />
    <Block p={[0, .395, 0]} s={[4.26, .075, 2.84]} material={m.gold} r={.045} />
    <Block p={[0, .455, 0]} s={[4.22, .10, 2.80]} material={m.wood} r={.05} />
    <Block p={[0, .53, 0]} s={[3.98, .12, 2.56]} material={m.velvet} r={.055} />
    <Block p={[0, .895, 1.414]} s={[3.68, .49, .018]} material={m.ebony} r={.08} />
    {[-1, 1].map(side => <group key={side}>
      <Block p={[0, .90, side * 1.31]} s={[4.15, .80, .18]} material={m.wood} r={.045} />
      <Block p={[side * 1.985, .90, 0]} s={[.18, .80, 2.54]} material={m.wood} r={.045} />
      <Block p={[0, 1.303, side * 1.30]} s={[4.20, .055, .16]} material={m.edge} r={.022} />
      <Block p={[side * 2.00, 1.303, 0]} s={[.16, .055, 2.60]} material={m.edge} r={.022} />
      <Block p={[0, 1.39, side * 1.30]} s={[4.18, .18, .18]} material={m.ebony} r={.035} />
      <Block p={[side * 2.00, 1.39, 0]} s={[.18, .18, 2.60]} material={m.ebony} r={.035} />
      <Block p={[0, 1.48, side * 1.30]} s={[4.22, .018, .18]} material={m.brass} r={.005} />
      <Block p={[side * 2.00, 1.48, 0]} s={[.18, .018, 2.60]} material={m.brass} r={.005} />
      <Block p={[0, .535, side * 1.410]} s={[4.02, .018, .010]} material={m.brass} r={.003} />
      <Block p={[0, 1.20, side * 1.410]} s={[4.02, .012, .010]} material={m.brass} r={.002} />
      <Block p={[side * 2.081, .535, 0]} s={[.010, .018, 2.54]} material={m.brass} r={.003} />
      <Block p={[side * 2.081, 1.20, 0]} s={[.010, .012, 2.54]} material={m.brass} r={.002} />
      <Block p={[side * 2.025, .90, side * 1.29]} s={[.12, .77, .12]} material={m.aged} r={.035} />
      <Block p={[0, 1.12, side * 1.203]} s={[3.77, .45, .038]} material={m.velvet} r={.014} />
      <Block p={[side * 1.88, 1.12, 0]} s={[.035, .45, 2.35]} material={m.velvet} r={.014} />
      <PearlVine p={[side * .43, .91, 1.438]} mirror={side < 0} scale={1.35} m={m} />
      <Filigree p={[side * 1.23, .69, 1.431]} mirror={side > 0} scale={.53} material={m.brass} />
      <group position={[side * 2.082, .8, 0]} rotation={[0, side * Math.PI / 2, 0]}><Filigree p={[-.65, -.01, 0]} scale={1.35} material={m.brass} /></group>
    </group>)}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * 1.94, .91, z * 1.405]}><Block s={[.075, .65, .015]} material={m.brass} r={.013} /><Screw p={[0, .25, .017]} material={m.gold} rotation={[Math.PI / 2, 0, 0]} size={.63} /><Screw p={[0, -.25, .017]} material={m.gold} rotation={[Math.PI / 2, 0, 0]} size={.63} /></group>))}
    <group position={[0, .9, 1.441]}><Block s={[.31, .42, .035]} material={m.aged} r={.09} /><Block p={[0, .016, .022]} s={[.24, .34, .018]} material={m.gold} r={.065} /><mesh position={[0, .055, .035]} material={darkSlot}><circleGeometry args={[.035, 24]} /></mesh><Block p={[0, -.01, .039]} s={[.025, .09, .004]} material={darkSlot} r={.004} />{[-1, 1].map(i => <Screw key={i} p={[0, i * .14, .038]} material={m.brass} size={.45} rotation={[Math.PI / 2, 0, 0]} />)}</group>
  </group>;
}

function Hinge({ x, m }: { x: number; m: Materials }) {
  return <group position={[x, 1.47, -1.36]}>
    <Cylinder radius={.065} height={.46} material={m.gold} rotation={[0, 0, Math.PI / 2]} />
    {[-.16, -.08, 0, .08, .16].map((v, i) => <Ring key={i} p={[v, 0, 0]} radius={.067} tube={.005} material={m.aged} rotation={[0, Math.PI / 2, 0]} />)}
    <Block p={[0, -.13, -.017]} s={[.44, .25, .035]} material={m.aged} r={.035} />
    {[-1, 1].map(i => <Screw key={i} p={[i * .14, -.16, -.041]} material={m.gold} size={.65} rotation={[-Math.PI / 2, 0, 0]} />)}
  </group>;
}

function Lid({ m, hinge, open }: { m: Materials; hinge: React.RefObject<THREE.Group | null>; open: boolean }) {
  return <group ref={hinge} position={[0, 1.50, -1.35]} name="musicbox-articulated-lid">
    <Block p={[0, .03, 1.35]} s={[4.36, .16, 2.94]} material={m.ebony} r={.09} />
    <Block p={[0, .112, 1.35]} s={[4.28, .035, 2.86]} material={m.gold} r={.035} />
    <Block p={[0, .178, 1.35]} s={[4.24, .10, 2.82]} material={m.wood} r={.06} />
    <Block p={[0, .24, 1.35]} s={[3.97, .055, 2.55]} material={m.edge} r={.065} />
    <Block p={[0, .272, 1.35]} s={[3.86, .018, 2.44]} material={m.ebony} r={.055} />
    <Block p={[0, .286, 1.35]} s={[3.78, .018, 2.36]} material={m.wood} r={.05} />
    {[-1, 1].map(side => <group key={side}><Block p={[0, .3, 1.35 + side * 1.075]} s={[3.52, .008, .014]} material={m.brass} r={.002} /><Block p={[side * 1.76, .3, 1.35]} s={[.014, .008, 2.16]} material={m.brass} r={.002} /><Filigree p={[side * .68, .309, .75]} scale={1.25} top mirror={side < 0} material={m.gold} /><PearlVine p={[side * .64, .312, 1.63]} scale={1.03} top mirror={side < 0} m={m} /></group>)}
    <group position={[0, .307, 1.35]}>
      <Cylinder radius={.59} height={.016} material={m.aged} /><Cylinder p={[0, .01, 0]} radius={.54} height={.012} material={m.ebony} />
      <Ring p={[0, .02, 0]} radius={.54} tube={.008} material={m.gold} /><Ring p={[0, .021, 0]} radius={.46} tube={.005} material={m.brass} />
      {Array.from({ length: 8 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 4, 0]}><mesh position={[0, .029, .245]} rotation={[-Math.PI / 2, 0, 0]} scale={[.068, .19, .008]} material={m.pearl}><sphereGeometry args={[1, 18, 12]} /></mesh><Block p={[0, .034, .41]} s={[.012, .007, .075]} material={m.gold} r={.002} /></group>)}
      <Cylinder p={[0, .035, 0]} radius={.078} height={.018} material={m.gold} /><Cylinder p={[0, .046, 0]} radius={.044} height={.014} material={m.aged} />
    </group>
    <Block p={[0, -.07, 1.35]} s={[3.98, .055, 2.57]} material={m.edge} r={.07} />
    <Block p={[0, -.105, 1.35]} s={[3.76, .035, 2.35]} material={m.velvet} r={.08} />
    <Cylinder p={[0, -.133, 1.35]} radius={1} height={.023} material={m.aged} />
    {open && <mesh position={[0, -.15, 1.35]} scale={[1.62, .94, 1]} rotation={[Math.PI / 2, 0, 0]} name="musicbox-actual-planar-mirror"><circleGeometry args={[1, 96]} /><MeshReflectorMaterial resolution={256} mirror={.84} mixBlur={0} mixStrength={.55} roughness={.09} color="#cbd1c5" metalness={.72} depthScale={0} reflectorOffset={.004} /></mesh>}
    <Ring p={[0, -.154, 1.35]} radius={1} tube={.022} scale={[1.66, .96, 1]} material={m.gold} />
    <Ring p={[0, -.156, 1.35]} radius={1} tube={.0055} scale={[1.71, 1.01, 1]} material={m.pearl} />
    {[-1, 1].map(side => <group key={side}><Block p={[side * 1.80, -.159, 1.35]} s={[.016, .014, 2.20]} material={m.gold} r={.003} /><Block p={[0, -.16, 1.35 + side * 1.10]} s={[3.61, .014, .016]} material={m.gold} r={.003} /><group position={[side * 1.39, -.168, .43]} rotation={[Math.PI, 0, 0]}><Filigree p={[0, 0, 0]} scale={.53} top mirror={side > 0} material={m.gold} /></group></group>)}
  </group>;
}

function gearGeometry(radius: number, teeth: number, thickness: number) {
  const shape = new THREE.Shape();
  for (let t = 0; t < teeth; t++) for (let j = 0; j < 4; j++) {
    const angle = ((t + (j + .03) / 4) / teeth) * Math.PI * 2;
    const r = radius * (j === 1 || j === 2 ? 1 : .87);
    if (!t && !j) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r); else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  shape.closePath();
  const axle = new THREE.Path(); axle.absarc(0, 0, radius * .12, 0, Math.PI * 2, true); shape.holes.push(axle);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, hole = new THREE.Path();
    hole.absellipse(Math.cos(a) * radius * .54, Math.sin(a) * radius * .54, radius * .15, radius * .20, 0, Math.PI * 2, true, a); shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .003, bevelThickness: .003, curveSegments: 16 });
  g.rotateX(-Math.PI / 2); g.translate(0, -thickness / 2, 0); return g;
}

function Gear({ p, radius, teeth, speed, active, m }: { p: V3; radius: number; teeth: number; speed: number; active: boolean; m: Materials }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => gearGeometry(radius, teeth, .028), [radius, teeth]);
  useFrame((_, dt) => { if (group.current && active) group.current.rotation.y += dt * speed; });
  return <group position={p} ref={group} name={`musicbox-spur-gear-${teeth}`}>
    <mesh geometry={geometry} material={m.brass} castShadow receiveShadow /><Cylinder radius={radius * .22} height={.078} material={m.aged} /><Cylinder p={[0, .044, 0]} radius={radius * .12} height={.018} material={m.steel} /><Screw p={[0, .06, 0]} material={m.gold} size={.6} />
  </group>;
}

function CylinderPins({ m }: { m: Materials }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pins = useMemo(() => {
    const list: { x: number; angle: number }[] = [];
    for (let lane = 0; lane < 36; lane++) for (let note = 0; note < 28; note++) if ((lane * 7 + note * 11 + lane % 5) % 11 < 2) list.push({ x: -.84 + lane * .048, angle: note / 28 * Math.PI * 2 + (lane % 3) * .045 });
    return list;
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
    pins.forEach((pin, i) => {
      const outward = new THREE.Vector3(0, Math.cos(pin.angle), Math.sin(pin.angle));
      dummy.position.set(pin.x, outward.y * .329, outward.z * .329); dummy.quaternion.setFromUnitVectors(up, outward); dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
    }); ref.current.instanceMatrix.needsUpdate = true;
  }, [pins]);
  return <instancedMesh ref={ref} args={[undefined, undefined, pins.length]} material={m.gold} castShadow name="musicbox-individual-cylinder-pins"><cylinderGeometry args={[.009, .011, .034, 7]} /></instancedMesh>;
}

function rectangularPlate(width: number, depth: number, holeWidth: number, holeDepth: number) {
  const outline = (w: number, d: number, r: number) => {
    const path = new THREE.Shape(), x = -w / 2, y = -d / 2;
    path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + d - r); path.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    path.lineTo(x + r, y + d); path.quadraticCurveTo(x, y + d, x, y + d - r);
    path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y); return path;
  };
  const shape = outline(width, depth, .12);
  shape.holes.push(new THREE.Path(outline(holeWidth, holeDepth, .10).getPoints(12).reverse()));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .032, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 2, curveSegments: 12 });
  geometry.rotateX(-Math.PI / 2); return geometry;
}

function Mechanism({ m, active, reducedMotion }: { m: Materials; active: boolean; reducedMotion: boolean }) {
  const drum = useRef<THREE.Group>(null), governor = useRef<THREE.Group>(null), { gl } = useThree();
  const plate = useMemo(() => rectangularPlate(1.38, 2.08, 1.12, 1.68), []);
  useEffect(() => () => plate.dispose(), [plate]);
  useFrame((_, dt) => {
    if (active && !reducedMotion) {
      if (drum.current) drum.current.rotation.x -= dt * .19;
      if (governor.current) governor.current.rotation.y += dt * 1.4;
    }
    if (drum.current) gl.domElement.dataset.cylinderAngle = drum.current.rotation.x.toFixed(3);
  });
  return <group name="musicbox-recessed-jewelled-movement" position={[1.03, 0, -.02]}>
    <Block p={[0, .935, 0]} s={[1.32, .085, 2.02]} material={m.aged} r={.1} />
    <Block p={[0, .983, 0]} s={[1.25, .012, 1.96]} material={m.ebony} r={.08} />
    <mesh position={[0, 1.186, 0]} geometry={plate} material={m.brass} castShadow receiveShadow />
    <Block p={[0, 1.237, 0]} s={[1.105, .012, 1.663]} material={m.glass} r={.075} name="musicbox-fitted-observation-window" />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Screw key={x + ':' + z} p={[x * .595, 1.226, z * .90]} material={m.gold} size={.47} />))}
    {[-1, 1].map(side => <Filigree key={side} p={[side * .597, 1.225, side * .58]} scale={.15} top mirror={side < 0} material={m.gold} />)}
    <group position={[0, 1.022, -.43]} name="musicbox-pinned-cylinder-assembly">
      {[-1, 1].map(side => <group key={side}>
        <Block p={[side * .502, -.026, 0]} s={[.08, .113, .23]} material={m.brass} r={.024} />
        <Cylinder p={[side * .508, .012, 0]} radius={.036} height={.086} material={m.jewel} rotation={[0, 0, Math.PI / 2]} />
      </group>)}
      <Cylinder radius={.018} height={1.10} material={m.steel} rotation={[0, 0, Math.PI / 2]} />
      <group ref={drum}>
        <Cylinder radius={.15} height={.87} material={m.brass} rotation={[0, 0, Math.PI / 2]} />
        {[-1, 1].map(side => <group key={side}>
          <Cylinder p={[side * .448, 0, 0]} radius={.158} height={.022} material={m.gold} rotation={[0, 0, Math.PI / 2]} />
          <Ring p={[side * .461, 0, 0]} radius={.128} tube={.005} rotation={[0, Math.PI / 2, 0]} material={m.aged} />
        </group>)}
        <group scale={[.49, .49, .49]}><CylinderPins m={m} /></group>
      </group>
    </group>
    <group name="musicbox-tuned-steel-comb">
      <Block p={[0, 1.043, .34]} s={[1.025, .055, .15]} material={m.blueSteel} r={.008} />
      <Block p={[0, 1.074, .37]} s={[1.036, .013, .06]} material={m.steel} r={.003} />
      <CombTeeth m={m} />
      {[-.43, 0, .43].map(x => <Screw key={x} p={[x, 1.088, .37]} material={m.gold} size={.45} />)}
    </group>
    <Gear p={[-.28, 1.018, .65]} radius={.17} teeth={32} speed={.32} active={active && !reducedMotion} m={m} />
    <Gear p={[0, 1.018, .56]} radius={.125} teeth={22} speed={-.466} active={active && !reducedMotion} m={m} />
    <Cylinder p={[.263, .974, .65]} radius={.143} height={.065} material={m.aged} />
    <Gear p={[.263, 1.018, .65]} radius={.155} teeth={26} speed={.395} active={active && !reducedMotion} m={m} />
    <group ref={governor} position={[.435, 1.059, .065]}>
      <Cylinder radius={.052} height={.08} material={m.aged} />
      <Block p={[0, .043, 0]} s={[.16, .012, .033]} material={m.steel} r={.005} />
      <Cylinder p={[0, .054, 0]} radius={.026} height={.017} material={m.gold} />
    </group>
    <mesh position={[0, 1.227, .933]} rotation={[-Math.PI / 2, 0, 0]} material={m.plaque}><planeGeometry args={[.91, .17]} /></mesh>
  </group>;
}

function CombTeeth({ m }: { m: Materials }) {
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 44; i++) {
      const length = .54 + (43 - i) / 43 * .07, g = new THREE.BoxGeometry(.015, .009, length);
      g.translate(-.455 + i * .0212, 1.058, .29 - length / 2); pieces.push(g);
    }
    const merged = mergeGeometries(pieces); pieces.forEach(g => g.dispose()); return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={m.steel} castShadow receiveShadow />;
}

function rosePetalGeometry() {
  const geometry = new THREE.BufferGeometry(), positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows = 10, columns = 8;
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
    const t = r / rows, w = c / columns * 2 - 1, width = Math.pow(Math.sin(Math.PI * t * .88), .65) * .18;
    positions.push(w * width, .26 * Math.sin(t * Math.PI * .58) + .06 * w * w * t, t * .39 - .055 * w * w * t * t);
    uvs.push(c / columns, t);
    if (r < rows && c < columns) {
      const i = r * (columns + 1) + c;
      indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function CrystalRose({ m, active, reducedMotion }: { m: Materials; active: boolean; reducedMotion: boolean }) {
  const sculpture = useRef<THREE.Group>(null), lift = useRef<THREE.Group>(null);
  const leafGeometry = useMemo(() => rosePetalGeometry(), []);
  const geometry = useMemo(() => {
    const original = rosePetalGeometry(), pieces: THREE.BufferGeometry[] = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = [9, 7, 5][layer], scale = [1, .73, .48][layer];
      for (let i = 0; i < count; i++) {
        const g = original.clone();
        g.scale(scale, 1 + layer * .2, scale); g.rotateX(-layer * .23);
        g.rotateY(i / count * Math.PI * 2 + layer * .38); g.translate(0, layer * .045, 0); pieces.push(g);
      }
    }
    const merged = mergeGeometries(pieces); original.dispose(); pieces.forEach(g => g.dispose()); return merged;
  }, []);
  useEffect(() => () => { geometry.dispose(); leafGeometry.dispose(); }, [geometry, leafGeometry]);
  useFrame((_, dt) => {
    if (sculpture.current && active && !reducedMotion) sculpture.current.rotation.y += dt * .13;
    if (lift.current) lift.current.scale.y = reducedMotion ? (active ? 1 : .08) : THREE.MathUtils.damp(lift.current.scale.y, active ? 1 : .08, 3, dt);
  });
  return <group position={[-.79, 1.107, -.04]} name="musicbox-rising-crystal-rose">
    <Cylinder radius={.625} height={.06} material={m.aged} />
    <Cylinder p={[0, .043, 0]} radius={.59} height={.03} material={m.gold} />
    <Cylinder p={[0, .066, 0]} radius={.543} height={.018} material={m.ebony} />
    <Ring p={[0, .077, 0]} radius={.492} tube={.006} material={m.pearl} />
    <group ref={lift} scale={[1, .08, 1]} position={[0, .08, 0]}>
      <Cylinder p={[0, .028, 0]} radius={.36} top={.33} height={.05} material={m.brass} />
      <Cylinder p={[0, .061, 0]} radius={.30} height={.022} material={m.pearl} />
      <group ref={sculpture}>
        <Stroke points={[[0, .065, 0], [-.07, .22, .025], [.035, .38, -.015], [0, .57, 0]]} material={m.gold} radius={.017} />
        <group position={[-.035, .29, .015]} rotation={[-.9, -.7, -.55]}>
          <mesh scale={[.65, .55, .65]} geometry={leafGeometry} material={m.enamel} castShadow />
        </group>
        <group position={[.008, .37, 0]} rotation={[-.75, 2.2, .4]}>
          <mesh scale={[.57, .48, .56]} geometry={leafGeometry} material={m.enamel} castShadow />
        </group>
        <mesh position={[0, .56, 0]} geometry={geometry} material={m.crystal} castShadow />
        <mesh position={[0, .71, 0]} rotation={[0, .3, 0]} material={m.crystal} castShadow><icosahedronGeometry args={[.067, 1]} /></mesh>
        <Ring p={[0, .55, 0]} radius={.075} tube={.009} material={m.gold} />
      </group>
    </group>
  </group>;
}

function Interior({ m, active, reducedMotion }: { m: Materials; active: boolean; reducedMotion: boolean }) {
  return <group name="musicbox-velvet-jewel-tray">
    <Block p={[0, .882, 0]} s={[3.77, .10, 2.32]} material={m.ebony} r={.045} />
    <Block p={[-.795, 1.041, 0]} s={[2.15, .10, 2.30]} material={m.ebony} r={.04} />
    <Block p={[-.795, 1.099, 0]} s={[2.15, .024, 2.27]} material={m.velvet} r={.04} />
    {[-1, 1].map(side => <Block key={side} p={[1.03, 1.099, side * 1.085]} s={[1.56, .024, .105]} material={m.velvet} r={.025} />)}
    <Block p={[1.79, 1.099, 0]} s={[.14, .024, 2.27]} material={m.velvet} r={.025} />
    {[-1, 1].map(side => <group key={side}>
      <Block p={[side * 1.82, 1.126, 0]} s={[.018, .022, 2.16]} material={m.gold} r={.005} />
      <Block p={[0, 1.126, side * 1.08]} s={[3.64, .022, .018]} material={m.gold} r={.005} />
      <Filigree p={[side < 0 ? -1.68 : -.13, 1.132, side * .84]} scale={.36} top mirror={side < 0} material={m.brass} />
    </group>)}
    <CrystalRose m={m} active={active} reducedMotion={reducedMotion} />
    <Mechanism m={m} active={active} reducedMotion={reducedMotion} />
  </group>;
}

function TimePortal({ m, reducedMotion }: { m: Materials; reducedMotion: boolean }) {
  const petals = useRef<THREE.InstancedMesh>(null), halo = useRef<THREE.Group>(null), glow = useRef<THREE.ShaderMaterial>(null), started = useRef(performance.now()), { gl } = useThree();
  const geometry = useMemo(() => rosePetalGeometry(), []), dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const elapsed = reducedMotion ? 0 : (performance.now() - started.current) / 1000;
    const progress = reducedMotion ? 1 : Math.min(elapsed / 2.6, 1), bloom = THREE.MathUtils.smoothstep(progress, .12, .83);
    gl.domElement.dataset.portalProgress = progress.toFixed(3);
    if (glow.current) { glow.current.uniforms.time.value = elapsed; glow.current.uniforms.bloom.value = bloom; }
    if (halo.current) {
      halo.current.scale.setScalar(Math.max(.001, bloom));
      halo.current.rotation.z = elapsed * .10;
    }
    if (petals.current) {
      for (let i = 0; i < 64; i++) {
        const t = i / 64, angle = t * Math.PI * 2 + elapsed * .25;
        const radius = (.12 + bloom * .73) * (1 + Math.sin(i * 2.4) * .075);
        dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * .95 + (1 - bloom) * -.52, Math.sin(i * 3.7 + elapsed) * .075);
        dummy.rotation.set(i * .7 + elapsed * .15, i * .53, angle + Math.PI / 2);
        dummy.scale.setScalar((.045 + Math.sin(i * 5.7) * .01) * bloom);
        dummy.updateMatrix(); petals.current.setMatrixAt(i, dummy.matrix);
      }
      petals.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <group position={[-.79, 2.65, .03]} rotation={[0, .17, 0]} name="musicbox-petal-time-gate">
    <group ref={halo} scale={.001}>
      <Ring radius={.82} tube={.004} material={m.portal} rotation={[0, 0, 0]} />
      <Ring radius={.89} tube={.0025} material={m.portal} rotation={[0, 0, 0]} />
      <Ring radius={.77} tube={.0018} material={m.portal} rotation={[0, 0, 0]} />
    </group>
    <mesh position={[0, 0, -.025]}>
      <planeGeometry args={[1.92, 1.92]} />
      <shaderMaterial ref={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}
        uniforms={{ time: { value: 0 }, bloom: { value: 0 } }}
        vertexShader={'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }'}
        fragmentShader={'varying vec2 vUv; uniform float time; uniform float bloom; void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x);float rim=exp(-pow((r-.87)*23.,2.));float haze=exp(-pow((r-.87)*7.,2.))*.24;float swirl=(.5+.5*sin(r*46.-time*1.7+a*2.))*exp(-pow((r-.72)*5.,2.))*.09;float mist=(1.-smoothstep(.1,.95,r))*.42*bloom*bloom;float alpha=(rim*.7+haze+swirl+mist)*bloom*(1.-smoothstep(.95,1.,r));gl_FragColor=vec4(mix(vec3(.95,.62,.35),vec3(1.,.92,.72),rim),alpha); }'} />
    </mesh>
    <instancedMesh ref={petals} args={[geometry, m.portal, 64]} frustumCulled={false} name="musicbox-spiralling-memory-petals" />
    <pointLight position={[0, -.1, .30]} intensity={4} color="#ffd8ab" distance={4} />
  </group>;
}

function WindingKey({ m, active, reducedMotion }: { m: Materials; active: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current && active && !reducedMotion) ref.current.rotation.x += dt * .07; });
  return <group position={[2.10, .91, .60]} name="musicbox-winding-key">
    <Cylinder radius={.095} height={.07} material={m.aged} rotation={[0, 0, Math.PI / 2]} /><Cylinder p={[.12, 0, 0]} radius={.038} height={.23} material={m.gold} rotation={[0, 0, Math.PI / 2]} />
    <group ref={ref} position={[.29, 0, 0]}><Cylinder radius={.064} height={.12} material={m.brass} rotation={[0, 0, Math.PI / 2]} /><Ring p={[.065, 0, -.125]} radius={.115} tube={.028} material={m.gold} rotation={[0, Math.PI / 2, 0]} scale={[1.17, 1, 1]} /><Ring p={[.065, 0, .125]} radius={.115} tube={.028} material={m.gold} rotation={[0, Math.PI / 2, 0]} scale={[1.17, 1, 1]} /><Block p={[.065, 0, 0]} s={[.05, .10, .12]} material={m.gold} r={.015} /></group>
  </group>;
}

function Keepsakes({ m }: { m: Materials }) {
  return <group name="musicbox-collected-letter-and-red-keepsake" position={[-.88, 1.133, .83]} rotation={[0, -.12, 0]}>
    <Block s={[.87, .025, .36]} material={m.paper} r={.014} />
    <Stroke points={[[-.40, .014, -.16], [0, .019, .055], [.40, .014, -.16]]} material={m.aged} radius={.002} />
    <Cylinder p={[0, .025, .06]} radius={.056} height={.013} material={m.red} />
    <Ring p={[0, .034, .06]} radius={.039} tube={.003} material={m.gold} />
  </group>;
}

export default function MusicBox({ phase, collected, reducedMotion, onBox }: Pick<SceneProps, 'phase' | 'collected' | 'reducedMotion' | 'onBox'>) {
  const m = useSurfaces(), hinge = useRef<THREE.Group>(null), { gl } = useThree();
  const [hover, setHover] = useState(false), open = phase !== 'landing';
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  useFrame((_, dt) => {
    if (!hinge.current) return;
    const target = open ? phase === 'transition-in' ? -1.83 : -1.72 : hover ? -.028 : 0;
    hinge.current.rotation.x = reducedMotion ? target : THREE.MathUtils.damp(hinge.current.rotation.x, target, 3.7, dt);
    gl.domElement.dataset.boxLidAngle = hinge.current.rotation.x.toFixed(3); gl.domElement.dataset.boxOpen = String(open);
  });
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta > 5) return; gl.domElement.dataset.lastAnchorSource = 'mesh:musicbox'; onBox(); };
  return <group position={[.30, 0, 0]} onClick={click} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }} name="original-classical-mechanical-musicbox">
    <Body m={m} /><Interior m={m} active={open} reducedMotion={reducedMotion} /><Lid m={m} hinge={hinge} open={open} />
    {open && <pointLight position={[-.4, 2.4, .8]} intensity={2.2} color="#ffe7c5" distance={4} decay={2} />}
    {[-1.36, 1.36].map(x => <Hinge key={x} x={x} m={m} />)}
    <WindingKey m={m} active={open} reducedMotion={reducedMotion} />
    {[-1, 1].map(i => <group key={i} position={[i * 1.87, 1.12, -.80]}><Block s={[.025, .25, .045]} material={m.gold} r={.009} rotation={[-.5, 0, 0]} /><Screw p={[0, -.13, 0]} material={m.brass} size={.55} /></group>)}
    {collected && open && <Keepsakes m={m} />}
    {phase === 'transition-in' && <TimePortal m={m} reducedMotion={reducedMotion} />}
  </group>;
}
