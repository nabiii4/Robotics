import { z } from 'zod';

// ---------- types (spec §13.2) ----------
export const GEAR_TEETH = [12, 24, 36, 48, 60, 72, 84] as const;
export type GearTeeth = (typeof GEAR_TEETH)[number];
export type Cartridge = 'red' | 'green' | 'blue';
export type MotorType = '11W' | '5.5W';
export type SubsystemStatus = 'complete' | 'in_progress' | 'planned';

export interface MotorSet { type: MotorType; count: number; cartridge?: Cartridge }
export interface Gearing { driving: GearTeeth; driven: GearTeeth }
export type Cyl = { strokeMm: 25 | 50 | 75; count: 1 | 2 };

export type Program = 'V5RC' | 'VEXU' | 'VAIRC' | 'Practice';
export type DriveType = 'tank' | 'xdrive' | 'mecanum' | 'hdrive';
export type WheelKind = 'omni' | 'traction' | 'mecanum';
export type WheelDiameter = 2 | 2.75 | 3.25 | 4;

export interface Drivetrain {
  type: DriveType;
  motors: MotorSet;
  gearing: Gearing | null;
  wheel: { kind: WheelKind; diameterIn: WheelDiameter };
  wheelsPerSide: 2 | 3 | 4;
  centerWheelsTraction?: boolean;
  wheelMount: 'between-rails' | 'outboard';
  trackWidthIn: number;
  wheelBaseIn: number;
  railChannel: '1x2x1' | '1x3x1' | '1x5x1';
  crossbraces: 2 | 3 | 4;
  hWheel?: { diameterIn: 2.75 | 3.25 | 4; motors: MotorSet };
}

type Base = { id: string; name: string; status: SubsystemStatus };
export type IntakeSub = Base & {
  type: 'intake'; variant: 'flex-wheel-roller' | 'chain-flaps' | 'rubber-band-roller';
  position: 'front' | 'rear'; stages: 1 | 2; widthIn: number; rollerCount: number;
  rollerDiameterIn: 1.625 | 2 | 2.5 | 3 | 4; liftHeightIn?: number;
  pivot: 'fixed' | 'pneumatic' | 'motor'; motors: MotorSet[];
};
export type LiftSub = Base & {
  type: 'lift'; variant: 'arm' | 'four-bar' | 'six-bar' | 'dr4b' | 'chain-bar' | 'linear-slide';
  towerHeightIn: number; armLengthIn: number; maxAngleDeg?: number; motors: MotorSet[];
  gearing: Gearing | null; rubberBands: number; endEffector?: 'none' | 'claw' | 'hook' | 'fork';
};
export type ClampSub = Base & {
  type: 'clamp'; variant: 'pneumatic-clamp' | 'motor-claw'; position: 'front' | 'rear';
  cylinders?: Cyl; motors?: MotorSet[];
};
export type LauncherSub = Base & {
  type: 'launcher'; variant: 'catapult' | 'flywheel' | 'puncher'; motors: MotorSet[];
  gearing: Gearing | null; flywheelDiameterIn?: 2 | 2.5 | 3 | 4; rubberBands?: number;
};
export type AccessorySub = Base & {
  type: 'wing' | 'hood' | 'hang' | 'descore-arm'; actuation: 'pneumatic' | 'motor';
  position: 'front' | 'rear' | 'left' | 'right' | 'both-sides'; lengthIn: number; cylinders?: Cyl; motors?: MotorSet[];
};
export type TrackingSub = Base & { type: 'tracking-wheels'; count: 1 | 2 | 3; diameterIn: 2 | 2.75 };
export type Subsystem = IntakeSub | LiftSub | ClampSub | LauncherSub | AccessorySub | TrackingSub;
export type SubsystemType = Subsystem['type'];

export type SensorType = 'inertial' | 'rotation' | 'optical' | 'distance' | 'gps' | 'ai-vision' | 'bumper' | 'limit';
export interface Sensor { id: string; type: SensorType; attachTo?: string; mount?: 'center' | 'front' | 'rear' | 'left' | 'right' }

export interface RobotSpec {
  schemaVersion: 1;
  meta: { name: string; tagline?: string; program: Program; season: string; drawingPrefix?: string; notes?: string };
  appearance: { metal: 'aluminum' | 'steel'; accentColor: string; rollerColor: 'red' | 'black' | 'gray'; decal?: { text: string; on: 'front-plate' | 'brain-guard' } };
  drivetrain: Drivetrain;
  subsystems: Subsystem[];
  sensors: Sensor[];
  electronics: {
    brainMount: 'rear-top' | 'center-top' | 'rear-vertical' | 'side-left' | 'side-right';
    batteryMount: 'center-low' | 'rear-low' | 'side-low';
    radioMount: 'top' | 'rear';
    pneumatics: { airTanks: 0 | 1 | 2; solenoids: number };
  };
  customPartIds: string[];
  portOverrides?: Record<string, number | string>;
}

// ---------- zod (lenient on numbers; normalize.ts snaps and reports) ----------
const num = z.coerce.number();
const Status = z.enum(['complete', 'in_progress', 'planned']);
export const MotorSetSchema = z.object({
  type: z.enum(['11W', '5.5W']),
  count: z.coerce.number().int().min(0).max(8),
  cartridge: z.enum(['red', 'green', 'blue']).nullish(),
});
const GearingSchema = z.object({ driving: num, driven: num }).nullish();
const CylSchema = z.object({ strokeMm: num, count: num }).nullish();
const base = { id: z.string().max(48).optional(), name: z.string().min(1).max(40), status: Status.default('planned') };

const IntakeSchema = z.object({
  ...base, type: z.literal('intake'),
  variant: z.enum(['flex-wheel-roller', 'chain-flaps', 'rubber-band-roller']).default('flex-wheel-roller'),
  position: z.enum(['front', 'rear']).default('front'),
  stages: num.default(1), widthIn: num.default(10), rollerCount: num.default(2), rollerDiameterIn: num.default(2),
  liftHeightIn: num.nullish(), pivot: z.enum(['fixed', 'pneumatic', 'motor']).default('fixed'),
  motors: z.array(MotorSetSchema).default([{ type: '5.5W', count: 1 }]),
});
const LiftSchema = z.object({
  ...base, type: z.literal('lift'),
  variant: z.enum(['arm', 'four-bar', 'six-bar', 'dr4b', 'chain-bar', 'linear-slide']).default('arm'),
  towerHeightIn: num.default(12), armLengthIn: num.default(10), maxAngleDeg: num.nullish(),
  motors: z.array(MotorSetSchema).default([{ type: '11W', count: 2, cartridge: 'red' }]),
  gearing: GearingSchema, rubberBands: num.default(0), endEffector: z.enum(['none', 'claw', 'hook', 'fork']).nullish(),
});
const ClampSchema = z.object({
  ...base, type: z.literal('clamp'), variant: z.enum(['pneumatic-clamp', 'motor-claw']).default('pneumatic-clamp'),
  position: z.enum(['front', 'rear']).default('rear'), cylinders: CylSchema, motors: z.array(MotorSetSchema).nullish(),
});
const LauncherSchema = z.object({
  ...base, type: z.literal('launcher'), variant: z.enum(['catapult', 'flywheel', 'puncher']).default('catapult'),
  motors: z.array(MotorSetSchema).default([{ type: '11W', count: 1, cartridge: 'red' }]), gearing: GearingSchema,
  flywheelDiameterIn: num.nullish(), rubberBands: num.nullish(),
});
const AccessorySchema = z.object({
  ...base, type: z.enum(['wing', 'hood', 'hang', 'descore-arm']), actuation: z.enum(['pneumatic', 'motor']).default('pneumatic'),
  position: z.enum(['front', 'rear', 'left', 'right', 'both-sides']).default('both-sides'), lengthIn: num.default(8),
  cylinders: CylSchema, motors: z.array(MotorSetSchema).nullish(),
});
const TrackingSchema = z.object({ ...base, type: z.literal('tracking-wheels'), count: num.default(2), diameterIn: num.default(2) });

export const SubsystemSchema = z.union([IntakeSchema, LiftSchema, ClampSchema, LauncherSchema, AccessorySchema, TrackingSchema]);

export const SensorSchema = z.object({
  id: z.string().max(48).optional(),
  type: z.enum(['inertial', 'rotation', 'optical', 'distance', 'gps', 'ai-vision', 'bumper', 'limit']),
  attachTo: z.string().max(48).nullish(),
  mount: z.enum(['center', 'front', 'rear', 'left', 'right']).nullish(),
});

export const RobotSpecSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  meta: z.object({
    name: z.string().min(1).max(60), tagline: z.string().max(80).nullish(),
    program: z.enum(['V5RC', 'VEXU', 'VAIRC', 'Practice']).default('V5RC'),
    season: z.string().max(60).default('V5RC 2026–27 Override'), drawingPrefix: z.string().max(40).nullish(), notes: z.string().max(500).nullish(),
  }),
  appearance: z.object({
    metal: z.enum(['aluminum', 'steel']).default('aluminum'),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#C8102E'),
    rollerColor: z.enum(['red', 'black', 'gray']).default('red'),
    decal: z.object({ text: z.string().max(6), on: z.enum(['front-plate', 'brain-guard']) }).nullish(),
  }).default({}),
  drivetrain: z.object({
    type: z.enum(['tank', 'xdrive', 'mecanum', 'hdrive']),
    motors: MotorSetSchema,
    gearing: GearingSchema,
    wheel: z.object({ kind: z.enum(['omni', 'traction', 'mecanum']), diameterIn: num }),
    wheelsPerSide: num.default(3),
    centerWheelsTraction: z.boolean().nullish(),
    wheelMount: z.enum(['between-rails', 'outboard']).default('between-rails'),
    trackWidthIn: num, wheelBaseIn: num,
    railChannel: z.enum(['1x2x1', '1x3x1', '1x5x1']).default('1x2x1'),
    crossbraces: num.default(3),
    hWheel: z.object({ diameterIn: num, motors: MotorSetSchema }).nullish(),
  }),
  subsystems: z.array(SubsystemSchema).max(10).default([]),
  sensors: z.array(SensorSchema).max(16).default([]),
  electronics: z.object({
    brainMount: z.enum(['rear-top', 'center-top', 'rear-vertical', 'side-left', 'side-right']).default('rear-top'),
    batteryMount: z.enum(['center-low', 'rear-low', 'side-low']).default('center-low'),
    radioMount: z.enum(['top', 'rear']).default('top'),
    pneumatics: z.object({ airTanks: num.default(0), solenoids: num.default(0) }).default({}),
  }).default({}),
  customPartIds: z.array(z.string()).default([]),
  portOverrides: z.record(z.union([z.number(), z.string()])).nullish(),
});
export type RobotSpecInput = z.input<typeof RobotSpecSchema>;

export const PROGRAM_LABEL: Record<Program, string> = {
  V5RC: 'VEX V5 Robotics Competition', VEXU: 'VEX U', VAIRC: 'VEX AI Robotics Competition', Practice: 'Practice',
};

export function motorCount(sets: MotorSet[] | undefined, type?: MotorType) {
  return (sets ?? []).reduce((s, m) => s + (type && m.type !== type ? 0 : m.count), 0);
}

export function subsystemMotors(s: Subsystem): MotorSet[] {
  if ('motors' in s && Array.isArray(s.motors)) return s.motors;
  return [];
}
