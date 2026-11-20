/* SVG-Symbole als Strings (werden in Templates eingesetzt) */
import { PL, STATUS_NAME } from '../data/players.js';

export const ICON = {
  halftime: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 12h9"/></svg>',
  subOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v14M6 12l6 6 6-6"/></svg>',
  subIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M6 12l6-6 6 6"/></svg>',
  whistle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 17.5a7 7 0 0 0 13.6 2.3L28 15.5V10H12.5A7 7 0 0 0 4 17.5z"/><circle cx="11" cy="17.5" r="2"/><path d="M20 10V6.5"/></svg>',
  /* Ball, Schuh und Zu-null-Symbol: eigene Kreo-Symbole (weiß auf dem Balken) */
  ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 5.2l-3.3 2.4 1.3 3.9h4l1.3-3.9zM12 5a7 7 0 0 0-2.6.5L12 7.3l2.6-1.8A7 7 0 0 0 12 5zm5.6 2.9l-1 3.1 1.9 2.6.5-.1a7 7 0 0 0-1.4-5.6zm-11.2 0A7 7 0 0 0 5 13.5l.5.1 1.9-2.6zm2.4 7.6l-1.9 2.5a7 7 0 0 0 3.5 1.9l.8-.6-.2-3.8zm6.4 0l-2.2 0-.2 3.8.8.6a7 7 0 0 0 3.5-1.9z"/></svg>',
  boot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5.5c0-.8.7-1.5 1.5-1.5h3c.8 0 1.5.7 1.5 1.5V9l2.6 1.4 1.4-1.1 1 1.2-1.2 1 1.7.9 1.3-1 1 1.2-1 .8c1.7.9 3.2 2.3 3.2 4.1 0 .9-.7 1.6-1.6 1.6H5.5C4.7 19.5 4 18.8 4 18zM5 20.5h15v1.5H5z"/></svg>',
  zero: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 3c3.6 0 6 3.6 6 9s-2.4 9-6 9-6-3.6-6-9 2.4-9 6-9zm0 3c-1.7 0-3 2.4-3 6 0 1.1.1 2.1.4 3l4.9-8.2A2.5 2.5 0 0 0 12 6zm2.6 3l-4.9 8.2c.6.5 1.4.8 2.3.8 1.7 0 3-2.4 3-6 0-1.1-.1-2.1-.4-3z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  injured: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#E5262D"/><path d="M8 4.5h4v3.5h3.5v4H12v3.5H8V12H4.5V8H8z" fill="#fff"/></svg>',
  knock: '<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(-45 10 10)"><rect x="1" y="6" width="18" height="8" rx="4" fill="#F2A33A"/><rect x="7" y="6" width="6" height="8" fill="#F7C987"/><circle cx="8.8" cy="8.6" r=".7" fill="#B9701C"/><circle cx="11.2" cy="8.6" r=".7" fill="#B9701C"/><circle cx="8.8" cy="11.4" r=".7" fill="#B9701C"/><circle cx="11.2" cy="11.4" r=".7" fill="#B9701C"/></g></svg>',
  brand: '<svg viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="9" fill="#8B6CFF"/><path d="M10.5 7.5v15M10.5 18l7.5-6.2M14 15.4l4.7 7.1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="9" r="2" fill="#C9FF4A"/></svg>',
  /* Uhr mit Kreuz: per Korrektur entfernte Aktion */
  removed: '<svg viewBox="0 0 24 24" class="ic-rm" aria-label="entfernt" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v3.5h-3.5"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>',
};

/* Verletzungs-Symbol: rotes Kreuz = verletzt, Pflaster = angeschlagen */
export function statusIcon(playerId) {
  const st = PL[playerId] && PL[playerId].status;
  if (st !== 'inj' && st !== 'hit') return '';
  const label = STATUS_NAME[st] + (PL[playerId].info ? ': ' + PL[playerId].info : '');
  return '<span class="sti" title="' + label.replace(/"/g, '&quot;') + '" aria-label="' + label.replace(/"/g, '&quot;') + '">' + (st === 'inj' ? ICON.injured : ICON.knock) + '</span>';
}
