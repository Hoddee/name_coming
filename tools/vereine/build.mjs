/* Baut die Vereinsliste für die Suche (assets/data/vereine.json) aus den Rohdaten in tools/vereine/quellen/.
   Aufruf im Repo-Root:  node tools/vereine/build.mjs [--kuerzen]
   Quellen (nur erlaubte, offene Daten):
     - quellen/osm.tsv       OpenStreetMap (ODbL): Vereine (club=sport), Plätze mit Betreiber, Sportanlagen
     - quellen/wikidata.tsv  Wikidata (CC0), optional – wird von wikidata-laden.mjs erzeugt
     - quellen/overture.tsv  Overture Maps Places (CDLA Permissive 2.0), optional – overture-laden.py
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
const PRE = /^(sports complex|kunstrasenhalle|soccerhalle|sportzentrum|sportpark|damenmannschaft|frauenmannschaft|herrenmannschaft|jugendabteilung|fu(ss|ß)ballabteilung|fu(ss|ß)ballplatz|vereinsheim|vereinshaus|vereinsgeb[äa]ude|sportheim|sportlerheim|sporthaus|clubhaus|clubheim|klubhaus|klubheim|gesch[äa]ftsstelle|festscheune|sportplatz(baude)?|sportanlage|sportgel[äa]nde|umkleide|abteilung fu(ss|ß)ball|fu(ss|ß)ballabteilung|kunstrasen(platz)?|rasenplatz|nachwuchsleistungszentrum|sportb[üu]ro)\b[\s:–-]*(des|der|vom|von)?\s*/i;
const TEAM = /[\s,–-]+(ii|iii|iv|2\.? mannschaft|u ?1\d|u ?2[0-3]|juniorteam|junioren|jugend|frauen|damen|leichtathletik|esports|e-sports)\s*$/i;
const POST = /[\s,–-]*(gesch[äa]ftsstelle|vereinsheim|vereinsgeb[äa]ude|vereinshaus|sportheim|clubhaus|abteilung fu(ss|ß)ball|abt\.? fu(ss|ß)ball|fu(ss|ß)ballabteilung|-? ?fu(ss|ß)ball|sportb[üu]ro|platz \d+)\s*$/i;
const EV = /,?\s*\b(e\.\s?v\.?|ev|e\. v|eingetragener verein)(?=\s|$|,)/gi;
export function clean(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(PRE, '').replace(POST, '').replace(TEAM, '').trim();
  t = t.replace(EV, '').replace(/\s*-\s*(rethen|adenbüttel)$/i, '').replace(/[\s,;:–-]+$/, '').replace(/^[\s,;:–-]+/, '').trim();
  /* „VFB“ → „VfB“ usw. */
  t = t.replace(/\bVFB\b/g, 'VfB').replace(/\bVFL\b/g, 'VfL').replace(/\bVFR\b/g, 'VfR').replace(/\bTUS\b/g, 'TuS').replace(/\bSPVGG\b/gi, 'SpVgg').replace(/\bSg\b/g, 'SG');
  return t;
}

/* Sieht der Name nach einem Fußball-/Sportverein aus? */
const CLUBWORD = /\b(1\.\s?)?(fc|sv|tsv|sc|sg|sgm|spvgg|spvg|sp\.? ?vgg|vfb|vfl|vfr|tus|tsg|tsgv|fsv|ssv|sf|spfr|djk|fv|tv|mtv|bsv|esv|psv|sus|ffc|bc|svg|tsc|asv|ksv|fk|gsv|vfv|tura|lsv|hsv|fsg|usv|ftsv|atsv|sge|spg|rsv|tuspo|sk|ac|kickers|eintracht|germania|borussia|viktoria|victoria|concordia|union|alemannia|fortuna|dynamo|lok|lokomotive|motor|stahl|einheit|empor|traktor|hertha|arminia|teutonia|sparta|olympia|preu(ss|ß)en|wacker|rot-wei(ss|ß)|blau-wei(ss|ß)|gr[üu]n-wei(ss|ß)|schwarz-wei(ss|ß)|rot-gr[üu]n|blau-gelb|schwarz-gelb|sportverein|sportvereinigung|sportclub|sport-club|sportfreunde|spielvereinigung|sportgemeinschaft|turnverein|turn- und sport\w*|fu(ss|ß)ball\w*|ballspiel\w*|sportgemeinde|kickers|fussballclub|athletic|united|azzurri|türkspor|turkspor|türkgücü|spor)\b/i;
const NOT = /\b(gemeinde|stadt|schule|schulzentrum|gymnasium|grundschule|realschule|universit|hochschule|kita|kindergarten|bolzplatz|landkreis|kreis\b|kreisverwaltung|bezirk|amt\b|verwaltung|verbandsgemeinde|samtgemeinde|kirche|pfarr|bundeswehr|kaserne|polizei|tennis|schützen|reit(er|sport|verein|club|ver)\w*\b|reit\b|golf|ruder|segel|kanu|kegel|tischfu(ss|ß)ball|tischtennis|schach|hockey|american football|baseball|rugby|handball|volleyball|basketball|turnhalle|soccerhalle|soccer-?arena|fu(ss|ß)ballgolf|freizeit|privat|gmbh|kg\b|ag\b|ug\b|hotel|camping|verband|kreissportbund|landessportbund|sportbund|stadtsportbund|fu(ss|ß)ballkreis|staffel|jugendfeuerwehr|feuerwehr|deutsche bahn|kickerking|monarchs|judo|karate|taekwondo|ju-?jutsu|kampfsport|boxing|box-?club|boxclub|ringer|schwimm|ski-?club|skiclub|radsport|radfahr|billard|dart|bowling|tanz|aero club|modell|angel|squash|badminton|cricket|curling|eissport|eishockey|lacrosse|ultimate|frisbee|footgolf|beach)\b/i;
const NOT2 = /^the\b|\b(nordufer|billard|\w*segler|leichtathletik|alte garde|kegler|bogen(sport|schie|schü)|darts?\b|eissport|eishockey|basketball|volleyball|handball|badminton|judo|karate|taekwondo|boxen|box|ringer|fanprojekt|fans?\b|ultras|stammtisch|tennis|tischtennis|schwimm|tanz|tauch|reit(er|sport|verein|club|ver)\w*\b|reit\b|golf|schützen|sportschützen|kegel|bowling|segel|ruder|kanu|ski(club|verein|zunft|sport)?\b|gesang|männergesang|chor\b|chorgemeinschaft|musik|karneval|carneval|fastnacht|narren|heimat|kleingarten|schach|angel(sport|verein|club|er)?\b|fischer(ei)?verein|sportfischer|motor-?sport|motorsport|motorrad|rad(sport|fahr)|flug(sport)?\b|luftsport|modell|hunde|brieftauben|kampfsport|fitness|gym|studio|reisebüro|reisen|transporte?|shop|fan-?shop|fanclub|fan-?club|spielplatz|bolzplatz|\w*schule|akademie|camp|kita|förderverein|freundeskreis|stiftung|verlag|versicherung|immobilien|gaststätte|restaurant|pizzeria|bistro|kiosk|getränke)/i;
export const isClub = n => n.length >= 4 && n.length <= 70 && CLUBWORD.test(n) && !NOT.test(n) && !NOT2.test(n);

/* Entfernung in km (genügt für Duplikate) */
const km = (a, b) => {
  if (!a.lat || !b.lat) return 0;
  const dx = (a.lon - b.lon) * 71.5, dy = (a.lat - b.lat) * 111.2;
  return Math.sqrt(dx * dx + dy * dy);
};

/* ---------- OSM einlesen ---------- */
const QUAL = { club: 3, centre: 2, pitch: 1, wd: 4, ov: 2 };
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

/* Overture-Namen kommen oft aus Registern in „Titel-Schreibweise“ („Sv Musterdorf 1920 E.v.“) – Kürzel wieder groß */
const ABK = { sv: 'SV', tsv: 'TSV', fc: 'FC', sc: 'SC', sg: 'SG', sgm: 'SGM', jsg: 'JSG', spvgg: 'SpVgg', vfb: 'VfB', vfl: 'VfL', vfr: 'VfR',
  tus: 'TuS', tsg: 'TSG', fsv: 'FSV', ssv: 'SSV', djk: 'DJK', fv: 'FV', tv: 'TV', mtv: 'MTV', bsv: 'BSV', esv: 'ESV', psv: 'PSV', sus: 'SuS',
  asv: 'ASV', ksv: 'KSV', tsc: 'TSC', usv: 'USV', lsv: 'LSV', rsv: 'RSV', sge: 'SGE', spg: 'SpG', gsv: 'GSV', fsg: 'FSG', hsv: 'HSV',
  svg: 'SVG', vfv: 'VfV', sf: 'SF', spfr: 'SpFr', ffc: 'FFC', bc: 'BC', ac: 'AC', sk: 'SK', fk: 'FK', ftsv: 'FTSV', atsv: 'ATSV', tura: 'TuRa',
  dsc: 'DSC', ssg: 'SSG', tsgv: 'TSGV', sgv: 'SGV', ttsv: 'TTSV', vfk: 'VfK', sv08: 'SV 08', ev: 'e. V.', og: 'OG', ii: 'II', iii: 'III' };
export const fixCase = s => String(s || '').replace(/[A-Za-zÄÖÜäöüß]+/g, w => ABK[w.toLowerCase()] || w)
  .replace(/([A-Za-zäöüß])-([a-zäöü])(?!nd\b)/g, (m, a, c) => a + '-' + c.toUpperCase()); // „Hausen-rohrbach“ → „Hausen-Rohrbach“
/* Kategorien von Overture, die zu Sportvereinen passen */
const OVKAT = /^(sport_league|amateur_sport_league|social_club|sport_or_recreation_club|sports_club_and_league|soccer_club|football_club|amateur_sport_team|professional_sport_team|sports_and_recreation|stadium_arena|football_stadium|soccer_stadium|sport_or_fitness_facility|gymnastics_club|soccer_field|sports_complex|community_services_non_profits|non_profit_organization)$/;
/* Register-Einträge hängen oft den Vorstand an („TV Musterdorf Peter Müller“) */
const VORNAME = /\s+(peter|thomas|michael|andreas|stefan|stephan|frank|klaus|jürgen|juergen|wolfgang|bernd|uwe|ralf|ralph|markus|marcus|martin|christian|matthias|alexander|daniel|tobias|jan|jens|dirk|holger|joachim|manfred|werner|helmut|gerhard|hans|karl|josef|günter|guenter|günther|dieter|horst|heinz|rainer|reiner|harald|norbert|volker|axel|sven|oliver|florian|sebastian|patrick|dominik|marco|mario|marc|mark|benjamin|philipp|simon|tim|timo|kai|lars|nils|jörg|joerg|torsten|thorsten|carsten|karsten|heiko|achim|roland|herbert|walter|georg|richard|robert|rudolf|ulrich|bernhard|hubert|alfred|erich|friedrich|fritz|wilhelm|otto|ludwig|anton|franz|johann|johannes|sabine|susanne|petra|andrea|claudia|monika|birgit|martina|nicole|stefanie|julia|anja|katrin|kathrin|heike|silke|sandra|tanja|christine|gabriele|ute|karin|renate|ingrid|ursula|elke|bettina|anke|simone|melanie|manuela|daniela|nadine|jessica|sarah|lisa|anna|maria)\s+[A-ZÄÖÜ][\wäöüß-]+(\s+[A-ZÄÖÜ][\wäöüß-]+)?$/i;
/* Register-Langformen kurz wie im Alltag („Turn- und Sportverein Leutenbach“ → „TSV Leutenbach“) */
const LANG = [[/^erster fu(ss|ß)ball-?\s?club\b/i, '1. FC'], [/^turn-? und sportverein\b/i, 'TSV'], [/^turn-? und sportgemeinschaft\b/i, 'TSG'], [/^turn-? und spielvereinigung\b/i, 'TuS'],
  [/^fu(ss|ß)ball-?\s?club\b/i, 'FC'], [/^fu(ss|ß)ballverein\b/i, 'FV'], [/^fu(ss|ß)ballsportverein\b/i, 'FSV'], [/^sportverein\b/i, 'SV'],
  [/^spielvereinigung\b/i, 'SpVgg'], [/^turnverein\b/i, 'TV'], [/^sportgemeinschaft\b/i, 'SG'], [/^sport-?\s?club\b/i, 'SC'],
  [/^ballspielverein\b/i, 'BSV'], [/^sport- und spielverein\b/i, 'SSV'], [/^männerturnverein\b/i, 'MTV'], [/^spvg\.?(?=\s)/i, 'SpVgg'], [/^sc\.(?=\s)/i, 'SC']];
const kurz = n => { for (const [re, k] of LANG) if (re.test(n)) return n.replace(re, k); return n; };
function fromOverture(r) {
  if (!OVKAT.test(r.kat || '')) return null;
  const n = kurz(clean(fixCase(r.name).split(' - ')[0].replace(VORNAME, '')));
  if (!n || !isClub(n)) return null;
  return { id: 'v' + r.id.slice(0, 12), name: n, ort: r.ort, plz: r.plz, land: '', lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: '', q: QUAL.ov, kat: r.kat };
}

const ovRows = readTsv('overture.tsv'), ovOk = ovRows.map(fromOverture);
/* node build.mjs --kuerzen: overture.tsv auf die verwendeten Zeilen kürzen (die Rohdatei ist sonst > 15 MB) */
if (process.argv.includes('--kuerzen') && ovRows.length) {
  const f = new URL('overture.tsv', DIR), lines = readFileSync(f, 'utf8').split('\n');
  const head = lines.filter(l => l.startsWith('#')), cols = lines.find(l => l && !l.startsWith('#'));
  const keep = ovRows.filter((r, i) => ovOk[i]).map(r => cols.split('\t').map(c => r[c]).join('\t'));
  writeFileSync(f, [...head, cols, ...keep].join('\n') + '\n');
}
const raw = [...readTsv('osm.tsv').map(fromOsm), ...readTsv('wikidata.tsv').map(fromWikidata), ...ovOk].filter(Boolean);

/* Bundesland über die Landesgrenzen (laender.json: Overture Maps Divisions, vereinfacht, CDLA Permissive 2.0) */
const LG = JSON.parse(readFileSync(new URL('./laender.json', import.meta.url), 'utf8'));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (x, y, p) => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h));
const LORD = ['BE', 'HB', 'HH', ...Object.keys(LG).filter(k => !['BE', 'HB', 'HH'].includes(k))];
const landAt = (lat, lon) => LORD.find(k => { const g = LG[k]; return (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some(p => inPoly(lon, lat, p)); }) || '';
for (const x of raw) if (x.lat) { const l = landAt(x.lat, x.lon); if (l) x.land = l; }

/* Rest ohne Angabe: Mehrheit der 5 nächsten Einträge mit Angabe */
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
  /* Register-Eintrag mit dem Namen eines bekannten Vereins woanders (Fanclub o. Ä.) – nur behalten, wenn der eigene Ort im Namen steht */
  if (x.kat && list.some(y => !y.kat) && !(x.ort && words(x.name).join(' ').includes(words(x.ort)[0] || '#'))) continue;
  list.push(x); groups.set(k, list);
}
/* Gleiche Wikidata-ID unter verschiedenen Namen: den OSM-Namen behalten */
const out = [], seenWd = new Set();
for (const list of groups.values()) for (const x of list) {
  if (x.wd) { if (seenWd.has(x.wd)) continue; seenWd.add(x.wd); }
  out.push(x);
}
/* „Werder Bremen“ neben „SV Werder Bremen“: Name ohne Kürzel im Umkreis von 10 km = derselbe Verein */
const ABKW = new Set(Object.keys(ABK).concat(['1', 'tsv', 'sv', 'fc']));
const core = x => words(x.name).filter(w => !ABKW.has(w) && !/^\d+$/.test(w)).join(' ');
const byCore = new Map();
for (const x of out) { const c = core(x); if (c) (byCore.get(c) || byCore.set(c, []).get(c)).push(x); }
const drop = new Set();
for (const list of byCore.values()) {
  if (list.length < 2) continue;
  for (const x of list) {
    if (words(x.name).some(w => ABKW.has(w))) continue;
    const y = list.find(y => y !== x && !drop.has(y) && words(y.name).some(w => ABKW.has(w)) && km(x, y) < 10);
    if (y) { drop.add(x); for (const f of ['ort', 'web', 'land']) if (!y[f] && x[f]) y[f] = x[f]; }
  }
}
for (let i = out.length - 1; i >= 0; i--) if (drop.has(out[i])) out.splice(i, 1);
out.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

const r2 = v => Math.round(v * 100) / 100;
const shortWeb = w => (w || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').slice(0, 60);
const data = {
  v: 1,
  stand: new Date().toISOString().slice(0, 10),
  quelle: '© OpenStreetMap-Mitwirkende (ODbL 1.0)' + (existsSync(new URL('wikidata.tsv', DIR)) ? ', Wikidata (CC0)' : '') +
    (existsSync(new URL('overture.tsv', DIR)) ? ', Overture Maps Foundation (CDLA Permissive 2.0)' : ''),
  /* [id, Name, Ort, Bundesland, lat, lon, Webseite] */
  c: out.map(x => [x.id, x.name, x.ort || '', x.land || '', r2(x.lat), r2(x.lon), shortWeb(x.web)])
};
writeFileSync(OUT, JSON.stringify(data).replace(/\],\[/g, '],\n['));
const per = {};
for (const x of out) per[x.land || '?'] = (per[x.land || '?'] || 0) + 1;
console.log('Vereine:', out.length, 'aus', raw.length, 'Rohtreffern');
console.log('Je Bundesland:', Object.entries(per).sort().map(([k, v]) => k + ' ' + v).join(', '));
