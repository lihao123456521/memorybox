import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { SceneProps } from '../types';
import MusicBox from './MusicBox';

function Camera({ phase, resetKey, reducedMotion }: Pick<SceneProps, 'phase' | 'resetKey' | 'reducedMotion'>) {
  const { camera, size } = useThree(), controls = useRef<OrbitControlsImpl>(null);
  const destination = useRef<{ eye: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const mobile = size.width < 700, transition = phase === 'transition-in';
  useEffect(() => {
    const portraitFit = Math.max(1, 1 / (size.width / size.height));
    const open = phase !== 'landing';
    const eye = mobile ? new THREE.Vector3(5.4, 5.6, 7.8).multiplyScalar(portraitFit * 1.16) : new THREE.Vector3(6.25, open ? 7.875 : 7.50, 9.375);
    const target = mobile ? new THREE.Vector3(.30, open ? 1.8 : 1.0, 0) : new THREE.Vector3(-1.5, open ? 1.65 : .35, 0);
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov = mobile ? 37 : 30; camera.updateProjectionMatrix(); }
    destination.current = transition ? { eye: new THREE.Vector3(.35, 1.74, .85), target: new THREE.Vector3(.20, .85, -.30) } : { eye, target };
  }, [phase, resetKey, size.width, size.height, camera]);
  useFrame((_, dt) => {
    if (!destination.current || !controls.current) return;
    const a = reducedMotion ? 1 : 1 - Math.exp(-dt * (transition ? 2.0 : 3.4));
    camera.position.lerp(destination.current.eye, a); controls.current.target.lerp(destination.current.target, a); controls.current.update();
    if (camera.position.distanceTo(destination.current.eye) < .006) destination.current = null;
  });
  return <OrbitControls key={`${resetKey}-${mobile}`} ref={controls} makeDefault target={mobile ? [.3, 1.05, 0] : [-1.5, 1.05, 0]} enablePan={false} enableDamping dampingFactor={.065} minDistance={transition ? .2 : 5.6} maxDistance={mobile ? 45 : 22} minPolarAngle={.25} maxPolarAngle={1.34} enabled={!transition} onStart={() => { destination.current = null; }} />;
}

function Lighting() {
  return <>
    <ambientLight intensity={.65} color="#c2c3b1" /><hemisphereLight args={['#dacba9', '#11171a', 1.1]} />
    <spotLight position={[-3.5, 7.5, 5]} intensity={145} angle={.59} penumbra={.8} distance={23} color="#ffdfae" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-.00012} shadow-normalBias={.015} />
    <directionalLight position={[3, 4, 5]} intensity={1.25} color="#eed8b5" />
    <spotLight position={[5, 5.5, -3]} intensity={80} angle={.65} penumbra={1} distance={20} color="#a7c9d3" />
    <pointLight position={[-5, 2.8, -2]} intensity={7} color="#c88643" distance={12} />
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" position={[-4, 6, 4]} scale={[5, 4, 1]} rotation={[0, Math.PI / 4, 0]} color="#fff0ce" intensity={4} />
      <Lightformer form="rect" position={[5, 4, -3]} scale={[3, 5, 1]} rotation={[0, -Math.PI / 2, 0]} color="#c5dce3" intensity={3} />
      <Lightformer form="rect" position={[0, 6, 0]} scale={[6, 4, 1]} rotation={[Math.PI / 2, 0, 0]} color="#e9d4a9" intensity={1.5} />
      <Lightformer form="rect" position={[-4, 6, -6]} scale={[6, 5, 1]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(4, -6, 6).normalize())} color="#fff1cb" intensity={1.2} />
    </Environment>
  </>;
}

function Diagnostics() {
  const { camera, gl, scene } = useThree(), last = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < .18) return; last.current = clock.elapsedTime;
    let count = 0; scene.traverse(o => { if (o instanceof THREE.Mesh) count++; });
    const c = gl.domElement; c.dataset.world = 'present'; c.dataset.sceneRevision = 'mechanical-musicbox-v3'; c.dataset.meshCount = String(count); c.dataset.triangles = String(gl.info.render.triangles); c.dataset.cameraPosition = camera.position.toArray().map(v => v.toFixed(3)).join(','); c.dataset.mechanism = 'pinned-cylinder,44-tuned-comb-teeth,3-meshing-spur-gears,spring-barrel,governor,winding-key,planar-mirror';
    const rect = c.getBoundingClientRect(), point = new THREE.Vector3(.30, 1.00, 0).project(camera);
    c.dataset.boxScreen = JSON.stringify({ x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 });
  });
  return null;
}

function World(props: SceneProps) {
  useEffect(() => { props.onReady?.(); }, []);
  return <>
    <color attach="background" args={['#101615']} /><fog attach="fog" args={['#101615', 18, 50]} />
    <Lighting />
    <mesh position={[0, 4.6, 5]} rotation={[0, Math.PI, 0]} name="studio-card-visible-in-lid-mirror"><planeGeometry args={[4, 1.45]} /><meshBasicMaterial color="#d2cbb7" toneMapped={false} /></mesh>
    <mesh position={[0, -.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial color="#090f0d" roughness={.94} metalness={.02} /></mesh>
    <mesh position={[.3, -.095, 0]} receiveShadow castShadow><cylinderGeometry args={[4.6, 4.64, .16, 128]} /><meshStandardMaterial color="#202620" roughness={.48} metalness={.1} /></mesh>
    <mesh position={[.3, -.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[4.57, 128]} /><meshStandardMaterial color="#1b241f" roughness={.78} /></mesh>
    <MusicBox phase={props.phase} collected={props.collected} reducedMotion={props.reducedMotion} onBox={props.onBox} />
    {!props.reducedMotion && <Sparkles count={45} scale={[7, 4, 5]} position={[.5, 2, 0]} size={.9} speed={.08} opacity={.24} color="#d7bd82" />}
    <Camera phase={props.phase} resetKey={props.resetKey} reducedMotion={props.reducedMotion} /><Diagnostics />
  </>;
}

export default function PresentScene(props: SceneProps) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [5, 6, 7.5], fov: 30, near: .035, far: 100 }} gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }} fallback={null} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.13; gl.outputColorSpace = THREE.SRGBColorSpace; gl.shadowMap.type = THREE.PCFSoftShadowMap; }}><Suspense fallback={null}><World {...props} /></Suspense></Canvas>;
}
