// Vereinssuche: unscharfe Suche (Tippfehler, Phonetik, Abkürzungen), Verein mit Mannschaften/Liga,
// Mein Verein, Verein anlegen (nur angemeldet) und Fun-Punkte ohne Konto
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // Suchmaschine ohne Oberfläche
  const r = await p.evaluate(async () => {
    const V = await import('./js/core/vsearch.js'), S = await import('./js/services/vereine.js');
    await S.loadVereine();
    const top = q => (S.searchLocal(q, 3)[0] || {}).name || '';
    return {
      n: S.vr.list.length, phon: V.koeln('Vornspach') === V.koeln('Fornsbach'),
      vorn: top('SC Vornspach'), typo: top('TSC Murhardt'), lang: top('Turn- und Sportverein Leutenbach'), ort: top('Fornsbach'),
      split: JSON.stringify(V.splitTeam('SC Fornsbach II')), none: S.searchLocal('xqzw blub', 3).length,
      simple: V.simple('Großerlach Süd-1'),
      teams: (await S.loadTeams((S.searchLocal('SC Fornsbach', 1)[0] || {}).id || '')).map(x => x.nummer).join(',')
    };
  });
  ok(r.n > 2000, 'Grundbestand geladen: ' + r.n);
  ok(r.phon, 'Kölner Phonetik');
  ok(r.vorn === 'SC Fornsbach', '„SC Vornspach“ findet: ' + r.vorn);
  ok(r.typo === 'TSC Murrhardt', 'Tippfehler: ' + r.typo);
  ok(r.lang === 'TSV Leutenbach', 'Ausgeschrieben: ' + r.lang);
  ok(r.split === '{"base":"SC Fornsbach","nr":2}', 'Mannschaftsnummer: ' + r.split);
  ok(r.none === 0, 'Unsinn findet nichts');
  ok(r.simple === 'grosserlach sued 1', 'simple(): ' + r.simple);
  ok(r.teams === 'B2', 'Mannschaften SC Fornsbach: ' + r.teams);

  // Oberfläche: Liga-Seite → Suche → Verein
  await c('[data-st="vereine"]'); await p.waitForTimeout(500);
  await p.fill('#vrQ', 'sc vornspach'); await p.waitForTimeout(700);
  const first = await p.evaluate(() => { const b = document.querySelector('.vr-row b'); return b && b.textContent; });
  ok(first === 'SC Fornsbach', 'Erster Treffer: ' + first);
  await p.screenshot({ path: 'out/vereine-suche.png' });
  await c('.vr-row'); await p.waitForTimeout(800);
  const det = await p.evaluate(() => ({ h: (document.querySelector('.vr-head h1') || {}).textContent, lg: [...document.querySelectorAll('.vr-team small')].map(e => e.textContent).join('|') }));
  ok(det.h === 'SC Fornsbach' && /Kreisliga B2/.test(det.lg), 'Verein mit Liga: ' + JSON.stringify(det));
  await c('[data-vr="mine"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('kreo-club-v1') || '{}').name === 'SC Fornsbach'), 'Mein Verein gemerkt');
  ok(await p.evaluate(() => !!document.querySelector('#vrBody [data-nav="admin"]')), 'Eintragen nur angemeldet');
  await p.screenshot({ path: 'out/vereine-verein.png' });

  // Verein anlegen ohne Konto: nur Anmelden
  await c('[data-nav="back"]'); await p.waitForTimeout(300);
  await p.fill('#vrQ', 'FC Gibtsnichtdorf'); await p.waitForTimeout(600);
  await c('[data-vr="neu"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('#vrNeuForm') && !!document.querySelector('#vrNeuBody [data-nav="admin"]')), 'Anlegen nur angemeldet');

  // Fun-Punkte: buchen, zurücknehmen, Verlauf – nichts an die Datenbank
  await p.evaluate(() => { location.hash = ''; }); await c('[data-tb="start"]'); await p.waitForTimeout(400);
  await c('[data-st="fun"]'); await p.waitForTimeout(400);
  await p.fill('[name="fname"]', 'Kumpel');
  await c('[data-fun="pos:ANG"]'); await p.waitForTimeout(100);
  await c('[data-fun="a:goal"]'); await c('[data-fun="a:goal"]'); await p.waitForTimeout(100);
  await c('[data-fun="undo:1"]'); await p.waitForTimeout(100);
  const tot = await p.evaluate(() => +document.querySelector('.fun-total b').textContent);
  ok(tot === 85, 'Fun-Summe (Tor Sturm): ' + tot);
  await p.screenshot({ path: 'out/fun.png' });
  await c('[data-fun="new"]'); await p.waitForTimeout(100);
  const fun = await p.evaluate(() => JSON.parse(localStorage.getItem('kreo-fun-v1')));
  ok(fun.hist.length === 1 && fun.hist[0].name === 'Kumpel' && fun.hist[0].t === 85 && !fun.cur.ev.length, 'Verlauf: ' + JSON.stringify(fun.hist));
  const w = t.writes.filter(x => !/rpc\/vereine_suche/.test(x)); // Suche ist ein Lesen per POST
  ok(!w.length, 'Nichts geschrieben: ' + w.join(', '));
  console.log('Fehler:', fails.length || t.errs.length ? fails.concat(t.errs) : 'keine'); await t.b.close();
})();
