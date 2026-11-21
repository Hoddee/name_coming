/* Wappen (Vereinslogos) aus Wikimedia Commons und der deutschsprachigen Wikipedia – nur Dateien, die dort frei nutzbar liegen
   (freie Lizenz oder „Schöpfungshöhe nicht erreicht“ / gemeinfrei). Die Wikipedia nimmt keine unfreien Logos an.
   Ablauf: 1. Logos aus Wikidata (P154, steht schon in quellen/wikidata.tsv)
           2. Vereine aus der Kategorie „Fußballverein aus Deutschland“ (mit Unterkategorien) – Infobox: Logo, Liga, Ort
           3. Lizenz + Urheber je Datei (für die Namensnennung), Vorschaubild 250 px laden
   Aufruf im Repo-Root:  node tools/vereine/wappen-laden.mjs   (danach python3 tools/vereine/wappen-bilder.py, dann build.mjs)
   Ergebnis: quellen/wappen.tsv (Q-ID, Datei, Lizenz, Urheber, Seite), quellen/dewiki.tsv (Vereine aus der Wikipedia),
             tools/vereine/roh/<Q>.png (nicht im Repo) */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const UA = 'Kreo-Vereinsliste/1.1 (+https://github.com/Hoddee/name_coming)';
const DIR = new URL('./quellen/', import.meta.url), RAW = new URL('./roh/', import.meta.url);
mkdirSync(RAW, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(params, host = 'de.wikipedia.org') {
  const u = 'https://' + host + '/w/api.php?' + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      if (r.ok) { const j = await r.json(); if (!j.error) return j; console.log('API-Fehler', j.error.code); }
      else console.log('HTTP', r.status);
    } catch (e) { console.log('Netz', e.message); }
    await sleep(3000 * (i + 1));
  }
  throw new Error('Wikipedia-API nicht erreichbar');
}
const readTsv = name => {
  const lines = readFileSync(new URL(name, DIR), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  const head = lines.shift().split('\t');
  return lines.map(l => { const p = l.split('\t'); return Object.fromEntries(head.map((h, i) => [h, (p[i] || '').trim()])); });
};
const tsv = v => String(v || '').replace(/[\t\r\n]+/g, ' ').trim();

/* ---------- 1. Wikidata ---------- */
const wd = readTsv('wikidata.tsv');
const logos = new Map(); // Q → Datei
for (const r of wd) if (r.logo) logos.set(r.id, r.logo);
const byArticle = new Map(wd.filter(r => r.dewiki).map(r => [r.dewiki, r]));
console.log('Wikidata:', wd.length, 'Vereine,', logos.size, 'mit Logo');

/* ---------- 2. Wikipedia-Kategorien ---------- */
/* Einstieg: alle Kategorien „Fußballverein aus …“ (Bundesländer, Landkreise) und „Verein im … Fußball…verband“ (Mitglieder je Landesverband) */
async function allCats(prefix) {
  const out = [];
  let cont = {};
  do {
    const j = await api({ action: 'query', list: 'allcategories', acprefix: prefix, aclimit: '500', ...cont });
    for (const c of j.query.allcategories) out.push('Kategorie:' + (c.category || c['*']));
    cont = j.continue || null;
  } while (cont);
  return out;
}
const SKIP = /(ehemalig|frauenfußball|fußballspieler|fußballtrainer|funktionär|person|stadion|saison|wettbewerb|pokal|fanclub|sportler|nationalmannschaft|liste)/i;
const roots = [...(await allCats('Fußballverein aus ')), ...(await allCats('Verein im '))].filter(c => !SKIP.test(c) && (/Fußballverein aus /.test(c) || /Fußball/.test(c)));
console.log('Einstiegskategorien:', roots.length, roots.slice(0, 8).join(' | '));
/* Verband je Kategorie „Verein im …“ (Kürzel wie in js/data/verbaende.js) */
const VB = [[/Württembergischen/, 'WFV'], [/Südbadischen/, 'SBFV'], [/Badischen/, 'BADFV'], [/Bayerischen/, 'BAYFV'], [/Berliner/, 'BERFV'], [/Brandenburg/, 'FLB'],
  [/Bremer/, 'BREFV'], [/Hamburger/, 'HAMFV'], [/Hessischen/, 'HESFV'], [/Mecklenburg/, 'LFVMV'], [/Niedersächsischen/, 'NFV'], [/Mittelrhein/, 'FVM'], [/Niederrhein/, 'FVN'],
  [/Westfalen/, 'FLVW'], [/Rheinland/, 'FVR'], [/Südwestdeutschen/, 'SWFV'], [/Saarländischen/, 'SAARFV'], [/Sächsischen/, 'SAXFV'], [/Sachsen-Anhalt/, 'FSA'],
  [/Schleswig-Holsteinischen/, 'SHFV'], [/Thüringer/, 'TFV']];
const vbOf = c => { if (!/^Kategorie:Verein im /.test(c)) return ''; const m = VB.find(([re]) => re.test(c)); return m ? m[1] : ''; };
const cats = [...roots], seenCat = new Set(cats), pages = new Set(), pageVb = new Map();
for (let i = 0; i < cats.length && i < 3000; i++) {
  let cont = {};
  const vb = vbOf(cats[i]);
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: cats[i], cmlimit: '500', cmtype: 'page|subcat', ...cont });
    for (const m of j.query.categorymembers) {
      if (m.ns === 14) { if (!seenCat.has(m.title) && !SKIP.test(m.title)) { seenCat.add(m.title); cats.push(m.title); } }
      else if (m.ns === 0) { pages.add(m.title); if (vb) pageVb.set(m.title, vb); }
    }
    cont = j.continue || null;
  } while (cont);
}
console.log('Kategorien:', cats.length, 'Artikel:', pages.size);

/* Infobox lesen: Logo, Liga, Ort, Farben; dazu Wikidata-ID und Koordinaten */
const PARAM = (txt, names) => {
  for (const n of names) {
    const m = new RegExp('\\|\\s*' + n + '\\s*=\\s*([^\\n|]*(?:\\[\\[[^\\]]*\\]\\][^\\n|]*)*)', 'i').exec(txt);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
};
const plain = s => String(s || '').replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/\{\{[^{}]*\}\}/g, '').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const fileOf = s => {
  const t = String(s || '').replace(/^\[\[/, '').replace(/^(Datei|File|Bild|Image):/i, '').split('|')[0].replace(/\]\]$/, '').trim();
  return /\.(svg|png|jpe?g|gif|webp)$/i.test(t) ? t.replace(/_/g, ' ') : '';
};
const list = [...pages];
const dewiki = [];
for (let i = 0; i < list.length; i += 50) {
  const chunk = list.slice(i, i + 50);
  const j = await api({ action: 'query', prop: 'revisions|pageprops|coordinates', rvprop: 'content', rvslots: 'main', ppprop: 'wikibase_item', titles: chunk.join('|'), redirects: '1' });
  for (const p of j.query.pages || []) {
    const q = p.pageprops && p.pageprops.wikibase_item;
    const txt = p.revisions && p.revisions[0] && p.revisions[0].slots.main.content || '';
    const ib = txt.search(/\{\{\s*Infobox (Fußballverein|Fußballklub|Verein|Sportverein)/i);
    if (!q || (ib < 0 && !pageVb.has(p.title))) continue;
    const box = ib < 0 ? '' : txt.slice(ib, ib + 6000);
    const logo = fileOf(PARAM(box, ['Bild', 'Logo', 'Vereinslogo', 'Wappen']));
    const liga = plain(PARAM(box, ['Liga']));
    const saison = plain(PARAM(box, ['Saison']));
    const ort = plain(PARAM(box, ['Ort', 'Sitz']));
    const farben = plain(PARAM(box, ['Vereinsfarben', 'Farben']));
    const c = p.coordinates && p.coordinates[0];
    if (logo && !logos.has(q) && !/stadion|arena|sportpark|sportplatz|mannschaft|team|spieler|luftbild|tribüne/i.test(logo)) logos.set(q, logo);
    dewiki.push([q, p.title.replace(/\s*\([^)]*\)$/, ''), ort, c ? c.lat : '', c ? c.lon : '', logo, liga, saison, farben, p.title, pageVb.get(p.title) || ''].map(tsv).join('\t'));
  }
  if (i % 1000 === 0) console.log('Artikel gelesen:', i, '/', list.length);
}
writeFileSync(new URL('dewiki.tsv', DIR), '# Wikipedia (deutsch), Infobox-Angaben (Fakten), Stand ' + new Date().toLocaleDateString('de-DE') + '.\nid\tname\tort\tlat\tlon\tlogo\tliga\tsaison\tfarben\tartikel\tverband\n' + dewiki.join('\n') + '\n');
console.log('Wikipedia-Vereine mit Infobox:', dewiki.length, '– Logos gesamt:', logos.size);

/* ---------- 3. Lizenz, Urheber, Vorschaubild ---------- */
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 160);
const files = [...new Set(logos.values())];
const info = new Map();
for (let i = 0; i < files.length; i += 50) {
  const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '250', iiextmetadatafilter: 'LicenseShortName|Artist|UsageTerms|Credit', iiextmetadatalanguage: 'de', titles: files.slice(i, i + 50).map(f => 'Datei:' + f).join('|') });
  const norm = new Map((j.query.normalized || []).map(n => [n.to, n.from]));
  for (const p of j.query.pages || []) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) continue;
    const m = ii.extmetadata || {}, v = k => (m[k] && m[k].value) || '';
    const name = (norm.get(p.title) || p.title).replace(/^(Datei|File):/, '');
    info.set(name.replace(/_/g, ' '), { lic: strip(v('LicenseShortName') || v('UsageTerms')) || 'frei', by: strip(v('Artist') || v('Credit')), url: ii.thumburl || ii.url, page: ii.descriptionurl, local: !/commons/.test(ii.descriptionurl || '') });
  }
}
const out = [];
let got = 0, fail = 0;
for (const [q, f] of logos) {
  const x = info.get(f);
  if (!x || !x.url) continue;
  /* Unfreie Dateien gibt es in der deutschen Wikipedia nicht; zur Sicherheit trotzdem ausschließen */
  if (/fair use|non-free|unfrei/i.test(x.lic)) continue;
  const file = new URL(q + '.png', RAW);
  if (!existsSync(file)) {
    try {
      const r = await fetch(x.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) { fail++; if (r.status === 429) await sleep(20000); continue; }
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      got++;
      await sleep(120);
    } catch (e) { fail++; continue; }
  }
  out.push([q, f, x.lic, x.by, x.page].map(tsv).join('\t'));
}
writeFileSync(new URL('wappen.tsv', DIR), '# Vereinslogos aus Wikimedia Commons / Wikipedia (deutsch) mit Lizenz und Urheber. Stand ' + new Date().toLocaleDateString('de-DE') + '.\nid\tdatei\tlizenz\turheber\tseite\n' + out.join('\n') + '\n');
console.log('Wappen:', out.length, 'geladen neu:', got, 'Fehler:', fail);
