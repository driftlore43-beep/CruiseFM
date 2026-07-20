# Over-the-air updates — how to switch them on and use them

Plain-English checklist. All commands run on **your computer** (the one with
EAS logged in), from inside the CruiseFM project folder. Copy-paste them one
line at a time.

---

## One-time: turn OTA on (do this once)

The update engine has to be baked into a fresh build before any over-the-air
update can reach a phone. The builds currently on phones don't have it yet.

1. Pull the latest code:
   ```
   git checkout claude/cruise-fm-v4wk5f
   git pull origin claude/cruise-fm-v4wk5f
   ```

2. Make sure the new package is installed:
   ```
   npm install
   ```

3. Build once (this is the build that carries the update engine):
   ```
   eas build -p android --profile preview
   ```
   Wait ~10–20 min. Install the finished build on the test phone(s) from the
   link EAS gives you. **This build is the starting point** — every OTA update
   from now on lands on top of it.

That's it. OTA is now live for anyone on that build.

---

## Every time after that: push an update (minutes, no store, no reinstall)

Whenever there are new visual / text / logic changes to ship (no new native
features), just publish an update:

```
git pull origin claude/cruise-fm-v4wk5f
eas update --branch preview -m "short note about what changed"
```

Testers get it automatically the next time they close and reopen the app —
usually within minutes. No new build, no Play Store, no reinstalling.

Use `-m` to leave yourself a note, e.g.
`eas update --branch preview -m "new badges + vinyl polish"`.

---

## When a plain update ISN'T enough

If a change adds a **new native feature** (a new device permission, a new
native library — I'll always tell you when that's the case), an OTA update
won't cover it. The system is built to notice this automatically and simply
withhold the update rather than ship something broken.

The fix is the same as step 3 above — one fresh `eas build` — then updates
resume as normal. You'll never have to guess: if I add something native, I'll
say "this one needs a new build," otherwise assume `eas update` is all it takes.

---

## Once the closed test / production is live

Same idea, different branch name so live users and testers stay separate:

- Testers on the closed-test build: `eas update --branch preview -m "..."`
- Real users after launch:          `eas update --branch production -m "..."`

Keep test changes on `preview` until you've seen them yourself, then publish
the same to `production` when you're happy.
