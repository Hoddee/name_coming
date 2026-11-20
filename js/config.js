/* Zentrale Konfiguration. Der Publishable Key ist öffentlich gedacht; die Rechte regelt Row Level Security in Supabase. */
export const SUPABASE_URL = 'https://eewvsquscmflxdhkgvna.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_tWF4nhJLNDqHsuGSK07zmw_54ZiRmPU';
/* Storage-Bucket heißt aus der ersten Version noch „kickbase“ (gemeinsame Datenbank) */
export const STORAGE_BASE = SUPABASE_URL + '/storage/v1/object/public/kickbase/';

/* Adresse der App, auf die Passwort-Links aus E-Mails zurückführen */
export const APP_URL = 'https://hoddee.github.io/name_coming/';
/* Öffentlicher Schlüssel für Push-Benachrichtigungen (der private liegt nur als Secret bei der Edge Function „push“) */
export const VAPID_PUBLIC = 'BPpdkr18TxFId_jZJ6A0qLOo3pkdTIdKzKqfSYsnChxvth3Oq3Vn4VzAdmfkCmEZEFQpB9aOw9omTvpAEto28Ms';

export const SEASON = '2026/2027';

/* Angezeigte Version (Konto-Seite) – zusammen mit VERSION in sw.js hochzählen */
export const APP_VERSION = '2.3.0';
/* Name der App (Titel, Teilen-Bilder, Benachrichtigungen) */
export const APP_NAME = 'Kreo';

/* localStorage-Schlüssel (alte Namen bleiben, damit laufende Spiele ein Update überstehen) */
export const KEYS = {
  game: 'matchday-punkte-v3',
  lastSelection: 'matchday-last-v1', schedule: 'kl-schedule-v1', intro: 'kl-intro-v1', intro2: 'kl-intro-v2', tourBook: 'kl-tour-book-v1', mvpSeen: 'kl-mvp-seen', mvpNews: 'kl-mvp-news', recorder: 'kl-recorder', oneHand: 'kl-onehand', traffic: 'kl-traffic',
  intro3: 'kl-intro-v3', tourBook2: 'kl-tour-book-v2', dev: 'kl-dev', mit: 'kl-mit',
  roster: 'kl-roster-v1',
  auth: 'kl-auth-v1',
  manager: 'kreo-manager-v1', tourMgr: 'kreo-tour-mgr-v1',
  club: 'kreo-club-v1', fun: 'kreo-fun-v1',
  ext: 'kreo-ext-v1', recent: 'kreo-recent-v1', follow: 'kreo-follow-v1'
};
