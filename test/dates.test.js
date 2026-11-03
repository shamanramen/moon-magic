import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castChart } from '../src/chart.js';
import { exactTime, place } from '../src/lunations.js';
import { span, countdown, windows, toIcs } from '../src/dates.js';

const chart = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });
const H = 36e5;
const newMoon = place('new', exactTime('new', new Date(Date.UTC(2026, 10, 3))), chart, 'placidus');
const fullEclipse = place('full', exactTime('full', new Date(Date.UTC(2026, 2, 1))), chart, 'placidus');

test('span reads like speech', () => {
  assert.equal(span(5 * 24 * H + 3 * H), '5 days, 3 hours');
  assert.equal(span(24 * H), '1 day');
  assert.equal(span(19 * H + 4 * 6e4), '19 hours, 4 minutes');
  assert.equal(span(10), '1 minute');
});

test('countdown states before, during and after the 48-hour window', () => {
  const t = +new Date(newMoon.date);
  assert.equal(countdown(newMoon, new Date(t - 5 * 24 * H)).state, 'upcoming');
  assert.match(countdown(newMoon, new Date(t - 5 * 24 * H)).text, /^In 5 days/);
  assert.equal(countdown(newMoon, new Date(t - 35.4 * 24 * H)).text, 'In 35 days');
  assert.match(countdown(newMoon, new Date(t - 6e4)).text, /^(Today|Tonight) at/);
  assert.match(countdown(newMoon, new Date(t + 17 * H)).text, /48-hour window open · 1 day, 7 hours left/);
  assert.equal(countdown(newMoon, new Date(t + 49 * H)).state, 'passed');
});

test('timing windows: New Moon builds to the Full Moon, arc ~6 months out; eclipse adds settle window', () => {
  const w = windows(newMoon);
  assert.deepEqual(w.map(x => x.label.split(':')[0]), ['48-hour window', 'Building (waxing) phase', 'Six-month arc']);
  const toFull = (w[1].end - w[1].at) / (24 * H);
  assert.ok(toFull > 13 && toFull < 16.5, `${toFull} days to Full`);
  const e = windows(fullEclipse).map(x => x.label);
  assert.ok(e.includes('Eclipse: let it settle'));
  assert.ok(e.some(l => l.startsWith('Began at the New Moon in Virgo')));
});

test('calendar file: valid shape, folded lines, window event for New Moons', () => {
  const ics = toIcs([newMoon, fullEclipse], { 5: 'Creative expression, romance, joy, and what you do for the pure love of it', 11: 'x', 3: 'x', 4: 'x', 6: 'x', 9: 'x', 10: 'x', 12: 'x', 1: 'x', 2: 'x', 7: 'x', 8: 'x' }, l => `https://example.test/#/practice/${l.phase}/${l.date}`);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 3);
  assert.match(ics, /SUMMARY:48-hour window closes · New Moon in Scorpio/);
  assert.match(ics, /TRIGGER:-P1D/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `too long: ${line}`);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
});
