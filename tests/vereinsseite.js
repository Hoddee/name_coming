// Vereinsseite 2.6: Wappen in Listen, Steckbrief (Landkreis, Verband), Stöbern nach Bundesland/Landkreis,
// Spieler nicht gefunden → anlegen/einladen, Kader als Liste (Erkennung), Einladungs-Link (?t=) mit „Das bin ich“
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // Daten: Format 2 mit Landkreis/Verband, Liste erkennt Zeilen
  const d = await p.evaluate(async () => {
    const S = await import('./js/services/vereine.js'), SP = await import('./js/services/spieler.js');
    await S.loadVereine();
    const f = S.searchLocal('SC Fornsbach', 1)[0] || {};
    const k = SP.parseKader('Max Mustermann 9 ST\nMüller, Tim TW\n7 Can Celik\nquatsch');
    return { kreis: f.kreis, vb: f.verband, crest: S.vereinCrest(f).slice(0, 30), withKreis: S.vr.list.filter(v => v.kreis).length, n: S.vr.list.length,
      parsed: k.out.map(x => x.vn + ' ' + x.n + '|' + (x.num || '') + '|' + x.pos).join(';'), bad: k.bad.join(',') };
  });
  ok(d.kreis === 'Rems-Murr-Kreis', 'Landkreis Fornsbach: ' + d.kreis);
  ok(d.vb === 'WFV', 'Verband Fornsbach: ' + d.vb);
  ok(d.withKreis / d.n > 0.9, 'Landkreis für > 90 %: ' + d.withKreis + '/' + d.n);
  ok(/^(data:image\/svg|assets\/img\/[wc]\/)/.test(d.crest), 'Wappen: ' + d.crest);
  ok(d.parsed === 'Max Mustermann|9|ANG;Tim Müller||TW;Can Celik|7|MIT', 'Liste erkannt: ' + d.parsed);
  ok(d.bad === 'quatsch', 'Nicht erkannt: ' + d.bad);

  // Suche: Spieler nicht gefunden → anlegen / einladen
  await c('[data-st="vereine"]'); await p.waitForTimeout(500);
  await c('[data-su="tab:all"]'); await p.fill('#suQ', 'Celik Asbach'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => !!document.querySelector('.su-miss [data-su="neu"]') && !!document.querySelector('.su-miss [data-su="einl"]')), 'Nicht gefunden: Anlegen + Einladen');
  ok(await p.evaluate(() => document.querySelectorAll('#suList img.vr-cr').length > 0), 'Wappen in der Vereinsliste');
  await p.screenshot({ path: 'out/vs-suche-leer.png' });

  // Vereinsseite: Steckbrief
  await p.fill('#suQ', 'SC Fornsbach'); await p.waitForTimeout(800);
  await c('.vr-row'); await p.waitForTimeout(900);
  const vs = await p.evaluate(() => ({ crest: !!document.querySelector('.vr-crest img'), facts: [...document.querySelectorAll('.vr-facts dt')].map(e => e.textContent).join(','),
    invite: !!document.querySelector('[data-vr="invite"]'), liste: !!document.querySelector('[data-vr="liste"]') }));
  ok(vs.crest, 'Großes Wappen');
  ok(/Liga/.test(vs.facts) && /Landkreis/.test(vs.facts) && /Verband/.test(vs.facts), 'Steckbrief: ' + vs.facts);
  ok(vs.invite && vs.liste, 'Team einladen + Kader als Liste');
  await p.screenshot({ path: 'out/vs-verein.png', fullPage: true });
  await c('[data-vr="invite"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('#einBody [data-ei="login"]')), 'Einladen nur angemeldet');
  await c('[data-nav="back"]'); await p.waitForTimeout(300);
  await c('[data-vr="liste"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('#klBody [data-ei="login"]')), 'Liste nur angemeldet');

  // Stöbern: Baden-Württemberg → Rems-Murr-Kreis
  await p.evaluate(async () => { (await import('./js/router.js')).show('vereine'); });
  await p.waitForTimeout(400);
  await c('[data-vr="land:BW"]'); await p.waitForTimeout(300);
  const kreise = await p.evaluate(() => document.querySelectorAll('.vr-kr').length);
  ok(kreise >= 40, 'Landkreise in BW: ' + kreise);
  await c('[data-vr="kreis:Rems-Murr-Kreis"]'); await p.waitForTimeout(400);
  const rm = await p.evaluate(() => [...document.querySelectorAll('#vrList .vr-row b')].map(e => e.textContent));
  ok(rm.includes('SC Fornsbach') && rm.length > 40, 'Vereine im Rems-Murr-Kreis: ' + rm.length);
  await p.screenshot({ path: 'out/vs-stoebern.png' });

  // Einladungs-Link: Kader mit „vergeben“, ohne Konto nur Anmelden
  await p.route(/rpc\/einladung_lesen/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ verein_id: 'k-fornsbach', verein_name: 'SC Fornsbach', team_art: 'herren', team_nr: 1, gueltig: true,
    spieler: [{ id: 'spaaaaaaaaaa', vorname: 'Can', nachname: 'Celik', pos: 'ANG', nummer: 9, beansprucht: false }, { id: 'spbbbbbbbbbb', vorname: 'Tim', nachname: 'Müller', pos: 'TW', nummer: 1, beansprucht: true }] }]) }));
  await p.goto('http://localhost:8123/?t=0123456789ab', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const inv = await p.evaluate(() => ({ view: !document.getElementById('einladung').hidden, rows: document.querySelectorAll('.ei-row').length, own: document.querySelectorAll('.ei-own').length,
    login: !!document.querySelector('#eiBody [data-ei="login"]'), head: (document.querySelector('.ei-head b') || {}).textContent }));
  ok(inv.view && inv.rows === 2 && inv.own === 1 && inv.login && inv.head === 'SC Fornsbach', 'Einladung: ' + JSON.stringify(inv));
  await p.screenshot({ path: 'out/vs-einladung.png' });

  const w = t.writes.filter(x => !/rpc\/(spieler_suche2?|vereine_suche|einladung_lesen)/.test(x));
  ok(w.length === 0, 'Schreibzugriffe: ' + w.join(', '));
  ok(t.errs.length === 0, 'JS-Fehler: ' + t.errs.join(' | '));
  console.log('Fehler:', fails.length ? fails : 'keine');
  await t.b.close();
  process.exit(fails.length ? 1 : 0);
})();
