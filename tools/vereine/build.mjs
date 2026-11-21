/* Baut die Vereinsliste für die Suche (assets/data/vereine.json) aus den Rohdaten in tools/vereine/quellen/.
   Aufruf im Repo-Root:  node tools/vereine/build.mjs [--kuerzen]
   Quellen (nur erlaubte, offene Daten):
     - quellen/osm.tsv       OpenStreetMap (ODbL): Vereine (club=sport), Plätze mit Betreiber, Sportanlagen
     - quellen/wikidata.tsv  Wikidata (CC0), optional – wird von wikidata-laden.mjs erzeugt
     - quellen/overture.tsv  Overture Maps Places (CDLA Permissive 2.0), optional – overture-laden.py
   fussball.de und FuPa werden bewusst NICHT ausgelesen (Nutzungsbedingungen, Datenbankrecht § 87b UrhG).
   Was fehlt, legen Nutzer in der App an (Tabelle vereine, Migration 015). */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { verbandFor } from './verband-zuordnung.mjs';
mkdirSync(new URL('./log/', import.meta.url), { recursive: true });
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
const POST = /[\s,–-]*(gesch[äa]ftsstelle|vereinsheim|vereinsgeb[äa]ude|vereinshaus|sportheim|clubhaus|abteilung fu(ss|ß)ball|abt\.? fu(ss|ß)ball|fu(ss|ß)ballabteilung|-? ?fu(ss|ß)ball|sportb[üu]ro|vereinsraum|vereinsheim|platz \d+)\s*$/i;
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
const NOT2 = /^the\b|\b(gewichtheb\w*|(?<![a-zäöüß])ringen\b|athletik|kraftsport|schwerathletik|angler\w*|yacht|aerobic|gymnastik|wassergymnastik|babyschwimmen|stockschütz\w*|eisstock\w*|wassersport|wasserski|wasserwacht|dlrg|faustball|prellball|rollsport|roll(er)?skat\w*|skater|inline|triathlon|lauftreff|marathon|wanderverein|wanderfreunde|alpenverein|bergsteig\w*|kletter\w*|bike|mtb|pferde?(sport|hof|freunde|zucht|pension)\w*|reit- und fahr\w*|voltigier\w*|turnerschaft|turnerbund|anwenderhandbuch|handbuch|fußballtraining|fussballtraining|fußballschule|fussballschule|soccerschool|pool\b|snooker|minigolf|sportabzeichen|seniorensport|reha(bilitation\w*|sport\w*)?\b|rehasport|herzsport|behindertensport|versehrten|nordufer|billard|\w*segler|leichtathletik|alte garde|kegler|bogen(sport|schie|schü)|darts?\b|eissport|eishockey|basketball|volleyball|handball|badminton|judo|karate|taekwondo|boxen|box|ringer|fanprojekt|fans?\b|ultras|stammtisch|tennis|tischtennis|schwimm|tanz|tauch|reit(er|sport|verein|club|ver)\w*\b|reit\b|golf|schützen|sportschützen|kegel|bowling|segel|ruder|kanu|ski(club|verein|zunft|sport)?\b|gesang|männergesang|chor\b|chorgemeinschaft|musik|karneval|carneval|fastnacht|narren|heimat|kleingarten|schach|angel(sport|verein|club|er)?\b|fischer(ei)?verein|sportfischer|motor-?sport|motorsport|motorrad|rad(sport|fahr)|flug(sport)?\b|luftsport|modell|hunde|brieftauben|kampfsport|fitness|gym|studio|reisebüro|reisen|transporte?|shop|fan-?shop|fanclub|fan-?club|spielplatz|bolzplatz|\w*schule|akademie|camp|kita|förderverein|freundeskreis|stiftung|verlag|versicherung|immobilien|gaststätte|restaurant|pizzeria|bistro|kiosk|getränke)/i;
/* Name sagt sicher Fußball */
/* Kürzel anderer Sportarten (Badminton-, Billard-, Box-, Athletik-, Tennis-, Golf-, Reit-, Yachtclub …) – nur ohne Fußball-Hinweis raus */
const OTHER = /^(1\.\s?(bc|ac)|ac|tc|gc|yc|kc|lc|thc|htc)\b|\b(badminton|billard|boxing|boxen)\b/i;
const FBNAME = /\b(fc|fv|fsv|ffc|jsg|sgm|spvgg|kickers|fu(ss|ß)ball\w*|soccer|calcio|spor|türkgücü)\b/i;
export const isClub = n => n.length >= 4 && n.length <= 70 && CLUBWORD.test(n) && (/^tennis borussia/i.test(n) || !NOT.test(n) && (!NOT2.test(n) || FBNAME.test(n) && !/gewicht|(?<![a-zäöüß])ringen\b|angel|yacht|motor|reha|faustball|schule|training|handbuch|camp|akademie|academy/i.test(n)));

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
    if (n && isClub(n)) return { id: 'o' + r.typ + r.id, name: n, ort: r.ort, plz: r.plz, land: r.land, lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: r.wikidata, q: QUAL[r.art], fb: r.art === 'club' ? 0 : 1 };
  }
  return null;
}
function fromWikidata(r) {
  const n = clean(r.name);
  if (!n || !isClub(n) && (!/^[A-ZÄÖÜ]/.test(n) || NOT2.test(n))) return null;
  return { id: 'q' + r.id.replace(/^Q/, ''), name: n, ort: r.ort, plz: '', land: r.land || '', lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: r.id, q: QUAL.wd, fb: 1,
    liga: r.liga ? r.liga.split('|')[0] : '', farben: r.farben || '', gr: /^\d{4}$/.test(r.gruendung || '') ? r.gruendung : '', wiki: r.dewiki || '' };
}
/* Wikipedia (Kategorie Fußballverein aus Deutschland, Infobox) – gleiche Q-ID wie Wikidata, ergänzt Liga/Saison/Farben */
const DEWIKI = new Map();
function fromDewiki(r) {
  DEWIKI.set(r.id, r);
  const n = clean(r.name);
  if (!n || !isClub(n) && NOT2.test(n)) return null;
  return { id: 'q' + r.id.replace(/^Q/, ''), name: n, ort: r.ort, plz: '', land: '', lat: +r.lat || 0, lon: +r.lon || 0, web: '', wd: r.id, q: QUAL.wd, fb: 1, wiki: r.artikel || '', vbw: r.verband || '' };
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
  return { id: 'v' + r.id.slice(0, 12), name: n, ort: r.ort, plz: r.plz, land: '', lat: +r.lat || 0, lon: +r.lon || 0, web: r.web, wd: '', q: QUAL.ov, kat: r.kat, fb: /soccer|football/.test(r.kat) ? 1 : 0 };
}

const ovRows = readTsv('overture.tsv'), ovOk = ovRows.map(fromOverture);
/* node build.mjs --kuerzen: overture.tsv auf die verwendeten Zeilen kürzen (die Rohdatei ist sonst > 15 MB) */
if (process.argv.includes('--kuerzen') && ovRows.length) {
  const f = new URL('overture.tsv', DIR), lines = readFileSync(f, 'utf8').split('\n');
  const head = lines.filter(l => l.startsWith('#')), cols = lines.find(l => l && !l.startsWith('#'));
  const keep = ovRows.filter((r, i) => ovOk[i]).map(r => cols.split('\t').map(c => r[c]).join('\t'));
  writeFileSync(f, [...head, cols, ...keep].join('\n') + '\n');
}
const raw = [...readTsv('osm.tsv').map(fromOsm), ...readTsv('wikidata.tsv').map(fromWikidata), ...readTsv('dewiki.tsv').map(fromDewiki), ...ovOk].filter(Boolean);
for (const x of raw) { x.ids = [x.id]; if (!x.fb && FBNAME.test(x.name)) x.fb = 1; }

/* Ohne Koordinaten (manche Wikidata-Einträge): Ort eines anderen Eintrags mit Koordinaten übernehmen */
{ const at = new Map(); for (const x of raw) if (x.lat && x.ort && !at.has(x.ort)) at.set(x.ort, x);
  for (const x of raw) if (!x.lat && x.ort && at.has(x.ort)) { const y = at.get(x.ort); x.lat = y.lat; x.lon = y.lon; } }

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
    for (const f of ['ort', 'plz', 'web', 'wd', 'land', 'liga', 'farben', 'gr', 'wiki', 'vbw']) if (!same[f] && x[f]) same[f] = x[f];
    same.ids.push(...x.ids); same.fb = same.fb || x.fb;
    if (!same.lat && x.lat) { same.lat = x.lat; same.lon = x.lon; }
    continue;
  }
  /* Register-Eintrag mit dem Namen eines bekannten Vereins woanders (Fanclub o. Ä.) – nur behalten, wenn der eigene Ort im Namen steht */
  if (x.kat && list.some(y => !y.kat) && !(x.ort && words(x.name).join(' ').includes(words(x.ort)[0] || '#'))) continue;
  list.push(x); groups.set(k, list);
}
/* Gleiche Wikidata-ID unter verschiedenen Namen: den OSM-Namen behalten */
const out = [], seenWd = new Map();
for (const list of groups.values()) for (const x of list) {
  if (x.wd) { const o = seenWd.get(x.wd); if (o) { o.ids.push(...x.ids); o.fb = o.fb || x.fb; for (const f of ['ort', 'web', 'liga', 'farben', 'gr', 'wiki', 'vbw']) if (!o[f] && x[f]) o[f] = x[f]; if (!o.lat && x.lat) { o.lat = x.lat; o.lon = x.lon; } continue; } seenWd.set(x.wd, x); }
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
    if (y) { drop.add(x); for (const f of ['ort', 'web', 'land', 'wd', 'liga', 'farben', 'gr', 'wiki', 'vbw']) if (!y[f] && x[f]) y[f] = x[f]; y.ids.push(...x.ids); y.fb = y.fb || x.fb; }
  }
}
for (let i = out.length - 1; i >= 0; i--) if (drop.has(out[i]) || (!out[i].fb && OTHER.test(out[i].name))) out.splice(i, 1);
out.sort((a, b) => norm(a.name).localeCompare(norm(b.name)));

const r2 = v => Math.round(v * 100) / 100;
const shortWeb = w => (w || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').slice(0, 60);

/* ---------- IDs stabil halten ----------
   „Mein Verein“, eingetragene Spieler und Mannschaften hängen an der Vereins-ID. Kommt ein Verein durch neue Quellen
   in eine andere Gruppe, behält er die ID aus der letzten Vereinsliste. */
const prev = existsSync(OUT) ? new Set(JSON.parse(readFileSync(OUT, 'utf8')).c.map(c => c[0])) : new Set();
const used = new Set();
let kept = 0;
for (const x of out) {
  const old = x.ids.find(id => prev.has(id) && !used.has(id));
  if (old) { if (old !== x.id) kept++; x.id = old; }
  used.add(x.id);
}
const lost = [...prev].filter(id => !used.has(id) && !/^k-/.test(id));

/* ---------- Landkreis, Verband, Bezirk ---------- */
const KR = existsSync(new URL('./kreise.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./kreise.json', import.meta.url), 'utf8')).k.filter(k => k.t !== 'b') : [];
const box = g => { let a = 180, b = 90, c = -180, d = -90; const walk = p => { if (typeof p[0] === 'number') { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } else p.forEach(walk); }; walk(g.coordinates); return [a, b, c, d]; };
for (const k of KR) k.bb = box(k.g);
const kreisAt = (lat, lon) => KR.findIndex(k => lon >= k.bb[0] && lon <= k.bb[2] && lat >= k.bb[1] && lat <= k.bb[3] &&
  (k.g.type === 'Polygon' ? [k.g.coordinates] : k.g.coordinates).some(p => inPoly(lon, lat, p)));
const kreise = [], kIdx = new Map();
for (const x of out) {
  if (!x.lat) continue;
  const i = kreisAt(x.lat, x.lon);
  if (i < 0) continue;
  const k = KR[i];
  if (!x.land && k.r) x.land = k.r;
  if (k.r && k.r !== x.land) continue; // Grenzfall: Bundesland gilt
  if (!kIdx.has(i)) { const vb = verbandFor(k.r, k.n, ''); kIdx.set(i, kreise.length); kreise.push([k.n, k.r, vb.bezirk]); }
  x.k = kIdx.get(i);
}
for (const x of out) {
  const kr = x.k != null ? kreise[x.k] : null;
  /* Mitgliedschaft laut Wikipedia-Kategorie „Verein im …verband“ geht vor (genauer in geteilten Landkreisen) */
  x.vb = x.vbw || verbandFor(x.land, kr ? kr[0] : '', '').verband;
  /* Stadtstaaten: ein Verband, auch ohne Kreis */
}

/* ---------- Wappen, Farben, Liga ---------- */
const WAPPEN = new Set(existsSync(new URL('../../assets/img/w/', import.meta.url)) ? readdirSync(new URL('../../assets/img/w/', import.meta.url)).map(f => f.replace(/\.webp$/, '')) : []);
const WLIZ = existsSync(new URL('wappen.tsv', DIR)) ? new Map(readTsv('wappen.tsv').map(r => [r.id, r])) : new Map();
const FARBWORT = { rot: '#d0202e', weiß: '#ffffff', weiss: '#ffffff', schwarz: '#111111', blau: '#1f4fbf', gelb: '#f7d117', grün: '#1d8a3a', gruen: '#1d8a3a',
  orange: '#f07d19', violett: '#6b2c91', lila: '#6b2c91', bordeaux: '#7b1830', weinrot: '#7b1830', himmelblau: '#5fa8e0', hellblau: '#5fa8e0', dunkelblau: '#16295e',
  marineblau: '#16295e', königsblau: '#1946b8', gold: '#c9a227', silber: '#a8adb3', grau: '#7d838a', braun: '#6b4423', türkis: '#1aa39a', pink: '#e2478b', rosa: '#f29bc0' };
const farbenOf = x => {
  const hex = String(x.farben || '').split('|').map(h => h.trim()).filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => '#' + h.toLowerCase());
  if (hex.length) return [...new Set(hex)].slice(0, 2);
  const d = x.wd && DEWIKI.get(x.wd);
  const words2 = String((d && d.farben) || '').toLowerCase().split(/[^a-zäöüß]+/).map(w => FARBWORT[w]).filter(Boolean);
  return [...new Set(words2)].slice(0, 2);
};
const ligaOf = x => {
  const d = x.wd && DEWIKI.get(x.wd);
  /* Infobox der Wikipedia mit aktueller Saison schlägt Wikidata */
  if (d && d.liga && /202[5-7]/.test(d.saison || '')) return d.liga.slice(0, 40);
  return String(x.liga || (d && d.liga) || '').slice(0, 40);
};
let nW = 0, nF = 0, nL = 0, nK = 0, nV = 0, nB = 0, nFb = 0;
const rows = out.map(x => {
  const wp = x.wd && WAPPEN.has(x.wd) ? 1 : 0, fa = farbenOf(x), lg = ligaOf(x);
  nW += wp; nF += fa.length ? 1 : 0; nL += lg ? 1 : 0; nK += x.k != null ? 1 : 0; nV += x.vb ? 1 : 0; nB += x.k != null && kreise[x.k][2] ? 1 : 0; nFb += x.fb ? 1 : 0;
  /* [id, Name, Ort, Land, lat, lon, Web, Kreis-Index, Verband, Wikidata, Flags (1 = sicher Fußball, 2 = Wappen), Farben, Liga, Gründung] */
  return [x.id, x.name, x.ort || '', x.land || '', r2(x.lat), r2(x.lon), shortWeb(x.web), x.k ?? -1, x.vb || '', x.wd || '', (x.fb ? 1 : 0) | (wp ? 2 : 0), fa.join(','), lg, x.gr || ''];
});
/* Namensnennung je Wappen (Lizenz, Urheber, Seite) – für die Anzeige auf der Vereinsseite */
const wliz = {};
for (const x of out) if (x.wd && WAPPEN.has(x.wd) && WLIZ.has(x.wd)) { const r = WLIZ.get(x.wd); wliz[x.wd] = [r.lizenz, r.urheber, r.seite]; }
writeFileSync(new URL('../../assets/data/wappen.json', import.meta.url), JSON.stringify({ quelle: 'Wikimedia Commons / Wikipedia', w: wliz }));
const data = {
  v: 2,
  stand: new Date().toISOString().slice(0, 10),
  quelle: '© OpenStreetMap-Mitwirkende (ODbL 1.0)' + (existsSync(new URL('wikidata.tsv', DIR)) ? ', Wikidata (CC0)' : '') +
    (existsSync(new URL('overture.tsv', DIR)) ? ', Overture Maps Foundation (CDLA Permissive 2.0)' : ''),
  /* Landkreise: [Name, Land, Verbandsbezirk] */
  k: kreise,
  c: rows
};
writeFileSync(OUT, JSON.stringify(data).replace(/\],\[/g, '],\n['));
const per = {};
for (const x of out) per[x.land || '?'] = (per[x.land || '?'] || 0) + 1;
const pc = n => n + ' (' + Math.round(n / out.length * 100) + ' %)';
console.log('Vereine:', out.length, 'aus', raw.length, 'Rohtreffern; alte IDs behalten:', kept, '– weggefallen:', lost.length);
console.log('Je Bundesland:', Object.entries(per).sort().map(([k, v]) => k + ' ' + v).join(', '));
console.log('Abdeckung – Landkreis:', pc(nK), 'Verband:', pc(nV), 'Bezirk:', pc(nB), 'sicher Fußball:', pc(nFb), 'Wappen:', pc(nW), 'Farben:', pc(nF), 'Liga:', pc(nL));
writeFileSync(new URL('./log/weggefallen.txt', import.meta.url), lost.join('\n') + '\n');
