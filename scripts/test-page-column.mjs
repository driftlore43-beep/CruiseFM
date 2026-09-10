/**
 * THE FOUR PAGES AND THE TAB BAR SHARE ONE READING COLUMN.
 *
 * On a phone this is invisible — the cap is 720 points and the widest phone
 * the app runs on is 430, so it never binds. It exists for the iPad, where a
 * page laid out against a side gutter stretches into shapes nobody designed:
 * a 4:1 hero with its type in one corner, a two-button row giving each button
 * half a screen, a station's name and its icon a foot apart.
 *
 * WHY IT IS WORTH PINNING RATHER THAN TRUSTING. The floating tab bar is
 * capped to match the column, so a page that opts out does not merely look
 * wide — it puts the bar visibly out of step with the content above it, which
 * is the exact fault the app's single gutter was introduced to fix (31.07).
 * And it fails ONLY on a tablet, which nobody here has: a phone screenshot
 * cannot show it, so nothing else in this repo would catch a page added or
 * refactored without it.
 */
import fs from 'node:fs';

const DIR = 'src/app/(tabs)';
let failures = 0;
const check = (what, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : '  ' + detail}`);
  if (!ok) failures++;
};

console.log('\n  every tab page sits in the shared column:');

// The pages, found rather than listed — a fifth one added tomorrow is exactly
// the case this exists for, so it must not need adding here by hand.
const pages = fs.readdirSync(DIR).filter((n) => n.endsWith('.tsx') && n !== '_layout.tsx');
check('found the tab pages', pages.length >= 4, `only ${pages.length} in ${DIR}`);

for (const page of pages) {
  const src = fs.readFileSync(`${DIR}/${page}`, 'utf8');
  // A page with no scrolling content container has nothing to cap.
  if (!src.includes('contentContainerStyle')) continue;
  check(`${page} uses pageColumn`, /\bpageColumn\b/.test(src),
    'its scroll content is not capped — on an iPad it will run the full width ' +
    'while the tab bar stays capped, and the two will not line up');
}

console.log('\n  the tab bar is capped to match it:');
{
  const src = fs.readFileSync(`${DIR}/_layout.tsx`, 'utf8');
  check('the pill carries a maxWidth off PAGE_MAX_W',
    /maxWidth:\s*PAGE_MAX_W\s*-\s*PAGE_GUTTER\s*\*\s*2/.test(src),
    'without it the four tabs spread across a whole iPad');
}

console.log('\n  the cap cannot bind on a phone:');
{
  const theme = fs.readFileSync('src/constants/theme.ts', 'utf8');
  const maxW = Number(/export const PAGE_MAX_W\s*=\s*(\d+)/.exec(theme)?.[1]);
  const wideMin = Number(/export const WIDE_MIN\s*=\s*(\d+)/.exec(theme)?.[1]);
  check('read both numbers out of the theme', Number.isFinite(maxW) && Number.isFinite(wideMin),
    `PAGE_MAX_W=${maxW} WIDE_MIN=${wideMin}`);
  // 430 points is the widest iPhone. Both numbers must sit above it, or this
  // stops being an iPad change and starts being a phone one.
  check('PAGE_MAX_W clears the widest phone', maxW > 430, `${maxW} <= 430`);
  check('WIDE_MIN clears the widest phone', wideMin > 430, `${wideMin} <= 430`);
}

console.log(failures ? `\n  ${failures} failure(s)\n` : '\n  the pages and the bar agree on one column\n');
process.exit(failures ? 1 : 0);
