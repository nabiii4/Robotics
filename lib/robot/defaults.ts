import type { RobotSpec } from './spec';

const base = (name: string, over: Partial<RobotSpec>): RobotSpec => ({
  schemaVersion: 1,
  meta: { name, program: 'V5RC', season: 'V5RC 2026–27 Override' },
  appearance: { metal: 'aluminum', accentColor: '#C8102E', rollerColor: 'red' },
  drivetrain: {
    type: 'tank', motors: { type: '11W', count: 4, cartridge: 'green' }, gearing: null,
    wheel: { kind: 'omni', diameterIn: 4 }, wheelsPerSide: 2, wheelMount: 'between-rails',
    trackWidthIn: 12, wheelBaseIn: 10, railChannel: '1x2x1', crossbraces: 3,
  },
  subsystems: [],
  sensors: [{ id: 'imu', type: 'inertial', attachTo: 'chassis', mount: 'center' }],
  electronics: { brainMount: 'rear-top', batteryMount: 'center-low', radioMount: 'top', pneumatics: { airTanks: 0, solenoids: 0 } },
  customPartIds: [],
  portOverrides: {},
  ...over,
});

/** Appendix D — "2026 Competition Robot" v3 (the reference renders). */
export const SEED_SPEC: RobotSpec = {
  schemaVersion: 1,
  meta: {
    name: '2026 Competition Robot', tagline: 'High Stakes, Higher Standards', program: 'V5RC',
    season: 'V5RC 2026–27 Override', drawingPrefix: '2026_Robot', notes: 'Seed design styled after the reference renders.',
  },
  appearance: { metal: 'aluminum', accentColor: '#C8102E', rollerColor: 'red', decal: { text: 'FDR', on: 'front-plate' } },
  drivetrain: {
    type: 'mecanum', motors: { type: '11W', count: 4, cartridge: 'green' }, gearing: null,
    wheel: { kind: 'mecanum', diameterIn: 4 }, wheelsPerSide: 2, wheelMount: 'outboard',
    trackWidthIn: 14.5, wheelBaseIn: 11.5, railChannel: '1x2x1', crossbraces: 3,
  },
  subsystems: [
    { id: 'intake', name: 'Intake', status: 'complete', type: 'intake', variant: 'flex-wheel-roller', position: 'front', stages: 2,
      widthIn: 11, rollerCount: 4, rollerDiameterIn: 2, liftHeightIn: 6, pivot: 'fixed', motors: [{ type: '5.5W', count: 1 }] },
    { id: 'lift', name: 'Lift', status: 'in_progress', type: 'lift', variant: 'arm', towerHeightIn: 14, armLengthIn: 13, maxAngleDeg: 100,
      motors: [{ type: '11W', count: 2, cartridge: 'red' }], gearing: { driving: 12, driven: 60 }, rubberBands: 4, endEffector: 'fork' },
    { id: 'launcher', name: 'Launcher', status: 'planned', type: 'launcher', variant: 'catapult',
      motors: [{ type: '11W', count: 1, cartridge: 'red' }], gearing: { driving: 12, driven: 84 }, rubberBands: 6 },
  ],
  sensors: [
    { id: 'imu', type: 'inertial', attachTo: 'chassis', mount: 'center' },
    { id: 'lift-rot', type: 'rotation', attachTo: 'lift' },
    { id: 'intake-optical', type: 'optical', attachTo: 'intake' },
  ],
  electronics: { brainMount: 'rear-top', batteryMount: 'center-low', radioMount: 'top', pneumatics: { airTanks: 0, solenoids: 0 } },
  customPartIds: [],
  portOverrides: {},
};

export const TEMPLATES: Record<string, { label: string; description: string; spec: (name: string) => RobotSpec }> = {
  'competition-base': {
    label: 'Competition Base',
    description: '6-motor 450 rpm tank drive on 3.25″ omni wheels with a front intake',
    spec: (name) => base(name, {
      drivetrain: {
        type: 'tank', motors: { type: '11W', count: 6, cartridge: 'blue' }, gearing: { driving: 36, driven: 48 },
        wheel: { kind: 'omni', diameterIn: 3.25 }, wheelsPerSide: 3, centerWheelsTraction: true, wheelMount: 'between-rails',
        trackWidthIn: 11.5, wheelBaseIn: 11, railChannel: '1x2x1', crossbraces: 3,
      },
      subsystems: [{ id: 'intake', name: 'Intake', status: 'planned', type: 'intake', variant: 'flex-wheel-roller', position: 'front', stages: 1,
        widthIn: 10, rollerCount: 2, rollerDiameterIn: 2.5, pivot: 'fixed', motors: [{ type: '5.5W', count: 1 }] }],
    }),
  },
  clawbot: {
    label: 'Clawbot-style Starter',
    description: '4-motor tank, 4″ wheels, a simple arm with a claw',
    spec: (name) => base(name, {
      drivetrain: {
        type: 'tank', motors: { type: '11W', count: 2, cartridge: 'green' }, gearing: null,
        wheel: { kind: 'traction', diameterIn: 4 }, wheelsPerSide: 2, wheelMount: 'outboard',
        trackWidthIn: 13, wheelBaseIn: 10, railChannel: '1x2x1', crossbraces: 2,
      },
      subsystems: [
        { id: 'arm', name: 'Arm', status: 'planned', type: 'lift', variant: 'arm', towerHeightIn: 10, armLengthIn: 10, maxAngleDeg: 90,
          motors: [{ type: '11W', count: 1, cartridge: 'red' }], gearing: { driving: 12, driven: 84 }, rubberBands: 2, endEffector: 'claw' },
      ],
    }),
  },
  xdrive: {
    label: 'X-Drive',
    description: '4 corner omni wheels at 45°, strafes in any direction',
    spec: (name) => base(name, {
      drivetrain: {
        type: 'xdrive', motors: { type: '11W', count: 4, cartridge: 'green' }, gearing: null,
        wheel: { kind: 'omni', diameterIn: 4 }, wheelsPerSide: 2, wheelMount: 'outboard',
        trackWidthIn: 12, wheelBaseIn: 12, railChannel: '1x2x1', crossbraces: 2,
      },
    }),
  },
  mecanum: {
    label: 'Mecanum',
    description: '4 mecanum wheels in an X pattern, strafes',
    spec: (name) => base(name, {
      drivetrain: {
        type: 'mecanum', motors: { type: '11W', count: 4, cartridge: 'green' }, gearing: null,
        wheel: { kind: 'mecanum', diameterIn: 4 }, wheelsPerSide: 2, wheelMount: 'outboard',
        trackWidthIn: 13.5, wheelBaseIn: 11, railChannel: '1x2x1', crossbraces: 3,
      },
    }),
  },
  blank: {
    label: 'Blank Chassis',
    description: '4-motor tank chassis with nothing on it yet',
    spec: (name) => base(name, {}),
  },
};
