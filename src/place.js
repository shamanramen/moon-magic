// Birth place lookup (Open-Meteo) and local birth time → UTC.

// shortcut: Open-Meteo's free tier is non-commercial; swap the geocoder before charging money.
// "Paris, France" → search "Paris", keep results whose region/country match the rest.
export async function searchPlaces(query, fetchFn = fetch) {
  const [name, ...rest] = query.split(',').map(s => s.trim()).filter(Boolean);
  if (!name || name.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=20&language=en&format=json`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const { results = [] } = await res.json();
  const want = rest.map(s => s.toLowerCase());
  const kept = results
    .filter(r => r.timezone)
    .filter(r => want.every(w => [r.admin1, r.admin2, r.country, r.country_code].some(v => v && v.toLowerCase().startsWith(w))))
    .slice(0, 10);
  const base = r => [r.name, r.admin1, r.country].filter(Boolean).join(', ');
  const count = kept.reduce((m, r) => m.set(base(r), (m.get(base(r)) || 0) + 1), new Map());
  // Same label twice: add the district, then the coordinates, so each choice reads differently.
  return kept.map(r => {
    let label = base(r);
    if (count.get(label) > 1) {
      label = [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', ');
      label += ` (${Math.abs(r.latitude).toFixed(2)}°${r.latitude < 0 ? 'S' : 'N'}, ${Math.abs(r.longitude).toFixed(2)}°${r.longitude < 0 ? 'W' : 'E'})`;
    }
    return { label, lat: r.latitude, lon: r.longitude, tz: r.timezone };
  });
}

// Offset (minutes east of UTC) of a time zone at a given UTC instant.
export function offsetAt(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(utcMs));
  const p = Object.fromEntries(parts.map(x => [x.type, +x.value]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

// Local wall time in tz → list of possible UTC instants.
// One result normally; two when DST repeats the hour; zero when DST skipped it (gap: true, raw guesses returned).
export function localToUtc({ y, m, d, h, min }, tz) {
  const wall = Date.UTC(y, m - 1, d, h, min);
  const offsets = [...new Set([offsetAt(wall - 864e5, tz), offsetAt(wall, tz), offsetAt(wall + 864e5, tz)])];
  const valid = offsets.map(o => ({ utc: wall - o * 6e4, offset: o })).filter(c => offsetAt(c.utc, tz) === c.offset);
  if (valid.length) return { candidates: valid.sort((a, b) => a.utc - b.utc), gap: false };
  return { candidates: offsets.map(o => ({ utc: wall - o * 6e4, offset: o })), gap: true };
}

export const fmtOffset = min => {
  const s = min < 0 ? '−' : '+', a = Math.abs(min);
  return `UTC${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};

// "+5:30", "-4", "UTC−03:00" → minutes; null if unreadable.
export function parseOffset(text) {
  const m = String(text).replace(/utc|gmt/i, '').replace('−', '-').trim().match(/^([+-])?(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const v = +m[2] * 60 + +(m[3] || 0);
  return v > 14 * 60 ? null : (m[1] === '-' ? -v : v);
}
