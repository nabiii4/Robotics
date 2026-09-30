// Parametric printed-part templates (spec §17.1). Units: mm. Interfaces follow §14.6 + hole compensation.
export type ParamValue = number | string | boolean;
export interface ParamDef { key: string; label: string; type: 'number' | 'enum' | 'boolean'; min?: number; max?: number; step?: number; unit?: string; options?: string[]; default: ParamValue }
export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  params: ParamDef[];
  defaultPrint: { material: string; layerHeightMm: number; infillPct: number; walls: number; supports: boolean; orientation: string };
  describe: (p: Record<string, ParamValue>) => string;
}

export const PITCH = 12.7;
export const SCREW_HOLE = 4.4;
export const SHAFT_18 = 3.4;
export const SHAFT_14 = 6.6;

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    id: 'u-bracket', name: 'U-bracket', description: 'Base plate with two walls, VEX hole pattern',
    params: [
      { key: 'lengthHoles', label: 'Length (holes)', type: 'number', min: 2, max: 10, step: 1, default: 5 },
      { key: 'widthHoles', label: 'Width (holes)', type: 'number', min: 1, max: 3, step: 1, default: 2 },
      { key: 'wallHeightMm', label: 'Wall height', type: 'number', min: 6, max: 30, step: 0.5, unit: 'mm', default: 19 },
      { key: 'thicknessMm', label: 'Thickness', type: 'number', min: 2.4, max: 6, step: 0.2, unit: 'mm', default: 3.2 },
      { key: 'holeStyle', label: 'Holes', type: 'enum', options: ['round-8-32', 'square-0.182'], default: 'round-8-32' },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.2, infillPct: 30, walls: 3, supports: false, orientation: 'base face down' },
    describe: (p) => `${p.lengthHoles}×${p.widthHoles}-hole U-bracket, ${p.wallHeightMm} mm walls`,
  },
  {
    id: 'l-bracket', name: 'L-bracket', description: 'Two legs at 90° with optional gusset',
    params: [
      { key: 'legAHoles', label: 'Leg A (holes)', type: 'number', min: 1, max: 8, step: 1, default: 3 },
      { key: 'legBHoles', label: 'Leg B (holes)', type: 'number', min: 1, max: 8, step: 1, default: 2 },
      { key: 'widthHoles', label: 'Width (holes)', type: 'number', min: 1, max: 3, step: 1, default: 2 },
      { key: 'thicknessMm', label: 'Thickness', type: 'number', min: 2.4, max: 6, step: 0.2, unit: 'mm', default: 3.2 },
      { key: 'gusset', label: 'Gusset', type: 'boolean', default: true },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.2, infillPct: 40, walls: 3, supports: false, orientation: 'leg A face down' },
    describe: (p) => `L-bracket ${p.legAHoles}+${p.legBHoles} holes${p.gusset ? ' with gusset' : ''}`,
  },
  {
    id: 'gusset-bracket', name: 'Gusset bracket', description: 'Angled bracket with a triangular web',
    params: [
      { key: 'legAHoles', label: 'Leg A (holes)', type: 'number', min: 2, max: 8, step: 1, default: 4 },
      { key: 'legBHoles', label: 'Leg B (holes)', type: 'number', min: 2, max: 8, step: 1, default: 3 },
      { key: 'angleDeg', label: 'Angle', type: 'number', min: 30, max: 150, step: 5, unit: '°', default: 90 },
      { key: 'thicknessMm', label: 'Thickness', type: 'number', min: 2.4, max: 6, step: 0.2, unit: 'mm', default: 3.6 },
      { key: 'lighteningHoleMm', label: 'Lightening hole', type: 'number', min: 0, max: 20, step: 1, unit: 'mm', default: 8 },
    ],
    defaultPrint: { material: 'PETG', layerHeightMm: 0.2, infillPct: 40, walls: 4, supports: false, orientation: 'web face down' },
    describe: (p) => `${p.angleDeg}° gusset bracket, legs ${p.legAHoles}/${p.legBHoles} holes`,
  },
  {
    id: 'spacer', name: 'Spacer', description: 'Round spacer for screws or shafts',
    params: [
      { key: 'odMm', label: 'Outer Ø', type: 'number', min: 6, max: 20, step: 0.5, unit: 'mm', default: 10 },
      { key: 'lengthMm', label: 'Length', type: 'number', min: 1, max: 50, step: 0.5, unit: 'mm', default: 6.35 },
      { key: 'bore', label: 'Bore', type: 'enum', options: ['screw-8-32', 'shaft-1/8', 'shaft-1/4'], default: 'screw-8-32' },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.16, infillPct: 60, walls: 3, supports: false, orientation: 'flat' },
    describe: (p) => `${p.lengthMm} mm spacer (${p.bore})`,
  },
  {
    id: 'spur-gear', name: 'Spur gear', description: '24 DP compatible (module 1.0583 mm, 20° PA)',
    params: [
      { key: 'teeth', label: 'Teeth', type: 'number', min: 8, max: 84, step: 1, default: 18 },
      { key: 'faceWidthMm', label: 'Face width', type: 'number', min: 3, max: 15, step: 0.5, unit: 'mm', default: 6.35 },
      { key: 'bore', label: 'Bore', type: 'enum', options: ['shaft-1/8', 'shaft-1/4', 'screw-8-32'], default: 'shaft-1/8' },
      { key: 'hubOdMm', label: 'Hub Ø', type: 'number', min: 0, max: 30, step: 0.5, unit: 'mm', default: 10 },
      { key: 'hubLengthMm', label: 'Hub length', type: 'number', min: 0, max: 15, step: 0.5, unit: 'mm', default: 4 },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.12, infillPct: 60, walls: 4, supports: false, orientation: 'flat' },
    describe: (p) => `${p.teeth}T spur gear, ${p.faceWidthMm} mm face`,
  },
  {
    id: 'sensor-mount', name: 'Sensor mount', description: 'Tray that holds a V5 sensor with mounting tab',
    params: [
      { key: 'sensor', label: 'Sensor', type: 'enum', options: ['inertial', 'rotation', 'optical', 'distance', 'custom'], default: 'distance' },
      { key: 'wallMm', label: 'Wall', type: 'number', min: 1.2, max: 4, step: 0.2, unit: 'mm', default: 2 },
      { key: 'windowCutout', label: 'Window cutout', type: 'boolean', default: true },
      { key: 'mountHoles', label: 'Mount holes', type: 'number', min: 1, max: 4, step: 1, default: 2 },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.2, infillPct: 25, walls: 3, supports: false, orientation: 'tray open side up' },
    describe: (p) => `${p.sensor} sensor mount`,
  },
  {
    id: 'plate', name: 'Plate', description: 'Flat plate on the VEX hole grid',
    params: [
      { key: 'holesX', label: 'Holes X', type: 'number', min: 1, max: 15, step: 1, default: 5 },
      { key: 'holesY', label: 'Holes Y', type: 'number', min: 1, max: 15, step: 1, default: 3 },
      { key: 'thicknessMm', label: 'Thickness', type: 'number', min: 1.6, max: 6, step: 0.2, unit: 'mm', default: 3 },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.2, infillPct: 25, walls: 3, supports: false, orientation: 'flat' },
    describe: (p) => `${p.holesX}×${p.holesY} plate`,
  },
  {
    id: 'cable-guide', name: 'Cable guide', description: 'Clip with zip-tie slots for smart cables',
    params: [
      { key: 'widthMm', label: 'Width', type: 'number', min: 10, max: 40, step: 1, unit: 'mm', default: 20 },
      { key: 'slots', label: 'Zip-tie slots', type: 'number', min: 1, max: 3, step: 1, default: 2 },
    ],
    defaultPrint: { material: 'PETG', layerHeightMm: 0.2, infillPct: 30, walls: 3, supports: false, orientation: 'flat' },
    describe: (p) => `${p.widthMm} mm cable guide`,
  },
  {
    id: 'license-plate-holder', name: 'License plate holder', description: 'Decorative holder for team number plates',
    params: [
      { key: 'plateWidthMm', label: 'Plate width', type: 'number', min: 80, max: 250, step: 1, unit: 'mm', default: 160 },
      { key: 'plateHeightMm', label: 'Plate height', type: 'number', min: 30, max: 80, step: 1, unit: 'mm', default: 50 },
    ],
    defaultPrint: { material: 'PLA', layerHeightMm: 0.2, infillPct: 15, walls: 2, supports: false, orientation: 'flat' },
    describe: (p) => `${p.plateWidthMm} × ${p.plateHeightMm} mm license plate holder`,
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATE_DEFS.map((t) => [t.id, t]));

export function withDefaults(templateId: string, params: Record<string, ParamValue> = {}): Record<string, ParamValue> {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) return params;
  const out: Record<string, ParamValue> = {};
  for (const d of t.params) {
    let v = params[d.key] ?? d.default;
    if (d.type === 'number') {
      let n = Number(v);
      if (!Number.isFinite(n)) n = Number(d.default);
      n = Math.min(d.max ?? n, Math.max(d.min ?? n, n));
      if (d.step && d.step >= 1) n = Math.round(n);
      v = n;
    } else if (d.type === 'enum') v = d.options?.includes(String(v)) ? String(v) : String(d.default);
    else v = v === true || v === 'true';
    out[d.key] = v;
  }
  return out;
}

export const LEGALITY_BADGE: Record<string, { label: string; tone: 'grey' | 'blue' | 'purple' }> = {
  practice: { label: 'Practice / prototype only', tone: 'grey' },
  decoration: { label: 'Decoration only (V5RC)', tone: 'blue' },
  license_plate: { label: 'License plate', tone: 'blue' },
  vexu_vai_only: { label: 'VEX U / VEX AI only', tone: 'purple' },
};
