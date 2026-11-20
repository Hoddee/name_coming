/* Kreo-Punktetabelle (eigene Wertung, Stand 2.0).
   Wert: Zahl oder Objekt je Position {TW, ABW, MIT, ANG, SUB}; SUB gilt, wenn der Spieler eingewechselt wurde.
   "only" begrenzt eine Gruppe auf eine Position (Torwart-Aktionen).
   Grundidee: Was am Spielfeldrand sicher zu sehen ist, zählt – keine Profi-Datenfeinheiten (Pässe ins Drittel,
   Ballbesitz nach geblockter Flanke …). Tore von hinten zählen mehr, Patzer kosten spürbar.
   Schlüssel alter Spiele, die es hier nicht mehr gibt, bleiben lesbar: Name und Punkte stehen im gespeicherten Spiel. */
export const GROUPS = {
  att: [
    { t: 'Tore', a: [
      ['goal', 'Tor', { TW: 150, ABW: 110, MIT: 95, ANG: 85, SUB: 90 }],
      ['pen', 'Elfmetertor', 65]
    ]},
    { t: 'Tor-Extras', a: [
      ['head', 'Kopfballtor', 10],
      ['long', 'Distanzschuss', 15],
      ['solo', 'Solo-Lauf', 15],
      ['fk', 'Direkter Freistoß', 20]
    ]},
    { t: 'Vorlagen', a: [
      ['ast', 'Vorlage', { TW: 70, ABW: 55, MIT: 45, ANG: 40, SUB: 40 }],
      ['reb', 'Abpraller-Vorlage', 20],
      ['setup', 'Vorletzter Pass', 20],
      ['pwon', 'Elfmeter rausgeholt', 30],
      ['ogf', 'Eigentor erzwungen', 20]
    ]},
    { t: 'Chancen', a: [
      ['sfar', 'Schuss daneben', 2],
      ['sblk', 'Schuss geblockt', 3],
      ['sjp', 'Knapp vorbei', 6],
      ['sast', 'Schlüsselpass', 6],
      ['sot', 'Schuss aufs Tor', 10],
      ['post', 'Aluminium', 12],
      ['bcc', 'Großchance aufgelegt', 15]
    ]},
    { t: 'Spielaufbau', a: [
      ['corner', 'Ecke rausgeholt', 1],
      ['fouled3', 'Foul gezogen', 2],
      ['lball', 'Seitenwechsel', 2],
      ['pf3', 'Steilpass', 3],
      ['cross', 'Flanke angekommen', 4],
      ['contest', 'Gegner ausgespielt', 5]
    ]}
  ],
  def: [
    { t: 'Torwart', only: 'TW', a: [
      ['thr', 'Schneller Abwurf', 3],
      ['catch', 'Ball festgehalten', 4],
      ['punch', 'Weggefaustet', 4],
      ['xcl', 'Flanke runtergepflückt', 6],
      ['shh', 'Schuss gehalten', 8],
      ['rush', 'Rausgelaufen und geklärt', 8],
      ['sv', 'Glanzparade', 15],
      ['bcs', 'Eins gegen eins gewonnen', 20],
      ['pgt', 'Elfmeter pariert', 90]
    ]},
    { t: 'Zweikampf', a: [
      ['aerw', 'Kopfballduell gewonnen', 3],
      ['pinti', 'Pass abgefangen', 3],
      ['duel', 'Zweikampf gewonnen', 4],
      ['icpt', 'Ball erobert', 5]
    ]},
    { t: 'Verteidigen', a: [
      ['xblk', 'Flanke geblockt', 2],
      ['clri', 'Ball geklärt', 3],
      ['blk16', 'Schuss geblockt', 8],
      ['tackle', 'Rettende Grätsche', 15],
      ['line', 'Auf der Linie gerettet', 25]
    ]}
  ],
  err: [
    { t: 'Torwart', only: 'TW', a: [
      ['xmiss', 'Flanke unterlaufen', -8],
      ['slip', 'Ball durchrutschen lassen', -20]
    ]},
    { t: 'Kleinkram', a: [
      ['poss', 'Ballverlust', -2],
      ['lost', 'Zweikampf verloren', -2],
      ['off', 'Abseits', -2],
      ['foul', 'Foul', -3],
      ['hand', 'Handspiel', -3],
      ['throw', 'Falscher Einwurf', -3],
      ['moan', 'Meckern', -5],
      ['danger', 'Rücksichtsloses Foul', -8]
    ]},
    { t: 'Patzer', a: [
      ['mshot', 'Patzer vor Torschuss', -12],
      ['bcm', 'Großchance versemmelt', -15],
      ['mgoal', 'Patzer vor Gegentor', -40],
      ['own', 'Eigentor', -50]
    ]},
    { t: 'Karten & Elfmeter', a: [
      ['yel', 'Gelbe Karte', -10],
      ['pcon', 'Elfmeter verursacht', -35],
      ['yel2', 'Gelb-Rot', -40],
      ['pmiss', 'Elfmeter verschossen', -40],
      ['red', 'Rote Karte', -60]
    ]}
  ]
};

/* Automatische Zeilen (nach Abpfiff bzw. ab Anpfiff) */
export const AUTO = {
  start: 10, sub: 5,                  // Startelf / eingewechselt
  per: 15, minPts: 2,                 // Einsatzzeit: +2 je 15 Minuten, +2 bei voller Spielzeit
  win: 20, draw: 5, loss: -10,        // Ergebnis
  goal: 4                             // Team-Tor +4, Gegentor −4 (nur auf dem Platz)
};
/* "Zu null" je 15 Minuten je Position, dazu derselbe Wert bei voller Spielzeit */
export const CLEAN_SHEET = { TW: 8, ABW: 6, MIT: 3, ANG: 1 };
/* Regeln alter Spiele (vor Kreo, Zeile „Minutenbonus“) – nur für Korrekturen an diesen Spielen */
export const LEGACY = { clean: { TW: 5, ABW: 3, MIT: 2, ANG: 1 }, win: 15, draw: 0, loss: -15 };

/* Aktionen, die als Tor bzw. Vorlage im Balkendiagramm gezählt werden (alte Schlüssel bleiben drin) */
export const GOAL_KEYS = { goal: 1, pen: 1 };
export const ASSIST_KEYS = { ast: 1, reb: 1, defl: 1, wood: 1 };

/* Vorschläge für die Schnellleiste, bevor etwas gebucht wurde */
export const QUICK_DEFAULTS = {
  TW: ['shh', 'catch', 'xcl', 'punch', 'thr', 'poss', 'rush', 'sv'],
  ANG: ['sot', 'duel', 'lost', 'poss', 'bcc', 'sjp', 'sfar', 'fouled3'],
  ABW: ['duel', 'icpt', 'lost', 'poss', 'clri', 'pf3', 'aerw', 'blk16'],
  MIT: ['duel', 'icpt', 'lost', 'poss', 'pf3', 'sast', 'lball', 'sot']
};
