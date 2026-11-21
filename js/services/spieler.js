/* Spielersuche: Spieler aus ganz Deutschland, die Nutzer selbst eintragen (Tabelle „spieler“, Migration 017),
   dazu der Kader aus clubs.js/players.js. Keine Daten von fussball.de/FuPa.
   Gefundene Spieler kommen als Eintrag in PL (players.js) und ihr Verein in CL (clubs.js) – so funktionieren Profil,
   Spiel, Hall of Fame und Marktwert ohne Sonderwege. Gemerkt in KEYS.ext, damit ein laufendes Spiel einen Neustart übersteht.
   Datenschutz: nur Name, Verein, Mannschaft, Position, Rückennummer; nur Erwachsene; Ausblenden geht sofort (rpc/spieler_ausblenden). */
import { KEYS, SEASON } from '../config.js';
import { rest, str, setRefLoader, games, uploadFile } from './api.js';
import { readJson, writeJson } from '../core/util.js';
import { keyOf, score, simple } from '../core/vsearch.js';
import { PL, PLAYER_LIST, EXT_ID, addExtPlayer, fullName } from '../data/players.js';
import { CL, registerClub } from '../data/clubs.js';
import { vr, loadVereine, vereinById, fetchVerein } from './vereine.js';

const json = { 'Content-Type': 'application/json' };
const VID = /^[a-z0-9_-]{2,40}$/;
const POS = ['TW', 'ABW', 'MIT', 'ANG'];
export const TEAM_ART = { herren: 'Herren', frauen: 'Frauen', ah: 'Alte Herren' };
export const sp = { dbMissing: false, rev: 0 };
const FIELDS0 = 'id,vorname,nachname,verein_id,verein_name,team_id,team_art,team_nr,pos,nummer,status,doppelt_von';
/* Mit Migration 018 zusätzlich eigenes Foto und „übernommen“; ohne 018 still die alten Spalten */
let FIELDS = FIELDS0 + ',foto,beansprucht';
const OK_FOTO = /^eigen\/[a-f0-9-]{36}\/[A-Za-z0-9_-]{4,40}\.(webp|png)$/;
const no018 = e => e && /foto|beansprucht|spieler_suche2|column|42703|PGRST202|PGRST204/i.test(e.message || '');
async function restSel(path) {
  try { return await (await rest(path.replace('$F', FIELDS))).json(); }
  catch (e) { if (FIELDS !== FIELDS0 && no018(e)) { FIELDS = FIELDS0; return (await rest(path.replace('$F', FIELDS))).json(); } throw e; }
}

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
    mw: 1000000, status: 'fit', foto: OK_FOTO.test(r.foto || '') ? r.foto : '', own: r.beansprucht === true, ext: true
  };
}
/* In PL/CL eintragen und auf dem Gerät merken (höchstens 400 Spieler) */
function remember(list) {
  if (!list.length) return;
  for (const p of list) { const v = vr.list ? vereinById(p.verein) : null; registerClub(p.verein, p.vname, v ? v.upl || v.wappen : '', v ? v.farben : null); addExtPlayer(p); }
  const old = readJson(KEYS.ext, null) || {};
  const ps = new Map((Array.isArray(old.p) ? old.p : []).map(p => [p.id, p]));
  for (const p of list) { ps.delete(p.id); ps.set(p.id, Object.assign({}, p)); }
  const keep = [...ps.values()].slice(-400);
  const cs = new Map();
  for (const c of old.c || []) if (c && c.id) cs.set(c.id, c);
  for (const p of keep) if (!cs.has(p.verein)) cs.set(p.verein, { id: p.verein, n: p.vname });
  writeJson(KEYS.ext, { p: keep, c: [...cs.values()].slice(-400) });
}
/* Verein (aus Vereinssuche) als Eintrag in CL – z. B. als Gegner */
export function useVerein(v) {
  if (!v) return null;
  const t = v.teams && v.teams.find(x => x.crest && CL[x.crest] && x.art === 'herren' && x.nr === 1);
  if (t) return t.crest;
  const w = v.upl || v.wappen || '', f = (v.farben || []).slice(0, 2);
  registerClub(v.id, v.name, w, f);
  const old = readJson(KEYS.ext, null) || { p: [], c: [] };
  old.c = (old.c || []).filter(c => c.id !== v.id).concat({ id: v.id, n: v.name, w, f }).slice(-400); writeJson(KEYS.ext, old);
  return v.id;
}

const isMissing = e => e && (e.status === 404 || /spieler|relation|schema cache|function/i.test(e.message || ''));

/* ---------- Spiele mit gesuchten Spielern: Spieler und Vereine nachladen (einmal je Ladevorgang) ---------- */
async function loadRefs(rows) {
  const want = [...new Set(rows.map(g => g.player).filter(id => EXT_ID.test(id) && !PL[id]))];
  if (want.length && !sp.dbMissing) {
    for (let i = 0; i < want.length; i += 80) {
      try {
        const d = await restSel('spieler?select=$F&id=in.(' + want.slice(i, i + 80).join(',') + ')');
        remember((Array.isArray(d) ? d : []).map(clean).filter(Boolean));
      } catch (e) { if (isMissing(e)) sp.dbMissing = true; break; }
    }
  }
  /* Gegner aus der Vereinssuche (Kreisliga-Vereine kennt CL schon) */
  const clubs = [...new Set(rows.flatMap(g => [g.opp, g.team]).filter(id => id && VID.test(id) && !CL[id]))];
  if (!clubs.length) return;
  try { await loadVereine(); } catch (e) { return; }
  for (const id of clubs) { const v = vereinById(id) || (await fetchVerein(id)); if (v) registerClub(id, v.name, v.upl || v.wappen, v.farben); }
}
setRefLoader(loadRefs);

/* Ein Spieler per ID (Profil-Link ?p=…) */
export async function fetchSpieler(id) {
  if (PL[id] || !EXT_ID.test(id) || sp.dbMissing) return PL[id] || null;
  try {
    const d = await restSel('spieler?select=$F&id=eq.' + id);
    const p = clean(Array.isArray(d) ? d[0] : null);
    if (p && !p.st) remember([p]);
    return PL[id] || null;
  } catch (e) { if (isMissing(e)) sp.dbMissing = true; return null; }
}

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
    const body = JSON.stringify({ q: t, v: verein, n: verein ? 60 : 20 });
    let d;
    try { if (!sp.no2) d = await (await rest('rpc/spieler_suche2', { method: 'POST', headers: json, body })).json(); }
    catch (e) { if (e && (e.status === 404 || no018(e))) sp.no2 = true; else throw e; }
    if (sp.no2) d = await (await rest('rpc/spieler_suche', { method: 'POST', headers: json, body })).json();
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

/* ---------- Gefolgte Spieler (nur auf dem Gerät) ---------- */
export const follows = () => (readJson(KEYS.follow, []) || []).filter(id => typeof id === 'string' && PL[id] && !PL[id].hidden);
export const isFollowed = id => follows().includes(id);
export function toggleFollow(id) {
  const l = (readJson(KEYS.follow, []) || []).filter(x => typeof x === 'string');
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1); else l.unshift(id);
  writeJson(KEYS.follow, l.slice(0, 30));
  return i < 0;
}

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
    const d = await (await rest('spieler?select=' + FIELDS0, { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(row) })).json();
    const p = clean(Array.isArray(d) ? d[0] : d);
    if (!p) throw new Error('leer');
    remember([p]); dbCache.clear(); keyCache.delete(p.id); sp.rev++;
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

/* ---------- Admin: Meldungen und ausgeblendete Spieler ---------- */
export async function loadModeration() {
  const [r, h] = await Promise.all([
    rest('spieler_meldungen?select=id,spieler_id,art,text,created_at&erledigt=eq.false&order=created_at.desc&limit=50').then(x => x.json()),
    restSel('spieler?select=$F&status=eq.ausgeblendet&order=created_at.desc&limit=50')
  ]);
  const rows = (Array.isArray(h) ? h : []).map(x => Object.assign(clean(Object.assign({}, x, { status: 'neu' })) || {}, { id: x.id })).filter(x => x.n);
  const names = new Map(rows.map(p => [p.id, fullName(p)]));
  const reps = (Array.isArray(r) ? r : []).filter(x => x && EXT_ID.test(x.spieler_id) && /^\d+$/.test(String(x.id))).map(x => ({
    id: +x.id, sp: x.spieler_id, art: str(x.art, 12), text: str(x.text, 200), name: names.get(x.spieler_id) || (PL[x.spieler_id] ? fullName(PL[x.spieler_id]) : x.spieler_id) }));
  return { hidden: rows, reports: reps };
}
export async function setSpielerStatus(id, status) {
  const r = await rest('spieler?id=eq.' + id, { method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify({ status }) });
  const d = await r.json();
  if (!Array.isArray(d) || !d.length) throw new Error('Keine Berechtigung');
  dbCache.clear();
  if (PL[id]) PL[id].hidden = status !== 'ok' && status !== 'neu';
}
export async function reportDone(id) {
  await rest('spieler_meldungen?id=eq.' + id, { method: 'PATCH', headers: json, body: JSON.stringify({ erledigt: true }) });
}

/* ---------- Kader schnell füllen (Migration 018) ---------- */
const rpc = async (fn, body) => (await rest('rpc/' + fn, { method: 'POST', headers: json, body: JSON.stringify(body) })).json();
const inviteErr = e => {
  const m = (e && e.message) || '';
  if (/schon ein Profil/i.test(m)) return 'Du hast schon ein Profil';
  if (/ungültig|ungueltig/i.test(m)) return 'Einladung abgelaufen';
  if (/zu viele/i.test(m)) return 'Für heute genug';
  if (/nicht angemeldet|JWT|401/i.test(m)) return 'Bitte anmelden';
  if (/duplicate|23505|unique/i.test(m)) return 'Gibt es an diesem Verein schon';
  if (e && (e.status === 404 || /function|PGRST202/i.test(m))) return 'Noch nicht freigeschaltet';
  return 'Nicht gespeichert';
};
const CODE = /^[a-f0-9]{12}$/;
export async function createInvite(v, art, nr) {
  try {
    const d = await (await rest('team_einladungen?select=code', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json),
      body: JSON.stringify({ verein_id: v.id, verein_name: str(v.name, 60).replace(/[<>"]/g, ''), team_art: TEAM_ART[art] ? art : 'herren', team_nr: Math.max(1, Math.min(9, +nr || 1)) }) })).json();
    const code = Array.isArray(d) && d[0] && d[0].code;
    if (!CODE.test(code || '')) throw new Error('leer');
    return code;
  } catch (e) { throw new Error(inviteErr(e)); }
}
export const inviteLink = code => location.origin + location.pathname + '?t=' + code;
export async function readInvite(code) {
  if (!CODE.test(code || '')) return null;
  try {
    const d = await rpc('einladung_lesen', { p_code: code });
    const r = Array.isArray(d) ? d[0] : null;
    if (!r || !VID.test(r.verein_id || '')) return null;
    const list = (Array.isArray(r.spieler) ? r.spieler : []).filter(x => x && EXT_ID.test(x.id)).map(x => ({ id: x.id, vn: okName(x.vorname), n: okName(x.nachname),
      pos: POS.includes(x.pos) ? x.pos : 'MIT', num: x.nummer >= 1 && x.nummer <= 99 ? +x.nummer : null, own: x.beansprucht === true })).filter(x => x.vn && x.n);
    return { code, verein: r.verein_id, vname: str(r.verein_name, 60).replace(/[<>"]/g, ''), art: TEAM_ART[r.team_art] ? r.team_art : 'herren',
      nr: Math.max(1, Math.min(9, +r.team_nr || 1)), ok: r.gueltig === true, list };
  } catch (e) { return null; }
}
export async function joinTeam(code, f) {
  try {
    const id = await rpc('spieler_beitreten', { p_code: code, p_vorname: okName(f.vn), p_nachname: okName(f.n), p_pos: POS.includes(f.pos) ? f.pos : 'MIT', p_nummer: f.num >= 1 && f.num <= 99 ? Math.round(f.num) : null });
    if (!EXT_ID.test(id || '')) throw new Error('leer');
    me.id = id; dbCache.clear(); sp.rev++;
    return fetchSpieler(id);
  } catch (e) { throw new Error(inviteErr(e)); }
}
export async function claimPlayer(code, id) {
  try {
    if ((await rpc('spieler_beanspruchen', { p_code: code, p_id: id })) !== true) throw new Error('vergeben');
    me.id = id; dbCache.clear(); sp.rev++;
    if (PL[id]) PL[id].own = true;
    return true;
  } catch (e) { throw new Error(e.message === 'vergeben' ? 'Schon vergeben' : inviteErr(e)); }
}
/* Eigenes Profil (übernommen) */
const me = { id: undefined };
export async function myPlayerId(force = false) {
  if (me.id !== undefined && !force) return me.id;
  try { const d = await rpc('mein_spieler', {}); me.id = EXT_ID.test(d || '') ? d : null; } catch (e) { me.id = null; }
  return me.id;
}
export const resetMe = () => { me.id = undefined; };
export async function uploadOwnPhoto(uid, blob) {
  const path = 'eigen/' + uid + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + (blob.type === 'image/webp' ? '.webp' : '.png');
  await uploadFile(path, blob);
  return path;
}
export async function updateMyProfile(id, f) {
  try {
    const ok = await rpc('spieler_profil', { p_id: id, p_pos: POS.includes(f.pos) ? f.pos : null, p_nummer: f.num >= 1 && f.num <= 99 ? Math.round(f.num) : null, p_foto: f.foto === undefined ? null : f.foto });
    if (ok !== true) throw new Error('Nicht dein Profil');
    const p = PL[id];
    if (p) { if (f.pos) p.pos = f.pos; p.num = f.num || null; if (f.foto !== undefined) { p.foto = f.foto || ''; p.fotoV = Date.now(); } }
    remember(p ? [p] : []); dbCache.clear(); sp.rev++;
  } catch (e) { throw new Error(e.message === 'Nicht dein Profil' ? e.message : inviteErr(e)); }
}
export async function releaseProfile(id) {
  try { if ((await rpc('spieler_freigeben', { p_id: id })) !== true) throw new Error('x'); } catch (e) { throw new Error('Nicht gespeichert'); }
  me.id = null; if (PL[id]) { PL[id].own = false; PL[id].foto = ''; } dbCache.clear(); sp.rev++;
}
/* Kader als Liste: „Vorname Nachname [Nr] [Position]“ je Zeile, auch „Nachname, Vorname“ */
const POSW = { tw: 'TW', torwart: 'TW', tor: 'TW', abw: 'ABW', abwehr: 'ABW', iv: 'ABW', av: 'ABW', mit: 'MIT', mittelfeld: 'MIT', zm: 'MIT', dm: 'MIT', om: 'MIT', ang: 'ANG', sturm: 'ANG', st: 'ANG', angriff: 'ANG' };
export function parseKader(text) {
  const out = [], bad = [];
  for (const raw of String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 60)) {
    let l = raw.replace(/[;\t|]+/g, ' ').replace(/\s+/g, ' ').trim(), num = null, pos = 'MIT';
    l = l.replace(/(^|\s)#?(\d{1,2})(?=\s|$)/, (m, a, n) => { num = +n; return ' '; }).trim();
    l = l.replace(/(^|\s)\(?([A-Za-zä]{2,10})\)?$/, (m, a, w) => { const k = POSW[w.toLowerCase()]; if (k) { pos = k; return ''; } return m; }).trim();
    let vn = '', n = '';
    if (l.includes(',')) { const [a, b] = l.split(',').map(x => x.trim()); n = a; vn = b; }
    else { const w = l.split(' '); n = w.pop() || ''; vn = w.join(' '); }
    vn = okName(vn); n = okName(n);
    if (vn && n) out.push({ vn, n, num: num >= 1 && num <= 99 ? num : null, pos }); else bad.push(raw);
  }
  return { out, bad };
}
export async function bulkCreate(v, art, nr, list, onStep = () => {}) {
  const res = { ok: 0, dup: 0, fail: [] };
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    onStep(i + 1, list.length);
    try { await createSpieler({ vn: x.vn, n: x.n, verein: v.id, vname: v.name, art, nr, pos: x.pos, num: x.num, ok: true }); res.ok++; }
    catch (e) { if (/schon/i.test(e.message)) res.dup++; else { res.fail.push(x.vn + ' ' + x.n + ': ' + e.message); if (/genug|freigeschaltet/i.test(e.message)) break; } }
  }
  return res;
}

/* Mannschaft als Text: „Herren II“, „Frauen“ */
export const teamText = p => (TEAM_ART[p.art] || 'Herren') + (p.nr > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][p.nr] : '');
export const clubName = p => (p.ext ? p.vname : (CL[p.c] || {}).n || '');
export const seasonText = () => SEASON;
export { vr };
