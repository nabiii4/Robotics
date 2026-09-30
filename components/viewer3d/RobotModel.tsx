'use client';
import * as THREE from 'three';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { PartInstance } from '@/lib/robot/generator/core';
import { CATALOG, MOTOR_11W_SIZE, MOTOR_55W_SIZE } from '@/lib/robot/catalog';
import { angleGeometry, boxGeometry, channelGeometry, cylX, cylY, cylZ, gearGeometry, holeAlphaTexture, labelTexture, plateGeometry, rollerGeometry, roundedBox, wheelGeometry } from './geometries';

const CART = { red: '#D0161E', green: '#2DA84F', blue: '#1F6FD1' } as const;

function useMaterials(accent: string, metal: 'aluminum' | 'steel') {
  return useMemo(() => {
    const hole = holeAlphaTexture();
    const alu = new THREE.MeshStandardMaterial({ color: metal === 'steel' ? '#AEB4BA' : '#C9CDD2', metalness: metal === 'steel' ? 0.85 : 0.9, roughness: metal === 'steel' ? 0.45 : 0.32, alphaMap: hole, alphaTest: 0.5, side: THREE.DoubleSide });
    return {
      alu,
      plate: alu,
      poly: new THREE.MeshStandardMaterial({ color: '#D8E6F0', metalness: 0, roughness: 0.2, transparent: true, opacity: 0.45 }),
      steel: new THREE.MeshStandardMaterial({ color: '#AEB4BA', metalness: 0.85, roughness: 0.45 }),
      motor: new THREE.MeshStandardMaterial({ color: '#2B2E33', roughness: 0.55, metalness: 0.1 }),
      black: new THREE.MeshStandardMaterial({ color: '#17181A', roughness: 0.6 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#1E1F21', roughness: 0.9 }),
      hub: new THREE.MeshStandardMaterial({ color: '#6F767D', roughness: 0.5, metalness: 0.2 }),
      accent: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
      red: new THREE.MeshStandardMaterial({ color: '#C8102E', roughness: 0.5 }),
      sensor: new THREE.MeshStandardMaterial({ color: '#B01223', roughness: 0.5 }),
      cyl: new THREE.MeshStandardMaterial({ color: '#BFC6CD', metalness: 0.6, roughness: 0.3 }),
      tank: new THREE.MeshStandardMaterial({ color: '#D5DBE0', metalness: 0.3, roughness: 0.25 }),
      ghost: new THREE.MeshStandardMaterial({ color: '#9AA3AD', transparent: true, opacity: 0.28, depthWrite: false }),
      cart: Object.fromEntries(Object.entries(CART).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })])) as Record<string, THREE.MeshStandardMaterial>,
      roller: (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }),
    };
  }, [accent, metal]);
}
type Mats = ReturnType<typeof useMaterials>;

function PartMesh({ p, mats, highlight, brainLabel }: { p: PartInstance; mats: Mats; highlight: boolean; brainLabel: string }) {
  const cat = CATALOG[p.partId];
  const pr = p.params ?? {};
  const n = (k: string, d = 0) => (typeof pr[k] === 'number' ? (pr[k] as number) : d);
  const hl = (m: THREE.Material) => {
    if (p.ghost) return mats.ghost;
    if (!highlight) return m;
    const c = (m as THREE.MeshStandardMaterial).clone();
    c.emissive = new THREE.Color('#C8061C');
    c.emissiveIntensity = 0.35;
    return c;
  };
  const kids: React.ReactNode[] = [];
  switch (cat?.render) {
    case 'channel': kids.push(<mesh key="c" geometry={channelGeometry(n('n', 2), n('holes', 2))} material={hl(mats.alu)} castShadow receiveShadow />); break;
    case 'angle': kids.push(<mesh key="c" geometry={angleGeometry(n('holes', 2))} material={hl(mats.alu)} castShadow />); break;
    case 'plate': kids.push(<mesh key="c" geometry={plateGeometry(n('w', 1), Math.max(0.02, n('t', 0.064)), n('l', 1))} material={hl(p.partId === 'poly-plate' ? mats.poly : mats.alu)} castShadow />); break;
    case 'shaft': { const s = p.partId === 'shaft-hs' ? 0.25 : 0.125; kids.push(<mesh key="c" geometry={boxGeometry(n('len', 2), s, s)} material={hl(mats.steel)} />); break; }
    case 'wheel': {
      const kind = String(pr.kind ?? 'omni');
      const g = wheelGeometry(kind, n('d', 4), n('w', 1), String(pr.hand ?? 'A'));
      kids.push(<mesh key="h" geometry={g.hub} material={hl(kind === 'traction' ? mats.hub : mats.black)} castShadow />);
      kids.push(<mesh key="t" geometry={g.tread} material={hl(kind === 'omni' ? mats.accent : mats.rubber)} castShadow />);
      break;
    }
    case 'roller': kids.push(<mesh key="r" geometry={rollerGeometry(n('d', 2), n('len', 10))} material={hl(mats.roller(p.color ?? '#C8102E'))} castShadow />); break;
    case 'gear': kids.push(<mesh key="g" geometry={gearGeometry(n('teeth', 12), n('face', 0.5))} material={hl(p.color ? mats.accent : mats.black)} castShadow />); break;
    case 'sprocket': kids.push(<mesh key="s" geometry={cylX(n('teeth', 12) / 24 / 2 + 0.05, n('face', 0.12), 24)} material={hl(mats.black)} />); break;
    case 'chain': kids.push(<mesh key="c" geometry={boxGeometry(0.1, 0.08, n('len', 1))} material={hl(mats.black)} />); break;
    case 'band': kids.push(<mesh key="b" geometry={boxGeometry(0.05, 0.05, n('len', 1))} material={hl(mats.black)} />); break;
    case 'motor': {
      const s = p.partId === 'motor-5.5w' ? MOTOR_55W_SIZE : MOTOR_11W_SIZE;
      kids.push(<mesh key="m" geometry={roundedBox(s[0], s[1], s[2], 0.14)} material={hl(mats.motor)} castShadow />);
      const cart = pr.cartridge ? mats.cart[String(pr.cartridge)] : null;
      if (cart) kids.push(<mesh key="k" geometry={cylX(0.5, 0.06, 28)} position={[-s[0] / 2 - 0.02, 0, 0]} material={hl(cart)} />);
      kids.push(<mesh key="sh" geometry={boxGeometry(0.3, 0.25, 0.25)} position={[s[0] / 2 + 0.12, 0, 0]} material={hl(mats.steel)} />);
      break;
    }
    case 'cylinder': {
      if (p.partId === 'air-tank') kids.push(<mesh key="t" geometry={cylZ(n('d', 1.4) / 2, n('len', 5), 28)} material={hl(mats.tank)} castShadow />);
      else kids.push(<mesh key="c" geometry={cylZ(n('d', 0.6) / 2, n('len', 3), 20)} material={hl(mats.cyl)} castShadow />);
      break;
    }
    case 'standoff': kids.push(<mesh key="s" geometry={cylY(0.1, n('len', 1), 6)} material={hl(mats.steel)} />); break;
    case 'decal': {
      const tex = labelTexture(String(pr.text ?? 'FDR'), { bg: '#9AA1A8', fg: '#D1071B' });
      kids.push(<mesh key="d"><boxGeometry args={[n('w', 3), n('h', 1.2), 0.06]} /><meshStandardMaterial map={tex} roughness={0.5} /></mesh>);
      break;
    }
    case 'box': {
      const s = cat.size ?? [1, 1, 1];
      if (p.partId === 'brain') {
        const tex = labelTexture('FDRHS', { bg: '#0B0D10', fg: '#D1071B', sub: brainLabel, w: 256, h: 180 });
        kids.push(<mesh key="b" geometry={roundedBox(s[0], s[1], s[2], 0.1)} material={hl(mats.motor)} castShadow />);
        kids.push(<mesh key="scr" position={[0, s[1] / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[s[0] * 0.82, s[2] * 0.6]} /><meshStandardMaterial map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.35} roughness={0.2} /></mesh>);
      } else if (p.partId === 'battery') {
        kids.push(<mesh key="b" geometry={roundedBox(s[0], s[1], s[2], 0.08)} material={hl(mats.black)} castShadow />);
        kids.push(<mesh key="l" geometry={boxGeometry(s[0] + 0.01, s[1] * 0.6, 0.8)} position={[0, 0, s[2] / 2 - 0.6]} material={hl(mats.red)} />);
      } else {
        const m = cat.category === 'sensors' ? mats.sensor : mats.black;
        kids.push(<mesh key="b" geometry={roundedBox(s[0], s[1], s[2], 0.08)} material={hl(m)} castShadow />);
      }
      break;
    }
    default: kids.push(<mesh key="x" geometry={boxGeometry(0.4, 0.4, 0.4)} material={hl(mats.black)} />);
  }
  return <group position={p.position} rotation={p.rotation}>{kids}</group>;
}

function Hardware({ parts, mats }: { parts: PartInstance[]; mats: Mats }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ref2 = useRef<THREE.InstancedMesh>(null);
  const screws = parts.filter((p) => p.partId === 'screw-8-32' || p.partId === 'collar');
  const nuts = parts.filter((p) => p.partId === 'nut-nylock');
  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    screws.forEach((p, i) => { e.set(...p.rotation); q.setFromEuler(e); m.compose(new THREE.Vector3(...p.position), q, s); ref.current?.setMatrixAt(i, m); });
    nuts.forEach((p, i) => { e.set(...p.rotation); q.setFromEuler(e); m.compose(new THREE.Vector3(...p.position), q, s); ref2.current?.setMatrixAt(i, m); });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (ref2.current) ref2.current.instanceMatrix.needsUpdate = true;
  }, [screws, nuts]);
  return (
    <>
      {screws.length > 0 && <instancedMesh ref={ref} args={[cylY(0.09, 0.06, 8), mats.steel, screws.length]} />}
      {nuts.length > 0 && <instancedMesh ref={ref2} args={[cylY(0.1, 0.06, 6), mats.steel, nuts.length]} />}
    </>
  );
}

export interface ModelProps {
  parts: PartInstance[];
  accent?: string;
  metal?: 'aluminum' | 'steel';
  highlight?: string | null;
  highlightUids?: Set<string> | null;
  dimUids?: Set<string> | null;
  hidden?: Set<string>;
  showHardware?: boolean;
  explode?: number;
  brainLabel?: string;
}

export const RobotModel = memo(function RobotModel({ parts, accent = '#C8102E', metal = 'aluminum', highlight, highlightUids, dimUids, hidden, showHardware = true, explode = 0, brainLabel = '' }: ModelProps) {
  const mats = useMaterials(accent, metal);
  const invalidate = useThree((s) => s.invalidate);
  // design-change glow: parts whose uid is new pulse red for 800 ms
  const prev = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(parts.map((p) => p.uid));
    if (prev.current) {
      const added = new Set([...now].filter((u) => !prev.current!.has(u)));
      if (added.size && added.size < now.size) { setFresh(added); const t = setTimeout(() => { setFresh(new Set()); invalidate(); }, 800); prev.current = now; return () => clearTimeout(t); }
    }
    prev.current = now;
  }, [parts, invalidate]);
  const centroids = useMemo(() => {
    const acc = new Map<string, [number, number, number, number]>();
    for (const p of parts) { const a = acc.get(p.subsystemId) ?? [0, 0, 0, 0]; a[0] += p.position[0]; a[1] += p.position[1]; a[2] += p.position[2]; a[3]++; acc.set(p.subsystemId, a); }
    const c = new Map<string, THREE.Vector3>();
    for (const [k, a] of acc) c.set(k, new THREE.Vector3(a[0] / a[3], a[1] / a[3], a[2] / a[3]));
    return c;
  }, [parts]);
  const visible = parts.filter((p) => !hidden?.has(p.subsystemId) && !CATALOG[p.partId]?.hardware);
  const hw = showHardware ? parts.filter((p) => CATALOG[p.partId]?.hardware && p.partId !== 'standoff' && !hidden?.has(p.subsystemId) && !p.ghost) : [];
  const standoffs = parts.filter((p) => p.partId === 'standoff');
  return (
    <group>
      {[...visible, ...standoffs].map((p) => {
        let pp = p;
        if (explode > 0) {
          const c = centroids.get(p.subsystemId) ?? new THREE.Vector3();
          const sub = p.subsystemId === 'drivetrain' ? new THREE.Vector3(0, 0, 0) : c.clone().multiplyScalar(0.6);
          const dir = new THREE.Vector3(...p.position).sub(c).multiplyScalar(0.8).add(sub).add(new THREE.Vector3(0, p.subsystemId === 'drivetrain' ? 0 : 3, 0));
          pp = { ...p, position: [p.position[0] + dir.x * explode, p.position[1] + dir.y * explode, p.position[2] + dir.z * explode] };
        }
        const isHl = (!!highlight && p.subsystemId === highlight) || !!highlightUids?.has(p.uid) || fresh.has(p.uid);
        if (dimUids?.has(p.uid)) return <DimPart key={p.uid} p={pp} />;
        return <PartMesh key={p.uid} p={pp} mats={mats} highlight={isHl} brainLabel={brainLabel} />;
      })}
      {explode === 0 && <Hardware parts={hw} mats={mats} />}
    </group>
  );
});

const dimMat = new THREE.MeshStandardMaterial({ color: '#8C939B', transparent: true, opacity: 0.45, roughness: 0.8 });
function DimPart({ p }: { p: PartInstance }) {
  const cat = CATALOG[p.partId];
  const pr = p.params ?? {};
  const n = (k: string, d = 0) => (typeof pr[k] === 'number' ? (pr[k] as number) : d);
  let geo: THREE.BufferGeometry;
  if (cat?.render === 'channel') geo = channelGeometry(n('n', 2), n('holes', 2));
  else if (cat?.render === 'wheel') geo = wheelGeometry(String(pr.kind ?? 'omni'), n('d', 4), n('w', 1)).hub;
  else if (cat?.size) geo = boxGeometry(...cat.size);
  else return null;
  return <mesh geometry={geo} material={dimMat} position={p.position} rotation={p.rotation} />;
}

/** re-render the demand frameloop when props change */
export function Invalidator({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => null);
  return null;
}
