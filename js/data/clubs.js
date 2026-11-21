/* Vereine der Kreisliga A2, B2 und B5 (Rems/Murr/Hall). In der B5 nutzen die Teams das Wappen des Stammvereins. Wappen liegen im Repo bzw. im Supabase-Storage. */
import { STORAGE_BASE } from '../config.js';

const FA = 'Wappen_KreisligaA2_Rems__Murr__Hall/';
const FB = 'Wappen_KreisligaB2_Rems__Murr__Hall/';

export const CLUB_LIST = [
  { id: 'vfr', n: 'VfR Murrhardt', lg: 'A2', f: FA + 'VfR_Murrhardt.png' },
  { id: 'allm2', n: 'Allmersbach II', lg: 'A2', f: FA + 'Allmersbach_II.png' },
  { id: 'weiler', n: 'FSV Weiler', lg: 'A2', f: FA + 'FSV_Weiler.png' },
  { id: 'sulzm', n: 'FV Sulzbach/Murr', lg: 'A2', f: FA + 'FV_SulzbachMurr.png' },
  { id: 'alex', n: 'Großer Alexander', lg: 'A2', f: FA + 'Grosser_Alexander.png' },
  { id: 'klein', n: 'Kleinaspach', lg: 'A2', f: FA + 'Kleinaspach.png' },
  { id: 'oppen2', n: 'Oppenweiler II', lg: 'A2', f: FA + 'Oppenweiler_II.png' },
  { id: 'ruder', n: 'Rudersberg', lg: 'A2', f: FA + 'Rudersberg.png' },
  { id: 'erbA', n: 'SGM Erbstetten/ TSG Backnang II', lg: 'A2', f: FA + 'SGM_Erbstetten__TSG_Backnang_II.png' },
  { id: 'sulzl', n: 'SGM Sulzbach-Laufen/ Gschwend', lg: 'A2', f: FA + 'SGM_Sulzbach_Laufen__Gschwend.png' },
  { id: 'sk_fichtenberg', n: 'SK Fichtenberg', lg: 'A2', f: FA + 'SK_Fichtenberg.png' },
  { id: 'spiegel', n: 'SV Spiegelberg', lg: 'A2', f: FA + 'SV_Spiegelberg.png' },
  { id: 'stein2', n: 'SV Steinbach II', lg: 'A2', f: FA + 'SV_Steinbach_II.png' },
  { id: 'tsc', n: 'TSC Murrhardt', lg: 'A2', f: FA + 'TSC_Murrhardt.png' },
  { id: 'unter2', n: 'Unterweissach II', lg: 'A2', f: FA + 'Unterweissach_II.png' },
  { id: 'vfrk', n: 'VfR Murrhardt/ Kirchenkirnberg II', lg: 'B2', f: FB + 'VfR Murrhardt__Kirchenkirnberg II.png' },
  { id: 'fornsbach', n: 'SC Fornsbach', lg: 'B2', f: FB + 'SC_Fornsbach.png' },
  { id: 'winn', n: 'FC Winnenden', lg: 'B2', f: FB + 'FC Winnenden.png' },
  { id: 'grosser', n: 'SF Großerlach', lg: 'B2', f: FB + 'SF_Grosserlach.png' },
  { id: 'erbB', n: 'SGM Erbstetten II/ TSG Backnang III', lg: 'B2', f: FB + 'SGM Erbstetten II__TSG Backnang III II.png' },
  { id: 'aspach', n: 'SGM Aspach', lg: 'B2', f: FB + 'SGM_Aspach.png' },
  { id: 'allm3', n: 'SV Allmersbach III', lg: 'B2', f: FB + 'SV_Allmersbach_III.png' },
  { id: 'kirchberg', n: 'SVG Kirchberg', lg: 'B2', f: FB + 'SVG_Kirchberg.png' },
  { id: 'althuette', n: 'TSV Althütte', lg: 'B2', f: FB + 'TSV_Althuette.png' },
  { id: 'leuten', n: 'TSV Leutenbach', lg: 'B2', f: FB + 'TSV_Leutenbach.png' },
  { id: 'lippold', n: 'TSV Lippoldsweiler', lg: 'B2', f: FB + 'TSV_Lippoldsweiler.png' },
  { id: 'oberbr', n: 'TSV Oberbrüden', lg: 'B2', f: FB + 'TSV_Oberbrueden.png' },
  { id: 'ruder2', n: 'TSV Rudersberg II', lg: 'B2', f: FB + 'TSV_Rudersberg_II.png' },
  { id: 'tuerk', n: 'Türkspor Schorndorf', lg: 'B2', f: FB + 'Tuerkspor_Schorndorf.png' },
  { id: 'sgm5', n: 'SGM Fornsbach II', lg: 'B5', f: FB + 'SC_Fornsbach.png' },
  { id: 'oberbr2', n: 'TSV Oberbrüden II', lg: 'B5', f: FB + 'TSV_Oberbrueden.png' },
  { id: 'klein2', n: 'Kleinaspach/ Allmersbach II', lg: 'B5', f: FA + 'Kleinaspach.png' },
  { id: 'kirchberg2', n: 'SVG Kirchberg II', lg: 'B5', f: FB + 'SVG_Kirchberg.png' },
  { id: 'spiegel2', n: 'SV Spiegelberg II', lg: 'B5', f: FA + 'SV_Spiegelberg.png' },
  { id: 'sulzm2', n: 'FV Sulzbach/Murr II', lg: 'B5', f: FA + 'FV_SulzbachMurr.png' },
  { id: 'alex2', n: 'Großer Alexander II', lg: 'B5', f: FA + 'Grosser_Alexander.png' },
  { id: 'leuten2', n: 'SGM Leutenbach II/ Weiler II', lg: 'B5', f: FB + 'TSV_Leutenbach.png' },
  { id: 'oppen3', n: 'Oppenweiler III', lg: 'B5', f: FA + 'Oppenweiler_II.png' },
  { id: 'sulzl2', n: 'SGM Sulzbach-Laufen/ Gschwend II', lg: 'B5', f: FA + 'SGM_Sulzbach_Laufen__Gschwend.png' },
  { id: 'fichten2', n: 'SK Fichtenberg II', lg: 'B5', f: FA + 'SK_Fichtenberg.png' },
  { id: 'tuerk2', n: 'Türkspor Schorndorf II', lg: 'B5', f: FB + 'Tuerkspor_Schorndorf.png' }
];
export const LEAGUES = ['A2', 'B2', 'B5'];

/* Eigene Gegner (z. B. Pokal) haben die ID "x:Name" und gelten nur für ein Spiel.
   CL liefert für solche IDs automatisch einen Eintrag ohne Liga mit generiertem Wappen. */
export const CUSTOM_PREFIX = 'x:';
export const isCustomClub = id => typeof id === 'string' && id.startsWith(CUSTOM_PREFIX);
export const customClubId = name => CUSTOM_PREFIX + name.trim().replace(/\s+/g, ' ').slice(0, 30);
const clubBase = Object.fromEntries(CLUB_LIST.map(c => [c.id, c]));
export const CL = new Proxy(clubBase, {
  get(t, k) {
    if (typeof k === 'string' && !(k in t) && isCustomClub(k) && k.length > 2) t[k] = { id: k, n: k.slice(2), lg: null, custom: true };
    return t[k];
  }
});

/* Vereine, aus denen Spieler gebucht werden (Reihenfolge in der Auswahl) */
export const OWN_CLUBS = ['vfr', 'vfrk', 'fornsbach', 'sgm5'];

export function storageUrl(path) {
  return STORAGE_BASE + path.split('/').map(encodeURIComponent).join('/');
}
/* Generiertes Wappen für Vereine ohne freies Logo: Schild in den Vereinsfarben (wenn bekannt, sonst aus dem Namen),
   Kürzel aus dem Ortsteil des Namens, Form und Muster je Verein fest (gleicher Name = gleiches Wappen). */
const SKIP_W = /^(\d+\.?|e|v|ev|fc|sv|tsv|sc|sg|sgm|fsv|vfr|vfb|vfl|tsg|sf|svg|fv|tsc|sk|tus|djk|spvgg|ssv|asv|tv|mtv|bsv|esv|psv|sus|fsg|ksv|rsv|usv|lsv|hsv|1)$/i;
export function initials(name) {
  const w = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(x => x && !/^\d+$/.test(x) && !SKIP_W.test(x));
  const a = w[0] || String(name).replace(/[^\p{L}]/gu, '') || '?';
  return (a[0] + (w[1] ? w[1][0] : a.slice(1, 2))).toUpperCase();
}
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const HEX = /^#[0-9a-f]{6}$/i;
const lum = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
const SHIELDS = [
  'M50 4l40 12v30c0 26-17 42-40 50C27 88 10 72 10 46V16z',
  'M12 8h76v40c0 24-18 38-38 46C30 86 12 72 12 48z',
  'M50 4c14 6 26 8 40 8v34c0 26-17 42-40 50C27 88 10 72 10 46V12c14 0 26-2 40-8z',
  'M10 10h80v30c0 30-20 46-40 54C30 86 10 70 10 40z'
];
const crestCache = new Map();
export function generatedCrest(name, colors = null) {
  const cols = (Array.isArray(colors) ? colors : []).filter(c => HEX.test(c));
  const key = name + '|' + cols.join(',');
  if (!crestCache.has(key)) {
    const h = hash(name), hue = h % 360;
    let a = cols[0] || 'hsl(' + hue + ',58%,36%)', b = cols[1] || (cols[0] ? (lum(cols[0]) > 0.6 ? '#1b2340' : '#ffffff') : 'hsl(' + ((hue + 40) % 360) + ',40%,92%)');
    /* Weiß als erste Farbe: Hauptfläche dunkel lassen, damit das Kürzel lesbar bleibt */
    if (HEX.test(a) && lum(a) > 0.8 && cols[1]) [a, b] = [b, a];
    const ink = HEX.test(a) && lum(a) > 0.62 ? '#10131f' : '#ffffff';
    const shape = SHIELDS[h % SHIELDS.length], pat = (h >> 3) % 4;
    const deco = pat === 0 ? '<path d="M0 0h50v100H0z" fill="' + b + '" opacity=".9"/>'
      : pat === 1 ? '<path d="M0 0h100v26H0z" fill="' + b + '"/>'
      : pat === 2 ? '<path d="M0 100L100 0v34L34 100z" fill="' + b + '" opacity=".85"/>'
      : '<path d="M38 0h24v100H38z" fill="' + b + '" opacity=".9"/>';
    const txt = initials(name).replace(/[<&>]/g, '');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="s"><path d="' + shape + '"/></clipPath></defs>' +
      '<g clip-path="url(#s)"><path d="M0 0h100v100H0z" fill="' + a + '"/>' + deco + '</g>' +
      '<path d="' + shape + '" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="4"/>' +
      '<circle cx="50" cy="52" r="23" fill="' + a + '" stroke="' + b + '" stroke-width="3"/>' +
      '<text x="50" y="61" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="' + (txt.length > 1 ? 24 : 28) + '" fill="' + ink + '">' + txt + '</text></svg>';
    crestCache.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  return crestCache.get(key);
}
/* Verein aus der Vereinssuche bzw. Mannschaft eines gesuchten Spielers als Eintrag in CL (keine Liga).
   img = echtes Wappen (assets/img/w/…), sonst generiert. */
const OK_IMG = /^(assets\/img\/w\/Q\d{1,12}\.webp|assets\/img\/c\/[a-zA-Z0-9_]{2,30}\.webp|https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[A-Za-z0-9_./%-]+)$/;
export const okCrest = v => (typeof v === 'string' && OK_IMG.test(v) ? v : '');
export function registerClub(id, name, img = '', colors = null) {
  if (!id) return null;
  const c = clubBase[id];
  if (c && !c.ext) return c;
  const n = String(name || '').slice(0, 60) || (c && c.n) || 'Verein';
  const real = okCrest(img) || (c && c.real) || '';
  clubBase[id] = { id, n, lg: null, ext: true, real, img: real || generatedCrest(n, colors) };
  return clubBase[id];
}
export function crestUrl(clubId) {
  const c = CL[clubId];
  if (!c) return generatedCrest('?');
  if (c.img) return c.img;
  if (!c.custom) return 'assets/img/c/' + c.id + '.webp'; // verkleinert im Repo (GitHub Pages)
  return c.f ? storageUrl(c.f) : generatedCrest(c.n);
}
