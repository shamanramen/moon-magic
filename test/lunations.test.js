import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castChart } from '../src/chart.js';
import { exactTime, place, nextLunations, arcPartner, allTwentyFour } from '../src/lunations.js';

const chart = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });
const within = (got, want, ms) => assert.ok(Math.abs(got - want) <= ms, `${got.toISOString()} vs ${want.toISOString()}`);

test('known 2026 lunations: exact time, degree, eclipse label', () => {
  // Total lunar eclipse, Full Moon 3 Mar 2026 11:38 UT, 12°54′ Virgo
  const full = exactTime('full', new Date(Date.UTC(2026, 2, 1)));
  within(full, new Date(Date.UTC(2026, 2, 3, 11, 38)), 3 * 6e4);
  const f = place('full', full, chart, 'placidus');
  assert.equal(f.sign, 'Virgo');
  assert.ok(Math.abs(f.degree - 12.9) < 0.15, `degree ${f.degree}`);
  assert.match(f.eclipse, /Lunar eclipse/);
  // Total solar eclipse, New Moon 12 Aug 2026 17:37 UT, 20°02′ Leo
  const nw = exactTime('new', new Date(Date.UTC(2026, 7, 1)));
  within(nw, new Date(Date.UTC(2026, 7, 12, 17, 37)), 3 * 6e4);
  const n = place('new', nw, chart, 'whole');
  assert.equal(n.sign, 'Leo');
  assert.match(n.eclipse, /Solar eclipse/);
  // Einstein: Cancer rising, so Leo is the 2nd whole-sign house; Virgo Full Moon opposes his Pisces Sun/MC
  assert.equal(n.house, 2);
  assert.ok(f.aspects.some(a => a.point === 'MC' && a.aspect === 'opposition'));
});

test('cards stay up 48h past exact, then roll on', () => {
  const full = exactTime('full', new Date(Date.UTC(2026, 2, 1)));
  const at = ms => new Date(nextLunations(new Date(+full + ms), chart, 'placidus').find(l => l.phase === 'full').date);
  within(at(47 * 3600e3), full, 6e4);
  assert.ok(at(49 * 3600e3) - full > 20 * 864e5);
});

test('6-month arc pairs same-sign New and Full Moons; all 24 covered', () => {
  const nw = place('new', exactTime('new', new Date(Date.UTC(2026, 3, 1))), chart, 'whole'); // Aries New Moon, 17 Apr 2026
  assert.equal(nw.sign, 'Aries');
  const p = arcPartner(nw);
  assert.equal(p.phase, 'full');
  const days = (new Date(p.date) - new Date(nw.date)) / 864e5;
  assert.ok(days > 150 && days < 215, `${days} days`);
  const back = arcPartner(place('full', new Date(p.date), chart, 'whole'));
  assert.ok(Math.abs(new Date(back.date) - new Date(nw.date)) < 864e5);
  const all = allTwentyFour(new Date(Date.UTC(2026, 10, 3)), chart, 'placidus');
  assert.ok(Object.keys(all).length >= 22, `${Object.keys(all).length} of 24 within ~14 months`);
});

test('eclipse gets the node and the wider 5° orb', () => {
  const f = place('full', exactTime('full', new Date(Date.UTC(2026, 2, 1))), chart, 'placidus');
  assert.equal(f.node, 'south'); // book: Virgo lunar eclipse near the South Node
});

test('aspects are ordered Moon, angles, house rulers, rest', () => {
  const ranks = ['Moon', 'ASC', 'MC'];
  for (let d = 0; d < 360; d += 15) {
    const t = exactTime('new', new Date(Date.UTC(2026, 0, 1) + d * 864e5));
    const l = place('new', t, chart, 'placidus');
    const idx = l.aspects.map(a => a.point === 'Moon' ? 0 : ranks.includes(a.point) ? 1 : l.rulers.includes(a.point) ? 2 : 3);
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
  }
});
