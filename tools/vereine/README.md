# Vereinsdatenbank

Die App findet Vereine aus ganz Deutschland über eine Suche (Ansicht `vereine`). Die Daten kommen aus drei Quellen:

| Quelle | Was | Wo | Lizenz |
|---|---|---|---|
| OpenStreetMap | Vereine (`club=sport` + Fußball), Sportanlagen, Plätze mit Betreiber | `quellen/osm.tsv` → `assets/data/vereine.json` | ODbL 1.0, Namensnennung Pflicht |
| Wikidata | Fußballvereine mit Ort/Koordinaten | `quellen/wikidata.tsv` (optional) | CC0 |
| Nutzer der App | fehlende Vereine, Mannschaften (I, II, Frauen, AH, Jugend) mit Liga/Staffel, Meldungen | Supabase, Migration 015 | eigene Daten |

Dazu kommen die Kreisliga-Teams aus `js/data/clubs.js` (Rems/Murr) als Startwissen über Mannschaften und Ligen.

## Aktualisieren

```
node tools/vereine/osm-laden.mjs        # ca. 5–10 Min., je Bundesland eine Overpass-Abfrage
node tools/vereine/wikidata-laden.mjs   # optional
node tools/vereine/build.mjs            # baut assets/data/vereine.json
```

Oder auf GitHub: Actions → „Vereinsliste aktualisieren“ → Run workflow. Die Action macht einen Pull Request, nichts geht von selbst live.
Nach einem Update `VERSION` in `sw.js` nicht nötig: `vereine.json` ist keine Shell-Datei und wird „erst Netz, dann Cache“ geladen.

## Was `build.mjs` macht

- Namen säubern („Sportheim des TSV …“ → „TSV …“, „e. V.“ weg), nur Namen behalten, die nach Fußballverein aussehen
  (Kürzel wie SV, TSV, FC … oder Wörter wie Sportfreunde, Eintracht), andere Sportarten und Gemeinden raus.
- Doppelte zusammenführen: gleicher Name (nach `words()` aus `js/core/vsearch.js`) im Umkreis von 15 km oder gleiche Wikidata-ID.
- Fehlendes Bundesland aus den 5 nächsten Einträgen.

## Suche in der App (`js/core/vsearch.js`)

Abkürzungen vereinheitlichen (Turn- und Sportverein = TSV), Kölner Phonetik (Vornspach = Fornsbach), Tippfehler (Levenshtein),
Kürzel zählen wenig, der Ort viel. Läuft komplett im Gerät – kein Supabase-Traffic. Von Nutzern angelegte Vereine fragt die App
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

Stand 20.11.2026: 2604 Vereine aus OpenStreetMap. Der DFB zählt rund 24.000 Vereine – OSM kennt also etwa jeden neunten.
Der Rest kommt über „Verein anlegen“ in der App dazu (mit Ortsprüfung, Doppelte werden vorher angezeigt) und über spätere Updates.
