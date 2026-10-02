'use client';
import * as THREE from 'three';
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, Environment, Lightformer } from '@react-three/drei';

const COLORS: Record<string, string> = { black: '#2C2F33', red: '#C8102E', white: '#E8EAED', gray: '#8A9097', grey: '#8A9097', blue: '#1F6FD1', green: '#1FA84F', orange: '#EA8111', yellow: '#F2C200', purple: '#643DBC' };

/** Orbitable preview of a printed part / STL (mm, Z up). */
export default function MeshViewer({ positions, indices, color = 'gray', className = '', dark = false }: { positions: number[]; indices: number[]; color?: string; className?: string; dark?: boolean }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -g.boundingBox!.min.z);
    return g;
  }, [positions, indices]);
  return (
    <div className={className} role="img" aria-label="3D preview of the printed part">
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 35, position: [80, -110, 90], up: [0, 0, 1] }} gl={{ preserveDrawingBuffer: true, alpha: true }}>
        <color attach="background" args={[dark ? '#1A1D21' : '#F4F6F8']} />
        <hemisphereLight args={['#ffffff', '#55606b', 0.8]} />
        <directionalLight position={[60, -80, 120]} intensity={1.8} />
        <Environment resolution={64} frames={1}><Lightformer form="rect" intensity={1.5} position={[0, 0, 100]} scale={[100, 100, 1]} /></Environment>
        <Bounds fit clip observe margin={1.3}>
          <mesh geometry={geom}><meshStandardMaterial color={COLORS[color] ?? color} roughness={0.55} metalness={0.05} /></mesh>
        </Bounds>
        <gridHelper args={[200, 20, dark ? '#3A4148' : '#C9CED4', dark ? '#2C3238' : '#E0E3E7']} rotation={[Math.PI / 2, 0, 0]} />
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>
    </div>
  );
}
