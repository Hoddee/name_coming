/* Kreo-Marktwert.
   Startwert: individuell aus dem Kader (leicht "krumm" gemacht, fest pro Spieler, auf allen Geräten gleich).
   Pro gespeichertem Spiel gibt es Bewertungspunkte; jeder Punkt = 1 % Marktwertänderung:
     Leistung: (Punkte − 60) / 25, gerundet, von −4 bis +6
     Einsatz:  90 Min. +2 · 45–89 +1 · darunter 0
     Ergebnis: Sieg +1 · Niederlage −1 (nur mit Einsatzminuten)
     Zu null:  +1 (kein Gegentor und mindestens 15 Minuten gespielt – wie bei den Punkten)
     Form:     +1, wenn das Spiel mindestens 30 Punkte über dem bisherigen Schnitt des Spielers liegt (ab dem 3. Spiel)
   Dazu ein kleines Markt-Rauschen (±0,25 %), damit die Werte nicht glatt wirken.
   Grenzen: mindestens 500.000 €, höchstens 30.000.000 €.
   Alles wird aus den gespeicherten Spielen berechnet – Regeländerungen gelten rückwirkend für alle Spiele. */
import { PL } from '../data/players.js';
import { hash01, cleanSheet } from './util.js';

export const MW_MIN = 500000;
export const MW_MAX = 30000000;
const PCT_PER_POINT = 0.01;
const NOISE = 0.005;

const clamp = v => Math.max(MW_MIN, Math.min(MW_MAX, Math.round(v)));

export function startValue(id) {
  const p = PL[id], base = (p && p.mw) || 1000000;
  if (p && p.exact) return clamp(base);
  return clamp(base * (0.975 + hash01('mw:' + id) * 0.06));
}

/* Bewertung eines Spiels: g = { points, minutes, us, them }; prev = { n, avg } der Spiele davor (optional) */
export function rating(g, prev) {
  const pts = g.points, m = g.minutes || 0;
  const perf = Math.max(-4, Math.min(6, Math.round((pts - 60) / 25)));
  const time = m >= 90 ? 2 : m >= 45 ? 1 : 0;
  /* Ohne Einsatzminuten zählt das Ergebnis nicht (nicht eingesetzt = 0) */
  const result = m <= 0 ? 0 : g.us > g.them ? 1 : g.us < g.them ? -1 : 0;
  const clean = cleanSheet(g) ? 1 : 0;
  const form = prev && prev.n >= 2 && pts >= prev.avg + 30 ? 1 : 0;
  return {
    total: perf + time + result + clean + form,
    parts: [['Leistung', perf], ['Einsatz', time], ['Ergebnis', result], ['Zu null', clean], ['Form', form]]
  };
}

export function nextValue(value, g, seed, prev) {
  const pct = rating(g, prev).total * PCT_PER_POINT + (hash01(seed) - 0.5) * NOISE;
  return clamp(value * (1 + pct));
}

/* games: Liste aller Spiele (aufsteigend sortiert wird intern) */
export function marketOf(id, games) {
  let v = startValue(id), last = 0, n = 0, sum = 0;
  const series = [{ v }];
  for (const g of byDate(games.filter(x => x.player === id))) {
    const nv = nextValue(v, g, g.uid, { n, avg: n ? sum / n : 0 });
    last = nv - v; v = nv; series.push({ v, g });
    n++; sum += g.points;
  }
  return { v, last, series, prev: { n, avg: n ? sum / n : 0 } };
}

export const byDate = list => list.slice().sort((a, b) => (a.played_at < b.played_at ? -1 : 1));
