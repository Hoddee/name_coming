/* Impressum und Datenschutz (Entwurf).
   Vor einem öffentlichen Start: Angaben in BETREIBER ausfüllen, Text prüfen lassen (kein Rechtsrat) und
   die Region des eigenen Supabase-Projekts eintragen. Erreichbar über „Konto“ ganz unten. */
import { $, esc, applyTier } from '../core/util.js';
import { APP_NAME } from '../config.js';
import { registerView } from '../router.js';

const BETREIBER = {
  name: '[Vorname Nachname]',
  adresse: '[Straße Nr.], [PLZ Ort]',
  mail: '[E-Mail-Adresse]',
  stand: 'Entwurf, November 2026'
};

const sec = (t, body) => '<h2>' + esc(t) + '</h2>' + body;
const p = t => '<p>' + t + '</p>';

function html() {
  const b = BETREIBER, app = esc(APP_NAME);
  return '<div class="lg">' +
    sec('Impressum', p('Angaben gemäß § 5 DDG') + p(esc(b.name) + '<br>' + esc(b.adresse)) + p('E-Mail: ' + esc(b.mail)) +
      p('Verantwortlich für den Inhalt: ' + esc(b.name) + ', Anschrift wie oben.')) +
    sec('Datenschutz', p('Verantwortlich: ' + esc(b.name) + ', ' + esc(b.adresse) + ', ' + esc(b.mail) + '.') +
      '<h3>Was gespeichert wird</h3><ul>' +
      '<li><b>Spiele und Punkte:</b> Spielername, Verein, Gegner, Ergebnis, Einsatzminuten, gebuchte Aktionen und wer das Spiel eingetragen hat. Öffentlich in ' + app + ' sichtbar.</li>' +
      '<li><b>Spielerprofile:</b> Name, Position, Verein, Status und Foto. Nur mit Einverständnis der Spieler.</li>' +
      '<li><b>Konto:</b> E-Mail-Adresse und Passwort (verschlüsselt) für die Anmeldung, dazu der verknüpfte Spieler.</li>' +
      '<li><b>Fun-Punkte:</b> nur auf dem Gerät, nichts in der Datenbank.</li>' +
      '<li><b>Manager:</b> Teamname und Käufe/Verkäufe mit Zeitpunkt. Für alle angemeldeten Manager sichtbar.</li>' +
      '<li><b>Push:</b> nur wenn eingeschaltet, die Push-Adresse des Geräts.</li>' +
      '<li><b>Datenmenge:</b> eine zufällige Gerätekennung und die geladene Datenmenge pro Tag, ohne Bezug zur Person.</li>' +
      '<li><b>Auf dem Gerät:</b> laufendes Spiel, Einstellungen und Anmeldung im Speicher des Browsers. Keine Werbe- oder Analyse-Cookies.</li></ul>' +
      '<h3>Dienstleister</h3><ul>' +
      '<li><b>Supabase</b> (Datenbank, Anmeldung, Dateien, Live). Auftragsverarbeitung, Region: [Region eintragen].</li>' +
      '<li><b>GitHub Pages</b> (Auslieferung der App). Dabei fallen technisch IP-Adressen an.</li>' +
      '<li><b>jsDelivr</b> nur beim Freistellen eines Fotos (Bildbearbeitung läuft im Browser).</li>' +
      '<li><b>OpenStreetMap Foundation</b> (Nominatim) nur beim Anlegen eines Vereins: der eingegebene Ort wird dort geprüft.</li></ul>' +
      '<h3>Vereinsdaten</h3>' + p('Vereinsliste aus OpenStreetMap, © OpenStreetMap-Mitwirkende, Lizenz ODbL 1.0. Von Nutzern angelegte Vereine und Mannschaften sind öffentlich sichtbar; gespeichert wird dazu, welches Konto sie angelegt hat.') +
      '<h3>Rechtsgrundlage</h3>' + p('Konto, Manager und Push: Art. 6 Abs. 1 lit. b DSGVO (Nutzung der App). Spielerprofile und Fotos: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, jederzeit widerrufbar. Spiele und Statistik: berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO.') +
      '<h3>Deine Rechte</h3>' + p('Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Eine Nachricht an ' + esc(b.mail) + ' genügt.')) +
    '<p class="lg-st">' + esc(b.stand) + '</p></div>';
}

export function initLegal() {
  registerView('legal', { elements: ['legal'], render: () => { $('legalBody').innerHTML = html(); applyTier(0); } });
}
