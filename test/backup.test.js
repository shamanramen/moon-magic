import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castChart } from '../src/chart.js';
import { makeBackup, readBackup, mergePages } from '../src/backup.js';

const chart = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });
const page = { phase: 'new', sign: 'Scorpio', house: 5, date: '2026-11-08T23:02:00.000Z', answers: { journal: 'mine' } };

test('round trip keeps chart, settings and pages', () => {
  const r = readBackup(makeBackup({ chart: JSON.parse(JSON.stringify(chart)), settings: { system: 'whole' }, pages: { 'new-2026-11-08T23': page } }));
  assert.deepEqual(r.pages['new-2026-11-08T23'], page);
  assert.equal(r.chart.utc, chart.utc);
  assert.deepEqual(r.settings, { system: 'whole' });
});

test('rejects foreign files and drops malformed pages', () => {
  assert.throws(() => readBackup('not json'), /isn’t a Moon Magic backup/);
  assert.throws(() => readBackup('{"app":"other","pages":{}}'), /isn’t a Moon Magic backup/);
  const r = readBackup(JSON.stringify({ app: 'moon-magic', pages: {
    good: page,
    badSign: { ...page, sign: 'Ophiuchus' },
    badHouse: { ...page, house: 13 },
    badDate: { ...page, date: 'yesterday' },
    oddAnswers: { ...page, answers: { journal: 'ok', evil: { x: 1 } } },
  }, chart: { utc: 'nope' } }));
  assert.deepEqual(Object.keys(r.pages), ['good', 'oddAnswers']);
  assert.deepEqual(r.pages.oddAnswers.answers, { journal: 'ok' });
  assert.equal(r.chart, null);
});

test('restore never overwrites a page on this device', () => {
  const { merged, added } = mergePages({ a: { ...page, answers: { journal: 'local' } } }, { a: page, b: page });
  assert.equal(merged.a.answers.journal, 'local');
  assert.equal(added, 1);
});
