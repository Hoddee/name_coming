/* Manager-Spiel: Wechsel laden und speichern.
   Angemeldet und mit Migration 014: Wechsel liegen in der Tabelle manager_moves (nur anfügen, Zeitpunkt setzt der Server
   per created_at – niemand kann rückdatieren), Teamnamen in manager_teams. Dann gibt es die Manager-Liga mit allen.
   Nicht angemeldet: kein Manager. Angemeldet, aber Tabelle fehlt: Wechsel nur auf diesem Gerät (KEYS.manager).
   Rechnen (Preis, Budget, Punkte) passiert immer in core/manager.js aus den gespeicherten Spielen. */
import { KEYS, SEASON } from '../config.js';
import { readJson, writeJson } from '../core/util.js';
import { rest, okId, str } from './api.js';
import { currentUser, isLoggedIn } from './auth.js';
import { PL } from '../data/players.js';

const json = { 'Content-Type': 'application/json' };
const UUID = /^[0-9a-f-]{36}$/;

export const mgr = {
  online: false,    // Wechsel liegen in der Datenbank
  missing: false,   // Tabelle gibt es (noch) nicht → nur lokal
  loaded: false, busy: false, error: false,
  managers: [],     // [{ id, name, moves, me }]
  local: readJson(KEYS.manager, null) || { name: '', moves: [] }
};
const listeners = new Set();
export const onManagerChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

const saveLocal = () => writeJson(KEYS.manager, mgr.local);
const cleanMove = m => (m && okId(m.p) && PL[m.p] && (m.a === 'buy' || m.a === 'sell') && Number.isFinite(m.t) ? { t: m.t, p: m.p, a: m.a } : null);
const isMissing = e => e && (e.status === 404 || /manager_|relation|schema cache/i.test(e.message || ''));

export const myManager = () => mgr.managers.find(m => m.me) || null;
export const myMoves = () => (myManager() || { moves: [] }).moves;
export const myName = () => (myManager() || {}).name || '';

function localOnly() {
  mgr.online = false;
  mgr.managers = [{ id: 'local', name: mgr.local.name || 'Mein Team', me: true, moves: (mgr.local.moves || []).map(cleanMove).filter(Boolean) }];
}

export async function loadManagers(force = false) {
  if (mgr.busy || (mgr.loaded && !force)) return;
  const user = currentUser();
  /* Ohne Anmeldung kein Manager (Fairness). Fehlt nur die Tabelle (Migration 014), bleibt es angemeldet lokal. */
  if (!isLoggedIn() || !user) { mgr.online = false; mgr.managers = []; mgr.loaded = true; emit(); return; }
  if (mgr.missing) { localOnly(); mgr.loaded = true; emit(); return; }
  mgr.busy = true; mgr.error = false;
  try {
    const s = encodeURIComponent(SEASON);
    const [mv, tm] = await Promise.all([
      rest('manager_moves?select=user_id,p,a,created_at&season=eq.' + s + '&order=created_at.asc&limit=20000').then(r => r.json()),
      rest('manager_teams?select=user_id,name&season=eq.' + s + '&limit=2000').then(r => r.json())
    ]);
    const by = new Map();
    const get = id => { if (!by.has(id)) by.set(id, { id, name: '', moves: [], me: id === user.id }); return by.get(id); };
    for (const t of Array.isArray(tm) ? tm : []) if (UUID.test(t.user_id)) get(t.user_id).name = str(t.name, 24);
    for (const r of Array.isArray(mv) ? mv : []) {
      if (!UUID.test(r.user_id)) continue;
      const m = cleanMove({ t: new Date(r.created_at).getTime(), p: r.p, a: r.a });
      if (m) get(r.user_id).moves.push(m);
    }
    get(user.id);
    mgr.managers = [...by.values()].map(m => Object.assign(m, { name: m.name || (m.me ? 'Mein Team' : 'Manager') }));
    mgr.online = true;
  } catch (e) {
    if (isMissing(e)) mgr.missing = true; else mgr.error = true;
    localOnly();
  }
  mgr.busy = false; mgr.loaded = true;
  emit();
}

/* Kauf oder Verkauf. Online zählt der Zeitpunkt des Servers. */
export async function addMove(p, a) {
  if (mgr.online) {
    const r = await rest('manager_moves', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify({ season: SEASON, p, a }) });
    const row = (await r.json())[0] || {};
    const me = myManager();
    me.moves.push({ t: row.created_at ? new Date(row.created_at).getTime() : Date.now(), p, a });
  } else {
    mgr.local.moves.push({ t: Date.now(), p, a });
    saveLocal(); localOnly();
  }
  emit();
}

export async function setTeamName(name) {
  name = str(name.trim(), 24);
  if (!name) return;
  if (mgr.online) {
    await rest('manager_teams?on_conflict=user_id,season', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, json), body: JSON.stringify({ season: SEASON, name }) });
    myManager().name = name;
  } else {
    mgr.local.name = name; saveLocal(); localOnly();
  }
  emit();
}

/* Anmelden/Abmelden: neu laden */
export function resetManagers() { mgr.loaded = false; mgr.missing = false; mgr.managers = []; }
