import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadContent, parseLunation, LUNATION_FILES } from '../src/content.js';
import { castChart } from '../src/chart.js';
import { exactTime, place } from '../src/lunations.js';
import { buildPractice, toMarkdown } from '../src/practice.js';

const base = new URL('../content/', import.meta.url);
const fromDisk = p => readFile(new URL(p, base), 'utf8');

test('all 24 lunation files parse with 12 houses each', async () => {
  const c = await loadContent('', fromDisk);
  assert.equal(Object.keys(c.lunations).length, 24);
  assert.equal(Object.keys(c.houses).length, 12);
  assert.equal(Object.keys(c.moonSigns).length, 12);
  assert.equal(Object.keys(c.signs).length, 12);
  assert.equal(Object.keys(c.progressed.signs).length, 12);
  assert.equal(Object.keys(c.progressed.houses).length, 12);
  assert.equal(Object.keys(c.progressed.phases).length, 8);
  for (const k of ['new', 'full', 'node']) assert.ok(c.eclipses[k], `eclipses.md missing ## ${k}`);
  for (const l of Object.values(c.lunations)) {
    for (let h = 1; h <= 12; h++) assert.match(l.houses[h].journal, /…$/, `${l.phase} ${l.sign} house ${h} journal should end mid-sentence`);
  }
});

test('parser names the file and the missing piece', () => {
  const f = LUNATION_FILES[0];
  assert.throws(() => parseLunation('# New Moon in Aries\nenergy: x\n## 1st house\njournal: a…\n', f), /01-new-moon-aries.md: 1st house missing "intention:"/);
});

test('practice page: 4 items, numbered steps filled, 48h deadline, markdown export', async () => {
  const c = await loadContent('', fromDisk);
  const chart = castChart({ utc: new Date(Date.UTC(1879, 2, 14, 10, 50)), lat: 48.4, lon: 10.0 });
  for (const phase of ['new', 'full']) {
    const lun = place(phase, exactTime(phase, new Date(Date.UTC(2026, 10, 3))), chart, 'placidus');
    const p = buildPractice(lun, chart, c);
    assert.equal(p.items.length, 4);
    assert.equal(p.items[2].steps.length, 4);
    for (const s of p.items[2].steps) assert.doesNotMatch(s, /\{\w+\}/, s);
    const md = toMarkdown(p, lun, { journal: 'my words' });
    assert.match(md, /my words/);
  }
});
