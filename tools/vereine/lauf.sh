# Datenlauf in GitHub Actions (siehe .github/workflows/wappen.yml). Wird bei Änderung von lauf.txt gestartet.
set -e
node tools/vereine/wikidata-laden.mjs
node tools/vereine/wappen-laden.mjs
python3 tools/vereine/wappen-bilder.py
ls assets/img/w | wc -l
# Welche Vereins-IDs nutzt die Datenbank schon? (nur lesen, öffentliche Spalten) – damit build.mjs sie nicht verliert
U=$(grep -o "https://[a-z0-9]*\.supabase\.co" js/config.js | head -1); K=$(grep -o "sb_publishable_[A-Za-z0-9_-]*" js/config.js | head -1)
for t in "spieler?select=verein_id" "mannschaften?select=verein_id" "vereine?select=id"; do
  curl -s -m 30 -H "apikey: $K" "$U/rest/v1/$t&limit=10000" -o "tools/vereine/log/db-$(echo $t | cut -d'?' -f1).json" || true
done
ls -la tools/vereine/log
