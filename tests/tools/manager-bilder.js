// Rundgang-Bilder „Manager erklärt“: node tests/tools/manager-bilder.js → tests/out/c-*.png (390×440, 2x),
// danach auf 600×676 verkleinern und als WebP nach assets/img/tut/. Erfundene Spiele und Manager, Supabase komplett abgefangen.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..');
const clubs = [...fs.readFileSync(ROOT + '/js/data/clubs.js', 'utf8').matchAll(/\{ id: '([a-z0-9]+)'/g)].map(m => m[1]);
const pl = [...fs.readFileSync(ROOT + '/js/data/players.js', 'utf8').matchAll(/\{ id: '(\w+)', vn: '[^']*', n: '[^']*', c: '(\w+)', pos: '(\w+)'/g)].map(m => ({ id: m[1], c: m[2], pos: m[3] }));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const games = [], events = {};
const now = Date.now();
for (let w = 0; w < 6; w++) for (const p of pl.slice(0, 14)) {
  if (rnd() < .25) continue;
  const us = Math.floor(rnd() * 4), them = Math.floor(rnd() * 3), pts = Math.round(20 + rnd() * 260 - (rnd() < .1 ? 120 : 0));
  const uid = 'g' + w + p.id.toLowerCase();
  let opp = clubs[Math.floor(rnd() * clubs.length)]; if (opp === p.c) opp = clubs[0] === p.c ? clubs[1] : clubs[0];
  const at = new Date(now - (w * 7 + 2) * 864e5); at.setHours(15, 0, 0, 0);
  games.push({ uid, created_at: at.toISOString(), played_at: at.toISOString(), season: '2026/2027', player: p.id, opp, home: rnd() < .5, pos: p.pos, us, them, minutes: 90, points: pts, goals: rnd() < .3 ? 1 : 0, assists: rnd() < .3 ? 1 : 0, team: p.c, erfasst_von: 'Test' });
  events[uid] = [{ k: 'duel', l: 'Zweikampf gewonnen', p: 4, t: 600 }, { k: 'sot', l: 'Schuss aufs Tor', p: 10, t: 1500 }, { k: 'tg', l: 'Team-Tor', p: 4, t: 2000 }, { k: 'poss', l: 'Ballverlust', p: -2, t: 3000 },
    { k: 'auto', a: 's', l: 'Startelf', p: 10, t: -1 }, { k: 'auto', a: 'e', l: 'Einsatzzeit', p: 14, t: -1 }, { k: 'auto', a: 'e', l: 'Spiel gewonnen', p: 20, t: -1 }];
}
games.sort((a, b) => (a.played_at < b.played_at ? 1 : -1));
const U1 = '11111111-1111-1111-1111-111111111111', U2 = '33333333-3333-3333-3333-333333333333', ME = '22222222-2222-2222-2222-222222222222';
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const mv = (u, p, d) => ({ user_id: u, p, a: 'buy', created_at: ago(d) });
const moves = [mv(U1, 'Barbano', 40), mv(U1, 'Fechter', 40), mv(U1, 'Krauss', 40), mv(U1, 'Klenk', 30),
  mv(ME, 'Reule', 41), mv(ME, 'Filenberg', 41), mv(ME, 'Knoedler', 41), mv(ME, 'Schauss', 25),
  mv(U2, 'Pace', 20), mv(U2, 'Heckmann', 20), mv(U2, 'Doez', 20)];
const OUT = require('path').join(__dirname, '..', 'out');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8124'], { cwd: ROOT, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 440 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await ctx.addInitScript(me => { for (const k of ['kl-intro-v1', 'kl-intro-v2', 'kl-intro-v3', 'kl-tour-book-v1', 'kl-tour-book-v2', 'kl-mvp-news', 'kreo-tour-mgr-v1']) localStorage.setItem(k, 'true');
    localStorage.setItem('kl-mvp-seen', '"9999"');
    localStorage.setItem('kl-auth-v1', JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 9e6, user: { id: me, email: 't@t.de' } })); }, ME);
  await ctx.route(/supabase\.co/, r => { const u = r.request().url(); let body = [];
    if (/manager_moves/.test(u)) body = moves; else if (/manager_teams/.test(u)) body = [{ user_id: U1, name: 'Dorfkicker' }, { user_id: ME, name: 'Kreisklasse Kings' }, { user_id: U2, name: 'Ascheplatz United' }];
    else if (/\/rest\/v1\/spiele\?/.test(u)) body = games; else if (/storage/.test(u)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, body: JSON.stringify(body), contentType: 'application/json' }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8124/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  const c = s => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, s);
  await c('.mvp-x, [data-mvp="close"], .mvp-close'); await p.waitForTimeout(300);
  await c('[data-tb="manager"]'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/c-team.png' });
  await c('[data-mg="t:markt"]'); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/c-markt.png' });
  await c('[data-mg="t:liga"]'); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/c-liga.png' });
  console.log('Fehler:', errs); await b.close(); srv.kill();
})();
