# Shipping Cruise FM from the MacBook

Everything you've been doing on the Windows PC works the same on the Mac —
it just needs setting up once, and it's less work than you'd expect. The
Spotify keys do **not** need copying across; they live on Expo's servers, not
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

You do *not* need the full Xcode from the App Store. No native code is built
on your machine — Expo's cloud does that. (The JavaScript bundle *is* built
locally, which is why the next step matters.)

Check it worked:
```
git --version
```

### 3. Install Node

Go to **nodejs.org**, stay on the **LTS** tab, download the **macOS
Installer (.pkg)**, open it and click through. There is only one macOS
installer and it works on every Mac — you don't have to pick a chip type.

Then check two things:
```
node -v
node -p "process.arch"
```

- The version must be **at least** `v20.19.4`, `v22.13.0` or `v24.3.0`. The
  exact numbers matter more than they look — `v20.5` and `v22.9` are both
  refused despite being "Node 20" and "Node 22". Taking the current LTS from
  the website is always safely above the line.
- The second command should print **`arm64`**. If it prints `x86_64`, your
  Terminal is running under Rosetta: quit Terminal, find it in
  Applications → Utilities, `Cmd + I`, untick **Open using Rosetta**, and open
  a fresh window. No need to reinstall Node.

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
which is well over a hundred commits behind the branch the app is actually
built from — everything since 21 July, including the crash fix that stops the
app being killed when you leave and come back to it. Publishing from `main`
would push all of that *backwards* onto your phone and every TestFlight
tester, and it would do it without any error at all.

### 5. Sign in to Expo

```
npx eas-cli login
npx eas-cli whoami
```

This opens a **browser tab** to sign in — it doesn't ask for a password in the
Terminal. Use the same Expo account as on the PC. `whoami` afterwards confirms
which account you're actually signed in as.

`npx eas-cli ...` fetches the tool fresh rather than installing it
permanently. The first run asks "Ok to proceed?" — say yes.

---

## Shipping an update

From inside the CruiseFM folder:

```
git pull origin claude/cruise-fm-v4wk5f
npx eas-cli update --branch preview --environment preview -m "short note about what changed"
```

Testers get it the next time they fully close and reopen the app.

### `--environment preview` — the flag that must never be left off

This is the one real difference from what you've been doing, and it's worth
understanding, because the way it fails is genuinely sneaky.

The Spotify keys aren't in the project folder. They're on Expo's servers, and
`--environment preview` is the instruction to go and fetch them. From Expo
SDK 55 onwards this is required, and Cruise FM is on SDK 56.

**If you forget it, you get asked to pick an environment from a list — and
picking the right one does not help.** The tool only loads the keys when the
flag was typed on the command line; the answer you give to that prompt is used
for the log entry and nothing else. So you'd choose "preview", watch it
publish successfully, and ship an update with **blank** Spotify keys that
breaks sign-in for every tester.

So: **if a list of environments ever appears, you forgot the flag.** Press
`Ctrl + C` and run it again with `--environment preview`.

### One check before your first publish from a new machine

```
npx eas-cli env:list --environment preview
```

You want to see `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` and
`EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`, and next to each a word saying how it's
stored. It must say **plaintext** or **sensitive**.

If either says **secret**, stop and tell me. Secret values deliberately can't
be read by anything except Expo's build machines — so an update would publish
with that key blank while the check still looked fine. It's a one-line fix on
Expo's website, but it has to happen before you publish.

### If it asks to commit changes

If you've opened a file in an editor, the tool may say *"Commit changes to
git?"*. **Say no.** Answering yes commits everything in the folder in one go,
which isn't what you want. Say no, tell me, and I'll sort it.

---

## Did it actually reach the phones?

Worth checking the first time you publish from a new computer. Each update
carries a "runtime version", and a phone only accepts updates whose runtime
version matches its own build. Two computers should produce the same one, but
it's a ten-second check — and if it ever didn't match, the update would simply
never arrive rather than tell you.

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
your phone:

```
npx eas-cli env:pull --environment preview
npx expo start
```

`env:pull` writes a `.env.local` file with the keys in it. Two things about
that file: it must never be committed (it's already set to be ignored — the
repo is public), and it's worth deleting when you're done, because there are
reports of it being picked up during publishing even though it shouldn't be.

---

## While you're on a Mac

Two things become possible here that never could on the PC:

- The **iPhone Simulator** (free, part of Xcode) — a working iPhone on the
  screen, so layouts can be checked without touching the real phone. This is
  the one outstanding item from the original launch checklist.
- Building and submitting to Apple locally, though the EAS cloud builds you
  already use work fine and need no setup at all.

Neither is needed to ship updates.
