/* Vereinsdatenbank: Grundbestand aus offenen Daten (assets/data/vereine.json, OpenStreetMap/ODbL – kein Supabase-Traffic),
   dazu die Kreisliga-Teams aus clubs.js und was Nutzer angelegt haben (Tabellen vereine, mannschaften, staffeln – Migration 015).
   Suche läuft im Gerät (vsearch.js: Abkürzungen, Kölner Phonetik, Tippfehler); die DB wird nur für angelegte Vereine gefragt.
   Ortsprüfung beim Anlegen: eine Anfrage an Nominatim (OpenStreetMap), nur wenn jemand auf „Anlegen“ tippt. */
import { KEYS, SEASON } from '../config.js';
import { rest, str, uploadFile } from './api.js';
import { readJson, writeJson } from '../core/util.js';
import { keyOf, score, scorePrep, prepQuery, splitTeam, words, simple } from '../core/vsearch.js';
import { CLUB_LIST, generatedCrest, registerClub, storageUrl } from '../data/clubs.js';
import { LAENDER, VERBAENDE, KLASSEN, ARTEN, JUGEND, ligaName } from '../data/verbaende.js';

const VID = /^[a-z0-9_-]{2,40}$/;
const json = { 'Content-Type': 'application/json' };
export const vr = { list: null, busy: null, error: false, quelle: '', stand: '', dbMissing: false };
const byId = new Map();
const teamCache = new Map();
const rpcCache = new Map();

/* ---------- Prüfen (alles aus Datei und DB) ---------- */
const num = v => (Number.isFinite(+v) && v !== null && v !== '' ? +v : 0);
const land = v => (typeof v === 'string' && LAENDER[v] ? v : '');
/* Webseite: nur Domain + Pfad, angezeigt wird immer https:// davor */
export const okWeb = v => {
  const w = str(v, 200).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  return /^[a-z0-9äöü.-]+\.[a-z]{2,}(\/[^\s"'<>\\]*)?$/i.test(w) ? w : '';
};
function make(id, name, ort, l, lat, lon, web, src, verband = '') {
  name = str(name, 60).trim(); ort = str(ort, 50).trim();
  if (!VID.test(id) || name.length < 3) return null;
  return { id, name, ort, land: land(l), lat: num(lat), lon: num(lon), web: okWeb(web), src, verband: VERBAENDE[verband] ? verband : '', key: keyOf(name, ort), teams: [],
    kreis: '', bezirk: '', wd: '', fb: false, wappen: '', farben: [], liga: '', gr: '', upl: '' };
}
/* Zusatzangaben aus vereine.json (Version 2): Landkreis, Verband, Wikidata, Fußball sicher, Wappen, Farben, Liga, Gründung */
const HEX = /^#[0-9a-f]{6}$/;
function extra(v, c, kreise) {
  const k = Number.isInteger(c[7]) && kreise[c[7]] ? kreise[c[7]] : null;
  if (k) { v.kreis = str(k[0], 60); v.bezirk = str(k[2], 40); }
  if (VERBAENDE[c[8]]) v.verband = c[8];
  if (/^Q\d{1,12}$/.test(c[9] || '')) v.wd = c[9];
  const f = num(c[10]);
  v.fb = !!(f & 1);
  if (f & 2 && v.wd) v.wappen = 'assets/img/w/' + v.wd + '.webp';
  v.farben = str(c[11], 20).split(',').filter(x => HEX.test(x)).slice(0, 2);
  v.liga = str(c[12], 40).replace(/[<>"]/g, '');
  v.gr = /^\d{4}$/.test(c[13] || '') ? c[13] : '';
}
const cleanDb = r => r && make(String(r.id || ''), r.name, r.ort, r.land, r.lat, r.lon, r.web, 'db', r.verband);

/* ---------- Kreisliga-Teams aus clubs.js (Rems/Murr, WFV) als Startwissen über Mannschaften ---------- */
const KL = { land: 'BW', verband: 'WFV', kreis: 'Rems/Murr', lat: 48.98, lon: 9.58 };
const km = (a, b) => Math.hypot((a.lon - b.lon) * 71.5, (a.lat - b.lat) * 111.2);
function addSeeds(list) {
  for (const c of CLUB_LIST) {
    if (!c.lg) continue;
    const { base, nr } = splitTeam(c.n.replace(/\s*\/\s*/g, '/'));
    const k = words(base).join(' ');
    let v = list.find(x => x.land === 'BW' && (!x.lat || km(x, KL) < 40) && x.key.w.join(' ') === k);
    if (!v) { v = make('k-' + c.id.toLowerCase().replace(/[^a-z0-9_-]/g, ''), base, '', KL.land, KL.lat, KL.lon, '', 'kl', KL.verband); if (!v) continue; list.push(v); }
    v.teams.push({ art: 'herren', nr, klasse: 'Kreisliga', nummer: c.lg, kreis: KL.kreis, verband: KL.verband, crest: c.id, src: 'kl' });
  }
}

/* Grundbestand einmal laden (liegt danach im Cache des Service Workers) */
export function loadVereine() {
  if (vr.list) return Promise.resolve(vr.list);
  if (vr.busy) return vr.busy;
  vr.busy = fetch('assets/data/vereine.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(d => {
    const list = [];
    const kreise = Array.isArray(d && d.k) ? d.k.filter(Array.isArray) : [];
    for (const c of Array.isArray(d && d.c) ? d.c : []) {
      if (!Array.isArray(c)) continue;
      const v = make(String(c[0] || ''), c[1], c[2], c[3], c[4], c[5], c[6], 'osm');
      if (!v) continue;
      if (c.length > 7) extra(v, c, kreise);
      list.push(v);
    }
    addSeeds(list);
    vr.quelle = str(d.quelle, 200); vr.stand = str(d.stand, 10);
    for (const v of list) byId.set(v.id, v);
    vr.list = list; vr.error = false;
    fixMyClub(list);
    return list;
  }).catch(e => { vr.error = true; vr.list = null; throw e; }).finally(() => { vr.busy = null; });
  return vr.busy;
}
export const vereinById = id => byId.get(id) || null;
/* „Mein Verein“ mit einer alten ID (Vereinsliste vor 2.4: o…) über Name + Ort neu zuordnen */
function fixMyClub(list) {
  const c = readJson(KEYS.club, null);
  if (!c || !/^o[nwr]\d/.test(c.id || '') || byId.has(c.id)) return;
  const n = simple(c.name), o = simple(c.ort);
  const v = list.find(x => simple(x.name) === n && simple(x.ort) === o) || list.find(x => simple(x.name) === n);
  if (v) setMyClub(v);
}

/* ---------- Suchen ---------- */
const mineFirst = () => (readJson(KEYS.club, null) || {}).id;
export function searchLocal(q, n = 25) {
  if (!vr.list || words(q).length === 0) return [];
  const my = mineFirst(), out = [], qp = prepQuery(q);
  for (const v of vr.list) {
    const s = scorePrep(qp, v.key);
    if (s > 0.5) out.push([s + (v.id === my ? 0.05 : 0) + (v.teams.length ? 0.02 : 0) + (v.fb ? 0.015 : 0) + (v.wappen ? 0.005 : 0), v]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => Object.assign(x[1], { s: x[0] }));
}

/* Von Nutzern angelegte Vereine (DB). Ohne Migration 015 still ohne. */
const isMissing = e => e && (e.status === 404 || /vereine|mannschaft|relation|schema cache|function/i.test(e.message || ''));
export async function searchDb(q) {
  const t = simple(q);
  if (vr.dbMissing || t.length < 3) return [];
  if (rpcCache.has(t)) return rpcCache.get(t);
  try {
    const r = await rest('rpc/vereine_suche', { method: 'POST', headers: json, body: JSON.stringify({ q: t, n: 15 }) });
    const d = await r.json();
    const list = (Array.isArray(d) ? d : []).filter(x => x && x.status !== 'doppelt').map(cleanDb).filter(Boolean);
    for (const v of list) { const old = byId.get(v.id); if (old) Object.assign(old, v, { teams: old.teams }); else byId.set(v.id, v); }
    const res = list.map(v => byId.get(v.id));
    rpcCache.set(t, res);
    return res;
  } catch (e) { if (isMissing(e)) vr.dbMissing = true; return []; }
}
/* Beides zusammen, sortiert nach Güte */
export function merged(q, dbList) {
  const seen = new Set(), out = [];
  for (const v of [...searchLocal(q), ...dbList.map(v => Object.assign(v, { s: score(q, v.key) + 0.01 }))]) {
    if (seen.has(v.id) || !(v.s > 0.3)) continue;
    seen.add(v.id); out.push(v);
  }
  return out.sort((a, b) => b.s - a.s).slice(0, 30);
}

/* Einen Verein aus der DB holen (z. B. „Mein Verein“ nach Neustart) */
export async function fetchVerein(id) {
  if (byId.has(id) || !/^u[a-f0-9]{11}$/.test(id) || vr.dbMissing) return byId.get(id) || null;
  try {
    const d = await (await rest('vereine?select=id,name,ort,land,verband,lat,lon,web,status&id=eq.' + id)).json();
    const v = Array.isArray(d) && d[0] ? cleanDb(d[0]) : null;
    if (v) byId.set(v.id, v);
    return v;
  } catch (e) { if (isMissing(e)) vr.dbMissing = true; return null; }
}

/* ---------- Mannschaften ---------- */
const cleanTeam = m => {
  if (!m || !ARTEN[m.art]) return null;
  const st = m.staffeln && typeof m.staffeln === 'object' ? m.staffeln : {};
  const nr = Math.max(1, Math.min(9, Math.round(num(m.nr)) || 1));
  return { id: Math.round(num(m.id)), art: m.art, nr, jugend: JUGEND.includes(m.jugend) ? m.jugend : '',
    klasse: KLASSEN.includes(st.klasse) ? st.klasse : str(st.klasse, 30), nummer: str(st.nummer, 6), kreis: str(st.kreis, 40),
    verband: VERBAENDE[st.verband] ? st.verband : '', src: 'db' };
};
export const teamKey = t => t.art + '|' + t.nr + '|' + (t.jugend || '');
export async function loadTeams(id, force = false) {
  const v = byId.get(id);
  if (!v) return [];
  if (teamCache.has(id) && !force) return teamCache.get(id);
  let db = [];
  if (!vr.dbMissing) {
    try {
      const d = await (await rest('mannschaften?select=id,art,nr,jugend,staffeln(klasse,nummer,kreis,verband)&verein_id=eq.' + encodeURIComponent(id) +
        '&saison=eq.' + encodeURIComponent(SEASON) + '&order=art.asc,nr.asc&limit=40')).json();
      db = (Array.isArray(d) ? d : []).map(cleanTeam).filter(Boolean);
    } catch (e) { if (isMissing(e)) vr.dbMissing = true; else throw e; }
  }
  /* Einträge aus der DB gehen vor (dort ist die Liga aktuell gepflegt) */
  const keys = new Set(db.map(teamKey));
  const all = [...db, ...v.teams.filter(t => !keys.has(teamKey(t)))];
  const ord = Object.keys(ARTEN);
  all.sort((a, b) => ord.indexOf(a.art) - ord.indexOf(b.art) || (a.jugend || '').localeCompare(b.jugend || '') || a.nr - b.nr);
  teamCache.set(id, all);
  return all;
}
export const teamLiga = t => ligaName(t.klasse, t.nummer);

/* ---------- Anlegen und melden (nur angemeldet; Rechte und Grenzen prüft die DB) ---------- */
const errText = e => (/duplicate|23505|unique|409/i.test((e && e.message) || '') || (e && e.status === 409) ? 'Gibt es schon'
  : /zu viele/i.test((e && e.message) || '') ? 'Für heute genug angelegt' : /gibt es schon/i.test((e && e.message) || '') ? 'Mannschaft gibt es schon'
  : isMissing(e) ? 'Noch nicht freigeschaltet' : 'Nicht gespeichert');

export async function createVerein(f) {
  const row = { name: str(f.name, 60).trim(), ort: str(f.ort, 50).trim() || null, land: land(f.land) || null, verband: VERBAENDE[f.verband] ? f.verband : null,
    web: okWeb(f.web) || null, lat: f.lat || null, lon: f.lon || null, osm: /^[NWR]\d{1,12}$/.test(f.osm || '') ? f.osm : null,
    plz: /^\d{5}$/.test(f.plz || '') ? f.plz : null };
  try {
    const d = await (await rest('vereine', { method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, json), body: JSON.stringify(row) })).json();
    const v = cleanDb(Array.isArray(d) ? d[0] : d);
    if (!v) throw new Error('leer');
    byId.set(v.id, v); rpcCache.clear();
    return v;
  } catch (e) { throw new Error(errText(e)); }
}

export async function saveTeam(id, t) {
  const v = byId.get(id);
  try {
    await rest('rpc/mannschaft_anlegen', { method: 'POST', headers: json, body: JSON.stringify({
      p_verein: id, p_art: t.art, p_nr: t.nr, p_jugend: t.art === 'jugend' ? t.jugend : null, p_saison: SEASON,
      p_klasse: t.klasse || null, p_nummer: str(t.nummer, 6).trim() || null, p_kreis: str(t.kreis, 40).trim() || null, p_verband: t.verband || (v && v.verband) || null }) });
    teamCache.delete(id);
  } catch (e) { throw new Error(errText(e)); }
}

export async function report(id, art, text) {
  try {
    await rest('vereine_meldungen', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, json), body: JSON.stringify({ verein_id: id, art, text: str(text, 200) || null }) });
  } catch (e) { throw new Error(errText(e)); }
}

/* ---------- Ort prüfen (OpenStreetMap Nominatim, eine Anfrage pro Tipp auf „Anlegen“) ---------- */
export async function checkOrt(ort) {
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=de&addressdetails=1&limit=1&accept-language=de&q=' + encodeURIComponent(ort);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    if (!r.ok) return null;
    const d = (await r.json())[0];
    if (!d) return { found: false };
    const a = d.address || {}, l = String(a['ISO3166-2-lvl4'] || '').replace(/^DE-/, '');
    const typ = String(d.osm_type || '')[0];
    return { found: true, ort: str(a.city || a.town || a.village || a.municipality || a.suburb || ort, 50), plz: /^\d{5}$/.test(a.postcode || '') ? a.postcode : '',
      land: LAENDER[l] ? l : '', lat: Math.round(+d.lat * 1e4) / 1e4, lon: Math.round(+d.lon * 1e4) / 1e4,
      osm: typ && /^[nwr]$/.test(typ) && /^\d{1,12}$/.test(String(d.osm_id)) ? typ.toUpperCase() + d.osm_id : '' };
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

/* ---------- Stöbern: Bundesland → Landkreis → Vereine ---------- */
export function laenderCount() {
  const c = {};
  for (const v of vr.list || []) if (v.land) c[v.land] = (c[v.land] || 0) + 1;
  return c;
}
export function kreiseIn(land) {
  const c = new Map();
  for (const v of vr.list || []) if (v.land === land) { const k = v.kreis || ''; c.set(k, (c.get(k) || 0) + 1); }
  return [...c.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => (a.k ? 0 : 1) - (b.k ? 0 : 1) || a.k.replace(/^(Landkreis|Kreis|Region|Städteregion) /, '').localeCompare(b.k.replace(/^(Landkreis|Kreis|Region|Städteregion) /, ''), 'de'));
}
/* Sichere Fußballvereine zuerst, dann nach Name */
export const vereineIn = (land, kreis) => (vr.list || []).filter(v => v.land === land && (v.kreis || '') === kreis)
  .sort((a, b) => (b.fb ? 1 : 0) - (a.fb ? 1 : 0) || a.name.localeCompare(b.name, 'de'));

/* ---------- Wappen ----------
   Reihenfolge: vom Verein hochgeladen (Supabase, Migration 018) → freies Logo aus Wikimedia (assets/img/w) → generiert (Farben + Kürzel) */
export const vereinCrest = v => (v ? v.upl || v.wappen || generatedCrest(v.name, v.farben) : generatedCrest('?'));
/* Für CL (Spiele, Live, Profile): Verein mit Wappen eintragen */
export const registerVerein = v => (v ? registerClub(v.id, v.name, v.upl || v.wappen, v.farben) : null);
let liz = null;
/* Namensnennung (Lizenz, Urheber, Seite) – nur auf der Vereinsseite, einmal pro Sitzung */
export async function wappenLizenz(wd) {
  if (!wd) return null;
  if (!liz) liz = fetch('assets/data/wappen.json').then(r => r.json()).then(d => (d && d.w) || {}).catch(() => ({}));
  const w = (await liz)[wd];
  return Array.isArray(w) ? { lic: str(w[0], 60), by: str(w[1], 160), page: /^https:\/\/(commons|de)\.wikipedia\.org\/|^https:\/\/commons\.wikimedia\.org\//.test(w[2] || '') ? w[2] : '' } : null;
}
const OK_UPL = /^wappen\/[a-z0-9_-]{2,40}\/[A-Za-z0-9_-]{4,40}\.(webp|png)$/;
/* Vom Verein hochgeladenes Wappen (eine kleine Abfrage beim Öffnen der Vereinsseite) */
export async function loadUploadedCrest(v) {
  if (!v || vr.dbMissing || v.uplChecked) return v && v.upl;
  v.uplChecked = true;
  try {
    const d = await (await rest('vereine_wappen?select=pfad&verein_id=eq.' + encodeURIComponent(v.id))).json();
    const p = Array.isArray(d) && d[0] && d[0].pfad;
    if (OK_UPL.test(p || '')) { v.upl = storageUrl(p); registerVerein(v); }
  } catch (e) { /* ohne Migration 018: kein eigenes Wappen */ }
  return v.upl;
}
export async function uploadCrest(v, blob) {
  const path = 'wappen/' + v.id + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + (blob.type === 'image/webp' ? '.webp' : '.png');
  await uploadFile(path, blob);
  const r = await rest('rpc/verein_wappen_setzen', { method: 'POST', headers: json, body: JSON.stringify({ v: v.id, p: path }) });
  if ((await r.json()) !== true) throw new Error('Keine Berechtigung');
  v.upl = storageUrl(path); registerVerein(v);
}
/* Vereinsverwalter: anfragen, Status lesen */
export async function adminStatus(id) {
  try {
    const d = await (await rest('vereine_admins?select=status&verein_id=eq.' + encodeURIComponent(id))).json();
    return Array.isArray(d) && d[0] ? str(d[0].status, 12) : '';
  } catch (e) { return ''; }
}
export async function requestAdmin(id, rolle) {
  try { await rest('vereine_admins', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, json), body: JSON.stringify({ verein_id: id, rolle: str(rolle, 40).replace(/[<>"]/g, '') || null }) }); }
  catch (e) { throw new Error(/duplicate|23505|409/i.test(e.message || '') ? 'Schon angefragt' : errText(e)); }
}

/* ---------- Mein Verein (nur auf dem Gerät) ---------- */
export const myClub = () => { const c = readJson(KEYS.club, null); return c && VID.test(c.id || '') ? c : null; };
export function setMyClub(v) { if (!v) { try { localStorage.removeItem(KEYS.club); } catch (e) {} return; } writeJson(KEYS.club, { id: v.id, name: v.name, ort: v.ort, land: v.land }); }
