/* Kader schnell füllen: Mannschaft per Link/QR einladen, Profil übernehmen („Das bin ich“) oder neu beitreten,
   Kader als Liste einfügen, eigenes Spielerprofil mit eigenem Foto. Daten in services/spieler.js (Migration 018). Klassen mit ei-.
   Ansichten: einladen (Link erstellen), einladung (Link geöffnet, ?t=<Code>), kliste (Liste einfügen). */
import { $, esc, toast, buzz, applyTier, shareLink } from '../core/util.js';
import { APP_NAME } from '../config.js';
import { registerView, show, nav } from '../router.js';
import { isLoggedIn, isAdmin, currentUser, onAuthChange } from '../services/auth.js';
import { rest } from '../services/api.js';
import { PL, POS_SHORT, POS_ORDER, fullName } from '../data/players.js';
import { qrSvg } from '../core/qr.js';
import { cutout } from '../core/cutout.js';
import { avatar } from './components.js';
import { vereinById, vereinCrest, loadVereine, fetchVerein } from '../services/vereine.js';
import { TEAM_ART, createInvite, inviteLink, readInvite, joinTeam, claimPlayer, myPlayerId, resetMe, uploadOwnPhoto, updateMyProfile, releaseProfile,
  parseKader, bulkCreate, fetchSpieler, teamText } from '../services/spieler.js';

const ROM = ['', 'I', 'II', 'III', 'IV'];
const PEND = 'kreo-einladung'; // Einladung merken, bis man angemeldet ist (sessionStorage)
const ui = { v: null, art: 'herren', nr: 1, code: '', busy: false, err: '', inv: null, join: { vn: '', n: '', pos: 'MIT', num: '' }, text: '', ok: false, res: null, step: '' };
const seg = (key, opts, cur) => '<div class="seg full">' + opts.map(([k, l]) => '<button type="button" data-ei="' + key + ':' + k + '" aria-pressed="' + (String(cur) === String(k)) + '">' + l + '</button>').join('') + '</div>';
const teamPick = () => seg('art', Object.entries(TEAM_ART), ui.art) + '<div class="seg full ei-nr">' + [1, 2, 3, 4].map(n => '<button type="button" data-ei="nr:' + n + '" aria-pressed="' + (ui.nr === n) + '">' + ROM[n] + '</button>').join('') + '</div>';
const head = (v, sub) => '<div class="ei-head"><img src="' + esc(vereinCrest(v)) + '" alt=""><span><b>' + esc(v.name) + '</b><small>' + esc(sub) + '</small></span></div>';
const loginBtn = () => '<button type="button" class="btn primary full" data-ei="login">Anmelden oder registrieren</button>';
const tName = (art, nr) => teamText({ art, nr });

/* ---------- Einladen: Link + QR für eine Mannschaft ---------- */
export function openInvite(v) {
  if (!v) { show('vereine'); toast('Erst den Verein wählen'); return; }
  Object.assign(ui, { v, code: '', err: '', busy: false });
  show('einladen');
}
function einladenHtml() {
  const v = ui.v;
  if (!v) return '';
  let h = head(v, [v.ort, v.kreis].filter(Boolean).join(' · '));
  if (!isLoggedIn()) return h + loginBtn();
  if (ui.code) {
    const link = inviteLink(ui.code);
    return h + '<div class="card ei-qr"><div class="ei-qrc">' + qrSvg(link) + '</div><b>' + esc(tName(ui.art, ui.nr)) + '</b><small class="ei-link">' + esc(link.replace(/^https?:\/\//, '')) + '</small></div>' +
      '<div class="duo"><button type="button" class="btn primary" data-ei="share">Teilen</button><button type="button" class="btn" data-ei="copy">Link kopieren</button></div>' +
      '<button type="button" class="lnk ei-again" data-ei="again">Andere Mannschaft</button>';
  }
  return h + '<div class="card inline-form"><div class="nf"><span>Mannschaft</span>' + teamPick() + '</div>' +
    (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<button type="button" class="btn primary full" data-ei="create"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Erstelle …' : 'Einladung erstellen') + '</button></div>';
}

/* ---------- Einladung geöffnet (?t=Code) ---------- */
export async function openInviteLink(code) {
  Object.assign(ui, { inv: null, err: '', busy: false, code });
  try { sessionStorage.setItem(PEND, code); } catch (e) {}
  show('einladung');
  const inv = (await readInvite(code)) || false;
  if (inv) {
    try { await loadVereine(); } catch (e) {}
    ui.v = vereinById(inv.verein) || (await fetchVerein(inv.verein)) || { id: inv.verein, name: inv.vname, ort: '', farben: [] };
    if (isLoggedIn()) await myPlayerId(true);
  }
  ui.inv = inv;
  if (nav.current === 'einladung') renderEinladung();
}
let mine = null;
function einladungHtml() {
  const inv = ui.inv;
  if (inv === null) return '<div class="skel" style="height:160px"></div>';
  if (!inv) return '<p class="hmsg">Einladung nicht gefunden.</p>';
  let h = head(ui.v, tName(inv.art, inv.nr) + ' · ' + APP_NAME);
  if (!inv.ok) return h + '<p class="hmsg">Einladung abgelaufen.</p>';
  if (mine) {
    const p = PL[mine];
    return h + '<div class="card ei-done"><b>Du bist dabei</b>' + (p ? '<small>' + esc(fullName(p)) + '</small>' : '') + '</div>' +
      '<button type="button" class="btn primary full" data-ei="me">Mein Profil</button>';
  }
  if (!isLoggedIn()) return h + (inv.list.length ? '<h2>Kader <small class="vr-season">' + inv.list.length + '</small></h2><div class="ei-list">' + inv.list.map(x => rowHtml(x, false)).join('') + '</div>' : '') + loginBtn();
  if (inv.list.length) h += '<h2>Bist du schon dabei?</h2><div class="ei-list">' + inv.list.map(x => rowHtml(x, true)).join('') + '</div>';
  const j = ui.join;
  h += '<h2>' + (inv.list.length ? 'Neu im Team' : 'Dein Profil') + '</h2><form class="card inline-form" id="eiJoin" autocomplete="off">' +
    '<div class="vr-two"><label class="nf"><span>Vorname</span><input class="fi" name="vn" maxlength="30" autocapitalize="words" value="' + esc(j.vn) + '"></label>' +
    '<label class="nf"><span>Nachname</span><input class="fi" name="n" maxlength="30" autocapitalize="words" value="' + esc(j.n) + '"></label></div>' +
    '<div class="nf"><span>Position</span>' + seg('jpos', POS_ORDER.map(k => [k, POS_SHORT[k]]), j.pos) + '</div>' +
    '<label class="nf su-numf"><span>Rückennummer</span><input class="fi" name="num" inputmode="numeric" maxlength="2" placeholder="–" value="' + esc(j.num) + '"></label>' +
    '<label class="su-ok"><input type="checkbox" name="ok"' + (ui.ok ? ' checked' : '') + '><span>Ich bin volljährig</span></label>' +
    (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<button type="submit" class="btn primary full"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? 'Speichere …' : 'Beitreten') + '</button></form>';
  return h;
}
const rowHtml = (x, can) => '<div class="ei-row"><span class="ei-num">' + (x.num || '') + '</span><span class="su-t"><b>' + esc(x.vn + ' ' + x.n) + '</b><small>' + POS_SHORT[x.pos] + '</small></span>' +
  (x.own ? '<i class="ei-own">vergeben</i>' : can ? '<button type="button" class="btn sm" data-ei="claim:' + esc(x.id) + '"' + (ui.busy ? ' disabled' : '') + '>Das bin ich</button>' : '<span></span>') + '</div>';
async function renderEinladung() {
  applyTier(0);
  mine = isLoggedIn() ? await myPlayerId() : null;
  if (mine && !PL[mine]) await fetchSpieler(mine);
  $('eiBody').innerHTML = einladungHtml();
}

/* ---------- Kader als Liste ---------- */
export function openKaderListe(v) {
  Object.assign(ui, { v, text: '', ok: false, res: null, err: '', busy: false, step: '' });
  show('kliste');
}
function klisteHtml() {
  const v = ui.v;
  if (!v) return '';
  let h = head(v, [v.ort, v.kreis].filter(Boolean).join(' · '));
  if (!isLoggedIn()) return h + loginBtn();
  if (ui.res) {
    const r = ui.res;
    return h + '<div class="card ei-done"><b>' + r.ok + ' eingetragen</b>' + (r.dup ? '<small>' + r.dup + ' gab es schon</small>' : '') +
      (r.fail.length ? '<small class="bad">' + r.fail.map(esc).join('<br>') + '</small>' : '') + '</div>' +
      '<div class="duo"><button type="button" class="btn primary" data-ei="toverein">Zum Verein</button><button type="button" class="btn" data-ei="invite">Team einladen</button></div>';
  }
  const p = parseKader(ui.text);
  h += '<div class="card inline-form"><div class="nf"><span>Mannschaft</span>' + teamPick() + '</div>' +
    '<label class="nf"><span>Ein Spieler pro Zeile</span><textarea class="fi ei-ta" id="eiText" rows="8" placeholder="Max Mustermann 9 ST&#10;Müller, Tim TW" autocapitalize="words" spellcheck="false">' + esc(ui.text) + '</textarea></label>';
  if (p.out.length) h += '<div class="ei-prev">' + p.out.map(x => '<span><i>' + (x.num || '–') + '</i>' + esc(x.vn + ' ' + x.n) + ' <small>' + POS_SHORT[x.pos] + '</small></span>').join('') + '</div>';
  if (p.bad.length) h += '<div class="form-msg bad">Nicht erkannt: ' + p.bad.map(esc).join(', ') + '</div>';
  h += '<label class="su-ok"><input type="checkbox" id="eiOk"' + (ui.ok ? ' checked' : '') + '><span>Alle volljährig und wissen Bescheid</span></label>' +
    (ui.err ? '<div class="form-msg bad">' + esc(ui.err) + '</div>' : '') +
    '<button type="button" class="btn primary full" data-ei="bulk"' + (ui.busy || !p.out.length ? ' disabled' : '') + '>' + (ui.busy ? 'Trage ein … ' + esc(ui.step) : p.out.length + ' eintragen') + '</button></div>';
  return h;
}
const renderKliste = () => { applyTier(0); $('klBody').innerHTML = klisteHtml(); };
const renderEinladen = () => { applyTier(0); $('einBody').innerHTML = einladenHtml(); };

/* ---------- Mein Spielerprofil (Karte im Konto) ---------- */
const meUi = { busy: false, err: '' };
export async function fillMyProfile() {
  const box = $('eiMe');
  if (!box || !isLoggedIn()) return;
  const id = await myPlayerId();
  if (!id) { box.innerHTML = ''; return; }
  const p = PL[id] || (await fetchSpieler(id));
  if (!p || !$('eiMe')) return;
  $('eiMe').innerHTML = '<div class="card ei-me"><div class="ei-mehead">' + avatar(id) + '<span class="su-t"><small>Mein Spielerprofil</small><b>' + esc(fullName(p)) + '</b><small>' + esc((p.vname || '') + ' · ' + teamText(p)) + '</small></span>' +
    '<button type="button" class="lnk inline" data-open="p:' + esc(id) + '">Ansehen</button></div>' +
    '<form id="eiMeForm" class="ei-meform"><div class="nf"><span>Position</span>' + seg('mpos', POS_ORDER.map(k => [k, POS_SHORT[k]]), p.pos) + '</div>' +
    '<label class="nf su-numf"><span>Rückennummer</span><input class="fi" name="num" inputmode="numeric" maxlength="2" placeholder="–" value="' + esc(p.num || '') + '"></label>' +
    (meUi.err ? '<div class="form-msg bad">' + esc(meUi.err) + '</div>' : '') +
    '<div class="duo"><label class="btn">' + (meUi.busy ? 'Lädt …' : p.foto ? 'Foto ändern' : 'Foto hochladen') + '<input type="file" accept="image/*" id="eiFoto" hidden></label>' +
    '<button type="submit" class="btn primary"' + (meUi.busy ? ' disabled' : '') + '>Speichern</button></div>' +
    (p.foto ? '<button type="button" class="lnk" data-ei="nofoto">Foto entfernen</button>' : '') +
    '<button type="button" class="lnk" data-ei="release">Profil freigeben</button></form></div>';
}

/* ---------- Admin: Anfragen von Vereinsverwaltern ---------- */
const va = { list: null, at: 0 };
export function vadmHtml() {
  if (!va.list || !va.list.length) return '<div id="vaCard"></div>';
  return '<div class="card su-mod" id="vaCard"><b>Vereinsverwalter</b>' + va.list.map(r => {
    const v = vereinById(r.verein_id);
    return '<div class="su-modr"><span class="su-t"><b>' + esc(v ? v.name : r.verein_id) + '</b><small>' + esc(r.rolle || '–') + '</small></span>' +
      '<span class="duo"><button type="button" class="btn sm" data-va="ok:' + esc(r.verein_id) + ':' + esc(r.user_id) + '">OK</button><button type="button" class="btn sm" data-va="abgelehnt:' + esc(r.verein_id) + ':' + esc(r.user_id) + '">Nein</button></span></div>';
  }).join('') + '</div>';
}
export async function loadVadm(force) {
  if (!isAdmin() || (!force && Date.now() - va.at < 120000)) return;
  va.at = Date.now();
  try {
    const d = await (await rest('vereine_admins?select=verein_id,user_id,rolle,status&status=eq.anfrage&order=created_at.asc&limit=30')).json();
    va.list = (Array.isArray(d) ? d : []).filter(r => r && /^[a-z0-9_-]{2,40}$/.test(r.verein_id) && /^[a-f0-9-]{36}$/.test(r.user_id));
    if (va.list.length) { try { await loadVereine(); } catch (e) {} }
  } catch (e) { va.list = null; }
  const el = $('vaCard'); if (el) el.outerHTML = vadmHtml();
}

/* ---------- Ereignisse ---------- */
async function onClick(e) {
  const a = e.target.closest('[data-va]');
  if (a && !a.disabled) {
    a.disabled = true;
    const [st, vid, uid] = a.dataset.va.split(':');
    try { await rest('vereine_admins?verein_id=eq.' + encodeURIComponent(vid) + '&user_id=eq.' + uid, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: st }) }); toast('Erledigt'); }
    catch (err) { toast('Nicht gespeichert', 'bad'); }
    loadVadm(true);
    return;
  }
  const b = e.target.closest('[data-ei]');
  if (!b || b.disabled) return;
  const k = b.dataset.ei, view = nav.current;
  const rerender = () => (view === 'einladen' ? renderEinladen() : view === 'kliste' ? renderKliste() : view === 'einladung' ? renderEinladung() : fillMyProfile());
  if (k.startsWith('art:')) { ui.art = k.slice(4); if (ui.art !== 'herren' && ui.nr > 2) ui.nr = 1; rerender(); }
  else if (k.startsWith('nr:')) { ui.nr = +k.slice(3); rerender(); }
  else if (k.startsWith('jpos:')) { readJoin(); ui.join.pos = k.slice(5); renderEinladung(); }
  else if (k.startsWith('mpos:')) { const f = $('eiMeForm'); if (f) f.dataset.pos = k.slice(5); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
  else if (k === 'login') { show('admin'); }
  else if (k === 'create') {
    ui.busy = true; ui.err = ''; renderEinladen();
    try { ui.code = await createInvite(ui.v, ui.art, ui.nr); buzz(20); } catch (err) { ui.err = err.message; }
    ui.busy = false; renderEinladen();
  } else if (k === 'share') shareLink(inviteLink(ui.code), ui.v.name + ' ' + tName(ui.art, ui.nr) + ' – ' + APP_NAME, ui.v.name + ' ' + tName(ui.art, ui.nr) + ' bei ' + APP_NAME);
  else if (k === 'copy') { try { await navigator.clipboard.writeText(inviteLink(ui.code)); toast('Kopiert'); } catch (err) { toast('Nicht kopiert', 'bad'); } }
  else if (k === 'again') { ui.code = ''; renderEinladen(); }
  else if (k === 'invite') openInvite(ui.v);
  else if (k === 'toverein') { const { openVerein } = await import('./vereine.js'); openVerein(ui.v.id); }
  else if (k === 'me') show('admin');
  else if (k.startsWith('claim:')) {
    ui.busy = true; renderEinladung();
    try { await claimPlayer(ui.code, k.slice(6)); await fetchSpieler(k.slice(6)); buzz(20); toast('Profil übernommen'); clearPending(); } catch (err) { toast(err.message, 'bad'); }
    ui.busy = false; await myPlayerId(true); renderEinladung();
  } else if (k === 'bulk') {
    const ta = $('eiText'); if (ta) ui.text = ta.value;
    const ok = $('eiOk'); ui.ok = !!(ok && ok.checked);
    if (!ui.ok) { ui.err = 'Bitte bestätigen'; renderKliste(); return; }
    const list = parseKader(ui.text).out;
    ui.busy = true; ui.err = ''; renderKliste();
    ui.res = await bulkCreate(ui.v, ui.art, ui.nr, list, (i, n) => { ui.step = i + '/' + n; const btn = document.querySelector('[data-ei="bulk"]'); if (btn) btn.textContent = 'Trage ein … ' + ui.step; });
    ui.busy = false; buzz(20); renderKliste();
  } else if (k === 'nofoto' || k === 'release') {
    const id = await myPlayerId();
    if (!id) return;
    meUi.busy = true; fillMyProfile();
    try {
      if (k === 'nofoto') { await updateMyProfile(id, { pos: (PL[id] || {}).pos, num: (PL[id] || {}).num, foto: '' }); toast('Foto entfernt'); }
      else { await releaseProfile(id); resetMe(); toast('Freigegeben'); }
    } catch (err) { toast(err.message, 'bad'); }
    meUi.busy = false; fillMyProfile();
  }
}
function readJoin() {
  const f = $('eiJoin');
  if (!f) return;
  Object.assign(ui.join, { vn: f.vn.value.trim(), n: f.n.value.trim(), num: f.num.value.replace(/\D/g, '').slice(0, 2) });
  ui.ok = f.ok.checked;
}
const clearPending = () => { try { sessionStorage.removeItem(PEND); } catch (e) {} };

export function initEinladung() {
  registerView('einladen', { elements: ['einladen'], render: renderEinladen });
  registerView('einladung', { elements: ['einladung'], render: () => { renderEinladung(); } });
  registerView('kliste', { elements: ['kliste'], render: renderKliste });
  document.addEventListener('click', onClick);
  document.addEventListener('input', e => { if (e.target.id === 'eiText') { ui.text = e.target.value; clearTimeout(ui.t); ui.t = setTimeout(() => { if (nav.current === 'kliste') { const pos = e.target.selectionStart; renderKliste(); const ta = $('eiText'); if (ta) { ta.focus(); ta.setSelectionRange(pos, pos); } } }, 600); } });
  document.addEventListener('submit', async e => {
    if (e.target.id === 'eiJoin') {
      e.preventDefault();
      readJoin();
      const j = ui.join;
      if (!/^\p{L}[\p{L} '.-]{1,29}$/u.test(j.vn) || !/^\p{L}[\p{L} '.-]{1,29}$/u.test(j.n)) { ui.err = 'Vor- und Nachname fehlen'; renderEinladung(); return; }
      if (!ui.ok) { ui.err = 'Bitte bestätigen'; renderEinladung(); return; }
      ui.busy = true; ui.err = ''; renderEinladung();
      try { await joinTeam(ui.code, { vn: j.vn, n: j.n, pos: j.pos, num: +j.num || null }); buzz(20); toast('Willkommen im Team'); clearPending(); }
      catch (err) { ui.err = err.message; }
      ui.busy = false; await myPlayerId(true); renderEinladung();
    } else if (e.target.id === 'eiMeForm') {
      e.preventDefault();
      const id = await myPlayerId(), f = e.target;
      if (!id) return;
      meUi.busy = true; meUi.err = '';
      try { await updateMyProfile(id, { pos: f.dataset.pos || (PL[id] || {}).pos, num: +f.num.value.replace(/\D/g, '') || null }); toast('Gespeichert'); buzz(15); }
      catch (err) { meUi.err = err.message; }
      meUi.busy = false; fillMyProfile();
    }
  });
  /* Eigenes Foto: freistellen wie bei den Kaderfotos, dann hochladen */
  document.addEventListener('change', async e => {
    if (e.target.id !== 'eiFoto' || !e.target.files || !e.target.files[0]) return;
    const id = await myPlayerId(), u = currentUser();
    if (!id || !u) return;
    meUi.busy = true; meUi.err = ''; fillMyProfile();
    try {
      const res = await cutout(e.target.files[0], 'player');
      const path = await uploadOwnPhoto(u.id, res.blob);
      await updateMyProfile(id, { pos: (PL[id] || {}).pos, num: (PL[id] || {}).num, foto: path });
      buzz(20); toast('Foto gespeichert');
    } catch (err) { meUi.err = err.message || 'Nicht gespeichert'; }
    meUi.busy = false; fillMyProfile();
  });
  /* Nach dem Anmelden: offene Einladung wieder öffnen, Profil-Karte füllen */
  onAuthChange(() => {
    resetMe();
    let code = null;
    try { code = sessionStorage.getItem(PEND); } catch (e) {}
    if (isLoggedIn() && code && nav.current !== 'einladung') openInviteLink(code);
    else if (nav.current === 'einladung') renderEinladung();
  });
}
