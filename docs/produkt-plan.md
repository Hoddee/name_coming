# Kreo: Weg zum Start

Stand: 20.11.2026. Das ist ein Arbeitsplan und kein Rechtsrat. Rechtliche Punkte vor dem Start prüfen lassen.

## 1. Eigene Datenbank (Pflicht vor dem Start)

Kreo nutzt im Moment dieselbe Supabase-Datenbank wie Version 1. Alles, was Kreo speichert, landet in der Tabelle `spiele` der alten App. Für einen Start braucht Kreo ein eigenes Projekt.

1. Neues Supabase-Projekt anlegen, Region **EU (Frankfurt)**, damit die Daten in der EU bleiben.
2. Alle Migrationen der Reihe nach ausführen: `001` bis `014`. Sie sind idempotent.
3. Storage-Bucket anlegen. Version 1 heißt `kickbase`; für Kreo `kreo` nehmen und den Namen an zwei Stellen anpassen: `STORAGE_BASE` in `config.js` und der Upload in `api.js`.
4. In `js/config.js` die Werte `SUPABASE_URL` und `SUPABASE_KEY` tauschen.
5. Daten übernehmen, falls gewünscht: `kader`, `spielplan` und `spiele` aus der alten DB als CSV exportieren und importieren. Konten lassen sich nicht übernehmen, weil sie an Supabase Auth hängen. Alle registrieren sich neu.
6. Edge Function `push` neu deployen und VAPID-Schlüssel neu erzeugen. Den Cron für Montag 19 Uhr neu anlegen.
7. Auth-Einstellungen setzen: Site URL und Redirect auf die neue Adresse, E-Mail-Vorlagen auf Deutsch mit „Kreo“.

**Kosten:** Free reicht für einen Verein. Ab mehreren Vereinen oder vielen Zuschauern bei Live wird der Egress knapp (5 GB/Monat). Dann lohnt sich Pro (25 $/Monat) mit 250 GB.

## 2. Mehrere Vereine

Heute sind die eigenen Vereine fest im Code (`OWN_CLUBS`, `TEAMS`, Kader in `players.js`). Für weitere Vereine:

- **Vereinsverzeichnis gibt es schon** (Migration 015, `tools/vereine/README.md`): ganz Deutschland aus OpenStreetMap plus von Nutzern angelegte Vereine,
  Mannschaften (I, II, Frauen, AH, Jugend) und Staffeln je Saison. Für den Umbau: Spalte `verein_id` (ID aus dem Verzeichnis) in `kader`, `spiele`,
  `spielplan` und `live_spiele`, dazu eine kleine Tabelle mit Wappen, Slug und Vereins-Admin für Vereine, die Kreo aktiv nutzen.
- **Spielpläne:** `staffeln` und `mannschaften` sind dafür vorbereitet (Spiel = Staffel + Heim- und Gastmannschaft). Daten von fussball.de/FuPa
  nur mit offizieller Zustimmung – sonst trägt jeder Verein seine Spiele selbst ein.
- **RLS je Verein:** Admins dürfen nur ihren eigenen Verein ändern. Lesen bleibt öffentlich, oder pro Verein „privat“.
- **Einstieg per Link:** `?v=<slug>` merkt sich den Verein im Gerät. Liga, Ranking und MVP filtern auf diesen Verein. Eine Vereinsauswahl kommt beim ersten Start.
- **Manager-Liga je Verein oder vereinsübergreifend:** Den Markt bilden die Spieler der eigenen Liga. Spalte `verein_id` in `manager_moves` oder eine eigene Tabelle `manager_ligen` mit Einladungscode.
- **Offline-Kader** (`players.js`) nur noch als Rückfall für Version 1. In Kreo kommt alles aus der DB.

Das ist der größte Umbau. Er sollte als eigener PR in Schritten kommen: zuerst die Spalten (Standardwert = heutiger Verein), dann die Filter in der App, zuletzt die Vereinsauswahl.

## 3. Hosting und Adresse

- GitHub Pages ist laut Nutzungsbedingungen nicht für kommerzielle Angebote gedacht (z. B. Abo-Verkauf). Für einen echten Start besser Cloudflare Pages oder Netlify mit eigener Domain, z. B. `kreo.app`, falls frei. Beide haben einen kostenlosen Einstieg.
- Eigene Domain bringt auch saubere E-Mail-Absender für die Anmeldung (SMTP in Supabase eintragen).
- Nach dem Umzug `APP_URL` in `config.js` anpassen. Der Service Worker arbeitet mit relativen Pfaden, dafür ist nichts zu ändern.

## 4. Recht und Datenschutz

- **Impressum und Datenschutz:** Ein Entwurf liegt in `js/ui/legal.js`. Platzhalter (`BETREIBER`, Supabase-Region) ausfüllen.
- **Fotos und echte Namen** von Spielern liegen öffentlich im Repo (`assets/img/p/`). Vor dem Start von jedem Spieler eine Einwilligung einholen (Formular oder Häkchen beim Konto). Alternative: Repo privat machen und Fotos nur aus dem Storage laden.
- **Minderjährige Spieler:** Für sie braucht es die Einwilligung der Eltern.
- **Konto löschen:** Einen Knopf im Konto einbauen (Art. 17 DSGVO). Heute geht das nur per Admin.
- **Marke:** Den Namen „Kreo“ im DPMA-Register (und EUIPO) für Klasse 9/41/42 prüfen und eventuell anmelden. Keine Anlehnung an Kickbase in Texten, Look oder Store-Beschreibung.

## 5. Manager-Modus

Entschieden am 20.11.2026:
- **Nur mit Anmeldung.** Ohne Konto zeigt der Reiter Team nur „Anmelden“ oder „Fun-Punkte vergeben“.
- **Es zählen nur Spiele, die mit Anmeldung gespeichert wurden** (Spalte `spiele.mit_konto`, setzt der Server selbst, Migration 016).
  Gilt für Punkte und Preise im Manager. Spiele aus der Testphase zählen weiter.
- **Fun-Punkte** ohne Konto: jemandem (z. B. einem Kumpel) Punkte nach der Kreo-Tabelle geben, als Bild teilen. Nichts in der Datenbank.
- **Sich selbst kaufen ist erlaubt.** **Kein Ausgleich für späte Einsteiger.**
- **Migration 014** muss ausgeführt sein, sonst bleibt der Manager (angemeldet) lokal auf dem Gerät.
- Offen: Wer Spiele einträgt, könnte vorher den Spieler kaufen und dann viele Punkte buchen. Gegenmittel später: Admin-Korrekturen,
  nur Spiele zählen, die ein zweites Konto bestätigt.
- **Saisonwechsel:** Wechsel hängen an `season`. Die neue Saison startet automatisch leer.

## 6. Reihenfolge-Vorschlag

1. Manager-PR testen und mergen, Migrationen 014–016 in der gemeinsamen DB ausführen (neue Tabellen, eine neue Spalte in `spiele`).
2. Eigenes Supabase-Projekt (Abschnitt 1) und neue Adresse (Abschnitt 3).
3. Einwilligungen und Konto löschen (Abschnitt 4).
4. Mehrere Vereine (Abschnitt 2).
5. Test mit zwei, drei befreundeten Vereinen, danach öffentlicher Start.
