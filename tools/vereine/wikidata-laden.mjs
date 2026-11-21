/* Lädt deutsche Fußballvereine aus Wikidata (CC0) nach quellen/wikidata.tsv – mit Logo-Datei, Liga, Vereinsfarben, Gründung.
   Aufruf im Repo-Root:  node tools/vereine/wikidata-laden.mjs   (Node 18+, danach wappen-laden.mjs und build.mjs)
   Wikidata verlangt bei automatischen Abfragen einen aussagekräftigen User-Agent mit Kontakt (hier: das Repo).
   Zwei Abfragen: Fußballvereine (Q476028 und Unterklassen) und Sportvereine mit Sportart Fußball. */
import { writeFileSync } from 'node:fs';

const OUT = new URL('./quellen/wikidata.tsv', import.meta.url);
const UA = 'Kreo-Vereinsliste/1.1 (+https://github.com/Hoddee/name_coming)';
const body = cls => `SELECT ?item (SAMPLE(?l) AS ?name) (SAMPLE(?ortL) AS ?ort) (SAMPLE(?c) AS ?coord) (SAMPLE(?c2) AS ?coord2) (SAMPLE(?c3) AS ?coord3)
  (SAMPLE(?w) AS ?web) (SAMPLE(?logo) AS ?logo) (GROUP_CONCAT(DISTINCT ?ligaL; separator="|") AS ?liga)
  (GROUP_CONCAT(DISTINCT ?farbe; separator="|") AS ?farben) (SAMPLE(?art) AS ?dewiki) (SAMPLE(?inc) AS ?gruendung) WHERE {
  ${cls}
  ?item wdt:P17 wd:Q183.
  FILTER NOT EXISTS { ?item wdt:P576 ?aufgeloest. }
  OPTIONAL { ?item rdfs:label ?l. FILTER(LANG(?l) = "de") }
  OPTIONAL { ?item wdt:P131 ?o. ?o rdfs:label ?ortL. FILTER(LANG(?ortL) = "de") OPTIONAL { ?o wdt:P625 ?c3. } }
  OPTIONAL { ?item wdt:P625 ?c. }
  OPTIONAL { ?item wdt:P115/wdt:P625 ?c2. }
  OPTIONAL { ?item wdt:P856 ?w. }
  OPTIONAL { ?item wdt:P154 ?logo. }
  OPTIONAL { ?item p:P118 ?st. ?st ps:P118 ?lg. FILTER NOT EXISTS { ?st pq:P582 ?ende. } ?lg rdfs:label ?ligaL. FILTER(LANG(?ligaL) = "de") }
  OPTIONAL { ?item wdt:P6364 ?fa. OPTIONAL { ?fa wdt:P465 ?farbe. } }
  OPTIONAL { ?art schema:about ?item; schema:isPartOf <https://de.wikipedia.org/>. }
  OPTIONAL { ?item wdt:P571 ?inc. }
} GROUP BY ?item`;
const QUERIES = [
  body('?item wdt:P31/wdt:P279* wd:Q476028.'),
  body('?item wdt:P31/wdt:P279* wd:Q847017; wdt:P641 wd:Q2736.')
];

async function sparql(q) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
    if (r.ok) return (await r.json()).results.bindings;
    console.log('Wikidata HTTP', r.status, '– neuer Versuch');
    await new Promise(res => setTimeout(res, 15000 * (i + 1)));
  }
  throw new Error('Wikidata nicht erreichbar');
}

const seen = new Map();
const clean = v => String(v || '').replace(/[\t\r\n]+/g, ' ').trim();
const pt = v => { const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(v || ''); return m ? [m[2], m[1]] : null; };
for (const q of QUERIES) {
  const rows = await sparql(q);
  console.log('Treffer:', rows.length);
  for (const b of rows) {
    const id = b.item.value.split('/').pop(), name = b.name && b.name.value;
    if (seen.has(id) || !name || /^Q\d+$/.test(name)) continue;
    /* Koordinaten: Verein, sonst Stadion, sonst Ort */
    const c = pt(b.coord && b.coord.value) || pt(b.coord2 && b.coord2.value) || pt(b.coord3 && b.coord3.value) || ['', ''];
    const logo = b.logo ? decodeURIComponent(b.logo.value.split('/').pop()).replace(/_/g, ' ') : '';
    const dewiki = b.dewiki ? decodeURIComponent(b.dewiki.value.split('/wiki/').pop()).replace(/_/g, ' ') : '';
    seen.set(id, [id, name, b.ort && b.ort.value, '', c[0], c[1], b.web && b.web.value, logo, b.liga && b.liga.value,
      b.farben && b.farben.value, dewiki, b.gruendung ? b.gruendung.value.slice(0, 4) : ''].map(clean).join('\t'));
  }
}
writeFileSync(OUT, '# Wikidata (CC0 1.0), Stand ' + new Date().toLocaleDateString('de-DE') + '.\nid\tname\tort\tland\tlat\tlon\tweb\tlogo\tliga\tfarben\tdewiki\tgruendung\n' + [...seen.values()].join('\n') + '\n');
console.log('Vereine:', seen.size);
