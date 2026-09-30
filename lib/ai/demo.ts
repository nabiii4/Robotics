import 'server-only';
import type { EnvelopeT } from './envelope';
import { TEMPLATES } from '../robot/defaults';
import type { RobotSpec, Subsystem, MotorSet } from '../robot/spec';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Rule-based stand-in for the model (AI_MOCK / no keys). It edits the RobotSpec from plain English so the whole
// pipeline — normalize, rules, versions, 3D, code — works end to end. Real answers need an AI key.

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const has = (s: string, re: RegExp) => re.test(s);

function rpmPlan(rpm: number): { cartridge: 'red' | 'green' | 'blue'; gearing: { driving: number; driven: number } | null; label: string } {
  const opts: { c: 'red' | 'green' | 'blue'; g: [number, number] | null }[] = [
    { c: 'blue', g: null }, { c: 'blue', g: [36, 48] }, { c: 'blue', g: [36, 60] }, { c: 'blue', g: [36, 72] }, { c: 'blue', g: [48, 60] }, { c: 'blue', g: [36, 84] },
    { c: 'green', g: null }, { c: 'green', g: [48, 36] }, { c: 'red', g: null },
  ];
  let best = opts[0], bd = Infinity;
  for (const o of opts) {
    const base = o.c === 'blue' ? 600 : o.c === 'green' ? 200 : 100;
    const r = o.g ? (base * o.g[0]) / o.g[1] : base;
    const d = Math.abs(r - rpm);
    if (d < bd) { bd = d; best = o; }
  }
  const base = best.c === 'blue' ? 600 : best.c === 'green' ? 200 : 100;
  const r = best.g ? Math.round((base * best.g[0]) / best.g[1]) : base;
  return { cartridge: best.c, gearing: best.g ? { driving: best.g[0], driven: best.g[1] } : null, label: `${best.c} ${base} rpm${best.g ? `, ${best.g[0]}:${best.g[1]}` : ''} → ${r} rpm` };
}

function uniqueId(spec: RobotSpec, base: string) {
  let id = base, k = 2;
  while (spec.subsystems.some((s) => s.id === id)) id = `${base}-${k++}`;
  return id;
}

function applyDesign(spec: RobotSpec, msg: string, changes: string[]): boolean {
  const m = msg.toLowerCase();
  let touched = false;
  const dt = spec.drivetrain;
  // drivetrain type
  const typeMatch = /\b(tank|mecanum|x-?drive|h-?drive)\b/.exec(m);
  if (typeMatch) {
    const t = typeMatch[1].replace('-', '') as 'tank' | 'mecanum' | 'xdrive' | 'hdrive';
    if (t !== dt.type) {
      changes.push(`Drivetrain: ${dt.type} → ${t}`);
      dt.type = t;
      if (t === 'mecanum') { dt.wheel = { kind: 'mecanum', diameterIn: 4 }; dt.wheelMount = 'outboard'; dt.wheelsPerSide = 2; dt.motors.count = 4; }
      if (t === 'xdrive') { dt.wheel = { kind: 'omni', diameterIn: 4 }; dt.wheelMount = 'outboard'; dt.motors.count = 4; dt.wheelBaseIn = dt.trackWidthIn; }
      if (t === 'tank' || t === 'hdrive') { if (dt.wheel.kind === 'mecanum') dt.wheel = { kind: 'omni', diameterIn: 3.25 }; dt.wheelMount = 'between-rails'; }
      if (t === 'hdrive') dt.hWheel = { diameterIn: 3.25, motors: { type: '11W', count: 1, cartridge: 'green' } };
      touched = true;
    }
  }
  // motor count on the drive
  const mc = /(\d+)[\s-]*motors?\b/.exec(m);
  if (mc && (has(m, /drive|tank|mecanum|chassis|drivetrain/) || !has(m, /intake|lift|arm|launcher|catapult|flywheel/))) {
    const n = Number(mc[1]);
    if (n !== dt.motors.count) { changes.push(`Drive motors: ${dt.motors.count} → ${n}`); dt.motors.count = n; touched = true; }
  }
  // wheels
  const wm = /(2\.75|3\.25|4|2)\s*(?:-?\s*inch(?:es)?|in\b|"|″)\s*(omni|traction|mecanum)?/.exec(m) ?? /(omni|traction|mecanum)\s*wheels?/.exec(m);
  if (wm) {
    const d = wm[1] && /\d/.test(wm[1]) ? Number(wm[1]) : dt.wheel.diameterIn;
    const kindWord = (wm[2] ?? (/\d/.test(wm[1]) ? undefined : wm[1])) as 'omni' | 'traction' | 'mecanum' | undefined;
    const kind = kindWord ?? (dt.type === 'mecanum' ? 'mecanum' : dt.wheel.kind);
    if (d !== dt.wheel.diameterIn || kind !== dt.wheel.kind) {
      changes.push(`Wheels: ${dt.wheel.diameterIn}″ ${dt.wheel.kind} → ${d}″ ${kind}`);
      dt.wheel = { kind, diameterIn: d as 2 | 2.75 | 3.25 | 4 };
      if (kind === 'mecanum') dt.type = 'mecanum';
      else if (dt.type === 'mecanum') { dt.type = 'tank'; dt.wheelMount = 'between-rails'; }
      touched = true;
    }
  }
  if (dt.type === 'tank' && dt.motors.count >= 6 && dt.wheelsPerSide < dt.motors.count / 2) { dt.wheelsPerSide = Math.min(4, dt.motors.count / 2) as 2 | 3 | 4; }
  // speed
  const rpm = /(\d{3})\s*rpm/.exec(m);
  if (rpm) {
    const plan = rpmPlan(Number(rpm[1]));
    dt.motors.type = '11W'; dt.motors.cartridge = plan.cartridge; dt.gearing = plan.gearing as any;
    changes.push(`Drive gearing: ${plan.label} at the wheel`);
    touched = true;
  } else if (has(m, /\bfaster\b|more speed|speed it up/)) {
    const plan = rpmPlan(dt.motors.cartridge === 'blue' && dt.gearing ? 480 : 450);
    dt.motors.type = '11W'; dt.motors.cartridge = plan.cartridge; dt.gearing = plan.gearing as any;
    changes.push(`Drive gearing: ${plan.label} at the wheel`);
    touched = true;
  } else if (has(m, /\b(stronger|more torque|push harder)\b/)) {
    const plan = rpmPlan(360);
    dt.motors.type = '11W'; dt.motors.cartridge = plan.cartridge; dt.gearing = plan.gearing as any;
    if (dt.type === 'tank') dt.centerWheelsTraction = true;
    changes.push(`Drive gearing: ${plan.label} at the wheel (more push)`);
    touched = true;
  }
  if (has(m, /\bwider\b/)) { dt.trackWidthIn += 1; changes.push(`Track width +1 in`); touched = true; }
  if (has(m, /\bnarrower\b/)) { dt.trackWidthIn -= 1; changes.push(`Track width −1 in`); touched = true; }
  if (has(m, /\blonger\b/)) { dt.wheelBaseIn += 1; changes.push(`Wheelbase +1 in`); touched = true; }
  if (has(m, /\bshorter\b/)) { dt.wheelBaseIn -= 1; changes.push(`Wheelbase −1 in`); touched = true; }
  if (has(m, /\bsteel\b/)) { spec.appearance.metal = 'steel'; changes.push('Structure: steel'); touched = true; }
  if (has(m, /\balumin(i)?um\b/)) { spec.appearance.metal = 'aluminum'; changes.push('Structure: aluminum'); touched = true; }

  // remove
  const rm = /(?:remove|drop|delete|get rid of|take off)\s+(?:the\s+)?(\w+)/.exec(m);
  if (rm) {
    const word = rm[1];
    const idx = spec.subsystems.findIndex((s) => s.name.toLowerCase().includes(word) || s.type.includes(word) || ('variant' in s && String(s.variant).includes(word)));
    if (idx >= 0) { changes.push(`Removed ${spec.subsystems[idx].name}`); spec.subsystems.splice(idx, 1); touched = true; }
  }
  const adding = has(m, /\b(add|put|give|mount|build|with|want|need|make)\b/);
  const pos = has(m, /\b(back|rear)\b/) ? 'rear' : has(m, /\bfront\b/) ? 'front' : null;
  const findType = (t: string) => spec.subsystems.find((s) => s.type === t);
  if (adding && has(m, /clamp|mogo|goal grabber/) && !findType('clamp')) {
    spec.subsystems.push({ id: uniqueId(spec, 'clamp'), name: 'Clamp', status: 'planned', type: 'clamp', variant: has(m, /motor|claw/) ? 'motor-claw' : 'pneumatic-clamp', position: (pos ?? 'rear') as 'front' | 'rear', cylinders: { strokeMm: 50, count: 2 } } as Subsystem);
    changes.push(`Added ${pos ?? 'rear'} ${has(m, /motor|claw/) ? 'motor claw' : 'pneumatic clamp (2 × 50 mm cylinders)'}`);
    touched = true;
  }
  if (adding && has(m, /intake|roller|pick up|grab/) && !findType('intake')) {
    spec.subsystems.push({ id: uniqueId(spec, 'intake'), name: 'Intake', status: 'planned', type: 'intake', variant: 'flex-wheel-roller', position: (pos === 'rear' ? 'rear' : 'front'), stages: has(m, /two|2|stage|high|up/) ? 2 : 1, widthIn: 10, rollerCount: 3, rollerDiameterIn: 2.5, liftHeightIn: 6, pivot: 'fixed', motors: [{ type: '5.5W', count: 1 }] } as Subsystem);
    changes.push('Added a front flex-wheel intake on a 5.5 W motor');
    touched = true;
  }
  if (adding && has(m, /\b(lift|arm|four[- ]bar|dr4b)\b/) && !findType('lift')) {
    const variant = has(m, /four[- ]bar/) ? 'four-bar' : has(m, /dr4b/) ? 'dr4b' : 'arm';
    spec.subsystems.push({ id: uniqueId(spec, 'lift'), name: 'Lift', status: 'planned', type: 'lift', variant, towerHeightIn: 12, armLengthIn: 11, maxAngleDeg: 100, motors: [{ type: '11W', count: 1, cartridge: 'red' }], gearing: { driving: 12, driven: 84 }, rubberBands: 4, endEffector: has(m, /claw/) ? 'claw' : 'fork' } as Subsystem);
    changes.push(`Added a ${variant} lift on one red 11 W motor with 12:84 and rubber bands`);
    touched = true;
  }
  if (adding && has(m, /catapult|flywheel|launcher|puncher|shooter/) && !findType('launcher')) {
    const variant = has(m, /flywheel|shooter/) ? 'flywheel' : has(m, /puncher/) ? 'puncher' : 'catapult';
    spec.subsystems.push({ id: uniqueId(spec, 'launcher'), name: 'Launcher', status: 'planned', type: 'launcher', variant, motors: [{ type: '11W', count: 1, cartridge: variant === 'flywheel' ? 'blue' : 'red' }], gearing: variant === 'flywheel' ? null : { driving: 12, driven: 84 }, flywheelDiameterIn: 4, rubberBands: variant === 'flywheel' ? 0 : 6 } as Subsystem);
    changes.push(`Added a ${variant}`);
    touched = true;
  }
  if (adding && has(m, /wings?/) && !findType('wing')) {
    spec.subsystems.push({ id: uniqueId(spec, 'wings'), name: 'Wings', status: 'planned', type: 'wing', actuation: 'pneumatic', position: 'both-sides', lengthIn: 8, cylinders: { strokeMm: 50, count: 1 } } as Subsystem);
    changes.push('Added pneumatic wings on both sides');
    touched = true;
  }
  if (adding && has(m, /\bhang\b|climb/) && !findType('hang')) {
    spec.subsystems.push({ id: uniqueId(spec, 'hang'), name: 'Hang', status: 'planned', type: 'hang', actuation: 'pneumatic', position: 'rear', lengthIn: 10, cylinders: { strokeMm: 75, count: 1 } } as Subsystem);
    changes.push('Added a pneumatic hang');
    touched = true;
  }
  if (adding && has(m, /tracking wheels?|odom/) && !findType('tracking-wheels')) {
    spec.subsystems.push({ id: uniqueId(spec, 'tracking'), name: 'Tracking Wheels', status: 'planned', type: 'tracking-wheels', count: 2, diameterIn: 2 } as Subsystem);
    changes.push('Added 2 tracking wheels on rotation sensors');
    touched = true;
  }
  for (const st of ['inertial', 'optical', 'distance', 'gps', 'rotation'] as const) {
    if (adding && new RegExp(`${st}( sensor)?`).test(m) && !spec.sensors.some((s) => s.type === st)) {
      spec.sensors.push({ id: `${st}-${spec.sensors.length + 1}`, type: st, attachTo: st === 'optical' ? findType('intake')?.id ?? 'chassis' : st === 'rotation' ? findType('lift')?.id ?? 'drivetrain' : 'chassis', mount: st === 'distance' ? 'front' : undefined } as any);
      changes.push(`Added ${st} sensor`);
      touched = true;
    }
  }
  if (has(m, /5\.5\s*w/) && has(m, /intake/)) {
    const it = findType('intake') as any;
    if (it) { it.motors = [{ type: '5.5W', count: 1 }]; changes.push('Intake on a 5.5 W motor'); touched = true; }
  }
  if (has(m, /(pneumatic|piston)/)) {
    const needs = spec.subsystems.some((s: any) => s.variant === 'pneumatic-clamp' || s.actuation === 'pneumatic' || s.pivot === 'pneumatic');
    if (needs && spec.electronics.pneumatics.airTanks === 0) spec.electronics.pneumatics.airTanks = 1;
  }
  return touched;
}

function motorAdvice(spec: RobotSpec) {
  const lines = [`- **Drivetrain:** ${spec.drivetrain.motors.count} × 11 W ${spec.drivetrain.motors.cartridge ?? ''} — blue 600 rpm geared 36:48 is the competitive default (450 rpm at the wheel).`];
  for (const s of spec.subsystems) {
    if (s.type === 'intake') lines.push(`- **${s.name}:** a 5.5 W motor (fixed 200 rpm) saves power; use an 11 W green if it stalls.`);
    if (s.type === 'lift') lines.push(`- **${s.name}:** 11 W red (100 rpm) or a 12:60 / 12:84 reduction, plus rubber bands.`);
    if (s.type === 'launcher') lines.push(`- **${s.name}:** ${s.variant === 'flywheel' ? '11 W blue geared up' : '11 W red behind a 12:84 slip gear'}.`);
  }
  return lines.join('\n');
}

export function demoEnvelope(ctx: Record<string, any>, message: string, mode: 'chat' | 'create'): EnvelopeT {
  const env: EnvelopeT = { reply: '', intent: 'question', robotSpec: null, changeSummary: [], customParts: [], codeSuggestion: null, inventoryActions: [], printActions: [], memory: [], followUps: [], clarifyingQuestion: null };
  const m = message.toLowerCase();
  const name = ctx.STUDENT?.firstName ?? 'there';
  const cur: RobotSpec | null = ctx.CURRENT_BUILD?.spec ?? null;
  const metrics = ctx.CURRENT_BUILD?.metrics;
  const mem: { id: string; text: string }[] = ctx.MEMORY ?? [];

  // crisis messages are handled before the model is called; memory ops
  const pref = /\bi (?:prefer|like|love|enjoy)\s+(.{3,120})/i.exec(message);
  if (pref) env.memory.push({ op: 'add', category: 'preference', text: `Prefers ${pref[1].replace(/[.!?]+$/, '')}`, importance: 3 });
  const role = /\bi(?:'m| am) (?:the |a |our )?(programmer|builder|driver|designer|captain|notebook\w*)/i.exec(message);
  if (role) env.memory.push({ op: 'add', category: 'role', text: `Works as the team's ${role[1].toLowerCase()}`, importance: 4 });
  const forget = /\bforget (?:that |about )?(.{3,120})/i.exec(message);
  if (forget) env.memory.push({ op: 'forget', text: forget[1] });

  if (/what do you (remember|know) about me/i.test(message)) {
    env.reply = mem.length ? `Here’s what I remember, ${name}:\n\n${mem.map((x) => `- ${x.text}`).join('\n')}\n\nYou can edit or delete any of these in Settings → AI Mentor & Memory.` : `I don’t have any memories about you yet, ${name}. Tell me things like “I prefer C++ examples” and I’ll remember them.`;
    env.followUps = ['Forget that', 'Give me design tips'];
    return env;
  }
  if (forget && !/robot|build|design/.test(m)) {
    env.reply = `Okay — I’ve forgotten that.`;
    return env;
  }

  // design
  const designWords = /make|build|design|change|add|remove|faster|stronger|drive|intake|lift|arm|claw|clamp|wheel|gear|motor|launcher|catapult|flywheel|pneumatic|wider|taller|shorter|rpm|tank|mecanum|wings?|hang/;
  if (mode === 'create' || (cur && designWords.test(m) && !/\?\s*$/.test(message.trim()) && !/^(what|which|how|why|should)\b/i.test(message.trim()))) {
    let spec: RobotSpec = cur ? clone(cur) : clone(TEMPLATES['competition-base'].spec(ctx.NEW_BUILD_NAME ?? 'New Robot'));
    const changes: string[] = [];
    if (!cur) {
      changes.push('Started from a 6-motor 450 rpm tank drive on 3.25″ omni wheels');
      spec.subsystems = [];
      if (/pick|grab|intake|collect|pins|cups|balls|rings/.test(m)) {
        spec.subsystems.push({ id: 'intake', name: 'Intake', status: 'planned', type: 'intake', variant: 'flex-wheel-roller', position: 'front', stages: 2, widthIn: 10, rollerCount: 3, rollerDiameterIn: 2.5, liftHeightIn: 6, pivot: 'fixed', motors: [{ type: '5.5W', count: 1 }] });
        changes.push('Added a 2-stage front intake on a 5.5 W motor');
      }
      if (/cup|goal|stack|hold|clamp/.test(m)) {
        spec.subsystems.push({ id: 'clamp', name: 'Clamp', status: 'planned', type: 'clamp', variant: 'pneumatic-clamp', position: 'rear', cylinders: { strokeMm: 50, count: 2 } });
        spec.electronics.pneumatics = { airTanks: 1, solenoids: 1 };
        changes.push('Added a rear pneumatic clamp (2 × 50 mm cylinders, 1 air tank)');
      }
      applyDesign(spec, message, changes);
    } else if (!applyDesign(spec, message, changes)) {
      spec = null as unknown as RobotSpec;
    }
    if (spec) {
      env.robotSpec = spec;
      env.intent = 'design_change';
      env.changeSummary = changes.slice(0, 8);
      const power = (spec.drivetrain.motors.count * (spec.drivetrain.motors.type === '11W' ? 11 : 5.5)) + spec.subsystems.reduce((s, x: any) => s + ((x.motors ?? []) as MotorSet[]).reduce((t: number, mm: MotorSet) => t + (mm.type === '11W' ? 11 : 5.5) * mm.count, 0), 0);
      env.reply = `${cur ? 'Updated' : 'Here’s your robot'}, ${name}!\n\n${changes.map((c) => `- ${c}`).join('\n')}\n\n${power > 88 ? `Heads up: that adds up to about ${power} W of motors, which is over the 88 W V5RC limit — the app will flag it.` : 'The app recalculated the size, speed, weight and rule checks — see the Design change card.'}`;
      env.followUps = cur ? ['Show the new top speed', 'Add a rotation sensor to the lift', 'Explain the gearing'] : ['Make it faster', 'Add a lift', 'What motor should I use?'];
      if (!cur) env.clarifyingQuestion = 'Do you want the intake to score high (two stages) or just collect?';
      return env;
    }
  }

  if (/rule|legal|allowed|inspect|manual|size limit/.test(m)) {
    const r = ctx.SEASON_RULES ?? {};
    env.intent = 'rules';
    env.reply = `Key robot rules for **${r.season ?? 'this season'}**:\n\n- Start inside **${(r.startSizeIn ?? [18, 18, 18]).join(' × ')} in**.\n- Total motor power **≤ ${r.maxMotorPowerW ?? 88} W** (11 W and 5.5 W V5 Smart Motors).\n- One Brain, ${r.smartPorts ?? 21} smart ports, ${r.threeWirePorts ?? 8} three-wire ports.\n- 3D-printed parts only as non-functional decorations or license plates.\n\nAlways check the current Game Manual and the official Q&A.`;
    env.followUps = ['Does our robot fit the 18″ box?', 'How much motor power are we using?'];
    return env;
  }
  if (/what motor|which motor|cartridge/.test(m) && cur) {
    env.reply = `Here’s what I’d use, ${name}:\n\n${motorAdvice(cur)}\n\n${metrics ? `Right now you’re at **${metrics.motorPowerW} W** of the 88 W limit.` : ''}`;
    env.followUps = ['Make the drive faster', 'Move the intake to a 5.5 W motor'];
    return env;
  }
  if (/design tips|tips/.test(m) && cur && metrics) {
    env.reply = `Three tips for **${ctx.CURRENT_BUILD.name}**:\n\n1. Top speed is **${metrics.topSpeedInPerS} in/s** — ${metrics.topSpeedInPerS < 55 ? 'a blue 600 rpm cartridge geared 36:48 would roughly double it.' : 'that’s competitive; add traction wheels in the middle for pushing.'}\n2. Start size is **${metrics.startSize.length} × ${metrics.startSize.width} × ${metrics.startSize.height} in** — keep about 0.25″ of margin inside the 18″ box.\n3. You’re using **${metrics.motorPowerW} W** — ${metrics.motorPowerW > 80 ? 'little room left; consider pneumatics for new mechanisms.' : 'there’s room for another mechanism.'}`;
    env.followUps = ['Make it faster', 'Add a rotation sensor'];
    return env;
  }
  if (/explain|what does this code|code/.test(m) && ctx.CODE_CONTEXT) {
    const code: string = ctx.CODE_CONTEXT.code;
    const fns = [...code.matchAll(/\d+: \s*void\s+(\w+)\s*\(/g)].map((x) => x[1]);
    const calls = [...new Set([...code.matchAll(/(\w+)\.(spin|driveFor|turnFor|stop|setStopping|print|pressing)\(/g)].map((x) => `${x[1]}.${x[2]}()`))].slice(0, 6);
    env.intent = 'code_help';
    env.reply = `**${ctx.CODE_CONTEXT.path}** step by step:\n\n${fns.length ? `- It defines ${fns.map((f) => `\`${f}()\``).join(', ')}.\n` : ''}${calls.map((c) => `- \`${c}\` — ${c.includes('driveFor') ? 'drives a set distance, then continues' : c.includes('spin') ? 'starts the motor spinning until you stop it' : c.includes('pressing') ? 'reads a controller button (true while held)' : c.includes('setStopping') ? 'sets what the motor does when stopped' : c.includes('print') ? 'prints on the Brain screen' : 'VEX API call'}`).join('\n')}\n\nTip: every loop needs \`wait(20, msec);\` and every spin needs a matching stop branch.`;
    if (/intakeMotor\.spin/.test(code) && !/intakeMotor\.stop/.test(code)) {
      env.codeSuggestion = { path: ctx.CODE_CONTEXT.path, language: 'cpp', explanation: 'Adds reverse on R2 and a brake when no button is held, so the intake stops.', code: code.split('\n').map((l) => l.replace(/^\d+: /, '')).join('\n').replace(/(\s*)intakeMotor\.spin\(forward, 100, percent\);\n(\s*)\}/, '$1intakeMotor.spin(forward, 100, percent);\n$2} else if (Controller1.ButtonR2.pressing()) {\n$1intakeMotor.spin(reverse, 100, percent);\n$2} else {\n$1intakeMotor.stop(brake);\n$2}') };
    }
    env.followUps = ['Help me debug', 'Add a lift button map'];
    return env;
  }
  if (/debug|troubleshoot|broken|not working|doesn.?t work|problem/.test(m)) {
    env.intent = 'troubleshoot';
    env.reply = `Let’s figure it out, ${name}. First checks:\n\n1. Does the Brain’s **Devices** screen show every motor on the right port?\n2. Is the battery above 50%?\n3. Does the problem happen in driver control, autonomous, or both?`;
    env.clarifyingQuestion = 'What exactly happens — does a motor not move, move the wrong way, or stop early?';
    env.followUps = ['A motor spins the wrong way', 'The robot drifts when driving straight'];
    return env;
  }
  if (/print|stl|bracket|mount/.test(m)) {
    env.intent = 'print';
    env.customParts = [{ template: 'sensor-mount', name: 'Sensor Mount', params: { sensor: 'distance', wallMm: 2, windowCutout: true, mountHoles: 2 }, material: 'PLA', color: 'black', quantity: 1, purpose: 'Holds a distance sensor on the front crossbrace' }];
    env.reply = `I can make that as a parametric printed part — see the proposal card. **Note:** in V5RC, 3D-printed parts are only legal as non-functional decorations or license plates, so use this for practice robots, prototypes and VEX U / VEX AI.`;
    env.followUps = ['Make it a U-bracket instead', 'Send it to the printer'];
    return env;
  }
  if (/inventory|stock|parts|order|have enough/.test(m)) {
    const low = ctx.INVENTORY_HINTS?.lowStock ?? [];
    env.intent = 'parts';
    env.reply = low.length ? `These are low right now:\n\n${low.slice(0, 6).map((i: any) => `- ${i.name}: ${i.onHand} left (min ${i.min})`).join('\n')}\n\nWant me to add them to the order list?` : 'Nothing is low on stock right now.';
    if (low[0]) env.inventoryActions = [{ type: 'add_to_order', item: low[0].name, qty: Math.max(5, low[0].min * 2) }];
    return env;
  }
  if (pref || role) {
    env.reply = `Got it, ${name} — I’ll remember that.`;
    return env;
  }
  env.reply = cur
    ? `Hi ${name}! I can change **${ctx.CURRENT_BUILD.name}** from a sentence (“make it a 6-motor tank drive with 3.25 inch omni wheels at 450 rpm”), explain code, check rules, or plan parts. What would you like to work on?`
    : `Hi ${name}! I’m the FDR Robotics AI mentor. Ask me about your design, code, parts, or competition rules!`;
  env.followUps = ['Give me design tips', 'What motor should I use?', 'Competition rules'];
  return env;
}
