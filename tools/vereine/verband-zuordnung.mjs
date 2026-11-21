/* Landesverband und Verbandsbezirk aus dem Landkreis (für build.mjs).
   Grundlage: Gebiete der Landesverbände (öffentlich bekannt, Satzungen/Webseiten der Verbände). Wo ein Landkreis auf zwei
   Verbände verteilt ist (z. B. Enzkreis: bfv und WFV), bleibt der Verband offen – lieber leer als falsch.
   In Bundesländern mit nur einem Verband steht er fest (verbandOf in js/data/verbaende.js).
   Kreisnamen kommen aus kreise.json (Overture Maps Divisions); verglichen wird ohne „Landkreis“, „Kreis“ usw. */
export const kurzKreis = n => String(n || '').replace(/^(Landkreis|Kreis|Region|Städteregion|Regionalverband|Stadtkreis|Stadt)\s+/i, '').replace(/\s*\(.*\)$/, '').trim();

const set = (verband, list) => Object.fromEntries(list.map(k => [k, verband]));
/* Baden-Württemberg: WFV (Württemberg, Hohenzollern), bfv (Nordbaden), SBFV (Südbaden inkl. Rastatt/Baden-Baden) */
const BW = {
  ...set('WFV', ['Stuttgart', 'Böblingen', 'Esslingen', 'Göppingen', 'Ludwigsburg', 'Rems-Murr-Kreis', 'Heilbronn', 'Hohenlohekreis', 'Schwäbisch Hall',
    'Ostalbkreis', 'Heidenheim', 'Reutlingen', 'Tübingen', 'Zollernalbkreis', 'Alb-Donau-Kreis', 'Ulm', 'Biberach', 'Ravensburg', 'Calw', 'Freudenstadt', 'Rottweil']),
  ...set('BADFV', ['Karlsruhe', 'Mannheim', 'Heidelberg', 'Rhein-Neckar-Kreis', 'Neckar-Odenwald-Kreis', 'Pforzheim']),
  ...set('SBFV', ['Freiburg im Breisgau', 'Breisgau-Hochschwarzwald', 'Emmendingen', 'Ortenaukreis', 'Lörrach', 'Waldshut', 'Konstanz', 'Schwarzwald-Baar-Kreis', 'Rastatt', 'Baden-Baden'])
  /* geteilt, bleibt offen: Enzkreis, Main-Tauber-Kreis, Bodenseekreis, Sigmaringen, Tuttlingen */
};
/* Nordrhein-Westfalen: FVM (Mittelrhein), FVN (Niederrhein), FLVW (Westfalen) */
const NW_FVM = ['Köln', 'Bonn', 'Leverkusen', 'Rhein-Erft-Kreis', 'Rhein-Sieg-Kreis', 'Rheinisch-Bergischer Kreis', 'Oberbergischer Kreis', 'Aachen', 'Düren', 'Euskirchen', 'Heinsberg'];
const NW_FVN = ['Düsseldorf', 'Duisburg', 'Essen', 'Krefeld', 'Mönchengladbach', 'Mülheim an der Ruhr', 'Oberhausen', 'Remscheid', 'Solingen', 'Wuppertal',
  'Kleve', 'Mettmann', 'Rhein-Kreis Neuss', 'Viersen', 'Wesel', 'Bottrop'];
const NW_OFFEN = ['Borken'];
/* Rheinland-Pfalz: FVR (Rheinland) und SWFV (Pfalz, Rheinhessen, Nahe) */
const RP_FVR = ['Koblenz', 'Trier', 'Ahrweiler', 'Altenkirchen (Westerwald)', 'Altenkirchen', 'Bernkastel-Wittlich', 'Cochem-Zell', 'Eifelkreis Bitburg-Prüm', 'Mayen-Koblenz',
  'Neuwied', 'Rhein-Hunsrück-Kreis', 'Rhein-Lahn-Kreis', 'Trier-Saarburg', 'Vulkaneifel', 'Westerwaldkreis'];
/* Niedersachsen: NFV-Bezirke (ehemalige Regierungsbezirke) */
const NI_BEZ = {
  ...set('Braunschweig', ['Braunschweig', 'Salzgitter', 'Wolfsburg', 'Gifhorn', 'Göttingen', 'Goslar', 'Helmstedt', 'Northeim', 'Peine', 'Wolfenbüttel']),
  ...set('Hannover', ['Hannover', 'Diepholz', 'Hameln-Pyrmont', 'Hildesheim', 'Holzminden', 'Nienburg/Weser', 'Nienburg', 'Schaumburg']),
  ...set('Lüneburg', ['Celle', 'Cuxhaven', 'Harburg', 'Lüchow-Dannenberg', 'Lüneburg', 'Osterholz', 'Rotenburg (Wümme)', 'Rotenburg', 'Heidekreis', 'Stade', 'Uelzen', 'Verden']),
  ...set('Weser-Ems', ['Delmenhorst', 'Emden', 'Oldenburg', 'Oldenburg (Oldb)', 'Osnabrück', 'Wilhelmshaven', 'Ammerland', 'Aurich', 'Cloppenburg', 'Emsland', 'Friesland',
    'Grafschaft Bentheim', 'Leer', 'Vechta', 'Wesermarsch', 'Wittmund'])
};
/* Bayern: BFV-Bezirke = Regierungsbezirke */
const BY_BEZ = {
  ...set('Oberbayern', ['München', 'Ingolstadt', 'Rosenheim', 'Altötting', 'Bad Tölz-Wolfratshausen', 'Berchtesgadener Land', 'Dachau', 'Ebersberg', 'Eichstätt', 'Erding',
    'Freising', 'Fürstenfeldbruck', 'Garmisch-Partenkirchen', 'Landsberg am Lech', 'Miesbach', 'Mühldorf am Inn', 'Neuburg-Schrobenhausen', 'Pfaffenhofen an der Ilm',
    'Starnberg', 'Traunstein', 'Weilheim-Schongau']),
  ...set('Niederbayern', ['Landshut', 'Passau', 'Straubing', 'Deggendorf', 'Dingolfing-Landau', 'Freyung-Grafenau', 'Kelheim', 'Regen', 'Rottal-Inn', 'Straubing-Bogen']),
  ...set('Oberpfalz', ['Amberg', 'Regensburg', 'Weiden in der Oberpfalz', 'Amberg-Sulzbach', 'Cham', 'Neumarkt in der Oberpfalz', 'Neustadt an der Waldnaab', 'Schwandorf', 'Tirschenreuth']),
  ...set('Oberfranken', ['Bamberg', 'Bayreuth', 'Coburg', 'Hof', 'Forchheim', 'Kronach', 'Kulmbach', 'Lichtenfels', 'Wunsiedel im Fichtelgebirge']),
  ...set('Mittelfranken', ['Ansbach', 'Erlangen', 'Fürth', 'Nürnberg', 'Schwabach', 'Erlangen-Höchstadt', 'Neustadt an der Aisch-Bad Windsheim', 'Nürnberger Land', 'Roth', 'Weißenburg-Gunzenhausen']),
  ...set('Unterfranken', ['Aschaffenburg', 'Schweinfurt', 'Würzburg', 'Bad Kissingen', 'Haßberge', 'Kitzingen', 'Main-Spessart', 'Miltenberg', 'Rhön-Grabfeld']),
  ...set('Schwaben', ['Augsburg', 'Kaufbeuren', 'Kempten (Allgäu)', 'Kempten', 'Memmingen', 'Aichach-Friedberg', 'Dillingen an der Donau', 'Donau-Ries', 'Günzburg', 'Lindau', 'Lindau (Bodensee)',
    'Neu-Ulm', 'Oberallgäu', 'Ostallgäu', 'Unterallgäu'])
};
const EIN = { BY: 'BAYFV', BE: 'BERFV', BB: 'FLB', HB: 'BREFV', HH: 'HAMFV', HE: 'HESFV', MV: 'LFVMV', NI: 'NFV', SL: 'SAARFV', SN: 'SAXFV', ST: 'FSA', SH: 'SHFV', TH: 'TFV' };

/* → { verband, bezirk } (leer, wenn nicht sicher) */
export function verbandFor(land, kreis, regbez) {
  const k = kurzKreis(kreis), rb = kurzKreis(regbez).replace(/^Regierungsbezirk\s+/i, '');
  if (EIN[land]) {
    const bezirk = land === 'BY' ? (BY_BEZ[k] || rb) : land === 'NI' ? (NI_BEZ[k] || '') : '';
    return { verband: EIN[land], bezirk };
  }
  if (land === 'BW') return { verband: BW[k] || '', bezirk: '' };
  if (land === 'NW') return { verband: NW_OFFEN.includes(k) || !k ? '' : NW_FVM.includes(k) ? 'FVM' : NW_FVN.includes(k) ? 'FVN' : 'FLVW', bezirk: '' };
  if (land === 'RP') return { verband: !k ? '' : RP_FVR.includes(k) ? 'FVR' : 'SWFV', bezirk: '' };
  return { verband: '', bezirk: '' };
}
