import { describe, expect, it } from 'vitest';
import { parseEnvelope, fallbackEnvelope } from '@/lib/ai/envelope';
import { parseCsv } from '@/lib/services/inventoryItems';
import { estimatePrint } from '@/lib/services/printing';
import { strength } from '@/lib/strength';

describe('AI envelope', () => {
  it('accepts fenced JSON with extra text', () => {
    const env = { ...fallbackEnvelope('Hi!') };
    const r = parseEnvelope('Sure:\n```json\n' + JSON.stringify(env) + '\n```');
    expect(r.ok).toBe(true);
  });
  it('rejects non-JSON', () => {
    expect(parseEnvelope('just words').ok).toBe(false);
  });
});

describe('CSV parsing', () => {
  it('handles quotes, commas and CRLF', () => {
    expect(parseCsv('name,qty\r\n"Screw, 8-32 x 1/2""",100\r\nNut,50\n')).toEqual([['name', 'qty'], ['Screw, 8-32 x 1/2"', '100'], ['Nut', '50']]);
  });
});

describe('print estimator', () => {
  const base = { volumeMm3: 20000, areaMm2: 9000, material: 'PLA', infillPct: 20, layerHeightMm: 0.2, quantity: 1 };
  it('is monotonic in infill and quantity', () => {
    expect(estimatePrint({ ...base, infillPct: 60 }).massG).toBeGreaterThan(estimatePrint(base).massG);
    expect(estimatePrint({ ...base, quantity: 3 }).timeSec).toBeGreaterThan(estimatePrint(base).timeSec);
  });
});

describe('password strength', () => {
  it('scores longer mixed passwords higher', () => {
    expect(strength('short')).toBe(0);
    expect(strength('Correct-Horse-9-Battery')).toBe(4);
  });
});
