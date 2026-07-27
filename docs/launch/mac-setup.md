# Shipping Cruise FM from the MacBook

Everything you've been doing on the Windows PC works the same on the Mac —
it just needs setting up once, and it's less work than you'd expect. The
Spotify keys do **not** need copying across; they live in Expo's servers, not
on your computer.

---

## One-time setup (about 15 minutes, most of it waiting)

### 1. Open Terminal

Press `Cmd + Space`, type `Terminal`, press Enter. Every command below gets
typed in here, one line at a time, pressing Enter after each.

### 2. Install the developer tools (this is what gives you `git`)

macOS doesn't come with `git`. Type:
```
xcode-select --install
```
A box pops up — click **Install**, accept the licence, wait 5–10 minutes.
(You do *not* need the full Xcode from the App Store. Nothing is compiled on
your machine; Expo's cloud does all of that.)

Check it worked:
```
git --version
```

### 3. Install Node

Go to **nodejs.org**, stay on the **LTS** tab, download the **macOS
Installer (.pkg)**, open it and click through.

Then check:
```
node -v
node -p "process.arch"
```

Two things to look at:

- The version must be **at least** `v20.19.4`, `v22.13.0` or `v24.3.0` — the
  exact numbers matter more than they look. Node `v20.5` or `v22.9` will be
  refused even though they're "Node 20" and "Node 22". Taking the current LTS
  from the website is always safely above the line.
- The second command must print **`arm64`**. If it prints `x86_64` you've got
  the Intel build of Node on an Apple Silicon Mac; it half-works and then
  fails confusingly later. Uninstall, and make sure you're downloading the
  Apple Silicon package.

### 4. Get the project

```
cd ~/Documents
git clone https://github.com/driftlore43-beep/CruiseFM.git
cd CruiseFM
git checkout claude/cruise-fm-v4wk5f
npm ci
```

`npm ci` takes a few minutes and prints a lot of text. That's normal.

**The `git checkout` line is not optional.** A fresh copy lands on `main`,
which is **161 commits behind** the branch the app is actually built from.
Publishing from `main` would push a months-old Cruise FM to your phone and to
every TestFlight tester — and it would do it without any error at all.

### 5. Sign in to Expo

```
npx eas-cli login
npx eas-cli whoami
```

Use the same Expo account as on the PC. `whoami` confirms which one you're
signed in as. The password is invisible while you type it — that's normal,
not a frozen terminal.

`npx eas-cli ...` downloads the tool fresh each time and always uses the
current version. You *can* install it permanently with
`sudo npm install -g eas-cli`, but the `npx` form avoids a permissions
problem that's a common place to get stuck, so it's what this guide uses.

---

## Shipping an update

From inside the CruiseFM folder:

```
git pull origin claude/cruise-fm-v4wk5f
npx eas-cli update --branch preview --environment preview -m "short note about what changed"
```

Testers get it the next time they fully close and reopen the app.

### Why `--environment preview` is there, and why it must never be left off

This is the one thing that's genuinely different from what you've been doing,
and it's worth understanding because leaving it off fails *quietly*.

The Spotify keys aren't in the project folder — they're stored on Expo's
servers. `--environment preview` is the instruction to go and fetch them.
From Expo SDK 55 onwards this flag is required, and Cruise FM is on SDK 56.

Leave it off and, depending on the version of the tool, you either get an
error (fine — you just retry) or it publishes an update with **blank** Spotify
keys. That second case looks completely successful and then nobody on the
preview channel can sign in to Spotify. So: always both flags, every time.

Before your first publish from the Mac, confirm the keys are actually there:
```
npx eas-cli env:list --environment preview
```
You should see `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` and
`EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` in the list. If either is missing, stop
and tell me — don't publish. (They can be added at **expo.dev** → the Cruise
FM project → **Environment variables**.)

---

## Did it actually reach the phones?

Worth checking the first time you publish from a new computer. Each update
carries a "runtime version", and a phone only accepts updates whose runtime
version matches its own build. Two computers *should* produce an identical
one — but it's a ten-second check, and if it ever didn't match, the update
would simply never arrive rather than tell you.

```
npx eas-cli update:list --branch preview
```

Compare the runtime version on the update you just published with the one
before it (published from the PC). Same = it's on its way. Different = tell
me; nothing is broken, the update is just being ignored, and it's fixable.

---

## Two things not to do

- **Don't publish to `production` while the app is in App Review.** That
  changes the app Apple is looking at. `preview` is safe — it only reaches
  your phone and your TestFlight testers.
- **Don't run `npm ci` again unless I tell you a package changed.** Normally
  `git pull` + the update command is the whole job.

---

## If you want to run the app on the Mac itself

Only needed if you want to see it in a simulator or a browser rather than on
your phone. Pull the keys down into a local file first, then start it:

```
npx eas-cli env:pull --environment preview
npx expo start
```

`env:pull` writes a `.env.local` file. It's already set to be kept out of the
repository, and it should stay that way — the repo is public.

---

## While you're on a Mac

Two things become possible here that never could on the PC:

- The **iPhone Simulator** (free, part of Xcode) — a working iPhone on the
  screen, so layouts can be checked without touching the real phone. This is
  the one outstanding item from the original launch checklist.
- Building and submitting to Apple locally, though the EAS cloud builds you
  already use work fine and need no setup at all.

Neither is needed to ship updates.
