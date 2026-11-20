/* Spielersuche: Spieler aus ganz Deutschland, die Nutzer selbst eintragen (Tabelle „spieler“, Migration 017),
   dazu der Kader aus clubs.js/players.js. Keine Daten von fussball.de/FuPa.
   Gefundene Spieler kommen als Eintrag in PL (players.js) und ihr Verein in CL (clubs.js) – so funktionieren Profil,
   Spiel, Hall of Fame und Marktwert ohne Sonderwege. Gemerkt in KEYS.ext, damit ein laufendes Spiel einen Neustart übersteht.
   Datenschutz: nur Name, Verein, Mannschaft, Position, Rückennummer; nur Erwachsene; Ausblenden geht sofort (rpc/spieler_ausblenden). */
import { KEYS, SEASON } from '../config.js';
import { rest, str, setRefLoader, games } from './api.js';
import { readJson, writeJson } from '../core/util.js';
import { keyOf, score, simple } from '../core/vsearch.js';
import { PL, PLAYER_LIST, EXT_ID, addExtPlayer, fullName } from '../data/players.js';
import { CL, registerClub } from '../data/clubs.js';
import { vr, loadVereine, vereinById, fetchVerein } from './vereine.js';

const json = { 'Content-Type': 'application/json' };
const VID = /^[a-z0-9_-]{2,40}$/;
const POS = ['TW', 'ABW', 'MIT', 'ANG'];
export const TEAM_ART = { herren: 'Herren', frauen: 'Frauen', ah: 'Alte Herren' };
export const sp = { dbMissing: false };
const FIELDS = 'id,vorname,nachname,verein_id,verein_name,team_id,team_art,team_nr,pos,nummer,status,doppelt_von';

/* ---------- Prüfen und eintragen ---------- */
/* Namen: Buchstaben, Leerzeichen, Bindestrich, Punkt, Apostroph (gleiche Regel wie in der DB) */
export const okName = v => { const t = str(v, 30).trim().replace(/\s+/g, ' '); return /^\p{L}[\p{L} '.-]{1,29}$/u.test(t) ? t : ''; };
function clean(r) {
  if (!r || !EXT_ID.test(r.id) || !VID.test(r.verein_id || '')) return null;
  const vn = okName(r.vorname), n = okName(r.nachname);
  if (!vn || !n) return null;
  const team = VID.test(r.team_id || '') && CL[r.team_id] && !CL[r.team_id].ext ? r.team_id : null;
  return {
    id: r.id, vn, n, c: team || r.verein_id, verein: r.verein_id, vname: str(r.verein_name, 60).replace(/[<>"]/g, '') || 'Verein',
    art: TEAM_ART[r.team_art] ? r.team_art : 'herren', nr: Math.max(1, Math.min(9, Math.round(+r.team_nr) || 1)),
    pos: POS.includes(r.pos) ? r.pos : 'MIT', num: r.nummer >= 1 && r.nummer <= 99 ? Math.round(+r.nummer) : null,
    st: r.status === 'doppelt' && /^[A-Za-z0-9_-]{1,64}$/.test(r.doppelt_von || '') ? r.doppelt_von : null,
    mw: 1000000, status: 'fit', foto: '', ext: true
  };
}
/* In PL/CL eintragen und auf dem Gerät merken (höchstens 400 Spieler) */
function remember(list) {
  if (!list.length) return;
  for (const p of list) { registerClub(p.verein, p.vname); addExtPlayer(p); }
  const old = readJson(KEYS.ext, null) || {};
  const ps = new Map((Array.isArray(old.p) ? old.p : []).map(p => [p.id, p]));
  for (const p of list) { ps.delete(p.id); ps.set(p.id, Object.assign({}, p)); }
  const keep = [...ps.values()].slice(-400);
  const cs = new Map();
  for (const p of keep) cs.set(p.verein, { id: p.verein, n: p.vname });
  writeJson(KEYS.ext, { p: keep, c: [...cs.values()] });
}
/* Verein (aus Vereinssuche) als Eintrag in CL – z. B. als Gegner */
export function useVerein(v) {
  if (!v) return null;
  const t = v.teams && v.teams.find(x => x.crest && CL[x.crest] && x.art === 'herren' && x.nr === 1);
  if (t) return t.crest;
  registerClub(v.id, v.name);
  const old = readJson(KEYS.ext, null) || { p: [], c: [] };
  if (!(old.c || []).some(c => c.id === v.id)) { old.c = (old.c || []).concat({ id: v.id, n: v.name }).slice(-400); writeJson(KEYS.ext, old); }
  return v.id;
}

const isMissing = e => e && (e.status === 404 || /spieler|relation|schema cache|function/i.test(e.message || ''));

/* ---------- Spiele mit gesuchten Spielern: Spieler und Vereine nachladen (einmal je Ladevorgang) ---------- */
async function loadRefs(rows) {
  const want = [...new Set(rows.map(g => g.player).filter(id => EXT_ID.test(id) && !PL[id]))];
  if (want.length && !sp.dbMissing) {
    for (let i = 0; i < want.length; i += 80) {
      try {
        const d = await (await rest('spieler?select=' + FIELDS + '&id=in.(' + want.slice(i, i + 80).join(',') + ')')).json();
        remember((Array.isArray(d) ? d : []).map(clean).filter(Boolean));
      } catch (e) { if (isMissing(e)) sp.dbMissing = true; break; }
    }
  }
  /* Gegner aus der Vereinssuche (Kreisliga-Vereine kennt CL schon) */
  const clubs = [...new Set(rows.flatMap(g => [g.opp, g.team]).filter(id => id && VID.test(id) && !CL[id]))];
  if (!clubs.length) return;
  try { await loadVereine(); } catch (e) { return; }
  for (const id of clubs) { const v = vereinById(id) || (await fetchVerein(id)); if (v) registerClub(id, v.name); }
}
setRefLoader(loadRefs);

/* ---------- Suchen ---------- */
const keyCache = new Map();
const pkey = p => { let k = keyCache.get(p.id); if (!k) { k = keyOf(fullName(p), p.ext ? p.vname : (CL[p.c] || {}).n || ''); keyCache.set(p.id, k); } return k; };
/* Im Gerät: Kader und schon bekannte gesuchte Spieler */
export function searchLocal(q, n = 20) {
  if (simple(q).length < 2) return [];
  const seen = new Set(), out = [];
  const pool = [...PLAYER_LIST.filter(p => p.active !== false && !p.guest), ...(readJson(KEYS.ext, null) || { p: [] }).p.map(p => PL[p.id]).filter(Boolean)];
  for (const p of pool) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const s = score(q, pkey(p));
    if (s > 0.5) out.push([s + (p.ext ? 0 : 0.03), p]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
/* In der DB (Migration 017); ohne Migration still leer. Ergebnisse je Suchtext gemerkt (Traffic) */
const dbCache = new Map();
export async function searchDb(q, verein = null) {
  const t = simple(q);
  if (sp.dbMissing || (t.length < 2 && !verein)) return [];
  const key = t + '|' + (verein || '');
  if (dbCache.has(key)) return dbCache.get(key);
  try {
    const d = await (await rest('rpc/spieler_suche', { method: 'POST', headers: json, body: JSON.stringify({ q: t, v: verein, n: verein ? 60 : 20 }) })).json();
    const list = (Array.isArray(d) ? d : []).map(clean).filter(p => p && !p.st);
    remember(list);
    const res = list.map(p => PL[p.id]).filter(Boolean);
    dbCache.set(key, res);
    return res;
  } catch (e) { if (isMissing(e)) sp.dbMissing = true; return []; }
}
/* Beides zusammen */
export function mergePlayers(q, db) {
  const seen = new Set(), out = [];
  for (const p of [...searchLocal(q, 30), ...db]) {
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id); out.push([p.ext ? score(q, pkey(p)) : score(q, pkey(p)) + 0.03, p]);
  }
  return out.filter(x => x[0] > 0.3).sort((a, b) => b[0] - a[0]).slice(0, 40).map(x => x[1]);
}

/* Kader eines Vereins: Spieler aus der DB + Stammspieler, deren Mannschaft zum Verein gehört */
export async function vereinKader(v, force = false) {
  if (force) dbCache.delete('|' + v.id);
  const db = await searchDb('', v.id);
  const crests = new Set((v.teams || []).map(t => t.crest).filter(Boolean));
  const own = PLAYER_LIST.filter(p => p.active !== false && !p.guest && crests.has(p.c));
  return [...own, ...db.filter(p => !own.some(o => o.id === p.id))];
}

/* ---------- Zuletzt angesehen (nur auf dem Gerät) ---------- */
export const recent = () => (readJson(KEYS.recent, []) || []).filter(x => x && typeof x.id === 'string' && (x.t === 'p' ? PL[x.id] : true)).slice(0, 8);
export function addRecent(t, id, name = '') {
  const l = (readJson(KEYS.recent, []) || []).filter(x => x && !(x.t === t && x.id === id));
  l.unshift({ t, id, n: str(name, 60) });
  writeJson(KEYS.recent, l.slice(0, 12));
}
export const clearRecent = () => writeJson(KEYS.recent, []);

/* ---------- Eintragen, melden, ausblenden (nur angemeldet; Regeln prüft die DB) ---------- */
const errText = e => {
  const m = (e && e.message) || '';
  if (/duplicate|23505|unique|409/i.test(m) || (e && e.status === 409)) return 'Gibt es an diesem Verein schon';
  if (/zu viele/i.test(m)) return 'Für heute genug eingetragen';
  if (/check|23514/i.test(m)) return 'Angaben prüfen';
  if (isMissing(e)) return 'Noch nicht freigeschaltet';
  return 'Nicht gespeichert';
};
export async function createSpieler(f) {
  const row = {
    vorname: okName(f.vn), nachname: okName(f.n), verein_id: f.verein, verein_name: str(f.vname, 60).replace(/[<>"]/g, '').trim(),
    team_id: f.team || null, team_art: TEAM_ART[f.art] ? f.art : 'herren', team_nr: Math.max(1, Math.min(9, +f.nr || 1)),
    pos: POS.includes(f.pos) ? f.pos : 'MIT', nummer: f.num >= 1 && f.num <= 99 ? Math.round(f.num) : null, bestaetigt: !!f.ok
  };
  if (!row.vorname || !row.nachname || !VID.test(row.verein_id || '') || !row.bestaetigt) throw new Error('Angaben prüfen');
  try {
    const d = await (await rest('spieler?select=' + FIELDS, { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(row) })).json();
    const p = clean(Array.isArray(d) ? d[0] : d);
    if (!p) throw new Error('leer');
    remember([p]); dbCache.clear(); keyCache.delete(p.id);
    return PL[p.id];
  } catch (e) { throw new Error(errText(e)); }
}
export async function reportSpieler(id, art, text) {
  try { await rest('spieler_meldungen', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, json), body: JSON.stringify({ spieler_id: id, art, text: str(text, 200) || null }) }); }
  catch (e) { throw new Error(errText(e)); }
}
/* Sofort ausblenden: verschwindet überall, auch auf diesem Gerät */
export async function hideSpieler(id, grund) {
  try {
    const ok = await (await rest('rpc/spieler_ausblenden', { method: 'POST', headers: json, body: JSON.stringify({ p_id: id, p_grund: str(grund, 200) || null }) })).json();
    if (ok !== true) throw new Error('Nicht gefunden');
  } catch (e) { throw new Error(/zu viele/i.test(e.message || '') ? 'Für heute genug' : e.message === 'Nicht gefunden' ? e.message : errText(e)); }
  forget(id);
}
export function forget(id) {
  const old = readJson(KEYS.ext, null) || {};
  writeJson(KEYS.ext, { p: (old.p || []).filter(p => p.id !== id), c: old.c || [] });
  writeJson(KEYS.recent, recent().filter(x => x.id !== id));
  dbCache.clear();
  if (PL[id] && PL[id].ext) PL[id].hidden = true;
  if (games.list) games.list = games.list.filter(g => g.player !== id);
}

/* Mannschaft als Text: „Herren II“, „Frauen“ */
export const teamText = p => (TEAM_ART[p.art] || 'Herren') + (p.nr > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][p.nr] : '');
export const clubName = p => (p.ext ? p.vname : (CL[p.c] || {}).n || '');
export const seasonText = () => SEASON;
export { vr };
