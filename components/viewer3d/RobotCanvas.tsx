'use client';
import * as THREE from 'three';
import { useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, ContactShadows, Environment, Grid, Lightformer } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import type { PartInstance } from '@/lib/robot/generator/core';
import { RobotModel, Invalidator, type ModelProps } from './RobotModel';

export type Preset = 'iso' | 'front' | 'side' | 'top';
export interface ViewerApi {
  zoom: (factor: number) => void;
  fit: () => void;
  reset: () => void;
  preset: (p: Preset) => void;
  setPan: (on: boolean) => void;
  screenshot: () => string | null;
}

export interface CanvasProps extends ModelProps {
  bbox?: { min: [number, number, number]; max: [number, number, number] };
  quality?: 'low' | 'medium' | 'high';
  sizingBox?: number | null;
  reduceMotion?: boolean;
  interactive?: boolean;
  initialPreset?: Preset;
  onReady?: () => void;
  apiRef?: MutableRefObject<ViewerApi | null>;
}

function bboxOf(parts: PartInstance[]) {
  const b = new THREE.Box3();
  for (const p of parts) b.expandByPoint(new THREE.Vector3(...p.position));
  if (b.isEmpty()) b.set(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 14, 8));
  b.expandByScalar(1.5);
  return b;
}

function Scene(props: CanvasProps) {
  const { parts, bbox, sizingBox, reduceMotion, interactive = true, initialPreset = 'iso', onReady, apiRef } = props;
  const controls = useRef<CameraControlsImpl>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const box = useMemo(() => (bbox ? new THREE.Box3(new THREE.Vector3(...bbox.min), new THREE.Vector3(...bbox.max)) : bboxOf(parts)), [bbox, parts]);
  const center = useMemo(() => box.getCenter(new THREE.Vector3()), [box]);
  const radius = useMemo(() => box.getBoundingSphere(new THREE.Sphere()).radius, [box]);
  const animate = !reduceMotion;

  const goPreset = (p: Preset, anim = animate) => {
    const c = controls.current;
    if (!c) return;
    const dist = (radius / Math.sin((35 * Math.PI) / 360)) * 1.1;
    let dir: THREE.Vector3;
    if (p === 'front') dir = new THREE.Vector3(0, 0.05, 1);
    else if (p === 'side') dir = new THREE.Vector3(1, 0.05, 0);
    else if (p === 'top') dir = new THREE.Vector3(0, 1, 0.001);
    else { const az = (-35 * Math.PI) / 180, el = (25 * Math.PI) / 180; dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)); }
    dir.normalize().multiplyScalar(dist);
    c.setLookAt(center.x + dir.x, center.y + dir.y, center.z + dir.z, center.x, center.y, center.z, anim);
  };

  useImperativeHandle(apiRef, () => ({
    zoom: (f) => { controls.current?.dolly(f > 1 ? radius * 0.4 : -radius * 0.4, animate); },
    fit: () => { controls.current?.fitToBox(box, animate, { paddingTop: 1, paddingBottom: 1, paddingLeft: 1, paddingRight: 1 }); },
    reset: () => goPreset(initialPreset),
    preset: (p) => goPreset(p),
    setPan: (on) => {
      const c = controls.current as unknown as { mouseButtons: { left: number }; touches: { one: number } } | null;
      if (!c) return;
      // camera-controls ACTION: ROTATE = 1, TRUCK = 2
      c.mouseButtons.left = on ? 2 : 1;
      c.touches.one = on ? 64 : 32;
    },
    screenshot: () => { gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); },
  }));

  const first = useRef(true);
  useEffect(() => {
    goPreset(initialPreset, !first.current && animate);
    first.current = false;
    const t = setTimeout(() => { invalidate(); onReady?.(); (window as unknown as { __viewerReady?: boolean }).__viewerReady = true; }, 50);
    return () => clearTimeout(t);
  }, [center.x, center.y, center.z, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <hemisphereLight args={['#ffffff', '#2a2f36', 0.35]} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[-12, 22, 16]} intensity={2.2} castShadow={props.quality === 'high'} />
      <directionalLight position={[14, 9, -16]} intensity={0.8} color="#bcd4ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 10, 6]} scale={[14, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-10, 4, 2]} rotation={[0, Math.PI / 2, 0]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[10, 3, -4]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 3, 1]} color="#cfe0ff" />
        <Lightformer form="circle" intensity={0.6} position={[0, -6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={8} color="#2a2f36" />
      </Environment>
      <Grid infiniteGrid cellSize={2} sectionSize={12} cellColor="#2C3238" sectionColor="#3A4148" fadeDistance={140} fadeStrength={1.5} cellThickness={0.8} sectionThickness={1.1} position={[0, -0.001, 0]} />
      {props.quality !== 'low' && <ContactShadows opacity={0.45} blur={2.5} scale={60} far={12} resolution={512} frames={1} />}
      <RobotModel {...props} />
      {sizingBox ? (
        <mesh position={[0, sizingBox / 2, 0]}>
          <boxGeometry args={[sizingBox, sizingBox, sizingBox]} />
          <meshBasicMaterial wireframe color="#FCC100" transparent opacity={0.5} />
        </mesh>
      ) : null}
      <CameraControls ref={controls} makeDefault enabled={interactive} minDistance={6} maxDistance={180} dollyToCursor smoothTime={reduceMotion ? 0 : 0.25} />
      <Invalidator deps={[parts, props.highlight, props.explode, props.hidden, props.showHardware, sizingBox, props.highlightUids, props.dimUids]} />
    </>
  );
}

export default function RobotCanvas({ className, label, quality = 'medium', ...rest }: CanvasProps & { className?: string; label?: string }) {
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'high' ? [1, 2] : [1, 1.5];
  return (
    <div className={className} role="img" aria-label={label ?? 'Live 3D model of the robot'}>
      <Canvas frameloop="demand" dpr={dpr} shadows={quality === 'high'} gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }} camera={{ fov: 35, near: 0.1, far: 500, position: [-12, 12, 18] }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
        <Scene quality={quality} {...rest} />
      </Canvas>
    </div>
  );
}
