// Spielersuche: Spieler suchen (Gerät + DB), Profil, „+ Spiel“ mit Gegner aus der Vereinssuche, Speichern mit gültigen IDs,
// Laden eines gespeicherten Spiels mit gesuchtem Spieler (Hall of Fame), Spieler eintragen (Formular), Ausblenden, ohne Migration still
const L = require('./lib.js');
const SP = [
  { id: 'sp0123456789', vorname: 'Lukas', nachname: 'Meier', verein_id: 'q162195', verein_name: '1. FC 08 Birkenfeld', team_id: null, team_art: 'herren', team_nr: 2, pos: 'ANG', nummer: 9, status: 'neu', doppelt_von: null },
  { id: 'sp0123456788', vorname: 'Jonas', nachname: 'Maier', verein_id: 'q162195', verein_name: '1. FC 08 Birkenfeld', team_id: null, team_art: 'herren', team_nr: 1, pos: 'TW', nummer: 1, status: 'neu', doppelt_von: null },
  { id: 'sp0123456787', vorname: 'Paul', nachname: 'Kern', verein_id: 'q162195', verein_name: '1. FC 08 Birkenfeld', team_id: null, team_art: 'herren', team_nr: 2, pos: 'ABW', nummer: 4, status: 'neu', doppelt_von: null },
  { id: 'sp01234567zz', vorname: '<img src=x>', nachname: 'Böse', verein_id: 'q162195', verein_name: 'x', status: 'neu' }
];
const GAME = { uid: 'testspiel-ext-0001', created_at: '2026-11-15T15:00:00Z', played_at: '2026-11-15T14:00:00Z', season: '2026/2027', player: 'sp0123456789', opp: 'ow93398679',
  home: true, pos: 'ANG', us: 3, them: 1, minutes: 90, points: 245, goals: 2, assists: 0, manual: false, team: 'q162195', player_foto: null, opp_foto: null, erfasst_von: 'Test', mit_konto: true };
(async () => {
  const t = await L.setup({ noGoto: true }); const { p, c } = t;
  const fails = [], ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const j = b => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  let hidden = false, posted = null;
  await p.route(/rest\/v1\/rpc\/spieler_suche/, r => r.fulfill(j(SP)));
  await p.route(/rest\/v1\/rpc\/spieler_ausblenden/, r => { hidden = true; return r.fulfill(j(true)); });
  await p.route(/rest\/v1\/spieler\?select=/, r => { if (r.request().method() === 'POST') posted = JSON.parse(r.request().postData()); return r.fulfill(j(r.request().method() === 'POST' ? [Object.assign({}, SP[0], { id: 'sp0123456700', vorname: 'Tim', nachname: 'Neu' })] : SP.filter(x => r.request().url().includes(x.id)))); });
  await p.route(/rest\/v1\/spiele\?select=uid%2Ccreated|rest\/v1\/spiele\?select=uid,created/, r => r.fulfill(j([GAME])));
  await p.goto('http://localhost:8123/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);

  // Gespeichertes Spiel mit gesuchtem Spieler wird geladen (Spieler + Vereine nachgeladen)
  const g = await p.evaluate(async () => { const A = await import('./js/services/api.js'); await A.loadGames(true); return A.games.list.map(x => x.player); });
  ok(g.includes('sp0123456789'), 'Spiel mit gesuchtem Spieler geladen: ' + JSON.stringify(g));

  // Suche
  await c('[data-st="suche"]'); await p.waitForTimeout(400);
  await p.fill('#suQ', 'maier'); await p.waitForTimeout(900);
  const rows = await p.$$eval('#suList .su-row b', l => l.map(e => e.textContent));
  ok(rows.some(x => /Lukas Meier/.test(x)) && rows.some(x => /Jonas Maier/.test(x)), 'Treffer: ' + rows.join('|'));
  ok(!(await p.$('#suList img[src="x"]')), 'kein eingeschleustes HTML');
  ok(!rows.some(x => /Böse/.test(x)), 'ungültiger Name aussortiert');
  await p.screenshot({ path: 'out/spielersuche.png' });
  await c('[data-su="tab:clubs"]'); await p.waitForTimeout(200);
  ok(!(await p.$('#suList .su-row')), 'Reiter Vereine ohne Spieler');
  await c('[data-su="tab:all"]'); await p.waitForTimeout(200);

  // Profil → + Spiel
  await c('[data-su="p:sp0123456789"]'); await p.waitForTimeout(700);
  const prof = await p.evaluate(() => ({ n: (document.querySelector('#profile .pnn') || {}).textContent, club: (document.querySelector('#profile .pcl b') || {}).textContent, pts: (document.querySelector('#profile .kb-g b') || {}).textContent }));
  ok(prof.n === 'Meier' && prof.club === '1. FC 08 Birkenfeld', 'Profil: ' + JSON.stringify(prof));
  ok(prof.pts === '245', 'Punkte aus dem gespeicherten Spiel: ' + prof.pts);
  await p.waitForTimeout(400);
  ok(await p.$('#profile .su-fol [data-open="p:sp0123456787"]') && !(await p.$('#profile .su-fol [data-open="p:sp0123456788"]')), 'Profil: Mitspieler Paul (nicht Jonas)');
  await c('[data-pf="play"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => !document.querySelector('.lgseg')), 'keine Kreisliga-Auswahl bei fremder Mannschaft');
  // Mitspieler derselben Mannschaft (Herren II): Paul ja, Jonas (Herren I) nein
  const mates = await p.$$eval('[data-pick^="pm:"]', l => l.map(e => e.getAttribute('data-pick')));
  ok(mates.length === 1 && mates[0] === 'pm:sp0123456787', 'Mitspieler: ' + JSON.stringify(mates));
  await p.evaluate(() => document.querySelector('[data-pick^="pm:"]').scrollIntoView({ block: 'center' })); await p.screenshot({ path: 'out/mitspieler.png' });
  await c('[data-pick="pm:sp0123456787"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /Mehrere · 2/.test(document.querySelector('[data-pick="multi"]').textContent)), 'Mitspieler dazu gewählt');
  await c('[data-pick="multi"]'); await p.waitForTimeout(300);
  await p.fill('#soQ', 'weisskirchen'); await p.waitForTimeout(500);
  await c('#soRes [data-pick^="ov:"]'); await p.waitForTimeout(300);
  ok(!(await p.$eval('#goBtn', e => e.disabled)), 'Gegner gewählt, Start möglich');
  await c('#goBtn'); await p.waitForTimeout(500);
  const S = await t.S();
  ok(S.match && S.match.p === 'sp0123456789' && S.match.team === 'q162195' && /^[oquvk]/.test(S.match.o), 'Spiel: ' + JSON.stringify(S.match));
  const head = await p.evaluate(() => document.getElementById('hName').textContent);
  ok(/Meier/.test(head), 'Spielerkarte: ' + head);

  // Neustart: laufendes Spiel bleibt (Spieler gemerkt)
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const S2 = await t.S();
  ok(S2.match && S2.match.p === 'sp0123456789', 'Spiel übersteht Neustart');
  const rec = await p.evaluate(async () => { const G = await import('./js/core/game.js'); return G.gameRecord('2026/2027'); });
  ok(/^[A-Za-z0-9_-]+$/.test(rec.player) && /^[A-Za-z0-9_-]+$/.test(rec.team) && /^[A-Za-z0-9_-]+$/.test(rec.opp), 'IDs speicherbar: ' + [rec.player, rec.team, rec.opp]);

  // Spieler eintragen: ohne Anmeldung nur „Nur für ein Spiel“
  await p.evaluate(async () => { const M = await import('./js/ui/suche.js'); M.openNeu({ name: 'Max Muster' }); });
  await p.waitForTimeout(500);
  ok(await p.$('[data-nav="admin"]') && !(await p.$('#snForm [type=submit]')), 'ohne Konto kein Eintragen');
  await p.fill('#snVq', 'fc 08 birkenfeld'); await p.waitForTimeout(300);
  await c('#snVres [data-sn="v:q162195"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'out/spieler-eintragen.png' });
  await c('[data-sn="guest"]'); await p.waitForTimeout(600);
  const gs = await p.evaluate(() => document.querySelector('#setup [aria-pressed="true"] b') && document.querySelector('#setup').textContent.includes('Max Muster'));
  ok(gs, 'Gastspieler aus Verein gewählt');

  // Angemeldet (Sitzung simuliert): Spieler eintragen → Profil
  await p.evaluate(() => localStorage.setItem('kl-auth-v1', JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 36e5, user: { id: '00000000-0000-0000-0000-000000000000', email: 't@t.de' } })));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  await p.evaluate(async () => { const M = await import('./js/ui/suche.js'); M.openNeu({ name: 'Tim Neu' }); });
  await p.waitForTimeout(400);
  await p.fill('#snVq', 'fc 08 birkenfeld'); await p.waitForTimeout(300);
  await c('#snVres [data-sn="v:q162195"]'); await p.waitForTimeout(300);
  await c('#snForm [type=submit]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /bestätigen/.test(document.getElementById('snBody').textContent)), 'Bestätigung verlangt');
  await p.check('#snForm [name=ok]'); await c('#snForm [type=submit]'); await p.waitForTimeout(1200);
  const made = await p.evaluate(() => ({ v: document.querySelector('#profile:not([hidden]) .pnn') && document.querySelector('#profile .pnn').textContent }));
  ok(made.v === 'Neu', 'Nach Eintragen Profil offen: ' + JSON.stringify(made));
  ok(posted && posted.vorname === 'Tim' && posted.bestaetigt === true && posted.verein_id === 'q162195' && !('user_id' in posted), 'Eintrag gesendet: ' + JSON.stringify(posted));

  // Vom Verein aus: mehrere hintereinander
  await p.evaluate(async () => { const V = await import('./js/services/vereine.js'), M = await import('./js/ui/suche.js'); await V.loadVereine(); M.openNeu({ verein: V.vereinById('q162195') }); });
  await p.waitForTimeout(400);
  await p.fill('#snForm [name=vn]', 'Ben'); await p.fill('#snForm [name=n]', 'Zwei'); await p.check('#snForm [name=ok]');
  await c('#snForm [type=submit]'); await p.waitForTimeout(900);
  const ser = await p.evaluate(() => ({ done: document.querySelectorAll('.su-done .su-row').length, vn: document.querySelector('#snForm [name=vn]').value, ok: document.querySelector('#snForm [name=ok]').checked, view: !document.getElementById('sneu').hidden }));
  ok(ser.done === 1 && ser.vn === '' && ser.ok && ser.view, 'Serie: ' + JSON.stringify(ser));

  // Vereinsseite: Kader nach Mannschaft gruppiert
  await p.evaluate(async () => { const M = await import('./js/ui/vereine.js'); await M.openVerein('q162195'); });
  await p.waitForTimeout(900);
  const kh = await p.$$eval('#verein .vr-kh', l => l.map(e => e.textContent));
  ok(kh.length >= 2 && kh.some(x => /Herren II/.test(x)), 'Kader-Gruppen: ' + JSON.stringify(kh));
  await p.screenshot({ path: 'out/verein-kader.png' });

  // Hall of Fame: Chip „Andere“ für Mannschaften außerhalb der Kreisliga
  await p.evaluate(async () => { const A = await import('./js/services/api.js'); await A.loadGames(true); const R = await import('./js/router.js'); R.show('hof'); });
  await p.waitForTimeout(700);
  ok(await p.$('[data-hof="l:OTHER"]'), 'Chip Andere da');
  await c('[data-hof="l:OTHER"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('hof').textContent.includes('245')), 'Andere zeigt Spiel');

  // Ausblenden
  const hid = await p.evaluate(async () => { const A0 = await import('./js/services/api.js'); await A0.loadGames(true); const S = await import('./js/services/spieler.js'); await S.hideSpieler('sp0123456789'); const P = await import('./js/data/players.js'); const A = await import('./js/services/api.js');
    return { h: P.PL.sp0123456789.hidden, g: A.games.list.some(x => x.player === 'sp0123456789'), r: S.recent().some(x => x.id === 'sp0123456789') }; });
  ok(hidden && hid.h && !hid.g && !hid.r, 'Ausblenden: ' + JSON.stringify(hid));

  // Vereins-Link ?v=
  await p.goto('http://localhost:8123/?v=q162195', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !document.getElementById('verein').hidden && /Birkenfeld/.test(document.querySelector('#verein h1').textContent) && !location.search), 'Vereins-Link öffnet Verein');

  console.log('Fehler:', fails.length ? fails : 'keine', t.errs.length ? t.errs : '');
  await t.b.close();
})();
