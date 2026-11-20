/* Manager: eigenes Team aus dem Kader zusammenstellen, Punkte sammeln, Manager-Liga.
   Reiter Team (Kader, Budget, Wechsel), Markt (alle Spieler mit Preis) und Liga (Tabelle aller Manager).
   Regeln und Rechnung in core/manager.js, Laden/Speichern in services/manager.js. */
import { $, esc, eur, tierOf, trendClass, applyTier, buzz, toast, dateShort } from '../core/util.js';
import { PL, PLAYER_LIST, POS_SHORT, POS_ORDER, fullName } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { games, loadGames } from '../services/api.js';
import { isLoggedIn, onAuthChange } from '../services/auth.js';
import { marketOf } from '../core/market.js';
import { BUDGET, TEAM_SIZE, replay, teamPoints, teamValue, buyBlock, leagueTable, weekRange } from '../core/manager.js';
import { mgr, loadManagers, onManagerChange, myManager, addMove, setTeamName, resetManagers } from '../services/manager.js';
import { avatar, skeleton } from './components.js';
import { registerView, show, nav } from '../router.js';
import { introSeen, mgrTourSeen, showMgrTour } from './intro.js';

const ui = { tab: 'team', pos: 'ALL', busy: false, week: false };
const TABS = [['team', 'Mein Team'], ['markt', 'Markt'], ['liga', 'Liga']];
/* Für den Manager zählen nur Spiele, die mit Anmeldung gespeichert wurden (Migration 016, Spalte mit_konto) */
let mgSrc = null, mgList = null;
export function mgGames() {
  if (!games.list) return null;
  if (mgSrc !== games.list) { mgSrc = games.list; mgList = games.list.filter(g => g.konto !== false); }
  return mgList;
}
const mio = v => (v / 1e6).toFixed(1).replace('.', ',') + ' Mio.';

/* Aktueller Stand des eigenen Teams */
export function myState() {
  const me = myManager();
  if (!me || !games.list) return null;
  const st = replay(me.moves, mgGames()), [ws, we] = weekRange();
  return Object.assign(st, { name: me.name, pts: teamPoints(st, mgGames()), week: teamPoints(st, mgGames(), ws, we).sum, worth: teamValue(st, mgGames()) });
}

/* ---------- Mein Team ---------- */
function head(st) {
  return '<div class="mg-head"><div class="mg-name"><b>' + esc(st.name) + '</b><button type="button" class="lnk inline" data-mg="rename">Ändern</button>' +
    (mgr.online ? '' : '<i class="tag">Nur auf diesem Gerät</i>') + '</div>' +
    '<div class="mg-kpi"><span><b>' + st.pts.sum + '</b><small>Punkte</small></span><span><b>' + st.week + '</b><small>Diese Woche</small></span>' +
    '<span><b>' + mio(st.budget) + '</b><small>Budget</small></span><span><b>' + mio(st.worth) + '</b><small>Teamwert</small></span></div></div>';
}
function memberRow(p, st) {
  const pl = PL[p], mw = marketOf(p, mgGames()), stint = st.stints.find(s => s.p === p && s.to === Infinity);
  const pts = st.pts.per.get(p) || 0, diff = mw.v - (stint ? stint.paid : mw.v);
  return '<div class="mg-row">' +
    '<button type="button" class="mg-who" data-open="p:' + esc(p) + '">' + avatar(p) + '<span><b>' + esc(fullName(pl)) + '</b>' +
    '<small><i class="pbadge">' + POS_SHORT[pl.pos || 'ABW'] + '</i>' + eur(mw.v) + (diff ? ' <em class="' + trendClass(diff) + '">' + (diff > 0 ? '▲' : '▼') + '</em>' : '') + '</small></span></button>' +
    '<span class="mg-pts"><b>' + pts + '</b><small>Punkte</small></span>' +
    '<button type="button" class="mg-act sell" data-mg="sell:' + esc(p) + '">Verkaufen</button></div>';
}
function historyHtml(st) {
  if (!st.moves.length) return '';
  return '<h2>Wechsel</h2><ul class="mg-hist">' + st.moves.slice().reverse().slice(0, 20).map(m =>
    '<li><span class="mg-h-a ' + m.a + '">' + (m.a === 'buy' ? 'Kauf' : 'Verkauf') + '</span><b>' + esc(fullName(PL[m.p])) + '</b>' +
    '<span>' + eur(m.v) + '</span><small>' + dateShort(new Date(m.t).toISOString()) + '</small></li>').join('') + '</ul>';
}
function teamTab(st) {
  let h = head(st) + '<h2>Kader <small class="mg-cnt">' + st.team.length + '/' + TEAM_SIZE + '</small></h2><div class="mg-list">';
  const sorted = st.team.slice().sort((a, b) => POS_ORDER.indexOf(PL[a].pos) - POS_ORDER.indexOf(PL[b].pos));
  h += sorted.map(p => memberRow(p, st)).join('');
  for (let i = st.team.length; i < TEAM_SIZE; i++) h += '<button type="button" class="mg-free" data-mg="t:markt"><span aria-hidden="true">+</span>Freier Platz</button>';
  h += '</div>';
  return h + historyHtml(st);
}

/* ---------- Markt ---------- */
function marketTab(st) {
  const chips = [['ALL', 'Alle'], ...POS_ORDER.map(p => [p, POS_SHORT[p]])];
  let h = '<div class="mg-bud"><span>Budget</span><b>' + eur(st.budget) + '</b></div>' +
    '<div class="lgs mg-pos">' + chips.map(([k, t]) => '<button type="button" data-mg="pos:' + k + '" aria-pressed="' + (ui.pos === k) + '">' + t + '</button>').join('') + '</div>';
  /* Gesuchte Spieler (ganz Deutschland) kommen auf den Markt, sobald sie ein zählendes Spiel haben */
  const ext = [...new Set(mgGames().map(g => g.player))].map(id => PL[id]).filter(p => p && p.ext && !p.hidden);
  const list = [...PLAYER_LIST, ...ext].filter(p => p.active !== false && !p.guest && (ui.pos === 'ALL' || p.pos === ui.pos))
    .map(p => ({ p, mw: marketOf(p.id, mgGames()) })).sort((a, b) => b.mw.v - a.mw.v);
  h += '<div class="mg-list">' + list.map(({ p, mw }) => {
    const l = mgGames().filter(g => g.player === p.id), avg = l.length ? Math.round(l.reduce((s, g) => s + g.points, 0) / l.length) : null;
    const own = st.team.includes(p.id), block = own ? '' : buyBlock(st, p.id, mgGames());
    const btn = own ? '<button type="button" class="mg-act sell" data-mg="sell:' + esc(p.id) + '">Verkaufen</button>'
      : '<button type="button" class="mg-act buy" data-mg="buy:' + esc(p.id) + '"' + (block ? ' disabled' : '') + '>' + (block || 'Kaufen') + '</button>';
    return '<div class="mg-row' + (own ? ' own' : '') + '">' +
      '<button type="button" class="mg-who" data-open="p:' + esc(p.id) + '">' + avatar(p.id) + '<span><b>' + esc(fullName(p)) + '</b>' +
      '<small><i class="pbadge">' + POS_SHORT[p.pos || 'ABW'] + '</i>' + (CL[p.c] ? '<img src="' + esc(crestUrl(p.c)) + '" alt="">' : '') + eur(mw.v) +
      (mw.last ? ' <em class="' + trendClass(mw.last) + '">' + (mw.last > 0 ? '▲' : '▼') + '</em>' : '') + '</small></span></button>' +
      '<span class="mg-pts tc"' + (avg != null ? ' data-tier="' + tierOf(avg) + '"' : '') + '><b>' + (avg != null ? avg : '–') + '</b><small>Ø</small></span>' + btn + '</div>';
  }).join('') + '</div>';
  return h;
}

/* ---------- Liga ---------- */
function leagueTab() {
  const rows = leagueTable(mgr.managers, mgGames());
  if (ui.week) rows.sort((a, b) => b.week - a.week || b.pts - a.pts);
  let h = '<div class="hb-sort">' + [[false, 'Gesamt'], [true, 'Diese Woche']].map(([k, t]) => '<button type="button" data-mg="w:' + (k ? 1 : 0) + '" aria-pressed="' + (ui.week === k) + '">' + t + '</button>').join('') +
    '<span>' + rows.length + ' Manager</span></div><div class="mg-league">' + rows.map((r, i) =>
    '<div class="mg-lr' + (r.me ? ' me' : '') + '"><span class="rk' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
    '<span class="mg-lt"><b>' + esc(r.name) + '</b><span class="mg-stack">' + r.team.map(p => avatar(p)).join('') + '</span></span>' +
    '<span class="mg-lw"><small>' + (ui.week ? 'Gesamt' : 'Woche') + '</small>' + (ui.week ? r.pts : r.week) + '</span><span class="mg-lp"><b>' + (ui.week ? r.week : r.pts) + '</b><small>' + mio(r.worth) + '</small></span></div>').join('') + '</div>';
  return h;
}

/* Ohne Anmeldung kein Manager (Fairness); stattdessen Anmelden oder Fun-Punkte */
function gateHtml() {
  return '<div class="mg-gate"><b>Manager</b><p>Nur mit Konto.</p>' +
    '<button type="button" class="btn primary full" data-nav="admin">Anmelden</button>' +
    '<button type="button" class="btn full" data-nav="fun">Fun-Punkte vergeben</button></div>';
}
function html() {
  if (!isLoggedIn()) return gateHtml();
  let h = '<div class="htabs" role="tablist">' + TABS.map(([k, t]) =>
    '<button type="button" role="tab" data-mg="t:' + k + '" aria-pressed="' + (ui.tab === k) + '">' + t + '</button>').join('') + '</div>';
  if (!games.list || !mgr.loaded) {
    if (games.error && !games.busy) return h + '<p class="hmsg">Keine Verbindung.</p><button type="button" class="btn full" data-mg="reload">Nochmal versuchen</button>';
    return h + skeleton(5);
  }
  const st = myState();
  if (!st) return h + skeleton(5);
  if (ui.tab === 'markt') return h + marketTab(st);
  if (ui.tab === 'liga') return h + leagueTab();
  return h + teamTab(st);
}

export function render() {
  if (!games.list && !games.busy) loadGames().then(rerenderIfOpen);
  if (!mgr.loaded && !mgr.busy) loadManagers();
  $('mgrBody').innerHTML = html();
  applyTier(0);
  /* Beim ersten Öffnen einmal der kurze Rundgang */
  if (isLoggedIn() && introSeen() && !mgrTourSeen() && !document.querySelector('.tour')) setTimeout(() => { if (nav.current === 'manager' && !mgrTourSeen() && !document.querySelector('.tour')) showMgrTour(); }, 400);
}
const rerenderIfOpen = () => { if (nav.current === 'manager') render(); };

/* Rückfrage vor Kauf/Verkauf (Wechsel sind endgültig) */
function ask(title, sub, ok) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mgT"><h3 id="mgT">' + esc(title) + '</h3><p>' + esc(sub) + '</p>' +
      '<div class="duo"><button type="button" class="btn primary" data-sh="1">' + esc(ok) + '</button><button type="button" class="btn" data-sh="0">Abbrechen</button></div></div>';
    const done = v => { el.remove(); res(v); };
    el.addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (b) done(b.dataset.sh === '1'); else if (e.target === el) done(false); });
    document.body.appendChild(el);
    el.querySelector('[data-sh="1"]').focus();
  });
}
function askName(cur) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'sheet-bg';
    el.innerHTML = '<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="mgN"><h3 id="mgN">Teamname</h3>' +
      '<input class="mg-in" name="n" maxlength="24" autocomplete="off" value="' + esc(cur) + '">' +
      '<div class="duo"><button type="submit" class="btn primary">Speichern</button><button type="button" class="btn" data-sh="0">Abbrechen</button></div></form>';
    const done = v => { el.remove(); res(v); };
    el.addEventListener('click', e => { if (e.target.closest('[data-sh]') || e.target === el) done(null); });
    el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); done(new FormData(e.target).get('n')); });
    document.body.appendChild(el);
    el.querySelector('input').focus();
  });
}

export async function trade(p, a) {
  if (ui.busy || !isLoggedIn()) return;
  const st = myState(), v = marketOf(p, mgGames()).v, n = fullName(PL[p]);
  if (a === 'buy' && (buyBlock(st, p, mgGames()) || PL[p].active === false)) return;
  if (a === 'sell' && !st.team.includes(p)) return;
  const ok = await ask(n + (a === 'buy' ? ' kaufen?' : ' verkaufen?'), eur(v), a === 'buy' ? 'Kaufen' : 'Verkaufen');
  if (!ok) return;
  ui.busy = true;
  try { await addMove(p, a); buzz(20); toast(a === 'buy' ? n + ' gekauft' : n + ' verkauft'); }
  catch (e) { toast('Nicht gespeichert', 'bad'); }
  ui.busy = false;
  render();
}

export function initManager() {
  registerView('manager', { elements: ['manager'], render });
  onManagerChange(rerenderIfOpen);
  onAuthChange(() => { resetManagers(); if (nav.current === 'manager' || nav.current === 'start') loadManagers(); });
  $('manager').addEventListener('click', async e => {
    const b = e.target.closest('[data-mg]');
    if (!b || b.disabled) return;
    const k = b.dataset.mg;
    if (k.startsWith('t:')) { ui.tab = k.slice(2); window.scrollTo(0, 0); render(); }
    else if (k.startsWith('pos:')) { ui.pos = k.slice(4); render(); }
    else if (k.startsWith('w:')) { ui.week = k === 'w:1'; render(); }
    else if (k.startsWith('buy:')) trade(k.slice(4), 'buy');
    else if (k.startsWith('sell:')) trade(k.slice(5), 'sell');
    else if (k === 'reload') { loadGames(true).then(rerenderIfOpen); render(); }
    else if (k === 'rename') {
      const n = await askName(myState().name);
      if (n && n.trim()) { try { await setTeamName(n); } catch (err) { toast('Nicht gespeichert', 'bad'); } render(); }
    }
  });
}

/* Zeile im Spielerprofil: kaufen bzw. verkaufen (data-pf="mg:buy|sell") */
export function profileTradeHtml(id) {
  const pl = PL[id];
  if (!pl || pl.guest || pl.hidden || !games.list || !isLoggedIn()) return '';
  if (pl.ext && !mgGames().some(g => g.player === id)) return '';
  if (!mgr.loaded) { if (!mgr.busy) loadManagers(); return ''; }
  const st = myState();
  if (!st) return '';
  const own = st.team.includes(id), block = own ? '' : (pl.active === false ? 'Nicht aktiv' : buyBlock(st, id, mgGames()));
  return '<div class="mg-pf"><span><small>' + esc(st.name) + '</small><b>' + (own ? 'Im Team' : mio(st.budget) + ' Budget') + '</b></span>' +
    (own ? '<button type="button" class="mg-act sell" data-pf="mg:sell">Verkaufen</button>'
      : '<button type="button" class="mg-act buy" data-pf="mg:buy"' + (block ? ' disabled' : '') + '>' + (block || 'Kaufen') + '</button>') + '</div>';
}

/* Karte auf der Liga-Seite */
export function managerCardHtml() {
  if (!games.list) return '';
  if (!isLoggedIn()) return '<button type="button" class="mg-card" data-st="mgr"><span class="mg-c-t"><small>Manager</small><b>Mein Team</b></span>' +
    '<span class="mg-c-go">Anmelden</span><span class="chev" aria-hidden="true">›</span></button>';
  if (!mgr.loaded && !mgr.busy) loadManagers();
  const st = myState();
  if (!st) return '';
  const empty = !st.team.length, many = mgr.online && mgr.managers.length > 1;
  const rank = many ? leagueTable(mgr.managers, mgGames()).findIndex(r => r.me) + 1 : 0;
  return '<button type="button" class="mg-card" data-st="mgr"><span class="mg-c-t"><small>' + (rank ? 'Platz ' + rank + ' von ' + mgr.managers.length : 'Mein Team') + '</small><b>' + esc(st.name) + '</b></span>' +
    (empty ? '<span class="mg-c-go">Team aufstellen</span>' :
      '<span class="mg-stack">' + st.team.map(p => avatar(p)).join('') + '</span><span class="mg-c-v"><b>' + st.pts.sum + '</b><small>Punkte</small></span>') +
    '<span class="chev" aria-hidden="true">›</span></button>';
}
export const openManager = (tab = 'team') => { ui.tab = tab; show('manager', { tab: true }); };
export { BUDGET };
