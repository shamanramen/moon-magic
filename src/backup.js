// Backup file: chart, settings and saved pages as one JSON file the user keeps.
import { SIGNS, PLANETS } from './chart.js';

export const makeBackup = ({ chart, settings, pages }) =>
  JSON.stringify({ app: 'moon-magic', version: 1, saved: new Date().toISOString(), chart, settings, pages }, null, 2);

const isDate = s => typeof s === 'string' && !isNaN(new Date(s));
const isNum = n => typeof n === 'number' && Number.isFinite(n);

// The file comes from outside the app: keep only well-formed pages and a usable chart.
export function readBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file isn’t a Moon Magic backup.'); }
  if (data?.app !== 'moon-magic' || typeof data.pages !== 'object') throw new Error('That file isn’t a Moon Magic backup.');
  const pages = {};
  for (const [k, p] of Object.entries(data.pages || {})) {
    if (!p || !['new', 'full'].includes(p.phase) || !SIGNS.includes(p.sign) || !isDate(p.date)) continue;
    if (!Number.isInteger(p.house) || p.house < 1 || p.house > 12 || typeof p.answers !== 'object') continue;
    const answers = Object.fromEntries(Object.entries(p.answers).filter(([, v]) => typeof v === 'string').map(([a, v]) => [a, v.slice(0, 20000)]));
    pages[k] = { phase: p.phase, sign: p.sign, house: p.house, date: p.date, answers };
  }
  const c = data.chart;
  const chartOk = c && isDate(c.utc) && isNum(c.lat) && isNum(c.lon) && c.planets && PLANETS.every(p => isNum(c.planets[p]))
    && Array.isArray(c.cusps?.whole) && c.cusps.whole.length === 12;
  const settings = ['placidus', 'whole'].includes(data.settings?.system) ? { system: data.settings.system } : null;
  return { pages, chart: chartOk ? c : null, settings };
}

// Restore never overwrites a page already on this device.
export function mergePages(local, incoming) {
  const merged = { ...local };
  let added = 0;
  for (const [k, p] of Object.entries(incoming)) if (!merged[k]) { merged[k] = p; added++; }
  return { merged, added };
}
