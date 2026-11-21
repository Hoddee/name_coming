# Vereinsdatenbank

Die App findet Vereine aus ganz Deutschland über eine Suche (Ansicht `vereine`). Die Daten kommen aus vier Quellen:

| Quelle | Was | Wo | Lizenz |
|---|---|---|---|
| OpenStreetMap | Vereine (`club=sport` + Fußball), Sportanlagen, Plätze mit Betreiber | `quellen/osm.tsv` → `assets/data/vereine.json` | ODbL 1.0, Namensnennung Pflicht |
| Wikidata | Fußballvereine mit Ort/Koordinaten | `quellen/wikidata.tsv` | CC0 |
| Overture Maps Places | Vereine aus Firmen-/Vereinsregistern (Quelle BrightQuery) und Meta-Orten, Kategorie Sportverein/-liga/-platz | `quellen/overture.tsv` | CDLA Permissive 2.0, Namensnennung |
| Wikipedia (deutsch) | Kategorien „Fußballverein aus …“ / „Verein im …verband“, Infobox (Liga, Saison, Farben, Logo) | `quellen/dewiki.tsv` | nur Fakten übernommen |
| Wikimedia Commons | freie Vereinslogos (Wikidata P154 / Infobox), Lizenz + Urheber je Datei | `quellen/wappen.tsv` → `assets/img/w/<Q-ID>.webp`, `assets/data/wappen.json` | je Datei (meist gemeinfrei, „Schöpfungshöhe nicht erreicht“) |
| Overture Divisions | Landkreise (Grenzen), Orte (Punkte) | `kreise.json`, `quellen/orte.tsv` | CDLA Permissive 2.0 |
| Nutzer der App | fehlende Vereine, Mannschaften (I, II, Frauen, AH, Jugend) mit Liga/Staffel, Meldungen | Supabase, Migration 015 | eigene Daten |

Dazu kommen die Kreisliga-Teams aus `js/data/clubs.js` (Rems/Murr) als Startwissen über Mannschaften und Ligen.

## Aktualisieren

```
node tools/vereine/osm-laden.mjs        # ca. 5–10 Min., je Bundesland eine Overpass-Abfrage
node tools/vereine/wikidata-laden.mjs   # optional
python3 tools/vereine/overture-laden.py # optional, braucht: pip install pyarrow fsspec aiohttp requests (10–30 Min.)
node tools/vereine/build.mjs            # baut assets/data/vereine.json
```

Oder auf GitHub: Actions → „Vereinsliste aktualisieren“ → Run workflow. Die Action macht einen Pull Request, nichts geht von selbst live.
Nach einem Update `VERSION` in `sw.js` nicht nötig: `vereine.json` ist keine Shell-Datei und wird „erst Netz, dann Cache“ geladen.

### Wappen- und Datenlauf (GitHub Action)

Im Cloud-Container sind Wikimedia/Wikidata gesperrt, deshalb lädt die Action „Wappen und Vereinsdaten“ (`.github/workflows/wappen.yml`):
Änderung an `lauf.txt` auf einem `claude/**`-Branch pushen → `lauf.sh` läuft (wikidata-laden, wappen-laden, wappen-bilder,
IDs aus der DB) und committet die Ergebnisse auf den Branch. Danach lokal `node tools/vereine/build.mjs`.
Landkreise/Orte: `python3 tools/vereine/kreise-laden.py`, `python3 tools/vereine/orte-laden.py` (Overture, geht auch im Container).

## Was `build.mjs` macht

- Namen säubern („Sportheim des TSV …“ → „TSV …“, „e. V.“ weg), nur Namen behalten, die nach Fußballverein aussehen
  (Kürzel wie SV, TSV, FC … oder Wörter wie Sportfreunde, Eintracht), andere Sportarten und Gemeinden raus.
- Overture: nur passende Kategorien (`OVKAT`), Kürzel wieder groß („Sv“ → „SV“), angehängte Vorstandsnamen weg,
  Langformen kurz („Turn- und Sportverein X“ → „TSV X“).
- Doppelte zusammenführen: gleicher Name (nach `words()` aus `js/core/vsearch.js`) im Umkreis von 15 km oder gleiche Wikidata-ID.
- Bundesland über die Landesgrenzen (`laender.json`), sonst aus den 5 nächsten Einträgen.
- Ohne Koordinaten: Ort aus `orte.tsv` (Ortsangabe oder Ortsname am Ende des Vereinsnamens, nur eindeutige Orte).
  Wikidata Q122940000–Q122960000 ist eine Sammelanlage bayerischer Vereine → Bayern. Wikipedia-Vereine ohne deutsches Bundesland fliegen raus.
- Landkreis per Punkt-in-Fläche (`kreise.json`), Verband aus der Wikipedia-Kategorie, sonst `verband-zuordnung.mjs` je Landkreis
  (geteilte Landkreise in BW/NRW bleiben leer), Bezirk für Bayern (Regierungsbezirk) und Niedersachsen (NFV-Bezirk).
- Mehrere Wikidata-IDs in einem Verein: die mit Wappen bzw. Artikel, ältester Eintrag zuerst (nicht Frauen/II); Name = Artikeltitel.
- **IDs bleiben stabil** (alte ID aus der letzten `vereine.json`). Zusammengeführte alte IDs stehen in `a` (alt → neu), die App leitet
  „Mein Verein“ um. Wirklich weggefallene IDs (fast nur Nicht-Fußball und aufgelöste Vereine) in `log/weggefallen.txt`.

## Suche in der App (`js/core/vsearch.js`)

Abkürzungen vereinheitlichen (Turn- und Sportverein = TSV), Kölner Phonetik (Vornspach = Fornsbach), Tippfehler (Levenshtein),
Kürzel zählen wenig, der Ort viel. Die Anfrage wird einmal vorbereitet (`prepQuery`), ~15 ms je Tastendruck bei 25.000 Vereinen. Läuft komplett im Gerät – kein Supabase-Traffic. Von Nutzern angelegte Vereine fragt die App
per `rpc/vereine_suche` (Trigramm-Suche in Postgres) nur, wenn im Grundbestand wenig passt.

## Rechtliches (Stand 20.11.2026, keine Rechtsberatung)

- **fussball.de**: keine offene Schnittstelle. Die Nutzungsbedingungen verbieten automatisiertes Auslesen; die Vereins-/Spieldaten
  sind als Datenbank geschützt (§ 87b UrhG). Deshalb **nicht** ausgelesen. Ein Link auf die Vereinsseite (Feld `web`) ist erlaubt.
- **FuPa**: ebenso keine offene Schnittstelle, Auslesen laut Bedingungen untersagt. Nur Links.
- **Verbände (WFV, BFV …)**: Vereinssuchen auf den Webseiten, aber keine offenen Daten. Sauberer Weg: offiziell anfragen
  (DFB-Medien/fussball.de-Datenservice, FuPa-Partnerprogramm, Landesverband).
- **OpenStreetMap**: frei nutzbar mit Namensnennung (steht in der App bei der Suche); abgeleitete Datenbanken unter ODbL.
- **Nominatim** (Ortsprüfung beim Anlegen): erlaubt bei geringer Nutzung – die App fragt nur einmal, wenn jemand „Anlegen“ tippt,
  keine Suche beim Tippen.

## Abdeckung

Stand 21.11.2026 (Version 2.6): **25.652 Vereine**. Bundesland 99,5 % (117 ohne), Landkreis 94 %, Landesverband 98 %,
Bezirk 31 % (nur Bayern/Niedersachsen), sicher Fußball 43 %, **freies Wappen 858 (3 %)**, Farben 7 %, Liga 7 %.
Wappen gibt es frei nur für Vereine mit Wikipedia-Artikel/Wikidata-Logo (meist ab Landesliga). Alle anderen bekommen ein
generiertes Wappen (Kürzel + Vereinsfarben) – bis der Verein sein eigenes hochlädt (Vereinsverwalter, Migration 018).
Wappen von Vereinsseiten, fussball.de oder FuPa werden nicht übernommen (Urheberrecht).

Stand 20.11.2026:
Stand 20.11.2026: **24.407 Vereine** (vorher 2.604). Der DFB zählt rund 24.000 Fußballvereine; in der Liste stehen auch
Sportvereine (TV, TSV …), deren Fußballabteilung nicht sicher ist, und vereinzelt Fehltreffer. Je Bundesland:
BW 3.2k, BY 4.6k, NW 4.3k, NI 2.7k, HE 2.1k, RP 1.6k, SN 1.2k, SH 0.8k, BB 0.7k, TH 0.7k, ST 0.7k, BE 0.5k, SL 0.4k, MV 0.4k, HH 0.2k, HB 0.1k.

| Quelle | Rohtreffer |
|---|---|
| OpenStreetMap (Vereine, Plätze, Anlagen) | ~7.000 |
| Wikidata | ~2.250 |
| Overture Maps (v. a. Vereinsregister über BrightQuery) | ~22.000 |

Bundesland kommt aus den Landesgrenzen (`laender.json`, Overture Divisions, vereinfacht). Fehlendes ergänzen Nutzer über
„Verein anlegen“, Fehler über „Melden“. Offizielle Daten (fussball.de/FuPa/Verbände): Anfrage-Entwurf in `docs/datenanfrage.md`.
