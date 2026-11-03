// The practice page: 4 starting points for one lunation, built from sign × house × phase + natal Moon.
import { ordinal, signOf } from './chart.js';
import { exactTime } from './lunations.js';

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
export const fmtWhen = d => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function buildPractice(lun, chart, content) {
  const cell = content.lunations[`${lun.phase}-${lun.sign}`];
  const moonSign = signOf(chart.planets.Moon);
  const pr = content.principles;
  const vars = {
    house: ordinal(lun.house), purpose: content.houses[lun.house].toLowerCase(), sign: lun.sign, opposite: lun.opposite,
    degree: `${Math.floor(lun.degree)}°`, moonSign,
    deadline: fmtWhen(+new Date(lun.date) + 48 * 3600e3),
    nextNew: lun.phase === 'full' ? fmtWhen(exactTime('new', new Date(lun.date))) : '',
    degreeNote: lun.lateDegree ? pr.degree.late : pr.degree.early,
  };
  const isNew = lun.phase === 'new';
  return {
    title: `${isNew ? 'New' : 'Full'} Moon in ${lun.sign} · your ${ordinal(lun.house)} house`,
    energy: cell.energy,
    draft: cell.draft,
    items: [
      { key: 'journal', label: 'Journal', text: cell.houses[lun.house].journal },
      { key: 'line', label: isNew ? 'Intention' : 'Release', text: cell.houses[lun.house].line },
      { key: 'numerals', label: 'The four steps', steps: [1, 2, 3, 4].map(n => fill(pr[lun.phase][n], vars)) },
      { key: 'baseline', label: `Your ${moonSign} Moon`, text: content.moonSigns[moonSign][lun.phase] },
    ],
  };
}

// Plain markdown of the page with the user's own writing filled in.
export function toMarkdown(p, lun, answers) {
  const out = [`# ${p.title}`, '', `${fmtWhen(lun.date)} · ${Math.floor(lun.degree)}° ${lun.sign}`, '', `*${p.energy}*`, ''];
  for (const it of p.items) {
    out.push(`## ${it.label}`, '');
    if (it.steps) it.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    else out.push(it.text);
    out.push('', answers[it.key]?.trim() || '_(blank)_', '');
  }
  return out.join('\n');
}
