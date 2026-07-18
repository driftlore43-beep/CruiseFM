/** Regenerates docs/legal/*.html from src/constants/legal.ts.
 * Run: node scripts/gen-legal.mts */
import { writeFileSync } from 'node:fs';
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type LegalDoc } from '../src/constants/legal.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function render(doc: LegalDoc): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cruise FM — ${doc.title}</title>
<style>
  body{margin:0;background:#0e0e14;color:rgba(255,255,255,.85);font:16px/1.65 -apple-system,'Segoe UI',Roboto,sans-serif}
  main{max-width:680px;margin:0 auto;padding:48px 24px 80px}
  h1{color:#fff;font-size:26px;margin:18px 0 4px}
  h2{color:#fff;font-size:17px;margin:28px 0 6px}
  p{margin:8px 0;color:rgba(255,255,255,.72)}
  .updated{color:rgba(255,255,255,.4);font-size:13px}
  .intro{color:rgba(255,255,255,.85);font-size:17px}
  .brand{color:#9B5FFF;font-weight:700;letter-spacing:2px;font-size:13px}
  a{color:#9B5FFF}
</style></head><body><main>
<div class="brand">CRUISE FM</div>
<h1>${doc.title}</h1>
<p class="updated">Last updated ${doc.updated}</p>
<p class="intro">${esc(doc.intro)}</p>
${doc.sections.map((s) => `<h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p>`).join('\n')}
</main></body></html>
`;
}

writeFileSync('docs/legal/privacy.html', render(PRIVACY_POLICY));
writeFileSync('docs/legal/terms.html', render(TERMS_OF_SERVICE));
console.log('wrote docs/legal/privacy.html and terms.html');
