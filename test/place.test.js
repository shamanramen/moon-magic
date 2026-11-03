import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localToUtc, offsetAt, parseOffset, fmtOffset, searchPlaces } from '../src/place.js';

test('summer time offset', () => {
  const { candidates, gap } = localToUtc({ y: 2000, m: 7, d: 1, h: 12, min: 0 }, 'America/New_York');
  assert.equal(gap, false);
  assert.deepEqual(candidates.map(c => c.offset), [-240]);
  assert.equal(new Date(candidates[0].utc).toISOString(), '2000-07-01T16:00:00.000Z');
});

test('pre-1970 rule: Britain kept BST all year in 1968–71', () => {
  assert.equal(offsetAt(Date.UTC(1969, 0, 15, 12), 'Europe/London'), 60);
});

test('repeated hour gives two choices, skipped hour is flagged', () => {
  const rep = localToUtc({ y: 2021, m: 11, d: 7, h: 1, min: 30 }, 'America/New_York');
  assert.deepEqual(rep.candidates.map(c => c.offset), [-240, -300]);
  const skip = localToUtc({ y: 2021, m: 3, d: 14, h: 2, min: 30 }, 'America/New_York');
  assert.equal(skip.gap, true);
});

test('offset text round trip', () => {
  assert.equal(parseOffset('+5:30'), 330);
  assert.equal(parseOffset(fmtOffset(-180)), -180);
  assert.equal(parseOffset('nonsense'), null);
});

test('place search filters by region/country after the comma', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ results: [
    { name: 'Paris', admin1: 'Île-de-France', country: 'France', country_code: 'FR', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' },
    { name: 'Paris', admin1: 'Texas', country: 'United States', country_code: 'US', latitude: 33.66, longitude: -95.55, timezone: 'America/Chicago' },
  ] }) });
  const r = await searchPlaces('Paris, France', fake);
  assert.deepEqual(r.map(x => x.tz), ['Europe/Paris']);
  assert.equal((await searchPlaces('Paris, tex', fake))[0].tz, 'America/Chicago');
});

test('results with the same name and region get told apart', async () => {
  const ulm = (admin2, lat) => ({ name: 'Ulm', admin1: 'Baden-Wurttemberg', admin2, country: 'Germany', latitude: lat, longitude: 9.99, timezone: 'Europe/Berlin' });
  const fake = async () => ({ ok: true, json: async () => ({ results: [ulm('Stadtkreis Ulm', 48.4), ulm('Ortenaukreis', 48.6), { ...ulm(null, 50.5), admin1: 'Hesse' }] }) });
  const labels = (await searchPlaces('Ulm', fake)).map(r => r.label);
  assert.equal(new Set(labels).size, 3);
  assert.equal(labels[2], 'Ulm, Hesse, Germany');
  assert.match(labels[0], /Stadtkreis Ulm.*48\.40°N/);
});
