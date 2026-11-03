// Loads Chad's markdown content. Format: "key: value" lines, "## " sections, "# " title.
import { SIGNS, ordinal } from './chart.js';

export function parseMd(text) {
  const doc = { title: '', top: {}, sections: {} };
  let cur = doc.top;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) doc.sections[line.slice(3).trim()] = cur = {};
    else if (line.startsWith('# ')) doc.title = line.slice(2).trim();
    else {
      const m = line.match(/^([A-Za-z0-9]+):\s*(.+)$/);
      if (m) cur[m[1]] = m[2];
    }
  }
  return doc;
}

const pad = n => String(n).padStart(2, '0');
// Same numbering as reference/: odd = New Moon in each sign from Aries, even = its opposite Full Moon.
export const LUNATION_FILES = SIGNS.flatMap((s, k) => [
  { phase: 'new', sign: s, file: `${pad(2 * k + 1)}-new-moon-${s.toLowerCase()}.md` },
  { phase: 'full', sign: SIGNS[(k + 6) % 12], file: `${pad(2 * k + 2)}-full-moon-${SIGNS[(k + 6) % 12].toLowerCase()}.md` },
]);

export const CONTENT_FILES = ['houses.md', 'moon-signs.md', 'principles.md', 'signs.md', 'eclipses.md', 'progressed.md'];

export function parseLunation(text, { phase, sign, file }) {
  const doc = parseMd(text);
  const second = phase === 'new' ? 'intention' : 'release';
  const want = `${phase === 'new' ? 'New' : 'Full'} Moon in ${sign}`;
  if (doc.title !== want) throw new Error(`${file}: title should be "# ${want}"`);
  if (!doc.top.energy) throw new Error(`${file}: missing "energy:" line`);
  const houses = {};
  for (let h = 1; h <= 12; h++) {
    const s = doc.sections[`${ordinal(h)} house`];
    if (!s) throw new Error(`${file}: missing "## ${ordinal(h)} house"`);
    for (const k of ['journal', second]) if (!s[k]) throw new Error(`${file}: ${ordinal(h)} house missing "${k}:"`);
    houses[h] = { journal: s.journal, line: s[second] };
  }
  return { phase, sign, energy: doc.top.energy, draft: doc.top.status !== 'reviewed', houses };
}

export async function loadContent(base = 'content/', fetchText = async p => {
  const r = await fetch(p);
  if (!r.ok) throw new Error(`Could not load ${p} (${r.status})`);
  return r.text();
}) {
  const [houses, moon, principles, signs, eclipses, progressed, ...lunations] = await Promise.all(
    [...CONTENT_FILES, ...LUNATION_FILES.map(f => `lunations/${f.file}`)].map(f => fetchText(base + f)));
  const p = parseMd(principles), m = parseMd(moon), e = parseMd(eclipses), g = parseMd(progressed);
  return {
    signs: parseMd(signs).top,
    eclipses: e.sections,
    progressed: g.sections,
    progressedDraft: g.top.status !== 'reviewed',
    houses: parseMd(houses).top,
    moonSigns: m.sections,
    moonSignsDraft: m.top.status !== 'reviewed',
    principles: { new: p.sections.new, full: p.sections.full, degree: p.sections.degree },
    principlesDraft: p.top.status !== 'reviewed',
    lunations: Object.fromEntries(LUNATION_FILES.map((f, i) => [`${f.phase}-${f.sign}`, parseLunation(lunations[i], f)])),
  };
}
