import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, withDefaults } from '@/lib/printing/templates';
import { meshStats, parseStl, partMesh, toStl } from '@/lib/printing/geometry';

describe.each(TEMPLATE_DEFS.map((t) => [t.id]))('printed part template %s', (id) => {
  it('builds a valid manifold that fits a 256 mm bed and round-trips through STL', async () => {
    const m = await partMesh(id, withDefaults(id));
    expect(m.volumeMm3).toBeGreaterThan(0);
    const size = [0, 1, 2].map((k) => m.bbox.max[k] - m.bbox.min[k]);
    expect(Math.max(...size)).toBeLessThanOrEqual(256);
    const stl = toStl(m, id);
    expect(stl.length).toBe(84 + 50 * (m.indices.length / 3));
    const back = meshStats(parseStl(stl));
    expect(back.volumeMm3).toBeCloseTo(m.volumeMm3, -1);
  }, 30_000);
});
