#!/usr/bin/env node
/**
 * PREFLIGHT — everything that can be checked from the repo before a build.
 *
 *   node scripts/preflight.mjs          # checks, prints a report, exits 1 on FAIL
 *   node scripts/preflight.mjs --quick  # skips the TypeScript pass
 *
 * Every check here exists because something it looks for actually went wrong
 * once, and the reference is named in the check so nobody has to guess why it
 * is being asked. The list is deliberately about CONFIGURATION AND PACKAGING —
 * the class of fault that is invisible on this machine, survives a green build,
 * and only shows up on a device or in front of a reviewer.
 *
 * WHAT THIS CANNOT DO, stated up front so it is never mistaken for cover: it
 * cannot tell you the app launches. Build 25 passed every check in this file
 * and still died 40 ms into launch, because a native module wanted a function
 * its Expo core did not have and only dyld on the phone could see it. The
 * launch test on a real phone is a separate, mandatory step — see
 * docs/launch/pre-submission-checklist.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');

const results = [];
const ok = (name, detail) => results.push({ level: 'PASS', name, detail });
const warn = (name, detail) => results.push({ level: 'WARN', name, detail });
const fail = (name, detail) => results.push({ level: 'FAIL', name, detail });

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pkg = readJson(path.join(ROOT, 'package.json'));

/** Deliberate exceptions, each with a reason. An empty reason is not allowed. */
const allow = existsSync(path.join(ROOT, 'scripts/preflight-allow.json'))
  ? readJson(path.join(ROOT, 'scripts/preflight-allow.json'))
  : { newerThanSdk: {}, entitlements: [], permissions: [] };

// ── The app's own resolved iOS configuration ────────────────────────────────
// Read from `expo config --type introspect`, never from app.json: a plugin can
// add native keys nobody wrote (expo-audio added UIBackgroundModes and got
// build 7 rejected under 2.5.4; expo-notifications added aps-environment and
// broke build 24 at the signing step).
let ios = {};
try {
  const raw = execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const cfg = JSON.parse(raw.slice(raw.indexOf('{')));
  ios = cfg.ios ?? {};

  if (cfg.version && cfg.runtimeVersion && cfg.version === cfg.runtimeVersion) {
    ok('version / runtimeVersion', `both ${cfg.version}`);
  } else {
    fail('version / runtimeVersion',
      `version ${cfg.version} vs runtimeVersion ${cfg.runtimeVersion} — this repo pins them equal (30.07)`);
  }
} catch (e) {
  fail('expo config introspect', `could not read the resolved config: ${String(e).slice(0, 120)}`);
}

const info = ios.infoPlist ?? {};
const ents = ios.entitlements ?? {};

// Entitlements. The provisioning profile carries no extra capabilities, so any
// entitlement at all fails the build at signing — that was build 15
// (com.apple.developer.applemusic) and build 24 (aps-environment).
const unexpectedEnts = Object.keys(ents).filter((k) => !allow.entitlements.includes(k));
if (unexpectedEnts.length === 0) ok('entitlements', 'none, which is what the profile expects');
else fail('entitlements', `${unexpectedEnts.join(', ')} — the profile has no matching capability, so signing will fail`);

// Background modes. Cruise FM never plays audio itself; Spotify and Apple
// Music do. Claiming it is what Apple rejected build 7 for.
if (info.UIBackgroundModes) fail('UIBackgroundModes', `declared: ${JSON.stringify(info.UIBackgroundModes)} — the app plays no audio of its own (2.5.4, build 7)`);
else ok('UIBackgroundModes', 'not declared');

// Permission strings. An unexplained one is a rejection risk and a bad look on
// the listing; a MISSING one silently removes a feature (Save Image needed
// NSPhotoLibraryAddUsageDescription and was withheld without it).
const EXPECTED_PERMS = new Set([
  'NSAppleMusicUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  ...allow.permissions,
]);
const present = Object.keys(info).filter((k) => /UsageDescription$/.test(k));
const surprise = present.filter((k) => !EXPECTED_PERMS.has(k));
const missing = [...EXPECTED_PERMS].filter((k) => !present.includes(k));
if (surprise.length) fail('permission strings', `unexpected: ${surprise.join(', ')}`);
else if (missing.length) fail('permission strings', `missing: ${missing.join(', ')}`);
else ok('permission strings', present.join(', '));

// ── Native module versions ──────────────────────────────────────────────────
// THIS IS THE BUILD-25 CHECK. Expo publishes a range per SDK, e.g.
// `expo-media-library: ~56.0.6`, and the version it actually ships and tests
// is the range's floor. 56.0.10 sits INSIDE that range, so npm, expo-doctor
// and `expo install --check` all accept it — and it was compiled against a
// newer ExpoModulesCore, so the app died at launch with a missing symbol. So
// the check here is stricter than the range: anything above the floor has to
// be justified in preflight-allow.json.
// A version is TRUSTED once a build carrying it has been seen to launch on a
// real phone — that is the only evidence that counts here, so the allow file
// names that commit and this reads the versions straight out of its lockfile.
// Everything unchanged since then is proven; anything newer than the SDK's own
// version AND changed since then is the build-25 shape and has to be justified.
try {
  const bundled = readJson(path.join(ROOT, 'node_modules/expo/bundledNativeModules.json'));
  const deps = pkg.dependencies ?? {};
  const native = Object.keys(deps).filter((n) => n in bundled);

  let proven = {};
  const provenCommit = allow.provenCommit;
  try {
    const lock = JSON.parse(execFileSync('git', ['show', `${provenCommit}:package-lock.json`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    proven = lock.packages ?? {};
  } catch {
    warn('proven baseline', `could not read package-lock.json at ${provenCommit} — every newer-than-SDK version will need justifying`);
  }

  const risky = [];
  const changed = [];
  for (const name of native) {
    const installedPath = path.join(ROOT, 'node_modules', name, 'package.json');
    if (!existsSync(installedPath)) continue;
    const installed = readJson(installedPath).version;
    const wasVersion = proven[`node_modules/${name}`]?.version;
    const newerThanSdk = cmpVersions(installed, String(bundled[name]).replace(/^[\^~]/, '')) > 0;

    if (wasVersion !== installed) changed.push(`${name} ${wasVersion ?? '(new)'} → ${installed}`);
    if (!newerThanSdk) continue;                       // at or below the SDK's own version
    if (wasVersion === installed) continue;            // unchanged since a build that launches
    if (allow.newerThanSdk?.[name]) {
      ok(`  ${name}`, `${installed}, newer than the SDK — allowed: ${allow.newerThanSdk[name]}`);
      continue;
    }
    risky.push(`${name} ${installed} (SDK ships ${String(bundled[name]).replace(/^[\^~]/, '')})`);
  }

  if (changed.length) {
    warn('native modules changed', `${changed.join('; ')} — this build must be LAUNCHED on a phone before it goes to Apple`);
  } else {
    ok('native modules changed', `none since ${provenCommit}, so the native side is the same as a build that launches`);
  }

  if (risky.length) {
    fail('unproven native versions', `${risky.join('; ')} — newer than the version this SDK ships AND not yet seen to launch. This is exactly how build 25 died (expo-media-library 56.0.10 wanted an ExpoModulesCore method 56.0.15 does not have). Pin down to the SDK's version, or justify it in scripts/preflight-allow.json.`);
  } else {
    ok('unproven native versions', 'none');
  }
} catch (e) {
  fail('native version check', String(e).slice(0, 140));
}

// ── App state that has been shipped wrong before ────────────────────────────
try {
  const cfgSrc = readFileSync(path.join(ROOT, 'src/constants/config.ts'), 'utf8');
  const ownerMode = /OWNER_MODE\s*[:=][^;\n]*?\btrue\b/.test(cfgSrc);
  if (ownerMode) fail('OWNER_MODE', 'is true — it bypasses every lock and must be false in any build that leaves this machine');
  else ok('OWNER_MODE', 'false');
} catch { warn('OWNER_MODE', 'could not read src/constants/config.ts'); }

// The screen that takes money guards itself. Gating the entry points alone is
// one forgotten button away from another 2.1(b) rejection (build 18).
try {
  const paywall = readFileSync(path.join(ROOT, 'src/app/premium.tsx'), 'utf8');
  if (/\bisPro\b/.test(paywall)) ok('paywall self-guard', 'premium.tsx refuses to render an offer while the app is free');
  else fail('paywall self-guard', 'premium.tsx no longer checks isPro — build 18 was rejected 2.1(b) for exactly this');
} catch { warn('paywall self-guard', 'could not read src/app/premium.tsx'); }

// ── Which commit is about to be built ───────────────────────────────────────
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) warn('working tree', `${dirty.split('\n').length} uncommitted change(s) — EAS builds what is COMMITTED, so these will not be in the binary`);
  else ok('working tree', 'clean');
  ok('commit', `${head} on ${branch}`);
} catch { warn('git', 'could not read repository state'); }

// ── TypeScript ──────────────────────────────────────────────────────────────
if (QUICK) {
  warn('typescript', 'skipped (--quick)');
} else {
  try {
    execFileSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, stdio: 'pipe' });
    ok('typescript', 'clean');
  } catch (e) {
    fail('typescript', String(e.stdout ?? e).split('\n').slice(0, 6).join(' | ').slice(0, 300));
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const pad = Math.max(...results.map((r) => r.name.length));
console.log('\nPREFLIGHT\n');
for (const r of results) {
  const tag = r.level === 'PASS' ? ' ok ' : r.level === 'WARN' ? 'warn' : 'FAIL';
  console.log(`  [${tag}] ${r.name.padEnd(pad)}  ${r.detail}`);
}
const fails = results.filter((r) => r.level === 'FAIL');
const warns = results.filter((r) => r.level === 'WARN');
console.log(`\n${results.length - fails.length - warns.length} passed, ${warns.length} warning(s), ${fails.length} failure(s)\n`);
if (fails.length) {
  console.log('Do not cut a build until these are fixed.\n');
  process.exit(1);
}
console.log('Configuration is sound. THIS DOES NOT MEAN THE APP LAUNCHES —');
console.log('if this build changes any native module, install it on a phone and');
console.log('open it before it goes anywhere near Apple (see the checklist).\n');

/** Compare two dotted versions. Returns >0 if a is newer. */
function cmpVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
