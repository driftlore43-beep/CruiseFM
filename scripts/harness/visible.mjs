/**
 * Click the copy of some text a PERSON could actually hit.
 *
 * `.first()` and `.last()` are both guesses, and both have now been wrong.
 * Expo Router keeps every tab MOUNTED, and several screens park a sheet
 * off-screen rather than unmounting it — so the same words exist two or three
 * times in the document. On 18.08 the home page gained a mode picker and a
 * mood picker, and every harness reaching for `.first()` silently started
 * aiming at a parked chip below the fold instead of the card in front of the
 * user: several steps failed while the app was perfectly fine.
 *
 * THE VIEWPORT ALONE IS NOT ENOUGH, and the first version of this got caught
 * by it: `scrollIntoViewIfNeeded()` on the phantom scrolls the page TO the
 * phantom, which duly makes it "on screen", and the click then lands on
 * something inert and times out. The honest test is whether the thing can be
 * touched at all — a parked sheet is rendered with `pointer-events: none`, so
 * a person cannot reach it however far you scroll.
 *
 * Order of preference: reachable AND already on screen, then merely
 * reachable (scrolled into view before clicking, which is what a real mode
 * card below the fold needs).
 *
 * Shared rather than copied into each harness: the trap is app-wide, and
 * three copies of the fix is three chances for one of them to rot.
 */
export function visibleClicker(page) {
  return async function clickVisible(text, { timeout = 20000 } = {}) {
    const pick = await page.evaluate((t) => {
      const nodes = [...document.querySelectorAll('*')].filter(
        (e) => e.children.length === 0 && (e.textContent || '').trim() === t);
      const reachable = [];
      nodes.forEach((e, i) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return;
        // Anything under a pointer-events:none ancestor is decoration or a
        // parked sheet — invisible to a finger wherever it sits.
        for (let n = e; n && n !== document.body; n = n.parentElement) {
          if (getComputedStyle(n).pointerEvents === 'none') return;
        }
        reachable.push({ i, onScreen: r.y >= 0 && r.y < window.innerHeight });
      });
      const seen = reachable.find((c) => c.onScreen) ?? reachable[0];
      return seen ? { idx: seen.i, needsScroll: !seen.onScreen } : null;
    }, text);
    if (!pick) throw new Error(`no reachable copy of "${text}"`);
    const target = page.getByText(text, { exact: true }).nth(pick.idx);
    if (pick.needsScroll) {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
    }
    await target.click({ timeout });
  };
}

/**
 * Answer the off-air ask, if it appeared.
 *
 * Since 19.08 a station that keeps hours and is outside them asks "… is off
 * air — play anyway?" before the drive opens. Every harness that starts a
 * drive from the mood sheet meets it, and WHETHER it appears depends on the
 * clock — so a harness that ignores it passes in the evening and fails all
 * afternoon, which is the worst kind of flake. Shared rather than copied, so
 * the four callers cannot drift apart.
 */
export async function answerOffAir(page, choice = 'Play anyway') {
  await page.waitForTimeout(900);
  const ask = page.getByText(choice, { exact: true });
  if (await ask.count()) { await ask.last().click({ force: true }); return true; }
  return false;
}
