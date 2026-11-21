# Datenlauf in GitHub Actions (siehe .github/workflows/wappen.yml). Wird bei Änderung von lauf.txt gestartet.
set -e
node tools/vereine/wikidata-laden.mjs
node tools/vereine/wappen-laden.mjs
python3 tools/vereine/wappen-bilder.py
ls assets/img/w | wc -l
