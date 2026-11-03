import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castChart, longitude, signOf, norm } from '../src/chart.js';
import { moonIngress, voidOfCourse, phaseName, meanNode, nearNode, progressedMoon, todayMoon } from '../src/sky.js';

const chart = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });

test('Moon ingress lands on a sign boundary, both directions', () => {
  const now = new Date(Date.UTC(2026, 10, 3, 12));
  const next = moonIngress(now, 1), prev = moonIngress(now, -1);
  assert.ok(prev < now && now < next);
  assert.ok(next - prev > 1.8 * 864e5 && next - prev < 3.2 * 864e5, 'a sign takes ~2–3 days');
  for (const t of [next, prev]) {
    assert.notEqual(signOf(longitude('Moon', new Date(+t - 12e4))), signOf(longitude('Moon', new Date(+t + 12e4))));
  }
});

test('void of course ends at ingress and starts at an exact aspect', () => {
  const now = new Date(Date.UTC(2026, 10, 3, 12));
  const v = voidOfCourse(now);
  assert.equal(v.end, moonIngress(now, 1).toISOString());
  assert.ok(new Date(v.start) <= new Date(v.end));
  const t = new Date(v.start);
  const m = longitude('Moon', t);
  const exact = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    .some(p => [0, 60, 90, 120, 180].some(a => Math.abs(Math.abs(norm(m - longitude(p, t) + 180) - 180) - a) < 0.05));
  assert.ok(exact, 'void starts on an exact aspect');
  // just before the end the Moon is void
  assert.equal(voidOfCourse(new Date(+new Date(v.end) - 6e4)).active, true);
});

test('phase names', () => {
  assert.equal(phaseName(0), 'New Moon');
  assert.equal(phaseName(180), 'Full Moon');
  assert.equal(phaseName(100), 'First Quarter');
  assert.equal(phaseName(350), 'New Moon');
});

test('mean node: 2026 Aug 12 solar eclipse in Leo sits near the South Node (book)', () => {
  const d = new Date(Date.UTC(2026, 7, 12, 17, 37));
  assert.equal(signOf(meanNode(d)), 'Pisces');
  assert.equal(nearNode(longitude('Moon', d), d), 'south');
  const f = new Date(Date.UTC(2026, 7, 28, 4, 13)); // Pisces lunar eclipse, near the North Node (book)
  assert.equal(nearNode(longitude('Moon', f), f), 'north');
});

test('progressed Moon moves about 13° a year and its sign change is in the future', () => {
  const a = progressedMoon(chart, new Date(Date.UTC(1900, 0, 1)), 'placidus');
  const b = progressedMoon(chart, new Date(Date.UTC(1901, 0, 1)), 'placidus');
  const yearly = norm(b.lon - a.lon);
  assert.ok(yearly > 11 && yearly < 16, `moved ${yearly}`);
  assert.ok(new Date(a.nextSignDate) > new Date(Date.UTC(1900, 0, 1)));
  const today = todayMoon(new Date(Date.UTC(2026, 10, 3, 12)), chart, 'placidus');
  assert.ok(today.lit >= 0 && today.lit <= 100);
});
