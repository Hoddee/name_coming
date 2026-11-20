/* Vereinssuche: Namen vereinheitlichen, Kölner Phonetik und unscharfer Vergleich.
   Reine Funktionen ohne DOM – laufen in der App und im Import-Werkzeug (tools/vereine/build.mjs).
   Ziel: „SC Vornspach“ findet „SC Fornsbach“, „spvgg weiler“ findet „Spielvereinigung Weiler“, Tippfehler stören nicht. */

/* Abkürzungen ↔ ausgeschriebene Formen (beim Suchen beide Seiten auf die Abkürzung bringen) */
const LONG = [
  [/\bturn- und sportverein\b/g, 'tsv'], [/\bturn und sportverein\b/g, 'tsv'], [/\bturn- und sportgemeinschaft\b/g, 'tsg'],
  [/\bfussball-?club\b/g, 'fc'], [/\bfussball-?verein\b/g, 'fv'], [/\bfussball-?sportverein\b/g, 'fsv'],
  [/\bsport-?verein(igung)?\b/g, 'sv'], [/\bsport-?club\b/g, 'sc'], [/\bsport-?gemeinschaft\b/g, 'sg'],
  [/\bspiel-?vereinigung\b/g, 'spvgg'], [/\bsport-?freunde\b/g, 'sf'], [/\bsportfreunde\b/g, 'sf'],
  [/\bverein fuer rasenspiele\b/g, 'vfr'], [/\bverein fuer bewegungsspiele\b/g, 'vfb'], [/\bverein fuer leibesuebungen\b/g, 'vfl'],
  [/\bturn- und sport\b/g, 'tus'], [/\bturnverein\b/g, 'tv'], [/\bmaenner-?turnverein\b/g, 'mtv'], [/\bballspiel-?club\b/g, 'bc'],
  [/\bspvg\b/g, 'spvgg'], [/\bsp\.? ?vgg\.?\b/g, 'spvgg'], [/\bsportfr\b/g, 'sf'], [/\bspfr\b/g, 'sf']
];
/* Wörter ohne Aussagekraft beim Suchen */
const STOP = new Set(['ev', 'e', 'v', 'von', 'und', 'der', 'die', 'das', 'im', 'am', 'an', 'in', 'a', 'd', 'eingetragener', 'verein', 'abteilung', 'fussball', 'abt']);
/* Vereinskürzel (zählen beim Vergleich wenig, der Ort ist das Entscheidende) */
export const PREFIX = new Set(['fc', 'sv', 'tsv', 'sc', 'sg', 'sgm', 'spvgg', 'vfb', 'vfl', 'vfr', 'tus', 'tsg', 'fsv', 'ssv', 'sf', 'djk', 'fv', 'tv', 'mtv',
  'bsv', 'esv', 'psv', 'sus', 'jfg', 'ffc', 'bc', 'svg', 'tsc', 'asv', 'ksv', 'fk', 'ac', 'cfr', 'sv1', 'gsv', 'tuspo', 'spg', 'sge', 'tsgv', 'vfv', 'post', 'sk', 'spvg', 'ssg', 'tura', 'ttc', 'dsc', 'rsv', 'lsv', 'hsv', 'fsg', 'usv', 'tsv1', 'ft', 'ftsv', 'ctg', 'atsv', 'sgv', 'kv']);

/* Kleinschreibung, Umlaute ausschreiben, Satzzeichen weg, Abkürzungen vereinheitlichen */
export function norm(s) {
  let t = String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, m => (m === '̈' ? 'e' : ''))
    .replace(/ß/g, 'ss').replace(/[„“"'’`´]/g, '').replace(/\be\.\s?v\.?/g, ' ');
  for (const [re, to] of LONG) t = t.replace(re, to);
  return t.replace(/[^a-z0-9]+/g, ' ').trim();
}
/* Wörter für den Vergleich (ohne Füllwörter und Jahreszahlen wie 1909) */
export function words(s) {
  return norm(s).split(' ').filter(w => w && !STOP.has(w) && !/^(1[89]|20)\d\d$/.test(w));
}

/* Kölner Phonetik (Postel 1969): gleich klingende Wörter bekommen denselben Code (Vornspach = Fornsbach = 376814) */
export function koeln(word) {
  const s = norm(word).replace(/[^a-z]/g, '');
  if (!s) return '';
  let out = '', last = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], p = s[i - 1] || '', n = s[i + 1] || '';
    let k;
    if ('aeijouy'.includes(c)) k = '0';
    else if (c === 'h') k = '';
    else if (c === 'b') k = '1';
    else if (c === 'p') k = n === 'h' ? '3' : '1';
    else if (c === 'd' || c === 't') k = 'csz'.includes(n) ? '8' : '2';
    else if ('fvw'.includes(c)) k = '3';
    else if ('gkq'.includes(c)) k = '4';
    else if (c === 'c') {
      if (i === 0) k = 'ahkloqrux'.includes(n) ? '4' : '8';
      else k = 'sz'.includes(p) ? '8' : 'ahkoqux'.includes(n) ? '4' : '8';
    } else if (c === 'x') k = 'ckq'.includes(p) ? '8' : '48';
    else if (c === 'l') k = '5';
    else if (c === 'm' || c === 'n') k = '6';
    else if (c === 'r') k = '7';
    else if (c === 's' || c === 'z') k = '8';
    else k = '';
    if (k === '') continue;
    if (k !== last) out += k;
    last = k;
  }
  return out[0] + out.slice(1).replace(/0/g, '');
}

/* Levenshtein mit Abbruch (für kurze Wörter reicht das) */
export function dist(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* Suchschlüssel eines Vereins: Wörter und deren Phonetik (einmal berechnen, dann oft vergleichen) */
export function keyOf(name, ort = '') {
  const w = words(name);
  const extra = words(ort).filter(x => !w.includes(x));
  return { w, x: extra, k: w.map(koeln), kx: extra.map(koeln) };
}

/* Wie gut passt ein Suchwort zu einem Vereinswort? 1 = gleich … 0 = gar nicht */
function wordScore(q, qk, w, wk) {
  if (w === q) return 1;
  if (w.startsWith(q)) return q.length >= 3 ? 0.9 : 0.6;
  if (q.length >= 4 && w.includes(q)) return 0.7;
  if (qk && qk.length >= 2 && wk === qk) return 0.8;
  if (q.length >= 4) {
    const d = dist(q, w.slice(0, Math.max(q.length, Math.min(w.length, q.length + 1))), 2);
    if (d === 1) return 0.75;
    if (d === 2 && q.length >= 6) return 0.55;
  }
  if (qk && qk.length >= 3 && wk && wk.startsWith(qk)) return 0.6;
  return 0;
}

/* Treffer bewerten: jedes Suchwort muss irgendwo passen; Kürzel (FC, SV …) zählen wenig.
   Ergebnis 0 = kein Treffer, sonst höher = besser. */
export function score(query, key) {
  const qw = words(query);
  if (!qw.length) return 0;
  let sum = 0, weight = 0;
  for (const q of qw) {
    const qk = koeln(q), pre = PREFIX.has(q);
    let best = 0;
    for (let i = 0; i < key.w.length; i++) best = Math.max(best, wordScore(q, qk, key.w[i], key.k[i]));
    for (let i = 0; i < key.x.length; i++) best = Math.max(best, 0.85 * wordScore(q, qk, key.x[i], key.kx[i]));
    const wt = pre ? 0.3 : 1;
    if (!best) {
      if (pre) { sum -= 0.1; weight += wt; continue; } // anderes Kürzel: kleiner Abzug, kein Ausschluss
      return 0;
    }
    sum += best * wt; weight += wt;
  }
  const s = sum / weight;
  /* Kürzere Namen bei gleicher Güte vorne (genauerer Treffer) */
  return s <= 0 ? 0 : s + 0.02 / (1 + key.w.length);
}

/* Mannschaftsnummer aus dem Namen lösen: „SC Fornsbach II“ → { base: 'SC Fornsbach', nr: 2 } */
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
export function splitTeam(name) {
  const m = String(name || '').trim().match(/^(.*?)[\s/]+(I{1,3}|IV|VI{0,3}|IX|[2-9])\.?$/i);
  if (!m || !m[1] || m[1].length < 3) return { base: String(name || '').trim(), nr: 1 };
  const t = m[2].toLowerCase(), nr = ROMAN[t] || Number(t) || 1;
  return { base: m[1].trim(), nr };
}
export const roman = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n] || String(n);

/* Gleiche Vereinfachung wie public.vereine_suchname() in der Datenbank (Migration 015) */
export const simple = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, ' ').trim();
