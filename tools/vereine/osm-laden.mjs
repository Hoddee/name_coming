/* Lädt Fußballvereine aus OpenStreetMap (Overpass API) nach quellen/osm.tsv.
   Aufruf im Repo-Root:  node tools/vereine/osm-laden.mjs   (Node 18+, danach build.mjs)
   Je Bundesland eine Abfrage mit Pause dazwischen – die öffentlichen Overpass-Server sind ein geteiltes Gut.
   Daten: © OpenStreetMap-Mitwirkende, ODbL 1.0 (Namensnennung, abgeleitete Daten unter gleicher Lizenz). */
import { writeFileSync } from 'node:fs';

const OUT = new URL('./quellen/osm.tsv', import.meta.url);
const API = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const UA = 'Kreo-Vereinsliste/1.0 (+https://github.com/Hoddee/name_coming)';
const LAENDER = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const COLS = ['art', 'typ', 'id', 'lat', 'lon', 'name', 'official_name', 'short_name', 'operator', 'ort', 'plz', 'web', 'wikidata', 'land'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const query = land => `[out:json][timeout:300];
area["ISO3166-2"="DE-${land}"]->.a;
(
  nwr["club"="sport"]["sport"~"soccer|multi|football"](area.a);
  nwr["club"="sport"]["name"][!"sport"](area.a);
  nwr["leisure"="sports_centre"]["sport"~"soccer"]["name"](area.a);
  nwr["leisure"="pitch"]["sport"="soccer"]["operator"](area.a);
);
out center tags;`;

async function load(land) {
  for (let i = 1; i <= 5; i++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query(land)) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return (await r.json()).elements || [];
    } catch (e) { console.warn(land, 'Versuch', i, e.message); await sleep(30000 * i); }
  }
  throw new Error('Overpass antwortet nicht für ' + land);
}

const clean = v => String(v || '').replace(/[\t\r\n]+/g, ' ').trim();
const rows = [];
for (const land of LAENDER) {
  const els = await load(land);
  for (const e of els) {
    const t = e.tags || {}, c = e.center || e;
    const art = t.club === 'sport' ? 'club' : t.leisure === 'sports_centre' ? 'centre' : 'pitch';
    rows.push([art, e.type[0], e.id, c.lat, c.lon, t.name, t.official_name, t.short_name, t.operator,
      t['addr:city'] || t['addr:place'] || '', t['addr:postcode'], t.website || t['contact:website'] || t.url, t.wikidata, land].map(clean).join('\t'));
  }
  console.log(land, els.length);
  await sleep(5000);
}
const head = '# OpenStreetMap-Daten, © OpenStreetMap-Mitwirkende, Lizenz ODbL 1.0 (https://www.openstreetmap.org/copyright). Stand ' +
  new Date().toLocaleDateString('de-DE') + '.\n' + COLS.join('\t') + '\n';
writeFileSync(OUT, head + rows.join('\n') + '\n');
console.log('Zeilen:', rows.length);
