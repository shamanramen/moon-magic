// Views, onboarding, storage, export.
import { castChart, cuspsFor, houseOf, aspectsTo, fmtDeg, signOf, ordinal, natalPoints } from './chart.js';
import { nextLunations, place as placeLunation, arcPartner, allTwentyFour } from './lunations.js';
import { todayMoon, progressedMoon, PROG_PHASE_NAMES } from './sky.js';
import { searchPlaces, localToUtc, fmtOffset, parseOffset } from './place.js';
import { loadContent, LUNATION_FILES, CONTENT_FILES } from './content.js';
import { makeBackup, readBackup, mergePages } from './backup.js';
import { buildPractice, toMarkdown, fmtWhen } from './practice.js';
import { fmtFull, fmtShort, countdown, windows, toIcs } from './dates.js';

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// localStorage can throw (private mode, blocked storage): fall back to memory for the session.
const mem = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : mem[k] ?? null; } catch { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memory only */ } },
};

let content;
const settings = () => ({ system: 'placidus', ...store.get('mm.settings') });
const getChart = () => store.get('mm.chart');

const ASPECT_WORD = { conjunction: 'on your', opposition: 'opposite your', square: 'square your' };
const pointName = p => p === 'ASC' ? 'Ascendant' : p === 'MC' ? 'Midheaven' : p;
// lun (optional) names the rulers of the house it activates.
function aspectList(aspects, lun, orb = 3) {
  if (!aspects.length) return `<p class="small muted" style="margin:12px 0 0">No natal planet within ${orb}°.</p>`;
  const ruler = p => lun?.rulers.includes(p) ? `, ruler of your ${ordinal(lun.house)}` : '';
  return `<ul class="aspects">${aspects.map(a => `
    <li class="${a.aspect === 'conjunction' ? 'personal' : ''}"><span>${ASPECT_WORD[a.aspect]} ${esc(pointName(a.point))}${ruler(a.point)}${a.aspect === 'conjunction' ? ' · personal contact' : ''}</span><span>${a.orb.toFixed(1)}°</span></li>`).join('')}</ul>`;
}
function rulerLine(l, chart) {
  const { cusps } = cuspsFor(chart, settings().system);
  const where = l.rulers.map(r => `${r} (in your ${ordinal(houseOf(chart.planets[r], cusps))})`);
  return `${l.houseSign} on the cusp, ruled by ${where.join(' and ')}`;
}

function systemNote(chart, lun) {
  if (!chart.timeKnown) return '<p class="note">Birth time unknown: houses are counted from your Sun sign, so treat them as approximate.</p>';
  if (lun && lun.system !== settings().system) return '<p class="note">Placidus can’t be calculated at your birth latitude, so houses use Whole Sign.</p>';
  return '';
}

const status = l => { const c = countdown(l); return `<div class="status ${c.state}">${esc(c.text)}</div>`; };
// The one window that matters most right now, for the home card.
function windowLine(l) {
  const w = windows(l).find(x => x.end);
  return `<p class="small muted" style="margin:6px 0 0">${esc(w.label)} until ${esc(fmtShort(w.end))}</p>`;
}

function timingList(l) {
  return `<section class="item ${l.phase}">
    <div class="eyebrow">Timing</div>
    <ul class="timing">${windows(l).map(w => `<li>
      <b>${w.link ? `<a href="#/practice/${w.link.phase}/${w.link.date}">${esc(w.label)}</a>` : esc(w.label)}</b>
      <span class="when">${w.end ? `${esc(fmtShort(w.at))} → ${esc(fmtShort(w.end))}` : esc(fmtFull(w.at))}</span>
      <span class="small muted">${esc(w.note)}</span></li>`).join('')}</ul>
  </section>`;
}

function addToCalendar(lunations) {
  const base = location.origin + location.pathname;
  const ics = toIcs(lunations, content.houses, l => `${base}#/practice/${l.phase}/${l.date}`);
  const name = lunations.length === 1
    ? `moon-magic-${lunations[0].phase}-moon-${lunations[0].sign.toLowerCase()}.ics` : 'moon-magic-next-moons.ics';
  // iPhone opens a calendar data link straight into "Add to Calendar"; elsewhere the downloaded file opens in the calendar app.
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  saveFile(ics, name, 'text/calendar', false);
}

function eclipseBlock(l) {
  if (!l.eclipse) return '';
  const e = content.eclipses;
  const contact = l.aspects.some(a => a.aspect === 'conjunction');
  return `<div class="house"><p class="small">${esc(e[l.phase].what)}</p>
    <p class="small muted">${esc(e.node[l.node])}</p>
    ${contact ? `<p class="small" style="color:var(--gold)">${esc(e.node.contact)}</p>` : ''}
    <p class="small muted">${esc(e[l.phase].how)}</p></div>`;
}

function todayCard(chart) {
  const t = todayMoon(new Date(), chart, settings().system);
  const v = t.void;
  const voidLine = v.active
    ? `<p class="small" style="color:var(--gold)">Void of course until ${esc(fmtWhen(v.end))}, then into ${v.nextSign}.</p>`
    : `<p class="small muted">Next void of course: ${esc(fmtWhen(v.start))} to ${esc(fmtWhen(v.end))}, then into ${v.nextSign}.</p>`;
  return `
    <section class="card today">
      <div class="eyebrow">Today · ${t.phase} · ${t.lit}% lit</div>
      <div class="row" style="align-items:baseline">
        <div class="degree" style="font-size:32px">Moon ${fmtDeg(t.lon)}</div>
      </div>
      <p class="muted" style="margin:0 0 8px">In your ${ordinal(t.house)} house · ${esc(content.signs[t.sign])}</p>
      ${voidLine}
      ${t.aspects.length ? aspectList(t.aspects) : ''}
    </section>`;
}

/* ---------- Home ---------- */
function home(chart) {
  const lunations = nextLunations(new Date(), chart, settings().system);
  view.innerHTML = `
    ${todayCard(chart)}
    <div class="eyebrow">${chart.name ? esc(chart.name) + ' · ' : ''}Your next two moons</div>
    ${systemNote(chart, lunations[0])}
    ${lunations.map(l => `
      <a class="card ${l.phase}" href="#/practice/${l.phase}">
        <div class="eyebrow accent">${l.phase === 'new' ? 'New Moon · declaration' : 'Full Moon · illumination'}</div>
        <div class="degree">${fmtDeg(l.lon)}</div>
        <div class="when">${esc(fmtFull(l.date))}</div>
        ${status(l)}
        ${windowLine(l)}
        <div class="tags">
          ${l.eclipse ? `<span class="tag gold">${esc(l.eclipse)}</span>` : ''}
          ${l.moonSign ? '<span class="tag gold">Your Moon sign · you are the emotional main character</span>' : ''}
          ${l.lateDegree ? '<span class="tag">Late degree</span>' : ''}
        </div>
        <div class="house">
          <b>Your ${ordinal(l.house)} house</b>
          <p class="muted" style="margin:4px 0 0">${esc(content.houses[l.house])}</p>
          <p class="small muted" style="margin:4px 0 0">${rulerLine(l, chart)}</p>
        </div>
        ${aspectList(l.aspects, l, l.eclipse ? 5 : 3)}
        ${eclipseBlock(l)}
        <div class="go accent">Open practice →</div>
      </a>`).join('')}
    <div class="actions" style="margin-top:0"><button class="ghost" id="cal">Add both to calendar</button></div>
    <p class="small muted">With reminders the day before, and before each 48-hour window closes.</p>`;
  view.querySelector('#cal').onclick = () => addToCalendar(lunations);
}

/* ---------- Practice ---------- */
// Saved pages: { [phase-YYYY-MM-DDTHH]: { phase, sign, house, date, answers } }
const pageKey = lun => `${lun.phase}-${lun.date.slice(0, 13)}`;
const pages = () => store.get('mm.pages') || {};
function savePage(lun, answers) {
  const all = pages();
  all[pageKey(lun)] = { phase: lun.phase, sign: lun.sign, house: lun.house, date: lun.date, answers };
  store.set('mm.pages', all);
}

// The arc's date lives in the timing list; this only quotes what was written at the New Moon it answers.
function arcBlock(lun) {
  const partner = lun.phase === 'full' && arcPartner(lun);
  const saved = partner && pages()[`${partner.phase}-${partner.date.slice(0, 13)}`];
  const text = saved && (saved.answers.line?.trim() || saved.answers.journal?.trim() || Object.values(saved.answers).find(v => v?.trim()));
  return text ? `<p class="note">At the New Moon in ${lun.sign} (${esc(fmtShort(partner.date))}) you wrote: “${esc(text)}”</p>` : '';
}

function practice(chart, phase, iso) {
  const system = settings().system;
  const lun = iso ? placeLunation(phase, new Date(iso), chart, system) : nextLunations(new Date(), chart, system).find(l => l.phase === phase);
  const p = buildPractice(lun, chart, content);
  const answers = pages()[pageKey(lun)]?.answers || {};
  view.innerHTML = `
    <a href="${iso ? '#/library' : '#/home'}" class="small noprint">← ${iso ? 'Library' : 'Moons'}</a>
    <div class="eyebrow" style="margin-top:16px">${fmtDeg(lun.lon)}${lun.eclipse ? ' · ' + esc(lun.eclipse) : ''}</div>
    <h1>${esc(p.title)}</h1>
    <div class="when">${esc(fmtFull(lun.date))}</div>
    ${status(lun)}
    <p class="energy">${esc(p.energy)} ${p.draft ? '<span class="draft">draft</span>' : ''}</p>
    ${systemNote(chart, lun)}
    ${lun.eclipse ? `<p class="note">${esc(content.eclipses[phase].how)}</p>` : ''}
    ${arcBlock(lun)}
    ${timingList(lun)}
    ${p.items.map(it => `
      <section class="item ${phase}">
        <div class="eyebrow">${esc(it.label)}</div>
        ${it.steps ? `<ol>${it.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : `<p class="prompt">${esc(it.text)}</p>`}
        <textarea data-key="${it.key}" aria-label="${esc(it.label)}: your words" placeholder="…">${esc(answers[it.key])}</textarea>
      </section>`).join('')}
    <div class="actions">
      <button id="save">Save</button>
      <button id="print" class="ghost">Print / PDF</button>
    </div>
    <div class="actions" style="margin-top:10px"><button id="cal" class="ghost">Add to calendar</button></div>
    <p class="small muted noprint" style="margin-top:10px">Your writing stays on this phone until you save it.</p>`;
  const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  view.querySelectorAll('textarea').forEach(t => {
    grow(t);
    t.addEventListener('input', () => { grow(t); answers[t.dataset.key] = t.value; savePage(lun, answers); });
  });
  view.querySelector('#print').onclick = () => window.print();
  view.querySelector('#cal').onclick = () => addToCalendar([lun]);
  view.querySelector('#save').onclick = () => saveFile(toMarkdown(p, lun, answers), `moon-magic-${phase}-moon-${lun.sign.toLowerCase()}-${new Date(lun.date).toLocaleDateString('en-CA')}.md`);
}

async function saveFile(text, filename, type = 'text/markdown', share = true) {
  const file = new File([text], filename, { type });
  // Share sheet on phones (an <a download> is unreliable in an iOS home-screen app); plain download elsewhere.
  if (share && navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Library ---------- */
function library(chart, tab) {
  const tabs = `<div class="row tabs noprint">
    <a href="#/library" class="${tab !== 'all' ? 'on' : ''}">My pages</a>
    <a href="#/library/all" class="${tab === 'all' ? 'on' : ''}">All 24 moons</a></div>`;
  if (tab === 'all') {
    const all = allTwentyFour(new Date(), chart, settings().system);
    const dated = Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
    const missing = LUNATION_FILES.filter(f => !all[`${f.phase}-${f.sign}`]);
    const month = d => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let html = '', current = '';
    for (const l of dated) {
      if (month(l.date) !== current) { current = month(l.date); html += `<li class="month">${esc(current)}</li>`; }
      html += `<li class="${l.phase}"><a href="#/practice/${l.phase}/${l.date}">
        <span><b>${l.phase === 'new' ? 'New' : 'Full'} Moon in ${l.sign}</b>${l.eclipse ? ' <span class="tag gold">eclipse</span>' : ''}<br>
        <span class="small muted">${esc(fmtShort(l.date))} · ${esc(countdown(l).text)}</span></span>
        <span class="accent">${ordinal(l.house)}</span></a></li>`;
    }
    html += missing.map(f => `<li class="${f.phase}"><span><b>${f.phase === 'new' ? 'New' : 'Full'} Moon in ${f.sign}</b><br><span class="small muted">Not in the next 14 months</span></span></li>`).join('');
    view.innerHTML = `<h1>Library</h1>${tabs}
      <p class="muted small">Every New and Full Moon coming up, in calendar order, and the house each lands in for you.</p>
      <ul class="list">${html}</ul>`;
    return;
  }
  const preview = p => { const t = (p.answers.journal || p.answers.line || '').trim(); return t ? ` · ${esc(t.slice(0, 60))}${t.length > 60 ? '…' : ''}` : ''; };
  const saved = Object.values(pages()).filter(p => Object.values(p.answers).some(v => v?.trim()))
    .sort((a, b) => b.date.localeCompare(a.date));
  view.innerHTML = `<h1>Library</h1>${tabs}
    ${saved.length ? `<ul class="list">${saved.map(p => `<li class="${p.phase}"><a href="#/practice/${p.phase}/${p.date}">
      <span><b>${p.phase === 'new' ? 'New' : 'Full'} Moon in ${p.sign}</b><br><span class="small muted">${esc(new Date(p.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))}${preview(p)}</span></span>
      <span class="accent">${ordinal(p.house)}</span></a></li>`).join('')}</ul>`
    : '<p class="muted">Nothing written yet. Pages you write in show up here, newest first.</p>'}`;
}

/* ---------- Moon baseline ---------- */
function moonPage(chart, first) {
  const moon = chart.planets.Moon, sign = signOf(moon);
  const { cusps, system } = cuspsFor(chart, settings().system);
  const others = { ...natalPoints(chart) };
  delete others.Moon;
  const range = chart.moonRange && signOf(chart.moonRange[0]) !== signOf(chart.moonRange[1])
    ? `<p class="note">Without a birth time your Moon could be in ${signOf(chart.moonRange[0])} or ${signOf(chart.moonRange[1])}. This page shows ${sign} (the noon position).</p>` : '';
  view.innerHTML = `
    <div class="eyebrow">${first ? 'Locked in' : 'Your baseline'}</div>
    <section class="card new">
      <div class="eyebrow accent">Natal Moon</div>
      <div class="degree">${chart.timeKnown ? fmtDeg(moon) : `${sign} <span class="small muted">(degree ±6°)</span>`}</div>
      <div class="house"><b>Your ${ordinal(houseOf(moon, cusps))} house</b>
        <p class="muted" style="margin:4px 0 0">${esc(content.houses[houseOf(moon, cusps)])}</p></div>
      ${aspectList(chart.timeKnown ? aspectsTo(moon, others) : [])}
    </section>
    ${range}
    ${systemNote(chart, { system })}
    <h2>Moon in ${sign}</h2>
    <p>${esc(content.moonSigns[sign].profile)}</p>
    <p class="muted small">At a New Moon: ${esc(content.moonSigns[sign].new)}</p>
    <p class="muted small">At a Full Moon: ${esc(content.moonSigns[sign].full)}</p>
    ${progressedSection(chart)}
    ${first ? '<div class="actions"><a class="btn" href="#/home" style="text-align:center;text-decoration:none">Show my next moons →</a></div>' : ''}`;
}

function progressedSection(chart) {
  const p = progressedMoon(chart, new Date(), settings().system);
  const g = content.progressed;
  return `
    <section class="card full" style="margin-top:24px">
      <div class="eyebrow accent">Progressed Moon · the update ${content.progressedDraft ? '<span class="draft">draft</span>' : ''}</div>
      <div class="degree" style="font-size:34px">${chart.timeKnown ? fmtDeg(p.lon) : p.sign}</div>
      <div class="when">Your ${ordinal(p.house)} house · enters ${p.nextSign} ${esc(new Date(p.nextSignDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }))}${chart.timeKnown ? '' : ' (approx.)'}</div>
      <div class="house">
        <p>${esc(g.signs[p.sign])}</p>
        <p class="muted">${esc(g.houses[p.house])}</p>
        <p class="small muted" style="margin:0"><strong>${PROG_PHASE_NAMES[p.phase]} phase.</strong> ${esc(g.phases[p.phase].replace(/^Progressed [^.]*\.\s*/, ''))}</p>
      </div>
    </section>`;
}

/* ---------- Settings ---------- */
function settingsPage(chart) {
  const s = settings();
  view.innerHTML = `
    <h1>Settings</h1>
    <label>House system</label>
    <label class="inline"><input type="radio" name="sys" value="placidus" ${s.system === 'placidus' ? 'checked' : ''}> Placidus</label>
    <label class="inline"><input type="radio" name="sys" value="whole" ${s.system === 'whole' ? 'checked' : ''}> Whole Sign</label>
    <label>Birth data</label>
    <p class="muted">${esc(chart.local)} · ${esc(chart.place)} · ${esc(fmtOffset(chart.offset))}${chart.timeKnown ? '' : ' · time unknown'}</p>
    <div class="actions"><button class="ghost" id="redo">Re-enter birth data</button></div>
    <label>Backup</label>
    <p class="muted small">Your pages live only in this browser. Clearing browser data erases them. Keep a backup file somewhere safe.</p>
    <div class="actions">
      <button id="backup">Back up</button>
      ${restoreButton()}
    </div>
    <p class="small" id="restoreMsg" role="status"></p>`;
  view.querySelectorAll('input[name=sys]').forEach(r => r.onchange = () => store.set('mm.settings', { ...settings(), system: r.value }));
  view.querySelector('#redo').onclick = () => { location.hash = '#/start'; };
  view.querySelector('#backup').onclick = () => saveFile(makeBackup({ chart, settings: settings(), pages: pages() }),
    `moon-magic-backup-${new Date().toLocaleDateString('en-CA')}.json`, 'application/json');
  wireRestore();
}

const restoreButton = () => `<label class="btn ghost restore">Restore<input type="file" id="restore" accept=".json,application/json" class="vh"></label>`;
function wireRestore() {
  view.querySelector('#restore').onchange = async e => {
    const msg = view.querySelector('#restoreMsg');
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = readBackup(await file.text());
      const { merged, added } = mergePages(pages(), data.pages);
      store.set('mm.pages', merged);
      const hadChart = !!getChart();
      if (!hadChart && data.chart) store.set('mm.chart', data.chart);
      if (!hadChart && data.settings) store.set('mm.settings', data.settings);
      msg.className = 'small';
      msg.textContent = `Restored ${added} page${added === 1 ? '' : 's'}${!hadChart && data.chart ? ' and your chart' : ''}.`;
      if (!hadChart && data.chart) setTimeout(() => { location.hash = '#/home'; }, 800);
    } catch (err) {
      msg.className = 'error';
      msg.textContent = err.message;
    }
    e.target.value = '';
  };
}

/* ---------- Onboarding ---------- */
function onboarding() {
  let place = null, candidates = [];
  view.innerHTML = `
    ${getChart() ? '<a href="#/settings" class="small">← Cancel, keep my chart</a>' : ''}
    <div class="eyebrow"${getChart() ? ' style="margin-top:16px"' : ''}>The Moon Magic System</div>
    <h1>Lock in your Moon</h1>
    <p class="muted">Enter your birth details once. Every New and Full Moon is then placed in your chart.</p>
    <form id="f" novalidate>
      <label for="name">Name (optional)</label>
      <input id="name" autocomplete="given-name">
      <label for="date">Birth date</label>
      <input id="date" type="date" required>
      <label for="time">Birth time</label>
      <input id="time" type="time">
      <label class="inline"><input id="notime" type="checkbox"> I don’t know my birth time</label>
      <label for="q">Birth place</label>
      <div class="row"><input id="q" placeholder="City, country" autocomplete="off"><button type="button" id="search" class="ghost" style="flex:0 0 auto">Search</button></div>
      <ul class="results" id="results"></ul>
      <div id="tz"></div>
      <p class="error" id="err" role="alert"></p>
      <div class="actions"><button id="go" disabled>Cast my chart</button></div>
    </form>
    <p class="muted small" style="margin-top:24px">Moving from another phone? Restore your backup file instead.</p>
    <div class="actions" style="margin-top:0">${restoreButton()}</div>
    <p class="small" id="restoreMsg" role="status"></p>`;
  wireRestore();
  const $ = id => view.querySelector('#' + id);

  const parts = () => {
    const [y, m, d] = $('date').value.split('-').map(Number);
    const [h, min] = $('notime').checked ? [12, 0] : ($('time').value || '').split(':').map(Number);
    return { y, m, d, h, min };
  };
  const ready = () => {
    const p = parts();
    return place && p.y && (Number.isFinite(p.h) && Number.isFinite(p.min));
  };
  function refreshTz() {
    $('go').disabled = !ready();
    if (!ready()) { $('tz').innerHTML = ''; return; }
    const r = localToUtc(parts(), place.tz);
    candidates = r.candidates;
    const opts = candidates.map((c, i) => `<option value="${i}">${fmtOffset(c.offset)}</option>`).join('');
    $('tz').innerHTML = `
      <label for="off">Time zone at birth · ${esc(place.tz)}</label>
      ${r.gap ? '<p class="note">The clocks skipped that time on that day. Check your birth certificate and pick the offset.</p>' : ''}
      ${candidates.length > 1 && !r.gap ? '<p class="note">The clocks repeated that hour on that day. Pick which one.</p>' : ''}
      <div class="row"><select id="cand">${opts}</select><input id="off" value="${fmtOffset(candidates[0].offset)}" aria-label="Override UTC offset"></div>
      <p class="small muted">Correct this if you know your birth offset was different.</p>`;
    $('cand').onchange = () => { $('off').value = fmtOffset(candidates[+$('cand').value].offset); };
  }
  ['date', 'time', 'notime'].forEach(id => $(id).addEventListener('change', () => { $('time').disabled = $('notime').checked; refreshTz(); }));

  async function search() {
    $('err').textContent = '';
    $('results').innerHTML = '<li class="muted small">Searching…</li>';
    try {
      const found = await searchPlaces($('q').value);
      if (!found.length) { $('results').innerHTML = '<li class="muted small">No match. Try just the city name.</li>'; return; }
      $('results').innerHTML = found.map((r, i) => `<li><label class="inline"><input type="radio" name="pl" value="${i}"> ${esc(r.label)}</label></li>`).join('');
      $('results').querySelectorAll('input').forEach(inp => inp.onchange = () => { place = found[+inp.value]; refreshTz(); });
    } catch (e) {
      $('results').innerHTML = '';
      $('err').textContent = navigator.onLine ? e.message : 'Place search needs a connection.';
    }
  }
  $('search').onclick = search;
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });

  $('f').onsubmit = e => {
    e.preventDefault();
    if (!ready()) return;
    const offset = parseOffset($('off').value);
    if (offset == null) { $('err').textContent = 'Write the offset like +01:00 or −05:00.'; return; }
    const p = parts();
    const utc = new Date(Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - offset * 6e4);
    const timeKnown = !$('notime').checked;
    const chart = castChart({ utc, lat: place.lat, lon: place.lon, timeKnown });
    Object.assign(chart, {
      name: $('name').value.trim(), place: place.label, tz: place.tz, offset,
      local: `${$('date').value}${timeKnown ? ' ' + $('time').value : ''}`,
    });
    store.set('mm.chart', chart);
    location.hash = '#/moon/first';
  };
}

/* ---------- Router ---------- */
function route() {
  const chart = getChart();
  const [, page, arg, iso] = location.hash.split('/');
  const target = !chart || page === 'start' ? 'start' : page || 'home';
  nav.hidden = target === 'start';
  nav.querySelectorAll('a').forEach(a => {
    a.classList.toggle('on', a.dataset.tab === target);
    if (a.dataset.tab === target) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  if (target === 'start') return onboarding();
  if (target === 'practice' && (arg === 'new' || arg === 'full')) return practice(chart, arg, iso && !isNaN(new Date(iso)) ? iso : null);
  if (target === 'library') return library(chart, arg);
  if (target === 'moon') return moonPage(chart, arg === 'first');
  if (target === 'settings') return settingsPage(chart);
  return home(chart);
}

try {
  content = await loadContent();
  window.addEventListener('hashchange', route);
  // Countdowns go stale while the app sits in the background; refresh when it comes back (not mid-typing on a practice page).
  // Skip forms (practice, onboarding) so nothing typed is lost, and keep the scroll position.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !getChart() || /^#\/(practice|start)/.test(location.hash)) return;
    const y = window.scrollY; route(); window.scrollTo(0, y);
  });
  route();
} catch (e) {
  view.innerHTML = `<p class="error pad">Couldn’t load the Moon Magic content. ${esc(e.message)}</p>`;
}

// Offline: register the worker, then warm its cache with the shell and every content file.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => caches.open('mm-v1')).then(c => c.addAll([
    './', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'vendor/astronomy.js',
    ...['app', 'chart', 'lunations', 'place', 'content', 'practice', 'sky', 'backup', 'dates'].map(f => `src/${f}.js`),
    ...CONTENT_FILES.map(f => `content/${f}`),
    ...LUNATION_FILES.map(f => `content/lunations/${f.file}`),
  ])).catch(() => { /* offline cache is best effort */ });
}
