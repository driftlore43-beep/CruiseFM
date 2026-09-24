// Which plan does the paywall arrive with already ticked?
//
// Owner, 24.09, settling what Premium is: a subscription, not a one-off
// unlock. The library behind it does not grow by itself — the five premium
// modes and the seven FM stations are the same five and seven in month two —
// so the monthly plan invites the monthly question "am I still using this?"
// on exactly the months the app has nothing new to show. Yearly is also the
// cheaper of the two per year at the shipped prices, so preselecting it is
// not a tax on the reader.
//
// THIS RULE DECIDES WHAT SOMEBODY IS CHARGED IF THEY NEVER TOUCH THE PICKER,
// which is why it is a pure exported function rather than a line inside an
// effect. Two things it must never do: preselect a LIFETIME plan (the biggest
// single charge on the page — nobody meets that already agreed to), and
// return something when the store gave us nothing (the button is disabled in
// that state and must stay disabled).
//
// Note the LISTED order deliberately disagrees with this: getPlans() puts
// monthly first so the entry price is visible without hunting. Ordering and
// selection are two decisions.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const src = fs.readFileSync('/home/user/CruiseFM/src/utils/purchases.ts', 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
// react-native's Platform, and the real-shaped config strings — the module
// inspects the key's prefix at load, so a stub handing back a function dies
// before a single assertion runs.
const stub = (name) => {
  if (name === '@/constants/config') {
    return { REVENUECAT_API_KEY: 'appl_stub', PREMIUM_ENTITLEMENT: 'cruise_fm_pro' };
  }
  return new Proxy({}, { get: () => () => undefined });
};
new Function('module', 'exports', 'require', js)(mod, mod.exports, stub);
const { preferredPlan } = mod.exports;
if (typeof preferredPlan !== 'function') {
  console.log('  FAIL preferredPlan is not exported'); process.exit(1);
}

let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};

const plan = (kind) => ({ id: kind, kind });
const M = plan('monthly'), Y = plan('annual'), L = plan('lifetime'), O = plan('other');

console.log('\n  the shipped shelf — monthly listed first, yearly chosen:');
check('monthly, annual', preferredPlan([M, Y])?.id, 'annual');
check('with a lifetime on sale too', preferredPlan([M, Y, L])?.id, 'annual');
check('order on the shelf does not decide it', preferredPlan([Y, M])?.id, 'annual');

console.log('\n  no yearly plan — fall back to what is listed first:');
check('monthly alone', preferredPlan([M])?.id, 'monthly');
check('monthly then lifetime', preferredPlan([M, L])?.id, 'monthly');
// The one that matters, and it does not depend on getPlans' sort order:
// a lifetime row must not be preselected merely for being listed first.
check('lifetime is stepped over', preferredPlan([L, M])?.id, 'monthly');
check('lifetime alone is still honoured', preferredPlan([L])?.id, 'lifetime');
check('an unclassified plan is still offerable', preferredPlan([O])?.id, 'other');

console.log('\n  nothing to choose from:');
check('could not ask the store', preferredPlan(null), null);
check('still asking', preferredPlan(undefined), null);
check('asked, nothing on sale', preferredPlan([]), null);

console.log(fails ? `\n  ${fails} failed\n` : '\n  all good\n');
process.exit(fails ? 1 : 0);
