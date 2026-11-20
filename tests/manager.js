// Manager: Regeln (Budget, Teamgröße, ein Torwart, Preise aus gespeicherten Spielen, Punkte nur in der Zeit im Team)
// und Kauf/Verkauf in der Oberfläche (nicht angemeldet = nur auf dem Gerät)
const L = require('./lib.js');
(async () => {
  const t = await L.setup(); const { p, c } = t;
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  const r = await p.evaluate(async () => {
    const M = await import('./js/core/manager.js');
    const day = d => new Date(Date.UTC(2026, 9, d, 15)).toISOString();
    const g = (uid, player, d, points, saved) => ({ uid, player, played_at: day(d), created_at: saved ? day(saved) : day(d), points, minutes: 90, us: 1, them: 0 });
    const games = [g('a', 'Pace', 1, 200), g('b', 'Pace', 10, 150), g('c', 'Fechter', 10, 80), g('d', 'Pace', 20, 50, 25)];
    const T = d => new Date(Date.UTC(2026, 9, d, 12)).getTime();
    const out = {};
    // Punkte nur ab Kauf; Spiel am 20. erst am 25. gespeichert → Preis beim Kauf am 22. ohne dieses Spiel
    let st = M.replay([{ t: T(5), p: 'Pace', a: 'buy' }, { t: T(22), p: 'Fechter', a: 'buy' }], games);
    out.pts = M.teamPoints(st, games).sum;
    out.pricePaid = st.moves[0].v; out.valueAt5 = M.valueAt('Pace', games, T(5)); out.valueAt0 = M.valueAt('Pace', games, T(1));
    out.late = M.valueAt('Pace', games, T(22)) === M.valueAt('Pace', games.filter(x => x.uid !== 'd'), T(22));
    // Zweiter Torwart, sechster Spieler und doppelter Kauf fallen weg
    st = M.replay(['Fechter', 'Fechter', 'Pace', 'Heckmann', 'Kugler', 'Klenk', 'Krauss'].map((p, i) => ({ t: T(1) + i, p, a: 'buy' })), []);
    out.team = st.team.length; out.tw = st.team.filter(p => p === 'Fechter').length;
    // Zu teuer: Budget reicht nicht
    st = M.replay(['Pace', 'Barbano', 'Filenberg', 'Doez', 'Heckmann'].map((p, i) => ({ t: T(1) + i, p, a: 'buy' })), []);
    out.budgetOk = st.budget >= 0;
    // Verkaufen bringt Geld zurück, danach zählen keine Punkte mehr
    st = M.replay([{ t: T(5), p: 'Pace', a: 'buy' }, { t: T(15), p: 'Pace', a: 'sell' }], games);
    out.afterSell = M.teamPoints(st, games).sum; out.budgetBack = st.budget > M.BUDGET - 1;
    out.block = M.buyBlock({ team: ['Fechter'], budget: 1e9 }, 'Fechter', []) + '|' + M.buyBlock({ team: [], budget: 1 }, 'Pace', []);
    return out;
  });
  ok(r.pts === 150 + 50, 'Punkte nur ab Kauf: ' + r.pts);
  ok(r.pricePaid === r.valueAt5 && r.valueAt5 !== r.valueAt0, 'Preis aus Spielen davor');
  ok(r.late, 'Spät gespeichertes Spiel ändert alten Preis nicht');
  ok(r.team === 5 && r.tw === 1, 'Teamgröße/Torwart: ' + r.team + '/' + r.tw);
  ok(r.budgetOk, 'Budget nie negativ');
  ok(r.afterSell === 150 && r.budgetBack, 'Verkauf: ' + r.afterSell);
  ok(r.block === 'Im Team|Zu teuer', 'buyBlock: ' + r.block);

  // Oberfläche (braucht echte Spiele)
  await c('[data-tb="manager"]'); await p.waitForTimeout(1500);
  const online = await p.evaluate(() => !!document.querySelector('.mg-head'));
  if (online) {
    await c('[data-mg="t:markt"]'); await p.waitForTimeout(300);
    const id = await p.evaluate(() => { const b = document.querySelector('.mg-act.buy:not([disabled])'); return b && b.dataset.mg.slice(4); });
    await c('.mg-act.buy:not([disabled])'); await p.waitForTimeout(200); await c('.sheet [data-sh="1"]'); await p.waitForTimeout(300);
    const ls = await p.evaluate(() => JSON.parse(localStorage.getItem('kreo-manager-v1') || 'null'));
    ok(ls && ls.moves.length === 1 && ls.moves[0].p === id, 'Kauf lokal gespeichert');
    await c('[data-mg="t:team"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(id => !!document.querySelector('[data-mg="sell:' + id + '"]'), id), 'Spieler im Team');
    await c('[data-mg="t:liga"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelectorAll('.mg-lr').length === 1), 'Liga lokal = nur eigenes Team');
    await p.screenshot({ path: 'out/manager-liga.png' });
  } else console.log('Keine Spiele geladen – nur Regeln geprüft');
  ok(!t.writes.some(w => /manager_/.test(w)), 'Ohne Anmeldung nichts an die Datenbank');
  console.log('Fehler:', fails.length || t.errs.length ? fails.concat(t.errs) : 'keine'); await t.b.close();
})();
