// Season profiles (spec §13.5). Stored in season_profiles.rules_json and editable by admins.
export interface RuleField<T> { value: T; ruleRef?: string; note?: string; verified: boolean }
export interface SeasonRules {
  id: string;
  name: string;
  program: string;
  years: string;
  manualUrl?: string;
  qnaUrl?: string;
  manualRuleUrlTemplate?: string;
  rules: {
    startSizeIn: RuleField<[number, number, number]>;
    maxMotorPowerW: RuleField<number>;
    smartPorts: RuleField<number>;
    threeWirePorts: RuleField<number>;
    brainCount: RuleField<number>;
    batteryCount: RuleField<number>;
    maxAirTanks: RuleField<number>;
    maxPsi: RuleField<number>;
    printedFunctionalPartsLegal: RuleField<boolean>;
  };
  match?: { field: string; autonomousSec: number; driverSec: number; verified: boolean };
  gameElements?: string[];
  notes?: string;
}

export const OVERRIDE: SeasonRules = {
  id: 'v5rc-2026-27-override',
  name: 'Override', program: 'V5RC', years: '2026–27',
  manualUrl: 'https://www.vexrobotics.com/override-manual',
  qnaUrl: 'https://events.vex.com/V5RC/2026-2027/QA',
  manualRuleUrlTemplate: 'https://events.vex.com/storage/game_manual/VEX_V5_Robotics_Competition_2026-2027_Override/rules/{id}.html',
  rules: {
    startSizeIn: { value: [18, 18, 18], ruleRef: '<R3>', verified: true },
    maxMotorPowerW: { value: 88, note: 'Any mix of V5 Smart Motor (11W) 276-4840 and (5.5W) 276-4842', verified: true },
    smartPorts: { value: 21, verified: true },
    threeWirePorts: { value: 8, verified: true },
    brainCount: { value: 1, verified: false },
    batteryCount: { value: 1, verified: false },
    maxAirTanks: { value: 2, verified: false },
    maxPsi: { value: 100, verified: false },
    printedFunctionalPartsLegal: { value: false, note: '3D-printed parts only as non-functional decorations or custom license plates', verified: false },
  },
  match: { field: '12 ft × 12 ft', autonomousSec: 15, driverSec: 105, verified: false },
  gameElements: ['Pins', 'Cups'],
  notes: 'Expansion and possession limits apply — see the Game Manual.',
};

export const VEXU: SeasonRules = {
  ...OVERRIDE,
  id: 'vexu-2026-27', name: 'VEX U', program: 'VEXU',
  rules: {
    ...OVERRIDE.rules,
    startSizeIn: { value: [24, 24, 24], ruleRef: '<VUR3>', note: 'Second robot must fit 15 × 15 × 15 in', verified: false },
    maxMotorPowerW: { value: 88, verified: false },
    printedFunctionalPartsLegal: { value: true, note: 'Custom printed parts allowed', verified: false },
  },
};

export const PRACTICE: SeasonRules = {
  ...OVERRIDE,
  id: 'practice', name: 'Practice', program: 'Practice',
  rules: {
    startSizeIn: { value: [36, 36, 36], note: 'No competition size limit — physical sanity only', verified: true },
    maxMotorPowerW: { value: 1000, verified: true },
    smartPorts: { value: 21, verified: true },
    threeWirePorts: { value: 8, verified: true },
    brainCount: { value: 1, verified: true },
    batteryCount: { value: 1, verified: true },
    maxAirTanks: { value: 10, verified: true },
    maxPsi: { value: 100, verified: true },
    printedFunctionalPartsLegal: { value: true, verified: true },
  },
};

export const SEASONS = [OVERRIDE, VEXU, PRACTICE];

export function seasonForProgram(program: string, active: SeasonRules = OVERRIDE): SeasonRules {
  if (program === 'Practice') return PRACTICE;
  if (program === 'VEXU' || program === 'VAIRC') return VEXU;
  return active;
}

export function compactRules(s: SeasonRules) {
  const r = s.rules;
  return {
    season: `${s.program} ${s.years} ${s.name}`,
    startSizeIn: r.startSizeIn.value, maxMotorPowerW: r.maxMotorPowerW.value, smartPorts: r.smartPorts.value,
    threeWirePorts: r.threeWirePorts.value, maxAirTanks: r.maxAirTanks.value,
    printedFunctionalPartsLegal: r.printedFunctionalPartsLegal.value, match: s.match, gameElements: s.gameElements, notes: s.notes,
  };
}
