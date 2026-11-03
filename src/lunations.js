// Next New and Full Moon, placed in the user's chart.
import * as A from '../vendor/astronomy.js';
import { longitude, signOf, degIn, houseOf, aspectsTo, cuspsFor, natalPoints, RULERS, SIGNS } from './chart.js';
import { nearNode } from './sky.js';

const HOLD_MS = 48 * 3600e3; // a card stays up 48h past exact, so the New Moon's 48-hour window stays visible
const DAY = 864e5;

function eclipseAt(phase, date) {
  const from = new Date(+date - 2 * DAY);
  const e = phase === 'new' ? A.SearchGlobalSolarEclipse(from) : A.SearchLunarEclipse(from);
  if (Math.abs(e.peak.date - date) > DAY) return null;
  return `${phase === 'new' ? 'Solar' : 'Lunar'} eclipse (${e.kind})`;
}

// One lunation as it lands for this chart.
export function place(phase, date, chart, system) {
  const lon = longitude('Moon', date);
  const { cusps, system: used } = cuspsFor(chart, system);
  const house = houseOf(lon, cusps);
  const houseSign = signOf(cusps[house - 1]);
  const rulers = RULERS[houseSign];
  const rank = a => a.point === 'Moon' ? 0 : a.point === 'ASC' || a.point === 'MC' ? 1 : rulers.includes(a.point) ? 2 : 3;
  const eclipse = eclipseAt(phase, date);
  // book: natal planets within 3–5° of an eclipse degree make it personal
  const aspects = aspectsTo(lon, natalPoints(chart), eclipse ? 5 : 3).sort((a, b) => rank(a) - rank(b) || a.orb - b.orb);
  const sign = signOf(lon);
  return {
    phase, date: date.toISOString(), lon, sign, degree: degIn(lon), house, houseSign, rulers, system: used, aspects,
    lateDegree: degIn(lon) >= 25,
    // masterclass: a Full Moon in your natal Moon's sign makes you the emotional main character
    moonSign: phase === 'full' && sign === signOf(chart.planets.Moon),
    eclipse, node: eclipse ? nearNode(lon, date) : null,
    opposite: SIGNS[(SIGNS.indexOf(sign) + 6) % 12],
  };
}

export function exactTime(phase, after) {
  return A.SearchMoonPhase(phase === 'new' ? 0 : 180, after, 40).date;
}

// The book's 6-month arc: a New Moon in a sign comes to light at the Full Moon in the same sign ~6 months later.
export function arcPartner(lun) {
  const other = lun.phase === 'new' ? 'full' : 'new';
  let t = new Date(+new Date(lun.date) + (lun.phase === 'new' ? 120 : -240) * 864e5);
  for (let i = 0; i < 6; i++) {
    t = exactTime(other, t);
    if (signOf(longitude('Moon', t)) === lun.sign) return { phase: other, date: t.toISOString() };
    t = new Date(+t + 864e5);
  }
  return null; // lunation fell at a sign edge; no same-sign partner nearby
}

// First upcoming lunation of each phase in each sign (the "All 24" list).
export function allTwentyFour(now, chart, system) {
  const out = {};
  for (const phase of ['new', 'full']) {
    let t = new Date(+now - HOLD_MS);
    for (let i = 0; i < 15; i++) {
      t = exactTime(phase, t);
      const sign = signOf(longitude('Moon', t));
      if (!out[`${phase}-${sign}`]) out[`${phase}-${sign}`] = place(phase, t, chart, system);
      t = new Date(+t + 864e5);
    }
  }
  return out;
}

export function nextLunations(now, chart, system) {
  const from = new Date(+now - HOLD_MS);
  return ['new', 'full']
    .map(p => place(p, exactTime(p, from), chart, system))
    .sort((a, b) => a.date.localeCompare(b.date));
}
