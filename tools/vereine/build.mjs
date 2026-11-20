/* Baut die Vereinsliste für die Suche (assets/data/vereine.json) aus den Rohdaten in tools/vereine/quellen/.
   Aufruf im Repo-Root:  node tools/vereine/build.mjs
   Quellen (nur erlaubte, offene Daten):
     - quellen/osm.tsv       OpenStreetMap (ODbL): Vereine (club=sport), Plätze mit Betreiber, Sportanlagen
     - quellen/wikidata.tsv  Wikidata (CC0), optional – wird von wikidata-laden.mjs erzeugt
   fussball.de und FuPa werden bewusst NICHT ausgelesen (Nutzungsbedingungen, Datenbankrecht § 87b UrhG).
   Was fehlt, legen Nutzer in der App an (Tabelle vereine, Migration 015). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { words, norm } from '../../js/core/vsearch.js';

const DIR = new URL('./quellen/', import.meta.url);
const OUT = new URL('../../assets/data/vereine.json', import.meta.url);

function readTsv(name) {
  const f = new URL(name, DIR);
  if (!existsSync(f)) return [];
  const lines = readFileSync(f, 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  const head = lines.shift().split('\t');
  return lines.map(l => { const p = l.split('\t'); return Object.fromEntries(head.map((h, i) => [h, (p[i] || '').trim()])); });
}

/* ---------- Namen säubern ---------- */
const PRE = /^(vereinsheim|vereinshaus|vereinsgeb[äa]ude|sportheim|sportlerheim|sporthaus|clubhaus|clubheim|klubhaus|klubheim|gesch[äa]ftsstelle|festscheune|sportplatz(baude)?|sportanlage|sportgel[äa]nde|umkleide|abteilung fu(ss|ß)ball|fu(ss|ß)ballabteilung|kunstrasen(platz)?|rasenplatz|nachwuchsleistungszentrum|sportb[üu]ro)\b[\s:–-]*(des|der|vom|von)?\s*/i;
const POST = /[\s,–-]*(gesch[äa]ftsstelle|vereinsheim|vereinsgeb[äa]ude|vereinshaus|sportheim|clubhaus|abteilung fu(ss|ß)ball|abt\.? fu(ss|ß)ball|fu(ss|ß)ballabteilung|-? ?fu(ss|ß)ball|sportb[üu]ro|platz \d+)\s*$/i;
const EV = /,?\s*\b(e\.\s?v\.?|ev|e\. v|eingetragener verein)(?=\s|$|,)/gi;
export function clean(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(PRE, '').replace(POST, '').trim();
  t = t.replace(EV, '').replace(/\s*-\s*(rethen|adenbüttel)$/i, '').replace(/[\s,;:–-]+$/, '').replace(/^[\s,;:–-]+/, '').trim();
  /* „VFB“ → „VfB“ usw. */
  t = t.replace(/\bVFB\b/g, 'VfB').replace(/\bVFL\b/g, 'VfL').replace(/\bVFR\b/g, 'VfR').replace(/\bTUS\b/g, 'TuS').replace(/\bSPVGG\b/gi, 'SpVgg').replace(/\bSg\b/g, 'SG');
  return t;
}

/* Sieht der Name nach einem Fußball-/Sportverein aus? */
const CLUBWORD = /\b(1\.\s?)?(fc|sv|tsv|sc|sg|sgm|spvgg|spvg|sp\.? ?vgg|vfb|vfl|vfr|tus|tsg|tsgv|fsv|ssv|sf|spfr|djk|fv|tv|mtv|bsv|esv|psv|sus|ffc|bc|svg|tsc|asv|ksv|fk|gsv|vfv|tura|lsv|hsv|fsg|usv|ftsv|atsv|sge|spg|rsv|tuspo|sk|ac|kickers|eintracht|germania|borussia|viktoria|victoria|concordia|union|alemannia|fortuna|dynamo|lok|lokomotive|motor|stahl|einheit|empor|traktor|hertha|arminia|teutonia|sparta|olympia|preu(ss|ß)en|wacker|rot-wei(ss|ß)|blau-wei(ss|ß)|gr[üu]n-wei(ss|ß)|schwarz-wei(ss|ß)|rot-gr[üu]n|blau-gelb|schwarz-gelb|sportverein|sportvereinigung|sportclub|sport-club|sportfreunde|spielvereinigung|sportgemeinschaft|turnverein|turn- und sport\w*|fu(ss|ß)ball\w*|ballspiel\w*|sportgemeinde|kickers|fussballclub|athletic|united|azzurri|türkspor|turkspor|türkgücü|spor)\b/i;
const NOT = /\b(gemeinde|stadt|schule|schulzentrum|gymnasium|grundschule|realschule|universit|hochschule|kita|kindergarten|bolzplatz|landkreis|kreis\b|kreisverwaltung|bezirk|amt\b|verwaltung|verbandsgemeinde|samtgemeinde|kirche|pfarr|bundeswehr|kaserne|polizei|tennis|schützen|reit|golf|ruder|segel|kanu|kegel|tischfu(ss|ß)ball|tischtennis|schach|hockey|american football|baseball|rugby|handball|volleyball|basketball|turnhalle|soccerhalle|soccer-?arena|fu(ss|ß)ballgolf|freizeit|privat|gmbh|kg\b|ag\b|ug\b|hotel|camping|verband|kreissportbund|landessportbund|sportbund|stadtsportbund|fu(ss|ß)ballkreis|staffel|jugendfeuerwehr|feuerwehr|deutsche bahn|kickerking|monarchs|judo|karate|taekwondo|ju-?jutsu|kampfsport|boxing|box-?club|boxclub|ringer|schwimm|ski-?club|skiclub|radsport|radfahr|billard|dart|bowling|tanz|aero club|modell|angel|squash|badminton|cricket|curling|eissport|eishockey|lacrosse|ultimate|frisbee|footgolf|beach)\b/i;
export const isClub = n => n.length >= 4 && n.length <= 70 && CLUBWORD.test(n) && !NOT.test(n);

/* Entfernung in km (genügt für Duplikate) */
const km = (a, b) => {
  if (!a.lat || !b.lat) return 0;
  const dx = (a.lon - b.lon) * 71.5, dy = (a.lat - b.lat) * 111.2;
  return Math.sqrt(dx * dx + dy * dy);
};

/* ---------- OSM einlesen ---------- */
const QUAL = { club: 3, centre: 2, pitch: 1, wd: 4 };
function fromOsm(r) {
  const cand = [];
  if (r.art === 'pitch') cand.push(r.operator, r.name);
  else cand.push(r.name, r.short_name && r.name && r.name.length > 40 ? r.short_name : '', r.official_name, r.operator);
  for (const c of cand) {
    const n = clean(c);
    if (n && isClub(n)) return { id: 'o' + r.typ + r.id, name: n, ort: r.ort, plz: r.plz, land: r.land, lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: r.wikidata, q: QUAL[r.art] };
  }
  return null;
}
function fromWikidata(r) {
  const n = clean(r.name);
  if (!n || !isClub(n) && !/^[A-ZÄÖÜ]/.test(n)) return null;
  return { id: 'q' + r.id.replace(/^Q/, ''), name: n, ort: r.ort, plz: '', land: r.land || '', lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: r.id, q: QUAL.wd };
}

const raw = [...readTsv('osm.tsv').map(fromOsm), ...readTsv('wikidata.tsv').map(fromWikidata)].filter(Boolean);

/* Bundesland für Einträge ohne Angabe: Mehrheit der 5 nächsten Einträge mit Angabe */
const withLand = raw.filter(x => x.land && x.lat);
for (const x of raw) {
  if (x.land || !x.lat) continue;
  const near = withLand.map(y => [km(x, y), y.land]).sort((a, b) => a[0] - b[0]).slice(0, 5);
  const cnt = {};
  for (const [, l] of near) cnt[l] = (cnt[l] || 0) + 1;
  x.land = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
}

/* ---------- Doppelte zusammenführen ---------- */
const key = x => words(x.name).join(' ');
const groups = new Map();
for (const x of raw.sort((a, b) => b.q - a.q || (b.web ? 1 : 0) - (a.web ? 1 : 0) || (b.ort ? 1 : 0) - (a.ort ? 1 : 0))) {
  const k = key(x);
  if (!k) continue;
  const list = groups.get(k) || [];
  /* Gleicher Name im Umkreis von 15 km (oder gleiche Wikidata-ID) = derselbe Verein */
  const same = list.find(y => (x.wd && y.wd && x.wd === y.wd) || km(x, y) < 15);
  if (same) {
    for (const f of ['ort', 'plz', 'web', 'wd', 'land']) if (!same[f] && x[f]) same[f] = x[f];
    if (!same.lat && x.lat) { same.lat = x.lat; same.lon = x.lon; }
    continue;
  }
  list.push(x); groups.set(k, list);
}
/* Gleiche Wikidata-ID unter verschiedenen Namen: den OSM-Namen behalten */
const out = [], seenWd = new Set();
for (const list of groups.values()) for (const x of list) {
  if (x.wd) { if (seenWd.has(x.wd)) continue; seenWd.add(x.wd); }
  out.push(x);
}
out.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

const r2 = v => Math.round(v * 100) / 100;
const shortWeb = w => (w || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').slice(0, 60);
const data = {
  v: 1,
  stand: new Date().toISOString().slice(0, 10),
  quelle: '© OpenStreetMap-Mitwirkende (ODbL 1.0)' + (existsSync(new URL('wikidata.tsv', DIR)) ? ', Wikidata (CC0)' : ''),
  /* [id, Name, Ort, Bundesland, lat, lon, Webseite] */
  c: out.map(x => [x.id, x.name, x.ort || '', x.land || '', r2(x.lat), r2(x.lon), shortWeb(x.web)])
};
writeFileSync(OUT, JSON.stringify(data).replace(/\],\[/g, '],\n['));
const per = {};
for (const x of out) per[x.land || '?'] = (per[x.land || '?'] || 0) + 1;
console.log('Vereine:', out.length, 'aus', raw.length, 'Rohtreffern');
console.log('Je Bundesland:', Object.entries(per).sort().map(([k, v]) => k + ' ' + v).join(', '));
