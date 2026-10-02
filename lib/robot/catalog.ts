// VEX V5 parts catalog (spec §14). Values marked verified:false are visual approximations — TODO(verify).
export type RenderKind =
  | 'channel' | 'angle' | 'plate' | 'shaft' | 'wheel' | 'gear' | 'sprocket' | 'chain' | 'motor' | 'box'
  | 'roller' | 'cylinder' | 'standoff' | 'screw' | 'nut' | 'collar' | 'band' | 'decal';

export type PartCategory = 'structure' | 'motion' | 'electronics' | 'sensors' | 'pneumatics' | 'hardware';
export type InventoryCategory = 'screws_hardware' | 'vex_structural' | 'motors_electronics' | 'printed_parts';

export interface CatalogPart {
  id: string;
  name: string;
  sku?: string;
  category: PartCategory;
  inventory: InventoryCategory;
  render: RenderKind;
  /** bounding size in the part's local frame [x, y, z] inches (for fixed-size parts) */
  size?: [number, number, number];
  weightLb?: number;
  verified: boolean;
  hardware?: boolean;
  smartDevice?: boolean;
}

export const HOLE_PITCH = 0.5;
export const HOLE_SIZE = 0.182;
export const AL_THICK = 0.064;
export const STEEL_THICK = 0.046;
export const AL_DENSITY = 0.0975; // lb/in^3
export const STEEL_DENSITY = 0.284;

export const MOTOR_RPM = { red: 100, green: 200, blue: 600 } as const;
export const MOTOR_11W_SIZE: [number, number, number] = [1.3, 2.82, 2.26]; // x = shaft axis
export const MOTOR_55W_SIZE: [number, number, number] = [1.3, 2.3, 2.26]; // TODO(verify)

export const WHEEL_WIDTH: Record<string, number> = {
  'omni-2.75': 1.0, 'omni-3.25': 1.0, 'omni-4': 1.1, 'omni-2': 0.9,
  'traction-2.75': 1.0, 'traction-3.25': 1.0, 'traction-4': 1.1, 'traction-2': 0.9,
  'mecanum-4': 1.5, 'mecanum-2': 1.0, 'mecanum-3.25': 1.3, 'mecanum-2.75': 1.2,
}; // ≈ verified:false

const P = (p: CatalogPart) => p;

export const CATALOG: Record<string, CatalogPart> = Object.fromEntries(
  [
    P({ id: 'c-channel-1x2x1-al', name: 'C-Channel 1x2x1 (aluminum)', sku: '276-2288', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'c-channel-1x3x1-al', name: 'C-Channel 1x3x1 (aluminum)', sku: '276-2289', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'c-channel-1x5x1-al', name: 'C-Channel 1x5x1 (aluminum)', sku: '276-2290', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'c-channel-1x2x1-st', name: 'C-Channel 1x2x1 (steel)', sku: '275-1141', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'c-channel-1x3x1-st', name: 'C-Channel 1x3x1 (steel)', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'c-channel-1x5x1-st', name: 'C-Channel 1x5x1 (steel)', category: 'structure', inventory: 'vex_structural', render: 'channel', verified: true }),
    P({ id: 'angle-2x2-al', name: 'Angle 2x2 (aluminum)', category: 'structure', inventory: 'vex_structural', render: 'angle', verified: true }),
    P({ id: 'plate-5xN-al', name: 'Plate 5xN (aluminum)', category: 'structure', inventory: 'vex_structural', render: 'plate', verified: true }),
    P({ id: 'flat-bar-1xN-al', name: 'Flat Bar 1xN (aluminum)', category: 'structure', inventory: 'vex_structural', render: 'plate', verified: true }),
    P({ id: 'poly-plate', name: 'Polycarbonate sheet', category: 'structure', inventory: 'vex_structural', render: 'plate', verified: false }),
    P({ id: 'shaft-hs', name: 'High Strength Shaft 1/4"', category: 'motion', inventory: 'vex_structural', render: 'shaft', verified: true }),
    P({ id: 'shaft-std', name: 'Drive Shaft 1/8"', category: 'motion', inventory: 'vex_structural', render: 'shaft', verified: true }),
    P({ id: 'omni-wheel', name: 'Omni-Directional Wheel', category: 'motion', inventory: 'vex_structural', render: 'wheel', verified: true }),
    P({ id: 'traction-wheel', name: 'Anti-Static Traction Wheel', category: 'motion', inventory: 'vex_structural', render: 'wheel', verified: true }),
    P({ id: 'mecanum-wheel', name: 'Mecanum Wheel', category: 'motion', inventory: 'vex_structural', render: 'wheel', verified: true }),
    P({ id: 'flex-wheel', name: 'Flex Wheel roller', category: 'motion', inventory: 'vex_structural', render: 'roller', verified: false }),
    P({ id: 'gear-hs', name: 'High Strength Gear', category: 'motion', inventory: 'vex_structural', render: 'gear', verified: true }),
    P({ id: 'sprocket', name: 'Sprocket', category: 'motion', inventory: 'vex_structural', render: 'sprocket', verified: false }),
    P({ id: 'chain', name: 'Chain', category: 'motion', inventory: 'vex_structural', render: 'chain', verified: false }),
    P({ id: 'motor-11w', name: 'V5 Smart Motor (11W)', sku: '276-4840', category: 'electronics', inventory: 'motors_electronics', render: 'motor', size: MOTOR_11W_SIZE, weightLb: 0.342, verified: true, smartDevice: true }),
    P({ id: 'motor-5.5w', name: 'V5 Smart Motor (5.5W)', sku: '276-4842', category: 'electronics', inventory: 'motors_electronics', render: 'motor', size: MOTOR_55W_SIZE, weightLb: 0.2, verified: false, smartDevice: true }),
    P({ id: 'brain', name: 'V5 Robot Brain', sku: '276-4810', category: 'electronics', inventory: 'motors_electronics', render: 'box', size: [4.0, 1.3, 5.5], weightLb: 0.63, verified: true }),
    P({ id: 'battery', name: 'V5 Robot Battery', sku: '276-4811', category: 'electronics', inventory: 'motors_electronics', render: 'box', size: [1.82, 1.18, 6.31], weightLb: 0.77, verified: true }),
    P({ id: 'radio', name: 'V5 Robot Radio', sku: '276-4831', category: 'electronics', inventory: 'motors_electronics', render: 'box', size: [2.0, 0.8, 2.0], weightLb: 0.06, verified: false, smartDevice: true }),
    P({ id: 'inertial', name: 'V5 Inertial Sensor', sku: '276-4855', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [1.5, 0.8, 1.5], weightLb: 0.05, verified: false, smartDevice: true }),
    P({ id: 'rotation', name: 'V5 Rotation Sensor', sku: '276-6050', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [0.7, 1.8, 1.8], weightLb: 0.06, verified: false, smartDevice: true }),
    P({ id: 'optical', name: 'V5 Optical Sensor', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [1.0, 1.0, 0.8], weightLb: 0.04, verified: false, smartDevice: true }),
    P({ id: 'distance', name: 'V5 Distance Sensor', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [1.9, 1.0, 0.9], weightLb: 0.05, verified: false, smartDevice: true }),
    P({ id: 'gps', name: 'V5 GPS Sensor', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [2.2, 2.2, 1.0], weightLb: 0.1, verified: false, smartDevice: true }),
    P({ id: 'ai-vision', name: 'AI Vision Sensor', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [2.8, 1.8, 1.2], weightLb: 0.1, verified: false, smartDevice: true }),
    P({ id: 'bumper', name: 'Bumper Switch v2', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [1.0, 0.8, 1.0], weightLb: 0.02, verified: false }),
    P({ id: 'limit', name: 'Limit Switch', category: 'sensors', inventory: 'motors_electronics', render: 'box', size: [0.8, 0.6, 1.0], weightLb: 0.02, verified: false }),
    P({ id: 'air-tank', name: 'Pneumatic Air Tank', category: 'pneumatics', inventory: 'motors_electronics', render: 'cylinder', weightLb: 0.2, verified: false }),
    P({ id: 'solenoid', name: 'Double-Acting Solenoid', category: 'pneumatics', inventory: 'motors_electronics', render: 'box', size: [1.4, 0.9, 1.0], weightLb: 0.05, verified: false }),
    P({ id: 'pneumatic-cylinder', name: 'Pneumatic Cylinder', category: 'pneumatics', inventory: 'motors_electronics', render: 'cylinder', weightLb: 0.08, verified: false }),
    P({ id: 'standoff', name: 'Standoff 8-32', category: 'hardware', inventory: 'screws_hardware', render: 'standoff', weightLb: 0.004, verified: false, hardware: true }),
    P({ id: 'screw-8-32', name: 'Screw 8-32 x 3/8"', category: 'hardware', inventory: 'screws_hardware', render: 'screw', weightLb: 0.0042, verified: true, hardware: true }),
    P({ id: 'nut-nylock', name: 'Nylock Nut 8-32', category: 'hardware', inventory: 'screws_hardware', render: 'nut', weightLb: 0.0024, verified: true, hardware: true }),
    P({ id: 'collar', name: 'Shaft Collar', category: 'hardware', inventory: 'screws_hardware', render: 'collar', weightLb: 0.006, verified: false, hardware: true }),
    P({ id: 'rubber-band', name: 'Rubber Band #64', category: 'hardware', inventory: 'screws_hardware', render: 'band', weightLb: 0.001, verified: false }),
    P({ id: 'decal-plate', name: 'Decal plate', category: 'structure', inventory: 'vex_structural', render: 'decal', weightLb: 0.02, verified: false }),
  ].map((p) => [p.id, p]),
);

export function channelProfile(partId: string): number {
  const m = /1x(\d)x1/.exec(partId);
  return m ? Number(m[1]) : 2;
}

/** weight formula for structural metal (spec §14.2) */
export function metalWeightLb(partId: string, lengthIn: number, widthIn = 0.5): number {
  const steel = partId.endsWith('-st');
  const t = steel ? STEEL_THICK : AL_THICK;
  const dens = steel ? STEEL_DENSITY : AL_DENSITY;
  let strip = widthIn;
  if (partId.startsWith('c-channel')) strip = channelProfile(partId) * 0.5 + 1.0;
  else if (partId.startsWith('angle')) strip = 2.0;
  return strip * t * lengthIn * (1 - 0.13) * dens;
}

// Enumerated options handed to the AI (PART_OPTIONS)
export const PART_OPTIONS = {
  driveTypes: ['tank', 'xdrive', 'mecanum', 'hdrive'],
  wheels: { omni: [2.75, 3.25, 4], traction: [2.75, 3.25, 4], mecanum: [2, 4] },
  gearTeeth: [12, 24, 36, 48, 60, 72, 84],
  cartridges: { red: '100 rpm (36:1)', green: '200 rpm (18:1)', blue: '600 rpm (6:1)' },
  motorTypes: { '11W': 'V5 Smart Motor 11 W, needs a cartridge', '5.5W': 'V5 Smart Motor 5.5 W, fixed 200 rpm, no cartridge' },
  railChannels: ['1x2x1', '1x3x1', '1x5x1'],
  wheelMounts: ['between-rails', 'outboard'],
  ranges: { trackWidthIn: [8, 17], wheelBaseIn: [6, 16.5], towerHeightIn: [4, 17.5], armLengthIn: [4, 16], rollerCount: [1, 6] },
  subsystemTemplates: {
    intake: { variants: ['flex-wheel-roller', 'chain-flaps', 'rubber-band-roller'], position: ['front', 'rear'], stages: [1, 2], rollerDiameterIn: [1.625, 2, 2.5, 3, 4], pivot: ['fixed', 'pneumatic', 'motor'] },
    lift: { variants: ['arm', 'four-bar', 'six-bar', 'dr4b', 'chain-bar', 'linear-slide'], endEffector: ['none', 'claw', 'hook', 'fork'] },
    clamp: { variants: ['pneumatic-clamp', 'motor-claw'], position: ['front', 'rear'], cylinderStrokeMm: [25, 50, 75] },
    launcher: { variants: ['catapult', 'flywheel', 'puncher'], flywheelDiameterIn: [2, 2.5, 3, 4] },
    accessory: { types: ['wing', 'hood', 'hang', 'descore-arm'], actuation: ['pneumatic', 'motor'], position: ['front', 'rear', 'left', 'right', 'both-sides'] },
    'tracking-wheels': { count: [1, 2, 3], diameterIn: [2, 2.75] },
  },
  sensors: ['inertial', 'rotation', 'optical', 'distance', 'gps', 'ai-vision', 'bumper', 'limit'],
  brainMounts: ['rear-top', 'center-top', 'rear-vertical', 'side-left', 'side-right'],
  printTemplates: ['u-bracket', 'l-bracket', 'gusset-bracket', 'spacer', 'spur-gear', 'sensor-mount', 'plate', 'cable-guide', 'license-plate-holder'],
};
