// Natal chart: tropical longitudes (true ecliptic of date), angles, houses, aspects.
import * as A from '../vendor/astronomy.js';

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
// Book's ruler table (book/06), co-rulers included.
export const RULERS = {
  Aries: ['Mars'], Taurus: ['Venus'], Gemini: ['Mercury'], Cancer: ['Moon'], Leo: ['Sun'], Virgo: ['Mercury'],
  Libra: ['Venus'], Scorpio: ['Pluto', 'Mars'], Sagittarius: ['Jupiter'], Capricorn: ['Saturn'], Aquarius: ['Uranus', 'Saturn'], Pisces: ['Neptune'],
};

const RAD = Math.PI / 180;
export const norm = d => ((d % 360) + 360) % 360;
export const signOf = lon => SIGNS[Math.floor(norm(lon) / 30)];
export const degIn = lon => norm(lon) % 30;
export const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
export const fmtDeg = lon => {
  const d = degIn(lon), whole = Math.floor(d), min = Math.floor((d - whole) * 60);
  return `${whole}°${String(min).padStart(2, '0')}′ ${signOf(lon)}`;
};

export function longitude(body, date) {
  if (body === 'Sun') return A.SunPosition(date).elon;
  if (body === 'Moon') return A.EclipticGeoMoon(date).lon;
  return A.Ecliptic(A.GeoVector(body, date, true)).elon;
}

// ASC/MC from local apparent sidereal time and true obliquity.
export function angles(date, lat, lon) {
  const t = A.MakeTime(date);
  const ramc = norm(A.SiderealTime(t) * 15 + lon);
  const eps = A.e_tilt(t).tobl;
  const r = ramc * RAD, e = eps * RAD, f = lat * RAD;
  const mc = norm(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / RAD);
  const asc = norm(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(f) * Math.sin(e))) / RAD);
  return { asc, mc, ramc, eps };
}

// Placidus: iterate the cusp until its RA sits at the right fraction of its own diurnal/nocturnal semi-arc.
function placidusCusp(ramc, eps, lat, frac, below) {
  const e = eps * RAD, tf = Math.tan(lat * RAD);
  let ra = ramc + (below ? 180 - frac * 90 : frac * 90);
  for (let i = 0; i < 100; i++) {
    const lam = Math.atan2(Math.sin(ra * RAD), Math.cos(ra * RAD) * Math.cos(e));
    const dec = Math.asin(Math.sin(e) * Math.sin(lam));
    const x = tf * Math.tan(dec);
    if (Math.abs(x) >= 1) return null; // circumpolar: Placidus undefined
    const ad = Math.asin(x) / RAD;
    const next = below ? ramc + 180 - frac * (90 - ad) : ramc + frac * (90 + ad);
    if (Math.abs(next - ra) < 1e-9) break;
    ra = next;
  }
  return norm(Math.atan2(Math.sin(ra * RAD), Math.cos(ra * RAD) * Math.cos(e)) / RAD);
}

export function placidus({ asc, mc, ramc, eps }, lat) {
  const c11 = placidusCusp(ramc, eps, lat, 1 / 3, false), c12 = placidusCusp(ramc, eps, lat, 2 / 3, false);
  const c2 = placidusCusp(ramc, eps, lat, 2 / 3, true), c3 = placidusCusp(ramc, eps, lat, 1 / 3, true);
  if ([c11, c12, c2, c3].includes(null)) return null;
  return [asc, c2, c3, mc + 180, c11 + 180, c12 + 180, asc + 180, c2 + 180, c3 + 180, mc, c11, c12].map(norm);
}

export const wholeSign = firstLon => Array.from({ length: 12 }, (_, i) => norm(Math.floor(norm(firstLon) / 30) * 30 + i * 30));

// House number (1-12) of a longitude given 12 cusps.
export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], span = norm(cusps[(i + 1) % 12] - a);
    if (norm(lon - a) < span) return i + 1;
  }
  return 12;
}

const ASPECTS = [['conjunction', 0], ['opposition', 180], ['square', 90]];
export function aspectsTo(lon, points, orb = 3) {
  const out = [];
  for (const [point, p] of Object.entries(points)) {
    if (p == null) continue;
    const sep = Math.abs(norm(lon - p + 180) - 180); // 0..180
    for (const [aspect, angle] of ASPECTS) {
      const o = Math.abs(sep - angle);
      if (o <= orb) out.push({ point, aspect, orb: o });
    }
  }
  return out;
}

// utc: Date of birth in UTC. timeKnown=false → noon chart, Sun-sign houses, no angles.
export function castChart({ utc, lat, lon, timeKnown = true }) {
  const planets = Object.fromEntries(PLANETS.map(p => [p, longitude(p, utc)]));
  const chart = { utc: utc.toISOString(), lat, lon, timeKnown, planets, asc: null, mc: null, cusps: {} };
  if (!timeKnown) {
    chart.cusps.whole = wholeSign(planets.Sun);
    chart.cusps.placidus = null;
    // Moon moves ~13°/day: range covers any birth time that day
    const day = 12 * 3600e3;
    chart.moonRange = [longitude('Moon', new Date(utc - day)), longitude('Moon', new Date(+utc + day))];
    return chart;
  }
  const ang = angles(utc, lat, lon);
  chart.asc = ang.asc;
  chart.mc = ang.mc;
  chart.cusps.whole = wholeSign(ang.asc);
  chart.cusps.placidus = placidus(ang, lat);
  return chart;
}

// Cusps for the chosen system, falling back to Whole Sign when Placidus is undefined.
export function cuspsFor(chart, system) {
  if (system === 'placidus' && chart.cusps.placidus) return { cusps: chart.cusps.placidus, system: 'placidus' };
  return { cusps: chart.cusps.whole, system: 'whole' };
}

// Natal points that can receive aspects (angles only when the birth time is known).
export const natalPoints = chart => ({ ...chart.planets, ASC: chart.asc, MC: chart.mc });
