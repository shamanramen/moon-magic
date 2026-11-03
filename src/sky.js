// Today's Moon, void-of-course, lunar nodes, progressed Moon.
import * as A from '../vendor/astronomy.js';
import { longitude, signOf, degIn, houseOf, aspectsTo, cuspsFor, natalPoints, norm, PLANETS, SIGNS } from './chart.js';

const HOUR = 3600e3, DAY = 864e5, YEAR = 365.2422 * DAY;
const wrap = d => norm(d + 180) - 180; // → (-180, 180]

// Bisect a sign change of f between a and b (ms) to within a minute.
function bisect(f, a, b) {
  let fa = f(a);
  while (b - a > 6e4) {
    const m = (a + b) / 2, fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return new Date((a + b) / 2);
}

// Next (dir=1) or previous (dir=-1) time the Moon crosses a sign boundary.
export function moonIngress(from, dir = 1) {
  const lon = longitude('Moon', from);
  const edge = dir > 0 ? (Math.floor(lon / 30) + 1) * 30 : Math.floor(lon / 30) * 30;
  const g = t => wrap(longitude('Moon', new Date(t)) - edge);
  let t = +from;
  while (dir > 0 ? g(t + HOUR) < 0 : g(t - HOUR) >= 0) t += dir * HOUR;
  return dir > 0 ? bisect(g, t, t + HOUR) : bisect(g, t - HOUR, t);
}

// Void of course: from the Moon's last Ptolemaic aspect to Sun–Pluto until it leaves the sign.
const VOID_ASPECTS = [0, 60, -60, 90, -90, 120, -120, 180];
export function voidOfCourse(now) {
  const start = +moonIngress(now, -1), end = +moonIngress(now, 1);
  const others = PLANETS.filter(p => p !== 'Moon');
  const samples = [];
  for (let t = start; t <= end + HOUR; t += HOUR) samples.push({ t, moon: longitude('Moon', new Date(Math.min(t, end))), ...Object.fromEntries(others.map(p => [p, longitude(p, new Date(Math.min(t, end)))])) });
  let last = start;
  for (let i = 1; i < samples.length; i++) {
    const s0 = samples[i - 1], s1 = samples[i];
    for (const p of others) for (const a of VOID_ASPECTS) {
      const h0 = wrap(s0.moon - s0[p] - a), h1 = wrap(s1.moon - s1[p] - a);
      if (Math.abs(h0) < 10 && Math.abs(h1) < 10 && Math.sign(h0) !== Math.sign(h1)) {
        const f = t => wrap(longitude('Moon', new Date(t)) - longitude(p, new Date(t)) - a);
        const hit = +bisect(f, s0.t, Math.min(s1.t, end));
        if (hit > last && hit <= end) last = hit;
      }
    }
  }
  return {
    start: new Date(last).toISOString(), end: new Date(end).toISOString(),
    active: +now >= last && +now < end,
    nextSign: SIGNS[(SIGNS.indexOf(signOf(longitude('Moon', now))) + 1) % 12],
  };
}

const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
export const phaseName = angle => PHASES[Math.floor(norm(angle + 22.5) / 45)];

export function todayMoon(now, chart, system) {
  const lon = longitude('Moon', now);
  const { cusps } = cuspsFor(chart, system);
  return {
    lon, sign: signOf(lon), degree: degIn(lon), house: houseOf(lon, cusps),
    phase: phaseName(A.MoonPhase(now)),
    lit: Math.round(A.Illumination(A.Body.Moon, now).phase_fraction * 100),
    aspects: aspectsTo(lon, natalPoints(chart)).sort((a, b) => a.orb - b.orb),
    void: voidOfCourse(now),
  };
}

// Mean lunar North Node (Meeus 47.7); the eclipse chapter needs only which node an eclipse sits near.
export function meanNode(date) {
  const T = (date - Date.UTC(2000, 0, 1, 12)) / (36525 * DAY);
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441);
}
export const nearNode = (lon, date) => Math.abs(wrap(lon - meanNode(date))) <= 90 ? 'north' : 'south';

// Secondary progressions: one day after birth = one year of life.
const PROG_PHASES = ['new', 'crescent', 'firstQuarter', 'gibbous', 'full', 'disseminating', 'lastQuarter', 'balsamic'];
export const PROG_PHASE_NAMES = { new: 'New', crescent: 'Crescent', firstQuarter: 'First Quarter', gibbous: 'Gibbous', full: 'Full', disseminating: 'Disseminating', lastQuarter: 'Last Quarter', balsamic: 'Balsamic' };
export function progressedMoon(chart, now, system) {
  const birth = +new Date(chart.utc);
  const prog = new Date(birth + (now - birth) / YEAR * DAY);
  const lon = longitude('Moon', prog), sun = longitude('Sun', prog);
  const toReal = d => new Date(birth + (d - birth) / DAY * YEAR);
  const { cusps } = cuspsFor(chart, system);
  return {
    lon, sign: signOf(lon), degree: degIn(lon), house: houseOf(lon, cusps),
    phase: PROG_PHASES[Math.floor(norm(lon - sun) / 45)],
    nextSign: SIGNS[(SIGNS.indexOf(signOf(lon)) + 1) % 12],
    nextSignDate: toReal(moonIngress(prog, 1)).toISOString(),
  };
}
