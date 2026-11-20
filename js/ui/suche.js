/* Suche (Spieler und Vereine, ganz Deutschland) und „Spieler eintragen“.
   Ansichten: suche (ein Suchfeld, Reiter Alle/Spieler/Vereine), sneu (Spieler eintragen bzw. nur für ein Spiel).
   Daten in services/spieler.js, Vereine aus services/vereine.js. Klassen mit su-. */
import { $, esc, toast, buzz, applyTier, tierOf } from '../core/util.js';
import { registerView, show, nav } from '../router.js';
import { isLoggedIn, onAuthChange } from '../services/auth.js';
import { PL, POS_NAME, POS_SHORT, POS_ORDER, fullName, guestId } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { games, loadGames } from '../services/api.js';
import { avatar, skeleton, playerStats } from './components.js';
import { vr, loadVereine, searchLocal as vLocal, searchDb as vDb, merged as vMerged, vereinById, myClub } from '../services/vereine.js';
import { loadModeration, setSpielerStatus, reportDone, fetchSpieler, searchDb, mergePlayers, recent, addRecent, clearRecent, createSpieler, useVerein, teamText, clubName, TEAM_ART, sp, searchLocal } from '../services/spieler.js';
import { vereinRow, openVerein, openVereinNeu } from './vereine.js';
import { keyOf, score } from '../core/vsearch.js';
import { openProfile } from './profile.js';
import { requestNewGame } from './start.js';

const ui = { q: '', tab: 'all', db: [], dbFor: '', vdb: [], vdbFor: '', busy: false };
let timer = 0;

/* ---------- Bausteine ---------- */
const CHEV = '<span class="chev" aria-hidden="true">›</span>';
export function spielerRow(p, attr = null) {
  const st = playerStats(p.id), sub = [clubName(p), p.ext ? teamText(p) : (CL[p.c] && CL[p.c].lg ? 'Kreisliga ' + CL[p.c].lg : '')].filter(Boolean).join(' · ');
  return '<button type="button" class="su-row" ' + (attr || 'data-su="p:' + esc(p.id) + '"') + '>' + avatar(p.id) +
    '<span class="su-t"><b>' + esc(fullName(p)) + (p.num ? ' <i class="su-num">' + p.num + '</i>' : '') + '</b><small>' + esc(sub) + '</small></span>' +
    '<span class="su-pos">' + POS_SHORT[p.pos || 'MIT'] + '</span>' +
    (st.avg != null ? '<span class="su-avg tc" data-tier="' + tierOf(st.avg) + '">' + st.avg + '</span>' : '<span></span>') + CHEV + '</button>';
}

function recentHtml() {
  const l = recent();
  if (!l.length) return '';
  return '<h2 class="su-h">Zuletzt<button type="button" class="lnk inline" data-su="clear">Leeren</button></h2><div class="su-list">' + l.map(x => {
    if (x.t === 'p' && PL[x.id] && !PL[x.id].hidden) return spielerRow(PL[x.id]);
    const v = x.t === 'v' && vereinById(x.id);
    return v ? vereinRow(v) : '';
  }).join('') + '</div>';
}

function emptyHtml() {
  const my = myClub();
  let h = recentHtml();
  if (my) h += '<h2 class="su-h">Mein Verein</h2><div class="su-list">' + (vereinById(my.id) ? vereinRow(vereinById(my.id)) : '') + '</div>';
  /* Top-Spieler aus den geladenen Spielen (kein Extra-Traffic) */
  if (games.list && games.list.length) {
    const sum = new Map();
    for (const g of games.list) sum.set(g.player, (sum.get(g.player) || 0) + g.points);
    const top = [...sum].filter(([id]) => PL[id] && !PL[id].hidden && !PL[id].guest).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length) h += '<h2 class="su-h">Top-Spieler</h2><div class="su-list">' + top.map(([id]) => spielerRow(PL[id])).join('') + '</div>';
  }
  if (!h) h = '<div class="su-empty"><span class="su-big" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></span><b>Spieler oder Verein</b></div>';
  return h;
}

function resultsHtml() {
  const q = ui.q.trim();
  if (q.length < 2) return emptyHtml();
  const players = ui.tab === 'clubs' ? [] : mergePlayers(q, ui.dbFor === q ? ui.db : []).filter(p => !p.hidden);
  const clubs = ui.tab === 'players' || !vr.list ? [] : vMerged(q, ui.vdbFor === q ? ui.vdb : []);
  const wait = ui.busy && ui.dbFor !== q;
  let h = '';
  if (ui.tab !== 'clubs') {
    const n = ui.tab === 'all' ? 5 : 40;
    if (ui.tab === 'all') h += '<h2 class="su-h">Spieler' + (players.length > n ? '<button type="button" class="lnk inline" data-su="tab:players">Alle ' + players.length + '</button>' : '') + '</h2>';
    h += players.length ? '<div class="su-list">' + players.slice(0, n).map(p => spielerRow(p)).join('') + '</div>' : wait ? skeleton(2, true) : '<p class="su-none">Kein Spieler gefunden</p>';
    h += '<button type="button" class="su-add" data-su="neu"><span aria-hidden="true">+</span>Spieler eintragen</button>';
  }
  if (ui.tab !== 'players') {
    const n = ui.tab === 'all' ? 4 : 30;
    if (ui.tab === 'all') h += '<h2 class="su-h">Vereine' + (clubs.length > n ? '<button type="button" class="lnk inline" data-su="tab:clubs">Alle ' + clubs.length + '</button>' : '') + '</h2>';
    h += !vr.list ? skeleton(2, true) : clubs.length ? '<div class="su-list">' + clubs.slice(0, n).map(vereinRow).join('') + '</div>' : '<p class="su-none">Kein Verein gefunden</p>';
    if (ui.tab === 'clubs' || !clubs.length) h += '<button type="button" class="su-add" data-su="vneu"><span aria-hidden="true">+</span>Verein anlegen</button>';
  }
  return h;
}
function renderList() { const b = $('suList'); if (b) b.innerHTML = resultsHtml(); }
function renderTabs() {
  $('suTabs').innerHTML = [['all', 'Alle'], ['players', 'Spieler'], ['clubs', 'Vereine']].map(([k, l]) =>
    '<button type="button" data-su="tab:' + k + '" aria-pressed="' + (ui.tab === k) + '">' + l + '</button>').join('');
}
function render() {
  applyTier(0);
  const inp = $('suQ');
  if (inp.value !== ui.q) inp.value = ui.q;
  $('suClear').hidden = !ui.q;
  renderTabs(); renderList();
  if (!vr.list && !vr.busy) loadVereine().then(renderList, renderList);
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'suche') renderList(); });
}

function onInput(q) {
  ui.q = q;
  $('suClear').hidden = !q;
  renderList();
  clearTimeout(timer);
  const t = q.trim();
  if (t.length < 2) return;
  /* DB erst nach kurzer Pause (Traffic), Spieler und angelegte Vereine zusammen */
  ui.busy = true;
  timer = setTimeout(async () => {
    if (ui.q.trim() !== t) return;
    const strong = vr.list ? vLocal(t, 5).filter(v => v.s >= 0.95).length : 0;
    const [ps, vs] = await Promise.all([searchDb(t), t.length >= 3 && strong < 3 ? vDb(t) : Promise.resolve([])]);
    if (ui.q.trim() !== t) return;
    ui.db = ps; ui.dbFor = t; ui.vdb = vs; ui.vdbFor = t; ui.busy = false;
    if (nav.current === 'suche') renderList();
  }, 350);
}

/* ---------- Spieler eintragen ---------- */
const nf = { vn: '', n: '', verein: null, vq: '', art: 'herren', nr: 1, pos: 'MIT', num: '', ok: false, err: '', busy: false, dupe: null, dupeOk: false, serie: false, done: [] };
export function openNeu({ verein = null, name = '' } = {}) {
  const parts = String(name || '').trim().split(/\s+/);
  Object.assign(nf, { vn: parts.length > 1 ? parts.slice(0, -1).join(' ') : '', n: parts.length > 1 ? parts[parts.length - 1] : parts[0] || '',
    verein: verein || (myClub() && vereinById(myClub().id)) || null, vq: '', art: 'herren', nr: 1, pos: 'MIT', num: '', ok: false, err: '', busy: false, dupe: null, dupeOk: false,
    /* Vom Verein aus: mehrere hintereinander eintragen (Formular bleibt offen) */
    serie: !!verein, done: [] });
  show('sneu');
}
const seg = (key, opts, cur) => '<div class="seg full">' + opts.map(([k, l]) => '<button type="button" data-sn="' + key + ':' + k + '" aria-pressed="' + (String(cur) === String(k)) + '">' + l + '</button>').join('') + '</div>';
function vereinPick() {
  if (nf.verein) return '<div class="su-vsel"><span class="vr-ic" aria-hidden="true">' + esc(nf.verein.name.replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2)) + '</span><span class="su-t"><b>' + esc(nf.verein.name) + '</b><small>' + esc(nf.verein.ort || '') + '</small></span>' +
    '<button type="button" class="lnk inline" data-sn="vchange">Ändern</button></div>';
  const l = nf.vq.trim().length >= 2 && vr.list ? vLocal(nf.vq, 6) : [];
  return '<input class="fi" id="snVq" type="search" placeholder="Verein oder Ort" autocomplete="off" spellcheck="false" value="' + esc(nf.vq) + '">' +
    '<div class="su-list su-vres" id="snVres">' + vresHtml(l) + '</div>';
}
const vresHtml = l => l.map(v => '<button type="button" class="su-vopt" data-sn="v:' + esc(v.id) + '"><b>' + esc(v.name) + '</b><small>' + esc(v.ort || '') + '</small></button>').join('');
function neuHtml() {
  const logged = isLoggedIn();
  let h = nf.done.length ? '<h2 class="su-h">Eingetragen<button type="button" class="lnk inline" data-nav="back">Fertig</button></h2><div class="su-list su-done">' +
    nf.done.filter(id => PL[id]).map(id => spielerRow(PL[id], 'data-open="p:' + esc(id) + '"')).join('') + '</div>' : '';
  h += '<form class="card inline-form su-form" id="snForm" autocomplete="off">' +
    '<div class="vr-two"><label class="nf"><span>Vorname</span><input class="fi" name="vn" maxlength="30" autocapitalize="words" value="' + esc(nf.vn) + '"></label>' +
    '<label class="nf"><span>Nachname</span><input class="fi" name="n" maxlength="30" autocapitalize="words" value="' + esc(nf.n) + '"></label></div>' +
    '<div class="nf"><span>Verein</span>' + vereinPick() + '</div>' +
    '<div class="nf"><span>Mannschaft</span>' + seg('art', Object.entries(TEAM_ART), nf.art) +
    '<div class="seg full su-nr">' + [1, 2, 3, 4].map(n => '<button type="button" data-sn="nr:' + n + '" aria-pressed="' + (nf.nr === n) + '">' + ['', 'I', 'II', 'III', 'IV'][n] + '</button>').join('') + '</div></div>' +
    '<div class="nf"><span>Position</span>' + seg('pos', POS_ORDER.map(k => [k, POS_SHORT[k]]), nf.pos) + '</div>' +
    '<label class="nf su-numf"><span>Rückennummer</span><input class="fi" name="num" inputmode="numeric" maxlength="2" placeholder="–" value="' + esc(nf.num) + '"></label>';
  if (logged) h += '<label class="su-ok"><input type="checkbox" name="ok"' + (nf.ok ? ' checked' : '') + '><span>Volljährig und weiß Bescheid</span></label>';
  if (nf.dupe && PL[nf.dupe]) h += '<div class="form-msg bad">Gibt es schon?</div><div class="su-list">' + spielerRow(PL[nf.dupe]) + '</div>';
  if (nf.err) h += '<div class="form-msg bad">' + esc(nf.err) + '</div>';
  if (logged && !sp.dbMissing) h += '<button type="submit" class="btn primary full"' + (nf.busy ? ' disabled' : '') + '>' + (nf.busy ? 'Speichere …' : nf.dupe ? 'Trotzdem eintragen' : 'Eintragen') + '</button>';
  else if (!logged) h += '<button type="button" class="btn primary full" data-nav="admin">Anmelden zum Eintragen</button>';
  h += '<button type="button" class="btn full su-guest" data-sn="guest">Nur für ein Spiel</button></form>';
  return h;
}
function renderNeu() { applyTier(0); $('snBody').innerHTML = neuHtml(); if (!vr.list && !vr.busy) loadVereine().then(() => { if (nav.current === 'sneu') renderNeu(); }, () => {}); }
function readNeu() {
  const f = $('snForm');
  if (!f) return;
  nf.vn = f.vn.value.trim(); nf.n = f.n.value.trim(); nf.num = f.num.value.replace(/\D/g, '').slice(0, 2);
  if (f.ok) nf.ok = f.ok.checked;
}
const validName = s => /^\p{L}[\p{L} '.-]{1,29}$/u.test(s.trim());
function check(needOk) {
  if (!validName(nf.vn) || !validName(nf.n)) return 'Vor- und Nachname fehlen';
  if (!nf.verein) return 'Verein wählen';
  if (needOk && !nf.ok) return 'Bitte bestätigen';
  return '';
}
/* Mannschaft aus der Kreisliga-Liste (Wappen, Liga), falls der Verein eine passende hat */
const crestTeam = () => { const t = (nf.verein.teams || []).find(x => x.crest && x.art === nf.art && x.nr === nf.nr); return t ? t.crest : null; };
async function submitNeu() {
  readNeu();
  nf.err = check(true);
  if (nf.err) { renderNeu(); return; }
  /* Doppelte vermeiden: ähnlicher Name am gleichen Verein */
  if (!nf.dupeOk) {
    const q = nf.vn + ' ' + nf.n;
    const pool = [...searchLocal(q, 10), ...(await searchDb(q))];
    const hit = pool.find(p => score(q, keyOf(fullName(p))) >= 0.9 && ((p.verein || '') === nf.verein.id || (crestTeam() && p.c === crestTeam()) || (!p.ext && (nf.verein.teams || []).some(t => t.crest === p.c))));
    if (hit && nf.dupe !== hit.id) { nf.dupe = hit.id; renderNeu(); return; }
    nf.dupeOk = true;
  }
  nf.busy = true; nf.err = ''; renderNeu();
  try {
    const p = await createSpieler({ vn: nf.vn, n: nf.n, verein: nf.verein.id, vname: nf.verein.name, team: crestTeam(), art: nf.art, nr: nf.nr, pos: nf.pos, num: +nf.num || null, ok: nf.ok });
    nf.busy = false; buzz(20); toast('Eingetragen');
    addRecent('p', p.id, fullName(p));
    if (nf.serie) {
      Object.assign(nf, { vn: '', n: '', num: '', dupe: null, dupeOk: false });
      nf.done.unshift(p.id); renderNeu();
      const f = $('snForm'); if (f) f.vn.focus();
      return;
    }
    show('suche'); openProfile(p.id);
  } catch (e) { nf.busy = false; nf.err = e.message; renderNeu(); }
}
/* Ohne Konto: Gastspieler nur für dieses Spiel (wird nicht in der Rangliste gespeichert) */
function asGuest() {
  readNeu();
  nf.err = check(false);
  if (nf.err) { renderNeu(); return; }
  const club = useVerein(nf.verein);
  const id = guestId(club, (nf.vn + ' ' + nf.n).replace(/[:<>"]/g, ''));
  if (PL[id]) PL[id].pos = nf.pos;
  requestNewGame({ player: id });
}

/* Profil-Link aus WhatsApp & Co.: ?p=<Spieler-ID> */
export async function openPlayerLink(id) {
  const p = await fetchSpieler(id);
  if (p && !p.hidden) { addRecent('p', id, fullName(p)); openProfile(id); }
  else toast('Spieler nicht gefunden', 'bad');
}
export const profileUrl = id => location.origin + location.pathname + '?p=' + encodeURIComponent(id);

/* ---------- Admin: Meldungen und ausgeblendete Spieler (Karte im Admin-Bereich) ---------- */
const mod = { data: null, err: '', at: 0 };
const ART = { ausblenden: 'Ausblenden', doppelt: 'Doppelt', falsch: 'Falsch', sonstiges: 'Sonstiges' };
export function modHtml() {
  if (sp.dbMissing) return '';
  const d = mod.data;
  if (!d) return '<div class="card su-mod" id="modCard"><b>Spieler-Meldungen</b><p class="muted small">' + esc(mod.err || 'Lädt …') + '</p></div>';
  if (!d.reports.length && !d.hidden.length) return '<div class="card su-mod" id="modCard"><b>Spieler-Meldungen</b><p class="muted small">Keine</p></div>';
  return '<div class="card su-mod" id="modCard"><b>Spieler-Meldungen</b>' +
    d.reports.map(r => '<div class="su-modr"><span class="su-t"><b>' + esc(r.name) + '</b><small>' + esc(ART[r.art] || r.art) + (r.text ? ' · ' + esc(r.text) : '') + '</small></span>' +
      '<button type="button" class="btn sm" data-mod="done:' + r.id + '">Erledigt</button></div>').join('') +
    (d.hidden.length ? '<div class="su-modh">Ausgeblendet</div>' + d.hidden.map(p => '<div class="su-modr"><span class="su-t"><b>' + esc(fullName(p)) + '</b><small>' + esc(p.vname) + '</small></span>' +
      '<button type="button" class="btn sm" data-mod="show:' + esc(p.id) + '">Wieder zeigen</button></div>').join('') : '') + '</div>';
}
export async function loadMod(force) {
  if (sp.dbMissing || (!force && Date.now() - mod.at < 120000)) return;
  mod.at = Date.now();
  try { mod.data = await loadModeration(); mod.err = ''; }
  catch (e) { mod.data = null; mod.err = e.status === 404 ? 'Migration 017 fehlt' : 'Nicht erreichbar'; }
  const el = $('modCard'); if (el) el.outerHTML = modHtml();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mod]');
  if (!b || b.disabled) return;
  b.disabled = true;
  const k = b.dataset.mod, v = k.slice(k.indexOf(':') + 1);
  try {
    if (k.startsWith('done:')) await reportDone(+v);
    else if (k.startsWith('show:')) await setSpielerStatus(v, 'ok');
    toast('Erledigt');
  } catch (err) { toast(err.message || 'Nicht gespeichert', 'bad'); }
  loadMod(true);
});

/* ---------- Einstieg ---------- */
export function openSuche(q = null, tab = null) { if (q != null) ui.q = q; if (tab) ui.tab = tab; show('suche'); setTimeout(() => { if (!ui.q) $('suQ').focus(); }, 60); }

export function initSuche() {
  registerView('suche', { elements: ['suche'], render });
  registerView('sneu', { elements: ['sneu'], render: renderNeu });
  onAuthChange(() => { if (nav.current === 'sneu') { readNeu(); renderNeu(); } });
  const inp = $('suQ');
  inp.addEventListener('input', e => onInput(e.target.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('suClear').addEventListener('click', () => { ui.q = ''; inp.value = ''; render(); inp.focus(); });

  $('suche').addEventListener('click', e => {
    const b = e.target.closest('[data-su], [data-vr^="v:"]');
    if (!b) return;
    if (b.dataset.vr) { const v = vereinById(b.dataset.vr.slice(2)); if (v) addRecent('v', v.id, v.name); return; }
    const k = b.dataset.su;
    if (k.startsWith('p:')) { const id = k.slice(2); if (PL[id]) { addRecent('p', id, fullName(PL[id])); buzz(8); openProfile(id); } }
    else if (k.startsWith('tab:')) { ui.tab = k.slice(4); renderTabs(); renderList(); window.scrollTo(0, 0); }
    else if (k === 'clear') { clearRecent(); renderList(); }
    else if (k === 'neu') openNeu({ name: ui.q });
    else if (k === 'vneu') openVereinNeu(ui.q);
  });

  $('sneu').addEventListener('click', e => {
    const b = e.target.closest('[data-sn]');
    if (!b) return;
    e.preventDefault();
    readNeu();
    const k = b.dataset.sn, v = k.slice(k.indexOf(':') + 1);
    if (k.startsWith('art:')) nf.art = v;
    else if (k.startsWith('nr:')) nf.nr = +v;
    else if (k.startsWith('pos:')) nf.pos = v;
    else if (k.startsWith('v:')) { nf.verein = vereinById(v); nf.vq = ''; nf.dupe = null; nf.dupeOk = false; }
    else if (k === 'vchange') { nf.verein = null; nf.dupe = null; nf.dupeOk = false; }
    else if (k === 'guest') { asGuest(); return; }
    nf.err = '';
    renderNeu();
    if (k === 'vchange') { const i = $('snVq'); if (i) i.focus(); }
  });
  $('sneu').addEventListener('input', e => {
    if (e.target.id === 'snVq') {
      nf.vq = e.target.value;
      const box = $('snVres');
      if (box && vr.list) box.innerHTML = vresHtml(nf.vq.trim().length >= 2 ? vLocal(nf.vq, 6) : []);
    } else if (e.target.name === 'vn' || e.target.name === 'n') { nf.dupe = null; nf.dupeOk = false; }
  });
  $('sneu').addEventListener('submit', e => { e.preventDefault(); if (!nf.busy) submitNeu(); });
}
export { openVerein };
