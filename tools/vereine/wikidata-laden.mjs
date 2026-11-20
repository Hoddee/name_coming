/* Lädt deutsche Fußballvereine aus Wikidata (CC0) nach quellen/wikidata.tsv.
   Aufruf im Repo-Root:  node tools/vereine/wikidata-laden.mjs   (Node 18+, danach build.mjs)
   Wikidata verlangt bei automatischen Abfragen einen aussagekräftigen User-Agent mit Kontakt (hier: das Repo). */
import { writeFileSync } from 'node:fs';

const OUT = new URL('./quellen/wikidata.tsv', import.meta.url);
const UA = 'Kreo-Vereinsliste/1.0 (+https://github.com/Hoddee/name_coming)';
/* Fußballverein (Q476028) mit Land Deutschland; Ort, Koordinaten, Webseite wenn vorhanden */
const SPARQL = `SELECT ?item ?itemLabel ?ortLabel ?coord ?web WHERE {
  ?item wdt:P31 wd:Q476028; wdt:P17 wd:Q183.
  OPTIONAL { ?item wdt:P131 ?ort. }
  OPTIONAL { ?item wdt:P625 ?coord. }
  OPTIONAL { ?item wdt:P856 ?web. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;

const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(SPARQL), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
if (!r.ok) throw new Error('Wikidata: HTTP ' + r.status);
const seen = new Set(), rows = [];
const clean = v => String(v || '').replace(/[\t\r\n]+/g, ' ').trim();
for (const b of (await r.json()).results.bindings) {
  const id = b.item.value.split('/').pop(), name = b.itemLabel && b.itemLabel.value;
  if (seen.has(id) || !name || /^Q\d+$/.test(name)) continue;
  seen.add(id);
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord ? b.coord.value : '');
  rows.push([id, name, b.ortLabel && b.ortLabel.value, '', m ? m[2] : '', m ? m[1] : '', b.web && b.web.value].map(clean).join('\t'));
}
writeFileSync(OUT, '# Wikidata (CC0 1.0), Stand ' + new Date().toLocaleDateString('de-DE') + '.\nid\tname\tort\tland\tlat\tlon\tweb\n' + rows.join('\n') + '\n');
console.log('Vereine:', rows.length);
