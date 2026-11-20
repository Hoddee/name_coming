/* Vereinssuche: ganz Deutschland, Vereine mit Mannschaften und Liga.
   Ansichten: vereine (Suche), verein (ein Verein mit Mannschaften), vneu (Verein anlegen).
   Daten und Prüfung in services/vereine.js, Suchlogik in core/vsearch.js. Klassen mit vr-. */
import { $, esc, toast, buzz, applyTier } from '../core/util.js';
import { registerView, show, nav } from '../router.js';
import { isLoggedIn, onAuthChange } from '../services/auth.js';
import { CL, crestUrl } from '../data/clubs.js';
import { fullName } from '../data/players.js';
import { LAENDER, VERBAENDE, verbaendeIn, verbandOf, KLASSEN, ARTEN, JUGEND } from '../data/verbaende.js';
import { roman, score } from '../core/vsearch.js';
import { vr, loadVereine, searchLocal, searchDb, merged, vereinById, fetchVerein, loadTeams, teamLiga, saveTeam, createVerein, report, checkOrt, myClub, setMyClub } from '../services/vereine.js';
import { skeleton, gameRow, playerStats } from './components.js';
import { games, loadGames } from '../services/api.js';
import { recordTeam } from '../core/game.js';
import { byDate } from '../core/market.js';
import { vereinKader, addRecent, sp, teamText } from '../services/spieler.js';
import { spielerRow, openNeu } from './suche.js';

const ui = { q: '', db: [], dbFor: '', id: null, teams: null, teamsErr: false, kader: null, kRev: 0, form: '', busy: false, err: '', neu: null };
let timer = 0;

/* ---------- Bausteine ---------- */
const where = v => [v.ort, LAENDER[v.land]].filter(Boolean).join(' · ');
const teamName = t => (t.art === 'jugend' ? t.jugend + (t.nr > 1 ? ' ' + roman(t.nr) : '') : ARTEN[t.art] + (t.nr > 1 ? ' ' + roman(t.nr) : ''));
const ligaChip = v => { const t = v.teams.find(x => x.art === 'herren' && x.nr === 1) || v.teams[0]; return t ? '<i class="vr-lg">' + esc(t.nummer || teamLiga(t)) + '</i>' : ''; };
export function vereinRow(v) { return row(v); }
function row(v) {
  const mine = (myClub() || {}).id === v.id;
  return '<button type="button" class="vr-row" data-vr="v:' + esc(v.id) + '"><span class="vr-ic" aria-hidden="true">' + esc(initials(v.name)) + '</span>' +
    '<span class="vr-t"><b>' + esc(v.name) + '</b><small>' + esc(where(v)) + (mine ? ' · Mein Verein' : '') + '</small></span>' + ligaChip(v) +
    '<span class="chev" aria-hidden="true">›</span></button>';
}
function initials(n) {
  const w = String(n).replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const main = w.find(x => x.length > 3 && x !== x.toUpperCase()) || w[0] || '?';
  return main.slice(0, 2);
}
const credit = () => '<p class="vr-src">Vereinsdaten: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap-Mitwirkende</a> (ODbL)' +
  (/wikidata/i.test(vr.quelle) ? ', Wikidata' : '') + (/overture/i.test(vr.quelle) ? ', <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noopener">Overture Maps</a>' : '') + '</p>';

/* ---------- Suche ---------- */
function searchHtml() {
  if (!vr.list) {
    if (vr.error) return '<p class="hmsg">Keine Verbindung.</p><button type="button" class="btn full" data-vr="reload">Nochmal versuchen</button>';
    return skeleton(4);
  }
  const q = ui.q.trim();
  if (!q) {
    const my = myClub(), v = my && vereinById(my.id);
    return (v ? '<h2>Mein Verein</h2><div class="vr-list">' + row(v) + '</div>' : '') +
      '<p class="vr-cnt">' + vr.list.length.toLocaleString('de-DE') + ' Vereine</p>' + credit();
  }
  const list = merged(q, ui.dbFor === q ? ui.db : []);
  let h = list.length ? '<div class="vr-list">' + list.map(row).join('') + '</div>' : '<p class="hmsg">Nichts gefunden.</p>';
  h += '<button type="button" class="btn full vr-add" data-vr="neu">Verein anlegen</button>';
  return h + credit();
}
function renderSearch() {
  const box = $('vrList');
  if (box) box.innerHTML = searchHtml();
}
function onInput(q) {
  ui.q = q;
  renderSearch();
  clearTimeout(timer);
  const t = q.trim();
  /* Angelegte Vereine aus der DB erst nach einer kurzen Pause und nur, wenn im Grundbestand wenig passt */
  if (t.length >= 3) timer = setTimeout(async () => {
    if (ui.q.trim() !== t) return;
    const strong = searchLocal(t, 5).filter(v => v.s >= 0.95).length;
    if (strong >= 3) return;
    const res = await searchDb(t);
    if (ui.q.trim() !== t) return;
    ui.db = res; ui.dbFor = t;
    if (nav.current === 'vereine') renderSearch();
  }, 450);
}
function renderVereine() {
  applyTier(0);
  const inp = $('vrQ');
  if (inp && inp.value !== ui.q) inp.value = ui.q;
  renderSearch();
  if (!vr.list && !vr.busy) loadVereine().then(renderSearch, renderSearch);
}

/* ---------- Ein Verein ---------- */
function teamForm(v) {
  const vb = verbaendeIn(v.land), vsel = v.verband || verbandOf(v.land);
  return '<form class="card inline-form vr-form" id="vrTeamForm"><div class="fl">Mannschaft</div>' +
    '<div class="vr-two"><label class="nf"><span>Art</span><select class="fi" name="art">' + Object.entries(ARTEN).map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join('') + '</select></label>' +
    '<label class="nf"><span>Nr.</span><select class="fi" name="nr">' + [1, 2, 3, 4, 5].map(n => '<option value="' + n + '">' + roman(n) + '</option>').join('') + '</select></label></div>' +
    '<label class="nf vr-jg" hidden><span>Jugend</span><select class="fi" name="jugend">' + JUGEND.map(j => '<option>' + j + '</option>').join('') + '</select></label>' +
    '<div class="vr-two"><label class="nf"><span>Liga</span><select class="fi" name="klasse"><option value="">–</option>' + KLASSEN.map(k => '<option>' + k + '</option>').join('') + '</select></label>' +
    '<label class="nf"><span>Staffel</span><input class="fi" name="nummer" maxlength="6" autocomplete="off" placeholder="2"></label></div>' +
    '<label class="nf"><span>Kreis / Bezirk</span><input class="fi" name="kreis" maxlength="40" autocomplete="off" placeholder="Rems/Murr"></label>' +
    (vb.length > 1 ? '<label class="nf"><span>Verband</span><select class="fi" name="verband">' + vb.map(k => '<option value="' + k + '"' + (k === vsel ? ' selected' : '') + '>' + esc(VERBAENDE[k][1]) + '</option>').join('') + '</select></label>' : '') +
    (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>Speichern</button><button type="button" class="btn" data-vr="close">Abbrechen</button></div></form>';
}
function reportForm() {
  const arts = [['doppelt', 'Doppelt'], ['falsch', 'Angaben falsch'], ['gibts_nicht', 'Gibt es nicht'], ['sonstiges', 'Sonstiges']];
  return '<form class="card inline-form vr-form" id="vrRepForm"><div class="fl">Fehler melden</div>' +
    '<label class="nf"><span>Was stimmt nicht?</span><select class="fi" name="art">' + arts.map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join('') + '</select></label>' +
    '<label class="nf"><span>Hinweis</span><input class="fi" name="text" maxlength="200" autocomplete="off"></label>' +
    (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<div class="duo"><button type="submit" class="btn primary"' + (ui.busy ? ' disabled' : '') + '>Senden</button><button type="button" class="btn" data-vr="close">Abbrechen</button></div></form>';
}
/* Kader nach Mannschaft gruppiert, darin nach Punkteschnitt (ohne Spiele unten, dann nach Name) */
const ART_ORDER = { herren: 0, frauen: 1, ah: 2 };
function kaderHtml(list) {
  const groups = new Map();
  for (const p of list) {
    const key = p.ext ? (ART_ORDER[p.art] || 0) * 10 + p.nr : -1, label = p.ext ? teamText(p) : ((CL[p.c] || {}).n || 'Herren');
    const k = key + '|' + label;
    if (!groups.has(k)) groups.set(k, { key, label, l: [] });
    groups.get(k).l.push(p);
  }
  const gs = [...groups.values()].sort((a, b) => a.key - b.key);
  /* „Herren“ wird zu „Herren I“, sobald es auch eine „Herren II“ gibt */
  for (const g of gs) if (g.key >= 0 && g.key % 10 === 1 && gs.some(o => o !== g && Math.floor(o.key / 10) === Math.floor(g.key / 10) && o.key >= 0)) g.label += ' I';
  const avgOf = p => { const a = playerStats(p.id).avg; return a == null ? -1e9 : a; };
  return gs.map(g => (gs.length > 1 ? '<div class="vr-kh">' + esc(g.label) + ' <small>' + g.l.length + '</small></div>' : '') +
    '<div class="su-list">' + g.l.sort((a, b) => avgOf(b) - avgOf(a) || fullName(a).localeCompare(fullName(b), 'de')).map(p => { const n = playerStats(p.id).n; return spielerRow(p, 'data-open="p:' + esc(p.id) + '"', n ? n + (n === 1 ? ' Spiel' : ' Spiele') : 'Noch kein Spiel'); }).join('') + '</div>').join('');
}
function vereinHtml() {
  const v = vereinById(ui.id);
  if (!v) return '<p class="hmsg">Verein nicht gefunden.</p>';
  const mine = (myClub() || {}).id === v.id, vb = v.verband || verbandOf(v.land);
  let h = '<div class="vr-head"><span class="vr-ic big" aria-hidden="true">' + esc(initials(v.name)) + '</span><h1>' + esc(v.name) + '</h1>' +
    '<p>' + esc(where(v)) + (vb ? ' · ' + esc(VERBAENDE[vb][0]) : '') + '</p>' +
    (v.web ? '<a class="vr-web" href="https://' + esc(v.web) + '" target="_blank" rel="noopener nofollow">' + esc(v.web.replace(/\/.*$/, '')) + '</a>' : '') + '</div>' +
    '<button type="button" class="btn full' + (mine ? '' : ' primary') + '" data-vr="mine">' + (mine ? 'Mein Verein ✓' : 'Als mein Verein merken') + '</button>';
  h += '<h2>Mannschaften <small class="vr-season">2026/27</small></h2>';
  if (ui.teams === null) h += ui.teamsErr ? '<p class="hmsg">Keine Verbindung.</p>' : skeleton(2);
  else if (!ui.teams.length) h += '<p class="vr-none">Noch keine eingetragen.</p>';
  else h += '<div class="vr-list">' + ui.teams.map(t => '<div class="vr-team">' +
    (t.crest ? '<img src="' + esc(crestUrl(t.crest)) + '" alt="">' : '<span class="vr-ic sm" aria-hidden="true">' + esc(t.art === 'jugend' ? 'J' : roman(t.nr)) + '</span>') +
    '<span class="vr-t"><b>' + esc(teamName(t)) + '</b><small>' + esc([teamLiga(t), t.kreis].filter(Boolean).join(' · ') || 'Liga offen') + '</small></span></div>').join('') + '</div>';
  /* Kader: Spieler, die Nutzer eingetragen haben, und Stammspieler der Kreisliga-Mannschaften */
  h += '<h2>Spieler' + (ui.kader && ui.kader.length ? ' <small class="vr-season">' + ui.kader.length + '</small>' : '') + '</h2>';
  if (ui.kader === null) h += skeleton(2, true);
  else if (ui.kader.length) h += kaderHtml(ui.kader);
  /* Letzte Spiele von Spielern des Vereins (aus den schon geladenen Spielen, kein Extra-Traffic) */
  const ids = new Set([v.id, ...(v.teams || []).map(t => t.crest).filter(Boolean)]);
  const gl = games.list ? byDate(games.list.filter(g => ids.has(recordTeam(g)))).reverse().slice(0, 5) : [];
  const gamesHtml = gl.length ? '<h2>Letzte Spiele</h2><ul class="glist">' + gl.map(g => gameRow(g, 0)).join('') + '</ul>' : '';
  h += '<button type="button" class="su-add" data-vr="spieler"><span aria-hidden="true">+</span>Spieler eintragen</button>';
  h += gamesHtml;
  if (ui.form === 'team') h += teamForm(v);
  else if (ui.form === 'report') h += reportForm();
  else if (isLoggedIn()) h += '<button type="button" class="btn full vr-add" data-vr="team">Mannschaft eintragen</button><button type="button" class="lnk vr-rep" data-vr="report">Fehler melden</button>';
  else h += '<button type="button" class="btn full vr-add" data-nav="admin">Anmelden zum Eintragen</button>';
  return h + (v.src === 'osm' ? credit() : '');
}
function renderVerein() {
  applyTier(0);
  if (!games.list && !games.busy) loadGames().then(() => { if (nav.current === 'verein') renderVerein(); });
  /* Zurück vom Eintragen: Spielerliste neu holen */
  if (ui.kader && ui.kRev !== sp.rev) { ui.kRev = sp.rev; const v = vereinById(ui.id); if (v) vereinKader(v, true).then(k => { ui.kader = k; if (nav.current === 'verein') renderVerein(); }, () => {}); }
  $('vrBody').innerHTML = vereinHtml();
  const f = $('vrTeamForm');
  if (f) f.art.addEventListener('change', () => { f.querySelector('.vr-jg').hidden = f.art.value !== 'jugend'; });
}
export async function openVerein(id) {
  if (!vr.list) { try { await loadVereine(); } catch (e) { /* weiter, vielleicht ein DB-Verein */ } }
  if (!vereinById(id)) await fetchVerein(id);
  Object.assign(ui, { id, teams: null, teamsErr: false, kader: null, form: '', err: '' });
  const v0 = vereinById(id);
  if (v0) addRecent('v', id, v0.name);
  show('verein');
  try { ui.teams = await loadTeams(id); } catch (e) { ui.teamsErr = true; }
  if (nav.current === 'verein' && ui.id === id) renderVerein();
  const v = vereinById(id);
  ui.kader = v ? await vereinKader(v).catch(() => []) : []; ui.kRev = sp.rev;
  if (nav.current === 'verein' && ui.id === id) renderVerein();
}

/* ---------- Verein anlegen ---------- */
function neuHtml() {
  const n = ui.neu || {}, l = n.land || ((myClub() || {}).land) || '', vb = verbaendeIn(l);
  if (!isLoggedIn()) return '<p class="hmsg">Nur mit Konto.</p><button type="button" class="btn primary full" data-nav="admin">Anmelden</button>';
  let h = '<form class="card inline-form vr-form" id="vrNeuForm">' +
    '<label class="nf"><span>Name</span><input class="fi" name="name" maxlength="60" required autocomplete="off" placeholder="SC Musterdorf" value="' + esc(n.name || '') + '"></label>' +
    '<label class="nf"><span>Ort</span><input class="fi" name="ort" maxlength="50" required autocomplete="off" value="' + esc(n.ort || '') + '"></label>' +
    '<label class="nf"><span>Bundesland</span><select class="fi" name="land" required><option value="">–</option>' +
    Object.entries(LAENDER).map(([k, t]) => '<option value="' + k + '"' + (k === l ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
    (vb.length > 1 ? '<label class="nf"><span>Verband</span><select class="fi" name="verband">' + vb.map(k => '<option value="' + k + '"' + (k === n.verband ? ' selected' : '') + '>' + esc(VERBAENDE[k][1]) + '</option>').join('') + '</select></label>' : '') +
    '<label class="nf"><span>Webseite</span><input class="fi" name="web" maxlength="200" inputmode="url" autocomplete="off" placeholder="optional" value="' + esc(n.web || '') + '"></label>';
  if (n.dupe) {
    const d = vereinById(n.dupe);
    if (d) h += '<div class="form-msg bad">Gibt es schon?</div><div class="vr-list">' + row(d) + '</div>';
  }
  h += (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Prüfe …' : n.dupe ? 'Trotzdem anlegen' : 'Anlegen') + '</button></form>';
  return h;
}
const renderNeu = () => { if (!ui.neu) ui.neu = {}; applyTier(0); $('vrNeuBody').innerHTML = neuHtml(); };
function readNeu(f) {
  const d = Object.fromEntries(new FormData(f));
  return Object.assign(ui.neu || {}, { name: String(d.name || '').trim().replace(/\s+/g, ' ').replace(/[<>"]/g, ''), ort: String(d.ort || '').trim().replace(/[<>"]/g, ''),
    land: d.land || '', verband: d.verband || verbandOf(d.land || ''), web: String(d.web || '').trim() });
}
async function submitNeu(f) {
  const n = readNeu(f);
  if (n.name.length < 3 || n.ort.length < 2 || !n.land) { ui.err = 'Name, Ort und Bundesland fehlen.'; renderNeu(); return; }
  if (n.web && !/^[^\s]+\.[a-z]{2,}/i.test(n.web)) { ui.err = 'Webseite stimmt nicht.'; renderNeu(); return; }
  /* Doppelte vermeiden: gleicher Name (auch ähnlich geschrieben) im gleichen Land */
  if (!n.dupeOk) {
    const q = n.name + ' ' + n.ort;
    const best = [...searchLocal(q, 5), ...(await searchDb(n.name))].filter(v => (!v.land || v.land === n.land) && score(q, v.key) >= 0.9)[0];
    if (best && n.dupe !== best.id) { n.dupe = best.id; n.dupeOk = false; ui.err = ''; renderNeu(); return; }
    if (best) n.dupeOk = true;
  }
  ui.busy = true; ui.err = ''; renderNeu();
  /* Ort bei OpenStreetMap prüfen: gibt es ihn, und in welchem Bundesland? */
  const o = await checkOrt(n.ort);
  if (o && !o.found) { ui.busy = false; ui.err = 'Ort nicht gefunden.'; renderNeu(); return; }
  if (o && o.land && o.land !== n.land) { ui.busy = false; n.land = o.land; n.verband = verbandOf(o.land); ui.err = n.ort + ' liegt in ' + LAENDER[o.land] + '. Bitte prüfen.'; renderNeu(); return; }
  try {
    const v = await createVerein(Object.assign({}, n, o && o.found ? { ort: o.ort || n.ort, plz: o.plz, lat: o.lat, lon: o.lon, osm: o.osm } : {}));
    ui.busy = false; ui.neu = null; buzz(20); toast('Verein angelegt');
    openVerein(v.id);
  } catch (e) { ui.busy = false; ui.err = e.message; renderNeu(); }
}

/* ---------- Einstieg ---------- */
export function openVereinNeu(name = '') { ui.neu = { name: String(name).trim().slice(0, 60) }; ui.err = ''; show('vneu'); }
export function openVereine(q = '') { if (q) ui.q = q; show('vereine'); }

/* Vorschläge für ein Textfeld (z. B. eigener Gegner beim neuen Spiel) über ein <datalist> */
export function suggestInto(input, list) {
  const q = input.value.trim();
  if (q.length < 3) return;
  const fill = () => { list.innerHTML = searchLocal(q, 8).map(v => '<option value="' + esc(v.name) + '">' + esc(v.ort || '') + '</option>').join(''); };
  if (vr.list) fill(); else loadVereine().then(fill, () => {});
}

export function initVereine() {
  registerView('vereine', { elements: ['vereine'], render: renderVereine });
  registerView('verein', { elements: ['verein'], render: renderVerein });
  registerView('vneu', { elements: ['vneu'], render: renderNeu });
  onAuthChange(() => { if (nav.current === 'verein') renderVerein(); if (nav.current === 'vneu') renderNeu(); });
  $('vrQ').addEventListener('input', e => onInput(e.target.value));
  $('vrQ').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-vr]');
    if (!b || b.disabled) return;
    const k = b.dataset.vr;
    if (k.startsWith('v:')) openVerein(k.slice(2));
    else if (k === 'reload') { vr.error = false; renderVereine(); loadVereine().then(renderSearch, renderSearch); }
    else if (k === 'spieler') openNeu({ verein: vereinById(ui.id) });
    else if (k === 'neu') { ui.neu = { name: ui.q.trim().slice(0, 60) }; ui.err = ''; show('vneu'); }
    else if (k === 'mine') {
      const v = vereinById(ui.id);
      if (!v) return;
      const mine = (myClub() || {}).id === v.id;
      setMyClub(mine ? null : v); buzz(15); renderVerein();
    } else if (k === 'team' || k === 'report') { ui.form = k; ui.err = ''; renderVerein(); }
    else if (k === 'close') { ui.form = ''; ui.err = ''; renderVerein(); }
  });
  document.addEventListener('submit', async e => {
    const f = e.target;
    if (!['vrTeamForm', 'vrRepForm', 'vrNeuForm'].includes(f.id)) return;
    e.preventDefault();
    if (ui.busy) return;
    if (f.id === 'vrNeuForm') { submitNeu(f); return; }
    const d = Object.fromEntries(new FormData(f)), id = ui.id;
    ui.busy = true; ui.err = '';
    try {
      if (f.id === 'vrTeamForm') {
        await saveTeam(id, { art: d.art, nr: +d.nr || 1, jugend: d.jugend, klasse: d.klasse, nummer: String(d.nummer || '').toUpperCase(), kreis: d.kreis, verband: d.verband });
        ui.teams = await loadTeams(id, true); toast('Gespeichert');
      } else { await report(id, d.art, d.text); toast('Danke, ist gemeldet'); }
      ui.form = ''; buzz(20);
    } catch (err) { ui.err = err.message; }
    ui.busy = false;
    renderVerein();
  });
  $('vneu').addEventListener('input', e => { if (e.target.form && e.target.form.id === 'vrNeuForm' && e.target.name === 'name') { if (ui.neu) { ui.neu.dupe = ''; ui.neu.dupeOk = false; } } });
  $('vneu').addEventListener('change', e => { if (e.target.name === 'land') { readNeu(e.target.form); renderNeu(); } });
}
