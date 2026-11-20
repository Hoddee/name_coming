/* Fun-Punkte: ohne Anmeldung jemandem (Kumpel, Spieler eines anderen Vereins) Punkte nach der Kreo-Tabelle geben.
   Nichts geht in die Datenbank, zählt nirgends (Manager, Hall of Fame) – nur ein Bild zum Teilen und ein Verlauf auf dem Gerät (KEYS.fun).
   Klassen mit fun-. */
import { $, esc, fmt, tierOf, applyTier, buzz, readJson, writeJson, dateLong } from '../core/util.js';
import { KEYS, APP_NAME } from '../config.js';
import { GROUPS } from '../data/actions.js';
import { registerView } from '../router.js';
import { shareCanvas, glow, fontsReady, TIER_COLOR } from './share.js';
import { suggestInto } from './vereine.js';
import { myClub } from '../services/vereine.js';

const POS = [['TW', 'Torwart'], ['ABW', 'Abwehr'], ['MIT', 'Mittelfeld'], ['ANG', 'Sturm']];
const TABS = [['att', 'Angriff'], ['def', 'Abwehr'], ['err', 'Fehler']];
const fresh = () => ({ name: '', club: (myClub() || {}).name || '', pos: 'MIT', ev: [] });
const st = Object.assign({ cur: null, hist: [] }, readJson(KEYS.fun, null) || {});
if (!st.cur || !Array.isArray(st.cur.ev)) st.cur = fresh();
if (!Array.isArray(st.hist)) st.hist = [];
const ui = { tab: 'att' };
const save = () => writeJson(KEYS.fun, st);

/* Wert einer Aktion für die Position */
const valOf = (v, pos) => (typeof v === 'number' ? v : v && (v[pos] != null ? v[pos] : v.MIT) || 0);
const ACT = {};
for (const k of Object.keys(GROUPS)) for (const g of GROUPS[k]) for (const [key, label, v] of g.a) ACT[key] = { label, v };
const total = c => c.ev.reduce((s, e) => s + (Number(e[1]) || 0), 0);

function html() {
  const c = st.cur, t = total(c);
  let h = '<div class="fun-who"><label class="nf"><span>Name</span><input class="fi" name="fname" maxlength="30" autocomplete="off" placeholder="Wer?" value="' + esc(c.name) + '"></label>' +
    '<label class="nf"><span>Verein</span><input class="fi" name="fclub" maxlength="40" autocomplete="off" list="funDl" value="' + esc(c.club) + '"></label><datalist id="funDl"></datalist></div>' +
    '<div class="lgs fun-pos">' + POS.map(([k, n]) => '<button type="button" data-fun="pos:' + k + '" aria-pressed="' + (c.pos === k) + '">' + n + '</button>').join('') + '</div>' +
    '<div class="fun-total tc" data-tier="' + tierOf(t) + '"><b>' + t + '</b><small>Punkte</small></div>';
  if (c.ev.length) h += '<div class="fun-last">' + c.ev.slice(-4).reverse().map((e, i) =>
    '<button type="button" data-fun="undo:' + (c.ev.length - 1 - i) + '"><span>' + esc((ACT[e[0]] || {}).label || '') + '</span><b>' + fmt(e[1]) + '</b><i aria-hidden="true">×</i></button>').join('') + '</div>';
  h += '<div class="htabs" role="tablist">' + TABS.map(([k, n]) => '<button type="button" role="tab" data-fun="tab:' + k + '" aria-pressed="' + (ui.tab === k) + '">' + n + '</button>').join('') + '</div>';
  for (const g of GROUPS[ui.tab]) {
    if (g.only && g.only !== c.pos) continue;
    h += '<h3 class="fun-gh">' + esc(g.t) + '</h3><div class="fun-acts">' + g.a.map(([key, label, v]) => {
      const p = valOf(v, c.pos);
      return '<button type="button" class="fun-act" data-fun="a:' + key + '"><span>' + esc(label) + '</span><b class="' + (p < 0 ? 'neg' : 'pos') + '">' + fmt(p) + '</b></button>';
    }).join('') + '</div>';
  }
  h += '<div class="duo fun-end"><button type="button" class="btn primary" data-fun="share"' + (c.ev.length ? '' : ' disabled') + '>Bild teilen</button>' +
    '<button type="button" class="btn" data-fun="new"' + (c.ev.length || c.name ? '' : ' disabled') + '>Neu</button></div>';
  if (st.hist.length) h += '<h2>Verlauf</h2><ul class="fun-hist">' + st.hist.slice(0, 10).map(x =>
    '<li><span><b>' + esc(x.name || '–') + '</b><small>' + esc([x.club, dateLong(new Date(x.d))].filter(Boolean).join(' · ')) + '</small></span><em class="tc" data-tier="' + tierOf(x.t) + '">' + Number(x.t) + '</em></li>').join('') + '</ul>';
  return h;
}
function render() { applyTier(0); $('funBody').innerHTML = html(); }

/* Bild zum Teilen: Name, Verein, Punkte */
async function shareFun() {
  const c = st.cur, t = total(c), name = c.name || 'Fun-Punkte';
  await fontsReady();
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#0B0E17'; x.fillRect(0, 0, W, H);
  glow(x, W);
  x.textAlign = 'center';
  x.fillStyle = '#C9FF4A'; x.font = '600 34px "Inter Tight", Arial, sans-serif'; x.fillText('Fun-Punkte', W / 2, 250);
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '800 96px "Kreo Display", Arial, sans-serif'; x.fillText(name.slice(0, 22), W / 2, 380);
  x.fillStyle = '#9AA2B8'; x.font = '500 40px "Inter Tight", Arial, sans-serif'; x.fillText([c.club, (POS.find(p => p[0] === c.pos) || [])[1]].filter(Boolean).join(' · ').slice(0, 44), W / 2, 450);
  x.fillStyle = TIER_COLOR[tierOf(t)]; x.font = '800 300px "Kreo Display", Arial, sans-serif'; x.fillText(String(t), W / 2, 820);
  /* die größten Aktionen */
  const top = {};
  for (const [k, p] of c.ev) { const l = (ACT[k] || {}).label || k; top[l] = (top[l] || 0) + Number(p || 0); }
  const rows = Object.entries(top).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
  x.font = '500 40px "Inter Tight", Arial, sans-serif';
  rows.forEach(([l, p], i) => { x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(l + '  ' + fmt(p), W / 2, 960 + i * 62); });
  x.fillStyle = '#6E7690'; x.font = '500 26px "Inter Tight", Arial, sans-serif'; x.fillText(APP_NAME + ' · ' + dateLong(new Date()), W / 2, 1300);
  shareCanvas(cv, 'fun-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + t + '.png', name + ' – ' + t + ' Punkte');
}

export function initFun() {
  registerView('fun', { elements: ['fun'], render });
  const root = $('fun');
  root.addEventListener('input', e => {
    if (e.target.name === 'fname') { st.cur.name = e.target.value.slice(0, 30); save(); }
    else if (e.target.name === 'fclub') { st.cur.club = e.target.value.slice(0, 40); save(); suggestInto(e.target, $('funDl')); }
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-fun]');
    if (!b || b.disabled) return;
    const k = b.dataset.fun, c = st.cur;
    if (k.startsWith('a:')) { const a = ACT[k.slice(2)]; if (!a) return; c.ev.push([k.slice(2), valOf(a.v, c.pos)]); buzz(12); }
    else if (k.startsWith('undo:')) c.ev.splice(+k.slice(5), 1);
    else if (k.startsWith('pos:')) c.pos = k.slice(4);
    else if (k.startsWith('tab:')) ui.tab = k.slice(4);
    else if (k === 'share') { shareFun(); return; }
    else if (k === 'new') {
      if (c.ev.length) st.hist.unshift({ name: c.name, club: c.club, pos: c.pos, t: total(c), d: Date.now() });
      st.hist = st.hist.slice(0, 20); st.cur = fresh();
    }
    save(); render();
  });
}
