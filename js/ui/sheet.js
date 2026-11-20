/* Blatt-Verhalten: von oben am Griff (oder ganz oben im Inhalt) nach unten ziehen schließt das Blatt – weit genug oder schnell gewischt. */
export function bindSheet(sheet, scroller, onClose) {
  const panel = sheet.querySelector('.sh-panel');
  let y0 = null, dy = 0, drag = false, t0 = 0, vy = 0, lastY = 0, lastT = 0;
  sheet.addEventListener('click', e => { if (e.target === sheet) onClose(); });
  panel.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const onGrab = !!e.target.closest('.sh-grab');
    if (!onGrab && scroller.scrollTop > 0) return;
    y0 = lastY = e.touches[0].clientY; dy = 0; drag = false; t0 = lastT = Date.now(); vy = 0;
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const y = e.touches[0].clientY, t = Date.now();
    /* Geschwindigkeit der letzten Bewegung (px/ms), damit ein schneller Wisch auch kurz reicht */
    if (t > lastT) vy = vy * 0.4 + ((y - lastY) / (t - lastT)) * 0.6;
    lastY = y; lastT = t;
    dy = y - y0;
    if (dy > 8) drag = true;
    if (drag) { panel.style.transition = 'none'; panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)'; }
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (y0 == null) return;
    panel.style.transition = '';
    if (drag && (dy > 110 || (dy > 36 && vy > 0.55))) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => { panel.style.transform = ''; onClose(); }, 180);
    } else panel.style.transform = '';
    y0 = null; drag = false;
  }, { passive: true });
}
