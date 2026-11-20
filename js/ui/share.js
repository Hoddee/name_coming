/* Ergebnis als Bild (1080x1350) im Look der Spielerkarte – teilen oder herunterladen */
import { store, total, score, names, teamOf, eachPlayer, isMulti } from '../core/game.js';
import { GOAL_KEYS, ASSIST_KEYS } from '../data/actions.js';
import { POS_NAME } from '../data/players.js';
import { PL, photoUrl } from '../data/players.js';
import { CL, crestUrl } from '../data/clubs.js';
import { tierOf, dateLong } from '../core/util.js';
import { APP_NAME } from '../config.js';

export const TIER_COLOR = { neg: '#E0343F', low: '#ED8928', mid: '#9CE04A', high: '#3FD8E8', top: '#E1BE38' };
const imgCache = new Map();

/* Namen etwas schmaler (nur wenn die Schrift es kann); ältere Browser zeichnen normal breit */
export const narrow = (x, on) => { if ('fontStretch' in x) x.fontStretch = on ? 'semi-condensed' : 'normal'; };
export function loadImg(url) {
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise(res => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = () => res(null);
      i.src = url;
    }));
  }
  return imgCache.get(url);
}
export function fontsReady() {
  try { return Promise.all([document.fonts.load('800 100px "Kreo Display"'), document.fonts.load('500 40px "Inter Tight"'), document.fonts.load('800 60px "Kreo Display"')]).catch(() => {}); }
  catch (e) { return Promise.resolve(); }
}
function urls() {
  const m = store.S.match, mine = teamOf(m);
  return [photoUrl(m.p), crestUrl(m.home ? mine : m.o), crestUrl(m.home ? m.o : mine)];
}
/* Bilder vorab laden, damit "Teilen" sofort reagiert (Teilen-Dialog braucht eine direkte Nutzeraktion) */
export function preloadShare() { if (store.S.match) { urls().forEach(loadImg); fontsReady(); } }

export function fit(x, img, cx, cy, box) {
  if (!img) return;
  const k = Math.min(box / img.width, box / img.height), w = img.width * k, h = img.height * k;
  x.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}
const spacing = (x, v) => { try { x.letterSpacing = v; } catch (e) {} };
/* Kreo-Hintergrund: violetter Schein von oben */
export function glow(x, W) {
  const g = x.createRadialGradient(W / 2, 120, 40, W / 2, 120, 760);
  g.addColorStop(0, 'rgba(139,108,255,.55)'); g.addColorStop(1, 'rgba(139,108,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, 900);
}

export async function shareCard() {
  const S = store.S;
  if (!S.ended || !S.match) return;
  const t = total(), sc = score(), col = TIER_COLOR[tierOf(t)], home = !!S.match.home;
  const [photo, cl, cr] = await Promise.all([...urls().map(loadImg), fontsReady()]);
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#0B0E17'; x.fillRect(0, 0, W, H);
  glow(x, W);
  if (photo) { const pw = 800, ph = pw * photo.height / photo.width; x.drawImage(photo, (W - pw) / 2, 30, pw, ph); }
  const g = x.createLinearGradient(0, 640, 0, 1010);
  g.addColorStop(0, 'rgba(11,14,23,0)'); g.addColorStop(1, '#0B0E17');
  x.fillStyle = g; x.fillRect(0, 640, W, 380); x.fillStyle = '#0B0E17'; x.fillRect(0, 1010, W, H - 1010);
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '800 96px "Kreo Display", Arial, sans-serif'; spacing(x, '-3px'); x.fillText(names.player, W / 2, 806); spacing(x, '0px');
  spacing(x, '-9px');
  x.fillStyle = col; x.font = '800 290px "Kreo Display", Arial, sans-serif'; x.fillText(String(t), W / 2, 1050);
  spacing(x, '0px');
  fit(x, cl, 215, 1175, 170); fit(x, cr, 865, 1175, 170);
  spacing(x, '6px');
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '500 92px "Inter Tight", Arial, sans-serif';
  x.fillText(home ? sc.us + ' : ' + sc.them : sc.them + ' : ' + sc.us, W / 2, 1200);
  spacing(x, '4px');
  x.fillStyle = '#9AA2B8'; x.font = '500 34px "Inter Tight", Arial, sans-serif'; x.fillText('Endstand', W / 2, 1262);
  spacing(x, '0px');
  x.font = '500 26px "Inter Tight", Arial, sans-serif'; x.fillStyle = '#6E7690';
  const d = S.manual && S.playedAt ? new Date(S.playedAt) : new Date();
  x.fillText(APP_NAME + ' · Kreisliga ' + (CL[teamOf(S.match)].lg || '') + ' · ' + dateLong(d), W / 2, 1316);

  shareCanvas(cv, names.player.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + t + '.png', names.player + ' – ' + t + ' Punkte');
}
export function shareCanvas(cv, name, title) {
  cv.toBlob(blob => {
    if (!blob) return;
    let file = null;
    try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title }).catch(er => { if (er && er.name !== 'AbortError') download(blob, name); });
    } else download(blob, name);
  }, 'image/png');
}

/* Team-Bild: ein Bild fürs ganze Spiel – Ergebnis oben, darunter alle Spieler nach Punkten */
function teamRows() {
  return eachPlayer(() => {
    const P = store.S, id = P.match.p;
    if (!P.stints.length && !P.manual) return null; // ohne Einsatz nicht aufs Bild
    let g = 0, a = 0;
    for (const e of P.events) { if (GOAL_KEYS[e.key]) g++; if (ASSIST_KEYS[e.key]) a++; }
    return { id, n: (PL[id] || {}).n || id, pos: POS_NAME[P.pos] || '', t: total(), g, a, url: photoUrl(id, true) };
  }).filter(Boolean).sort((x, y) => y.t - x.t);
}
export function preloadTeamShare() { if (isMulti()) teamRows().forEach(r => loadImg(r.url)); }
export async function shareTeamCard() {
  const S = store.S, sc = score(), home = !!S.match.home, rows = teamRows();
  const [cl, cr, ...photos] = await Promise.all([...urls().slice(1).map(loadImg), ...rows.map(r => loadImg(r.url)), fontsReady()]);
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#0B0E17'; x.fillRect(0, 0, W, H);
  glow(x, W);
  x.textAlign = 'center';
  spacing(x, '6px'); x.fillStyle = '#F1F3FA'; x.font = '700 30px "Inter Tight", Arial, sans-serif'; x.fillText('Endstand', W / 2, 92); spacing(x, '0px');
  fit(x, cl, 200, 230, 190); fit(x, cr, 880, 230, 190);
  x.fillStyle = '#fff'; x.font = '800 150px "Kreo Display", Arial, sans-serif';
  x.fillText(home ? sc.us + ' : ' + sc.them : sc.them + ' : ' + sc.us, W / 2, 285);
  x.fillStyle = '#9AA2B8'; x.font = '500 30px "Inter Tight", Arial, sans-serif';
  const d = S.manual && S.playedAt ? new Date(S.playedAt) : new Date();
  x.fillText(CL[teamOf(S.match)].n + ' · ' + dateLong(d), W / 2, 380);
  const rh = Math.min(146, Math.floor((H - 440 - 70) / rows.length)), top = 440 + Math.max(0, Math.floor((H - 440 - 70 - rows.length * rh) / 3));
  rows.forEach((r, i) => {
    const y = top + i * rh, col = TIER_COLOR[tierOf(r.t)], cy = y + rh / 2;
    x.fillStyle = i === 0 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.035)';
    roundRect(x, 50, y + 6, W - 100, rh - 12, 22); x.fill();
    if (i === 0) { x.fillStyle = col; roundRect(x, 50, y + 6, 10, rh - 12, 5); x.fill(); }
    /* Schrift wächst/schrumpft mit der Zeilenhöhe (bis zu 15 Spieler) */
    const ph = photos[i], s = rh - Math.round(rh * 0.23), k = rh / 146, f = v => Math.round(v * Math.max(0.5, k));
    x.save(); x.beginPath(); x.arc(90 + s / 2 + 8, cy, s / 2, 0, 6.2832); x.fillStyle = '#1A2032'; x.fill(); x.clip();
    if (ph) { const w = s * 1.15, h = w * ph.height / ph.width; x.drawImage(ph, 90 + s / 2 + 8 - w / 2, cy - s / 2 - 2, w, h); }
    x.restore();
    x.textAlign = 'left';
    const tx = 90 + s + 30, two = rh >= 90;
    x.fillStyle = '#fff'; x.font = '700 ' + f(50) + 'px "Kreo Display", Arial, sans-serif'; x.fillText(r.n, tx, two ? cy - 2 : cy + f(18));
    const extra = [r.pos, r.g ? r.g + (r.g > 1 ? ' Tore' : ' Tor') : '', r.a ? r.a + (r.a > 1 ? ' Vorlagen' : ' Vorlage') : ''].filter(Boolean).join(' · ');
    if (two) { x.fillStyle = '#9AA2B8'; x.font = '500 ' + f(28) + 'px "Inter Tight", Arial, sans-serif'; x.fillText(extra, tx, cy + f(36)); }
    x.textAlign = 'right'; x.fillStyle = col; x.font = '800 ' + f(76) + 'px "Kreo Display", Arial, sans-serif'; x.fillText(String(r.t), W - 90, cy + f(26));
  });
  x.textAlign = 'center'; x.font = '500 26px "Inter Tight", Arial, sans-serif'; x.fillStyle = '#6E7690';
  x.fillText(APP_NAME + ' · Kreisliga ' + (CL[teamOf(S.match)].lg || ''), W / 2, H - 30);
  shareCanvas(cv, 'spiel-' + sc.us + '-' + sc.them + '.png', 'Endstand ' + (home ? sc.us + ':' + sc.them : sc.them + ':' + sc.us));
}
export function roundRect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
