import { generate, type GenResult } from './generator';
import { computeMetrics, type Metrics } from './metrics';
import { runRules, type Legality, type RuleCheck } from './rules';
import { assignPorts, type Device, type PortReport } from './ports';
import { buildBom, type BomRow } from './bom';
import { normalizeSpec, type NormalizeNote } from './normalize';
import { OVERRIDE, seasonForProgram, type SeasonRules } from './seasons';
import type { RobotSpec } from './spec';

export interface Derived {
  spec: RobotSpec;
  normalizeReport: NormalizeNote[];
  metrics: Metrics;
  ruleChecks: RuleCheck[];
  devices: Device[];
  portReport: PortReport[];
  bom: BomRow[];
  gen: GenResult;
}

export interface DeriveOpts {
  previous?: RobotSpec | null;
  previousDevices?: Device[];
  season?: SeasonRules;
  printedParts?: { name: string; legality: Legality }[];
}

/** One pipeline: RobotSpec + season → generator → metrics, rules, ports, BOM. */
export function deriveFromSpec(spec: RobotSpec, opts: DeriveOpts = {}, report: NormalizeNote[] = []): Derived {
  const season = seasonForProgram(spec.meta.program, opts.season ?? OVERRIDE);
  const gen = generate(spec, { pose: 0 });
  const max = generate(spec, { pose: 1 });
  const metrics = computeMetrics(spec, gen, max);
  const { devices, report: portReport } = assignPorts(spec, opts.previousDevices);
  const ruleChecks = runRules({ spec, metrics, season, collisions: gen.collisions, devices, printedParts: opts.printedParts });
  const bom = buildBom(gen.parts);
  return { spec, normalizeReport: report, metrics, ruleChecks, devices, portReport, bom, gen };
}

export function derive(input: unknown, opts: DeriveOpts = {}): Derived {
  const { spec, report } = normalizeSpec(input, opts.previous);
  return deriveFromSpec(spec, opts, report);
}

/** Serializable summary (no parts) for APIs and the AI context */
export function derivedSummary(d: Derived) {
  return {
    metrics: d.metrics,
    ruleChecks: d.ruleChecks,
    devices: d.devices,
    bom: d.bom,
    collisions: d.gen.collisions,
    steps: d.gen.steps,
    normalizeReport: d.normalizeReport,
    portReport: d.portReport,
  };
}
