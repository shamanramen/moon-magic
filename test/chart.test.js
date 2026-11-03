import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../vendor/astronomy.js';
import { castChart, houseOf, aspectsTo, norm, signOf, wholeSign } from '../src/chart.js';

const near = (got, want, tol, label) => {
  const d = Math.abs(norm(got - want + 180) - 180);
  assert.ok(d <= tol, `${label}: got ${got.toFixed(3)}, want ${want.toFixed(3)} (off ${d.toFixed(3)}°)`);
};
const dm = (d, m, sign) => ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'].indexOf(sign) * 30 + d + m / 60;

// Einstein, 14 Mar 1879 11:30 LMT Ulm (48N24, 10E00) → 10:50 UT. Published (astro.com) values.
test('Einstein chart matches published positions', () => {
  const ch = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });
  near(ch.planets.Sun, dm(23, 30, 'Pisces'), 0.05, 'Sun');
  near(ch.planets.Moon, dm(14, 32, 'Sagittarius'), 0.1, 'Moon');
  near(ch.planets.Mercury, dm(3, 9, 'Aries'), 0.1, 'Mercury');
  near(ch.planets.Saturn, dm(4, 11, 'Aries'), 0.1, 'Saturn');
  near(ch.planets.Pluto, dm(24, 44, 'Taurus'), 0.1, 'Pluto');
  near(ch.asc, dm(11, 38, 'Cancer'), 0.1, 'ASC');
  near(ch.mc, dm(12, 50, 'Pisces'), 0.1, 'MC');
});

// Placidus property: cusp 11's hour angle is 1/3 of its own semi-diurnal arc; cusp 3's is 2/3 of the way down the nocturnal side.
test('Placidus cusps satisfy the semi-arc trisection', () => {
  for (const [lat, lon] of [[48.4, 10], [-33.9, 151.2], [40.7, -74]]) {
    const utc = new Date(Date.UTC(1990, 5, 15, 8, 0));
    const ch = castChart({ utc, lat, lon });
    const t = A.MakeTime(utc);
    const ramc = norm(A.SiderealTime(t) * 15 + lon), e = A.e_tilt(t).tobl * Math.PI / 180;
    const check = (cusp, want) => {
      const l = cusp * Math.PI / 180;
      const ra = norm(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * 180 / Math.PI);
      const dec = Math.asin(Math.sin(e) * Math.sin(l));
      const ad = Math.asin(Math.tan(lat * Math.PI / 180) * Math.tan(dec)) * 180 / Math.PI;
      near(norm(ra - ramc), want(ad), 1e-6, `lat ${lat}`);
    };
    const c = ch.cusps.placidus;
    check(c[10], ad => (90 + ad) / 3);          // 11th
    check(c[11], ad => 2 * (90 + ad) / 3);      // 12th
    check(c[1], ad => 180 - 2 * (90 - ad) / 3); // 2nd
    check(c[2], ad => 180 - (90 - ad) / 3);     // 3rd
  }
});

test('Placidus is undefined above the polar circle; Whole Sign still works', () => {
  const ch = castChart({ utc: new Date(Date.UTC(1990, 11, 21, 12)), lat: 78.2, lon: 15.6 });
  assert.equal(ch.cusps.placidus, null);
  assert.equal(ch.cusps.whole.length, 12);
});

test('houses, whole sign and aspects', () => {
  const ws = wholeSign(dm(11, 38, 'Cancer'));
  assert.equal(houseOf(dm(5, 0, 'Cancer'), ws), 1);
  assert.equal(houseOf(dm(29, 0, 'Gemini'), ws), 12);
  assert.equal(houseOf(dm(0, 0, 'Capricorn'), ws), 7);
  assert.equal(signOf(359.9), 'Pisces');
  const a = aspectsTo(100, { Moon: 102.5, Sun: 281, Mars: 10, Venus: 50 });
  assert.deepEqual(a.map(x => `${x.point} ${x.aspect}`), ['Moon conjunction', 'Sun opposition', 'Mars square']);
});

test('unknown birth time: Sun-sign houses, no angles, Moon range', () => {
  const ch = castChart({ utc: new Date(Date.UTC(1990, 5, 15, 12)), lat: 0, lon: 0, timeKnown: false });
  assert.equal(ch.asc, null);
  assert.equal(signOf(ch.cusps.whole[0]), signOf(ch.planets.Sun));
  assert.equal(ch.moonRange.length, 2);
});
