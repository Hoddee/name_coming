/* Manager-Spiel: jeder stellt sich aus dem Kader ein Team zusammen und sammelt die Punkte seiner Spieler.
   Regeln:
     - Startbudget BUDGET, höchstens TEAM_SIZE Spieler, höchstens ein Torwart.
     - Kaufen und Verkaufen zum aktuellen Marktwert. Der Preis wird nie gespeichert, sondern immer aus den Spielen
       berechnet, die zum Zeitpunkt des Wechsels schon gespeichert waren (created_at) – so kann niemand einen Preis „mitschicken“
       und ein später nachgetragenes Spiel macht einen alten Kauf nicht ungültig.
     - Ein Spieler bringt die Punkte aller Spiele, die er gespielt hat, während er im Team war (played_at zwischen Kauf und Verkauf).
   Wechsel = Liste { t (ms), p (Spieler-ID), a ('buy'|'sell') }. Ungültige Wechsel (zu teuer, Team voll, doppelt …) fallen weg.
   Alles hier ist reine Rechnung ohne Speicher oder Netz – gleich für das eigene Team und für die Manager-Liga. */
import { PL } from '../data/players.js';
import { marketOf } from './market.js';

export const BUDGET = 50000000;
export const TEAM_SIZE = 5;
export const MAX_TW = 1;

const at = g => new Date(g.played_at).getTime();
const known = g => new Date(g.created_at || g.played_at).getTime();

/* Marktwert eines Spielers zum Zeitpunkt t (nur Spiele, die da schon gespeichert waren) */
export function valueAt(p, games, t) {
  return marketOf(p, games.filter(g => g.player === p && known(g) < t)).v;
}

/* Wechsel nachspielen: Ergebnis ist das Team mit Kaufzeitpunkten und das Budget */
export function replay(moves, games) {
  let budget = BUDGET;
  const team = new Map(), stints = [], ok = [];
  for (const m of moves.slice().sort((a, b) => a.t - b.t)) {
    if (!PL[m.p] || PL[m.p].guest) continue;
    if (m.a === 'buy') {
      if (team.has(m.p) || team.size >= TEAM_SIZE) continue;
      if (PL[m.p].pos === 'TW' && [...team.keys()].filter(id => PL[id].pos === 'TW').length >= MAX_TW) continue;
      const v = valueAt(m.p, games, m.t);
      if (v > budget) continue;
      budget -= v; team.set(m.p, { from: m.t, paid: v }); ok.push(Object.assign({ v }, m));
    } else if (m.a === 'sell') {
      const s = team.get(m.p);
      if (!s) continue;
      const v = valueAt(m.p, games, m.t);
      budget += v; team.delete(m.p); stints.push({ p: m.p, from: s.from, to: m.t, paid: s.paid, got: v }); ok.push(Object.assign({ v }, m));
    }
  }
  for (const [p, s] of team) stints.push({ p, from: s.from, to: Infinity, paid: s.paid });
  return { budget, team: [...team.keys()], stints, moves: ok };
}

/* Punkte eines Teams: je Spieler die Spiele in seiner Zeit im Team; optional nur ab/bis (Spieltag) */
export function teamPoints(state, games, from = -Infinity, to = Infinity) {
  let sum = 0;
  const per = new Map();
  for (const s of state.stints) {
    for (const g of games) {
      if (g.player !== s.p) continue;
      const t = at(g);
      if (t < s.from || t >= s.to || t < from || t >= to) continue;
      sum += g.points;
      per.set(s.p, (per.get(s.p) || 0) + g.points);
    }
  }
  return { sum, per };
}

/* Wert des Kaders jetzt */
export const teamValue = (state, games) => state.team.reduce((s, p) => s + marketOf(p, games).v, 0);

/* Darf p gerade gekauft werden? Gibt einen kurzen Grund zurück oder '' */
export function buyBlock(state, p, games) {
  if (state.team.includes(p)) return 'Im Team';
  if (state.team.length >= TEAM_SIZE) return 'Team voll';
  if (PL[p] && PL[p].pos === 'TW' && state.team.some(id => PL[id] && PL[id].pos === 'TW')) return 'Schon ein Torwart';
  if (marketOf(p, games).v > state.budget) return 'Zu teuer';
  return '';
}

/* Woche Mo–So wie beim Spieltag (Gerätezeit) */
export function weekRange(now = new Date()) {
  const s = new Date(now); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - (s.getDay() + 6) % 7);
  const e = new Date(s); e.setDate(e.getDate() + 7);
  return [s.getTime(), e.getTime()];
}

/* Manager-Liga: managers = [{ id, name, moves }] → Tabelle nach Punkten, dann Gesamtwert */
export function leagueTable(managers, games, now = new Date()) {
  const [ws, we] = weekRange(now);
  return managers.map(m => {
    const st = replay(m.moves, games);
    return { id: m.id, name: m.name, me: !!m.me, pts: teamPoints(st, games).sum, week: teamPoints(st, games, ws, we).sum,
      worth: st.budget + teamValue(st, games), team: st.team };
  }).sort((a, b) => b.pts - a.pts || b.worth - a.worth);
}
