// Date detail for a lunation: full date, countdown/status, timing windows, calendar file.
import { exactTime, arcPartner } from './lunations.js';
import { ordinal } from './chart.js';

const MIN = 6e4, HOUR = 36e5, DAY = 864e5, WINDOW = 48 * HOUR;

export const fmtFull = d => new Date(d).toLocaleString(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
export const fmtShort = d => new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTime = d => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function span(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / HOUR), m = Math.floor(ms % HOUR / MIN);
  if (d) return h ? `${plural(d, 'day')}, ${plural(h, 'hour')}` : plural(d, 'day');
  if (h) return m ? `${plural(h, 'hour')}, ${plural(m, 'minute')}` : plural(h, 'hour');
  return plural(Math.max(m, 1), 'minute');
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// state: upcoming | today | window | passed
export function countdown(lun, now = new Date()) {
  const at = new Date(lun.date), diff = at - now;
  if (diff > 0) {
    if (sameDay(at, now)) return { state: 'today', text: `${at.getHours() >= 17 ? 'Tonight' : 'Today'} at ${fmtTime(at)} · in ${span(diff)}` };
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (sameDay(at, tomorrow)) return { state: 'upcoming', text: `Tomorrow at ${fmtTime(at)} · in ${span(diff)}` };
    return { state: 'upcoming', text: `In ${diff > 7 * DAY ? plural(Math.round(diff / DAY), 'day') : span(diff)}` };
  }
  const since = -diff;
  if (since < WINDOW) {
    return { state: 'window', text: lun.phase === 'new'
      ? `48-hour window open · ${span(WINDOW - since)} left`
      : `Exact ${span(since)} ago · the light is on` };
  }
  return { state: 'passed', text: `Passed ${span(since)} ago` };
}

// Timing windows around one lunation, in date order.
export function windows(lun) {
  const t = +new Date(lun.date), out = [];
  const partner = arcPartner(lun);
  if (lun.phase === 'new') {
    out.push({ label: '48-hour window', at: t, end: t + WINDOW, note: 'Do the first true action before it closes.' });
    out.push({ label: 'Building (waxing) phase', at: t, end: +exactTime('full', new Date(t)), note: 'What you inscribed grows until the Full Moon.' });
    if (partner) out.push({ label: `Six-month arc: Full Moon in ${lun.sign}`, at: +new Date(partner.date), note: 'What you inscribe now comes to light.', link: partner });
  } else {
    out.push({ label: 'Release (waning) phase', at: t, end: +exactTime('new', new Date(t)), note: 'Integration and release until the next New Moon.' });
    if (partner) out.push({ label: `Began at the New Moon in ${lun.sign}`, at: +new Date(partner.date), note: 'This Full Moon answers what was inscribed then.', link: partner });
  }
  if (lun.eclipse) {
    out.push({ label: 'Eclipse: let it settle', at: t, end: t + WINDOW,
      note: lun.phase === 'full' ? 'No major decisions until this passes.' : 'Do not force new starts on the exact day.' });
  }
  return out.sort((a, b) => a.at - b.at);
}

/* ---------- Calendar (.ics) ---------- */
const icsTime = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// RFC 5545: lines over 75 octets fold onto a continuation line starting with a space.
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function event({ uid, start, minutes = 30, summary, description, url, alarm }) {
  return [
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${icsTime(Date.now())}`,
    `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(start + minutes * MIN)}`,
    `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`, url ? `URL:${url}` : null,
    ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, `TRIGGER:${alarm}`, 'END:VALARM'] : []),
    'END:VEVENT',
  ].filter(Boolean);
}

// lunations: placed lunations; houses: content.houses; link(lun) → practice page URL.
export function toIcs(lunations, houses, link) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moon Magic//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const l of lunations) {
    const t = +new Date(l.date), name = `${l.phase === 'new' ? 'New' : 'Full'} Moon in ${l.sign}`;
    const deg = `${Math.floor(l.degree)}° ${l.sign}`;
    lines.push(...event({
      uid: `${l.phase}-${l.date.slice(0, 13)}@moon-magic`, start: t,
      summary: `${name}${l.eclipse ? ' (eclipse)' : ''} · your ${ordinal(l.house)} house`,
      description: `${deg} in your ${ordinal(l.house)} house: ${houses[l.house]}.\nOpen your practice page: ${link(l)}`,
      url: link(l), alarm: '-P1D',
    }));
    if (l.phase === 'new') {
      lines.push(...event({
        uid: `${l.phase}-${l.date.slice(0, 13)}-window@moon-magic`, start: t + WINDOW,
        summary: `48-hour window closes · ${name}`,
        description: 'Your first true action for this New Moon, before this time.', alarm: '-PT6H',
      }));
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
