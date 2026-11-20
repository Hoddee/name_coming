/* Bundesländer, Landesverbände und Spielklassen – für Vereine, Mannschaften und Staffeln (Vereinssuche).
   Kürzel der Verbände sind eigene Schlüssel (höchstens 8 Zeichen, DB-Spalte verband), weil sich die üblichen doppeln (BFV). */
export const LAENDER = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland',
  SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen'
};
/* [Kurzname, voller Name, Bundesland] */
export const VERBAENDE = {
  WFV: ['WFV', 'Württembergischer Fußball-Verband', 'BW'], BADFV: ['bfv', 'Badischer Fußballverband', 'BW'], SBFV: ['SBFV', 'Südbadischer Fußball-Verband', 'BW'],
  BAYFV: ['BFV', 'Bayerischer Fußball-Verband', 'BY'], BERFV: ['BFV', 'Berliner Fußball-Verband', 'BE'], FLB: ['FLB', 'Fußball-Landesverband Brandenburg', 'BB'],
  BREFV: ['BFV', 'Bremer Fußball-Verband', 'HB'], HAMFV: ['HFV', 'Hamburger Fußball-Verband', 'HH'], HESFV: ['HFV', 'Hessischer Fußball-Verband', 'HE'],
  LFVMV: ['LFV', 'Landesfußballverband Mecklenburg-Vorpommern', 'MV'], NFV: ['NFV', 'Niedersächsischer Fußballverband', 'NI'],
  FVM: ['FVM', 'Fußball-Verband Mittelrhein', 'NW'], FVN: ['FVN', 'Fußballverband Niederrhein', 'NW'], FLVW: ['FLVW', 'Fußball- und Leichtathletik-Verband Westfalen', 'NW'],
  FVR: ['FVR', 'Fußballverband Rheinland', 'RP'], SWFV: ['SWFV', 'Südwestdeutscher Fußballverband', 'RP'], SAARFV: ['SFV', 'Saarländischer Fußballverband', 'SL'],
  SAXFV: ['SFV', 'Sächsischer Fußball-Verband', 'SN'], FSA: ['FSA', 'Fußballverband Sachsen-Anhalt', 'ST'], SHFV: ['SHFV', 'Schleswig-Holsteinischer Fußballverband', 'SH'],
  TFV: ['TFV', 'Thüringer Fußball-Verband', 'TH']
};
export const verbaendeIn = land => Object.keys(VERBAENDE).filter(k => VERBAENDE[k][2] === land);
/* Nur ein Verband im Land → steht fest */
export const verbandOf = land => { const v = verbaendeIn(land); return v.length === 1 ? v[0] : ''; };

export const KLASSEN = ['Kreisliga A', 'Kreisliga B', 'Kreisliga C', 'Kreisliga', 'Kreisklasse', 'Kreisoberliga', 'Bezirksliga', 'Bezirksoberliga',
  'Landesliga', 'Verbandsliga', 'Oberliga', 'Regionalliga'];
export const ARTEN = { herren: 'Herren', frauen: 'Frauen', ah: 'Alte Herren', jugend: 'Jugend' };
export const JUGEND = ['U19', 'U17', 'U15', 'U13', 'U11', 'U9', 'U7'];

/* „Kreisliga A“ + „2“ → „Kreisliga A2“, „Bezirksliga“ + „3“ → „Bezirksliga 3“ */
export function ligaName(klasse, nummer) {
  if (!klasse) return '';
  if (!nummer) return klasse;
  return / [A-C]$/.test(klasse) && /^\d+$/.test(nummer) ? klasse + nummer : klasse + ' ' + nummer;
}
