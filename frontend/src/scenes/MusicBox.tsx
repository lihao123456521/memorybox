import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
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
      velvet: new THREE.MeshStandardMaterial({ color: '#132c29', roughness: 1, metalness: 0 }),
      jewel: new THREE.MeshPhysicalMaterial({ color: '#692d2b', roughness: .12, metalness: .38, clearcoat: 1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#d3e6dc', transparent: true, opacity: .19, transmission: .4, thickness: .025, ior: 1.48, roughness: .08, metalness: .02, depthWrite: false }),
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
  const curves: V3[][] = [
    [[0, 0, 0], [.15, .09, 0], [.43, .06, 0], [.56, .21, 0], [.51, .38, 0], [.34, .34, 0], [.37, .23, 0], [.43, .25, 0]],
    [[.04, -.025, 0], [.27, -.13, 0], [.56, -.12, 0], [.75, .03, 0], [.76, .16, 0], [.66, .16, 0]],
    [[.16, .045, 0], [.19, .24, 0], [.08, .39, 0], [-.08, .35, 0], [-.07, .24, 0], [0, .22, 0]],
  ];
  return <group position={p} rotation={top ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} scale={[mirror ? -scale : scale, scale, scale]}>
    {curves.map((points, i) => <Stroke key={i} points={points} material={material} radius={i === 0 ? .009 : .0065} />)}
    {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[.18 + i * .095, -.045 - Math.sin(i * .6) * .045, .003]} rotation={[0, 0, -.75 + i * .16]} scale={[.022, .065, .007]} material={material} castShadow><sphereGeometry args={[1, 12, 8]} /></mesh>)}
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
      <Filigree p={[side * .53, .77, 1.411]} mirror={side < 0} scale={1.55} material={m.brass} />
      <group position={[side * 2.082, .8, 0]} rotation={[0, side * Math.PI / 2, 0]}><Filigree p={[-.65, -.01, 0]} scale={1.35} material={m.brass} /></group>
    </group>)}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}${z}`} position={[x * 1.94, .91, z * 1.405]}><Block s={[.075, .65, .015]} material={m.brass} r={.013} /><Screw p={[0, .25, .017]} material={m.gold} rotation={[Math.PI / 2, 0, 0]} size={.63} /><Screw p={[0, -.25, .017]} material={m.gold} rotation={[Math.PI / 2, 0, 0]} size={.63} /></group>))}
    <group position={[0, .9, 1.425]}><Block s={[.31, .42, .035]} material={m.aged} r={.09} /><Block p={[0, .016, .022]} s={[.24, .34, .018]} material={m.gold} r={.065} /><mesh position={[0, .055, .035]} material={darkSlot}><circleGeometry args={[.035, 24]} /></mesh><Block p={[0, -.01, .039]} s={[.025, .09, .004]} material={darkSlot} r={.004} />{[-1, 1].map(i => <Screw key={i} p={[0, i * .14, .038]} material={m.brass} size={.45} rotation={[Math.PI / 2, 0, 0]} />)}</group>
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
    {[-1, 1].map(side => <group key={side}><Block p={[0, .3, 1.35 + side * 1.075]} s={[3.52, .008, .014]} material={m.brass} r={.002} /><Block p={[side * 1.76, .3, 1.35]} s={[.014, .008, 2.16]} material={m.brass} r={.002} /><Filigree p={[side * .68, .309, .75]} scale={1.25} top mirror={side < 0} material={m.gold} /></group>)}
    <group position={[0, .307, 1.35]}>
      <Cylinder radius={.59} height={.016} material={m.aged} /><Cylinder p={[0, .01, 0]} radius={.54} height={.012} material={m.ebony} />
      <Ring p={[0, .02, 0]} radius={.54} tube={.008} material={m.gold} /><Ring p={[0, .021, 0]} radius={.46} tube={.005} material={m.brass} />
      {Array.from({ length: 8 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 4, 0]}><mesh position={[0, .029, .245]} rotation={[-Math.PI / 2, 0, 0]} scale={[.068, .19, .008]} material={i % 2 ? m.gold : m.edge}><sphereGeometry args={[1, 18, 12]} /></mesh><Block p={[0, .034, .41]} s={[.012, .007, .075]} material={m.gold} r={.002} /></group>)}
      <Cylinder p={[0, .035, 0]} radius={.078} height={.018} material={m.gold} /><Cylinder p={[0, .046, 0]} radius={.044} height={.014} material={m.aged} />
    </group>
    <Block p={[0, -.07, 1.35]} s={[3.98, .055, 2.57]} material={m.edge} r={.07} />
    <Block p={[0, -.105, 1.35]} s={[3.71, .035, 2.30]} material={m.gold} r={.055} />
    <Block p={[0, -.13, 1.35]} s={[3.57, .025, 2.16]} material={m.aged} r={.05} />
    {open && <mesh position={[0, -.146, 1.35]} rotation={[Math.PI / 2, 0, 0]} name="musicbox-actual-planar-mirror"><planeGeometry args={[3.43, 2.02]} /><MeshReflectorMaterial resolution={512} mirror={.85} mixBlur={0} mixStrength={.8} roughness={.09} color="#c7cec3" metalness={.72} depthScale={0} reflectorOffset={.004} /></mesh>}
    {[-1, 1].map(side => <group key={side}><Block p={[side * 1.80, -.159, 1.35]} s={[.025, .014, 2.20]} material={m.gold} r={.004} /><Block p={[0, -.16, 1.35 + side * 1.10]} s={[3.61, .014, .025]} material={m.gold} r={.004} /></group>)}
    <group position={[0, -.174, 2.52]} rotation={[Math.PI, 0, 0]}><Filigree p={[-.5, 0, 0]} scale={.6} top material={m.gold} /><Filigree p={[.5, 0, 0]} scale={.6} top mirror material={m.gold} /></group>
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

function Mechanism({ m, active, reducedMotion }: { m: Materials; active: boolean; reducedMotion: boolean }) {
  const drum = useRef<THREE.Group>(null), governor = useRef<THREE.Group>(null);
  const { gl } = useThree();
  useFrame((_, dt) => {
    if (active && !reducedMotion) { if (drum.current) drum.current.rotation.x -= dt * .19; if (governor.current) governor.current.rotation.y += dt * 3.3; }
    if (drum.current) gl.domElement.dataset.cylinderAngle = drum.current.rotation.x.toFixed(3);
  });
  return <group name="musicbox-real-three-dimensional-clockwork">
    <Block p={[0, .57, -.03]} s={[3.77, .085, 2.19]} material={m.aged} r={.05} /><Block p={[0, .62, -.03]} s={[3.63, .022, 2.05]} material={m.brass} r={.04} />
    {[-1.7, 1.7].flatMap(x => [-.94, .91].map(z => <Screw key={`${x}${z}`} p={[x, .64, z]} material={m.steel} size={1.05} />))}
    <group position={[-.42, .95, -.40]} name="musicbox-pinned-cylinder-assembly">
      {[-1, 1].map(side => <group key={side}>
        <Block p={[side * 1.04, -.17, 0]} s={[.17, .32, .32]} material={m.aged} r={.05} /><Ring p={[side * 1.04, .005, 0]} radius={.085} tube={.022} rotation={[0, Math.PI / 2, 0]} material={m.gold} /><Cylinder p={[side * 1.04, .005, 0]} radius={.046} height={.19} material={m.jewel} rotation={[0, 0, Math.PI / 2]} /><Screw p={[side * 1.04, -.002, .19]} material={m.steel} rotation={[Math.PI / 2, 0, 0]} size={.65} />
      </group>)}
      <Cylinder radius={.028} height={2.49} material={m.steel} rotation={[0, 0, Math.PI / 2]} />
      <group ref={drum}>
        <Cylinder radius={.31} height={1.81} material={m.brass} rotation={[0, 0, Math.PI / 2]} />
        {[-1, 1].map(side => <group key={side}><Cylinder p={[side * .92, 0, 0]} radius={.325} height={.035} material={m.gold} rotation={[0, 0, Math.PI / 2]} /><Ring p={[side * .943, 0, 0]} radius={.27} tube={.008} material={m.aged} rotation={[0, Math.PI / 2, 0]} /></group>)}
        {[-.70, -.35, 0, .35, .70].map(x => <Ring key={x} p={[x, 0, 0]} radius={.311} tube={.0035} material={m.aged} rotation={[0, Math.PI / 2, 0]} />)}
        <CylinderPins m={m} />
      </group>
      <Cylinder p={[1.19, 0, 0]} radius={.115} height={.15} material={m.steel} rotation={[0, 0, Math.PI / 2]} />
      {Array.from({ length: 14 }, (_, i) => <group key={i} position={[1.19, 0, 0]} rotation={[i * Math.PI / 7, 0, 0]}><Block p={[0, .116, 0]} s={[.16, .026, .031]} material={m.aged} r={.003} /></group>)}
    </group>
    <group name="musicbox-tuned-steel-comb" position={[-.42, 0, 0]}>
      <Block p={[0, .69, .78]} s={[1.99, .10, .25]} material={m.blueSteel} r={.012} /><Block p={[0, .746, .85]} s={[2.06, .018, .11]} material={m.steel} r={.004} />
      {Array.from({ length: 44 }, (_, i) => {
        const len = .62 + (43 - i) / 43 * .19;
        return <group key={i} position={[-.936 + i * .0435, .748, .73]} rotation={[-.12, 0, 0]}><Block p={[0, 0, -len / 2]} s={[.032, .014, len]} material={i % 3 ? m.steel : m.blueSteel} r={.003} /><Block p={[0, .007, -len + .045]} s={[.031, .013, .065]} material={m.steel} r={.004} /></group>;
      })}
      {[-.83, 0, .83].map(x => <Screw key={x} p={[x, .765, .85]} material={m.gold} size={.8} />)}
    </group>
    <Gear p={[1.08, .72, -.45]} radius={.34} teeth={32} speed={.32} active={active && !reducedMotion} m={m} />
    <Gear p={[1.49, .77, -.05]} radius={.235} teeth={22} speed={-.466} active={active && !reducedMotion} m={m} />
    <Gear p={[1.12, .72, .32]} radius={.28} teeth={26} speed={.395} active={active && !reducedMotion} m={m} />
    <group position={[1.16, .75, .79]}><Cylinder radius={.25} height={.19} material={m.aged} /><Cylinder p={[0, .11, 0]} radius={.26} height={.028} material={m.brass} /><Ring p={[0, .13, 0]} radius={.22} tube={.008} material={m.gold} /><Screw p={[0, .145, 0]} material={m.steel} size={.8} />
      {Array.from({ length: 36 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 18, 0]}><Block p={[.251, .115, 0]} s={[.035, .028, .021]} material={m.gold} r={.003} /></group>)}
    </group>
    <group position={[1.43, .67, -.90]}><Cylinder radius={.025} height={.47} material={m.steel} /><Cylinder p={[0, -.015, 0]} radius={.12} height={.045} material={m.aged} /><group ref={governor} position={[0, .29, 0]}><Block s={[.42, .018, .07]} material={m.steel} r={.01} /><Block s={[.07, .018, .42]} material={m.steel} r={.01} /><Cylinder radius={.045} height={.035} material={m.gold} /></group></group>
    <Block p={[-.37, .66, -1.00]} s={[1.17, .025, .22]} material={m.gold} r={.024} /><mesh position={[-.37, .675, -1.00]} rotation={[-Math.PI / 2, 0, 0]} material={m.plaque}><planeGeometry args={[1.1, .19]} /></mesh>
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
  return <group name="musicbox-collected-letter-and-red-keepsake">
    <group position={[-1.48, 1.49, .73]} rotation={[0, -.24, .12]} scale={.37}>
      <mesh position={[0, .31, 0]} material={m.red} castShadow><capsuleGeometry args={[.19, .22, 6, 16]} /></mesh>
      <mesh position={[0, .73, 0]} castShadow><sphereGeometry args={[.18, 20, 14]} /><meshStandardMaterial color="#d7b594" roughness={.95} /></mesh>
      <mesh position={[0, .84, -.03]} material={m.ebony} castShadow scale={[1, .60, 1]}><sphereGeometry args={[.19, 20, 12]} /></mesh>
      {[-1, 1].map(i => <group key={i}><mesh position={[i * .065, .75, .169]} material={darkSlot}><sphereGeometry args={[.018, 10, 8]} /></mesh><Block p={[i * .24, .4, 0]} s={[.13, .35, .14]} material={m.red} r={.05} rotation={[0, 0, i * .2]} /><Block p={[i * .10, .07, 0]} s={[.12, .25, .14]} material={m.red} r={.04} /></group>)}
    </group>
    <group position={[.11, 1.545, 1.30]} rotation={[.19, -.22, 0]}><Block s={[.97, .035, .59]} material={m.paper} r={.017} /><Stroke points={[[-.46, .022, -.27], [0, .024, .09], [.46, .022, -.27]]} material={m.aged} radius={.0025} /><Cylinder p={[0, .03, .08]} radius={.065} height={.015} material={m.red} /><Ring p={[0, .04, .08]} radius={.043} tube={.004} material={m.gold} /></group>
    <Block p={[1.36, 1.52, 1.13]} s={[.52, .028, .38]} material={m.paper} rotation={[.08, .2, 0]} r={.018} />
  </group>;
}

export default function MusicBox({ phase, collected, reducedMotion, onBox }: Pick<SceneProps, 'phase' | 'collected' | 'reducedMotion' | 'onBox'>) {
  const m = useSurfaces(), hinge = useRef<THREE.Group>(null), { gl } = useThree();
  const [hover, setHover] = useState(false), open = phase !== 'landing';
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  useFrame((_, dt) => {
    if (!hinge.current) return;
    const target = open ? phase === 'transition-in' ? -1.64 : -1.42 : hover ? -.028 : 0;
    hinge.current.rotation.x = reducedMotion ? target : THREE.MathUtils.damp(hinge.current.rotation.x, target, 3.7, dt);
    gl.domElement.dataset.boxLidAngle = hinge.current.rotation.x.toFixed(3); gl.domElement.dataset.boxOpen = String(open);
  });
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta > 5) return; gl.domElement.dataset.lastAnchorSource = 'mesh:musicbox'; onBox(); };
  return <group position={[.30, 0, 0]} onClick={click} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }} name="original-classical-mechanical-musicbox">
    <Body m={m} /><Mechanism m={m} active={open} reducedMotion={reducedMotion} /><Lid m={m} hinge={hinge} open={open} />
    {open && <group name="musicbox-clear-glass-dust-cover">
      <Block p={[0, 1.337, -.03]} s={[3.67, .014, 2.11]} material={m.glass} r={.004} />
      {[-1.70, 1.70].flatMap(x => [-.97, .91].map(z => <group key={`${x}${z}`}><Block p={[x, 1.349, z]} s={[.13, .022, .11]} material={m.brass} r={.012} /><Screw p={[x, 1.367, z]} material={m.steel} size={.65} /></group>))}
    </group>}
    {open && <pointLight position={[-.3, 2.0, .4]} intensity={3.4} color="#ffe8bd" distance={4} decay={2} />}
    {[-1.36, 1.36].map(x => <Hinge key={x} x={x} m={m} />)}
    <WindingKey m={m} active={open} reducedMotion={reducedMotion} />
    {[-1, 1].map(i => <group key={i} position={[i * 1.87, 1.12, -.80]}><Block s={[.025, .25, .045]} material={m.gold} r={.009} rotation={[-.5, 0, 0]} /><Screw p={[0, -.13, 0]} material={m.brass} size={.55} /></group>)}
    {collected && open && <Keepsakes m={m} />}
    {phase === 'transition-in' && <><pointLight position={[0, 1.35, -.18]} intensity={4} color="#ffe2ad" distance={5} /><mesh position={[0, .656, -.03]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.4, 1.9]} /><meshBasicMaterial color="#ffe5a6" transparent opacity={.08} depthWrite={false} /></mesh></>}
  </group>;
}
