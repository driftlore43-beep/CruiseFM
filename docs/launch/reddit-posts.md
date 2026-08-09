# Reddit posts — a launched app

Replaces `reddit-beta-posts.md`, which was written for TestFlight recruitment
and is now wrong in three ways: the app is live rather than in beta, it opened
on Spotify when Apple Music is the story that actually works, and it pointed at
a TestFlight link.

**The App Store link:** <https://apps.apple.com/app/id6793233679>

---

## Read this before posting anything

**Reddit is a one-shot channel per subreddit.** You cannot post Cruise FM to
r/iosapps twice. Spend each one when the listing is good and the app is current,
not before.

**Your account is the first gate, and it fails silently.** A new account, or one
with almost no karma, gets auto-removed by spam filters — the post looks fine to
you and nobody else ever sees it. If yours is new, spend two weeks just
commenting normally somewhere you actually care about before posting anything of
your own. Check your post is really visible by opening it while logged out.

**Lead with the limitation.** Every post below says up front that Spotify
control is capped at five users. That is not modesty, it is self-defence:
someone will discover it, and it lands very differently as a footnote you
volunteered than as a thing you hid. On Reddit, admitting the flaw is what buys
you the rest of the post.

**Mechanics:**

- One subreddit at a time, a few hours apart. Identical text posted to several
  subs at once is the classic spam signal.
- Rewrite each post. Do not paste the same body twice.
- Check the sub's rules for a required flair — a missing flair is the most
  common removal, and mods usually restore it if you message them politely.
- Some subs want the link in a comment rather than the post. Read the rules.
- **Tuesday to Thursday, early morning US Eastern** is the widest window.
- **Reply to every comment in the first hour.** Silence kills a post faster than
  criticism does.

**Language that gets you downvoted:** "revolutionary", "seamless", "check it
out", "game-changer", any sentence a press release could contain. Write the way
you'd tell a friend what you'd been doing.

---

## 1. r/iosapps — the straight one

**Title:**
I made a driving app that organises music by how a drive feels instead of by genre

**Body:**

Cruise FM is a visual companion for the music you already have. You pick a mood
station — Night Run, Sunset, Rain Drive, After Hours — link one of your own
playlists to it, and the screen becomes something worth having on a phone mount:
a record with a tonearm riding the grooves, a cassette whose reels actually wind
as the song plays, a mirror ball throwing light round the room, a dot-matrix
head unit you drag to tune between moods.

Free, no account, no ads, nothing to buy.

The honest catch, up front: **full playback control works on Apple Music, and on
Spotify only for five people.** Spotify caps apps at five users unless you're a
company with 250,000 monthly users, which I am obviously not. So Apple Music
subscribers get the real thing — play, pause, skip, scrub, pick a song from the
queue, all inside the app. Everyone else can press play in their own music app
and Cruise FM runs the visuals alongside it.

iPhone, iOS 16.4+. <https://apps.apple.com/app/id6793233679>

I'd genuinely like to know which visual mode you leave running, and whether it
holds up mounted in a car — that's the thing I can't test enough of on my own.

---

## 2. r/SideProject — the maker story

Do not lead with the app here. This sub rewards the *problem*, and you have a
genuinely good one.

**Title:**
Spotify limits third-party apps to 5 users unless you have 250k MAU. Here's what I did instead.

**Body:**

I built a driving app that plays your own playlists behind full-screen visuals —
a turning record, a winding cassette, a mirror ball. To control playback it
needs the Spotify API.

Spotify's development tier allows **five users**. To lift it you apply for an
extension, and since May 2025 that's organisations only, requiring an
established business with 250,000+ monthly active users. There is no path from
where I am to where that is. So for anyone past the fifth person, the app could
show the visuals but couldn't touch the music.

What I did: built the whole thing again on Apple's MusicKit, which has no user
quota at all. Any iPhone owner with an Apple Music subscription now gets full
control inside the app. Spotify still works for five people and degrades
honestly for everyone else — press play in Spotify, the visuals follow along.

Things I learned the hard way, in case they save someone else the trip:

- MusicKit's `SystemMusicPlayer` survives your app being force-quit;
  `ApplicationMusicPlayer` dies with it, which is fatal in a car.
- MusicKit returns no artwork for library tracks. I ended up looking covers up
  through Apple's public catalogue endpoint instead.
- Apple rejected an early build because a dependency had quietly added a
  background-audio claim to the app's configuration. Read the *resolved* config,
  not the file you wrote.

Free, no account, no ads: <https://apps.apple.com/app/id6793233679>

---

## 3. r/AppleMusic — genuinely useful there

**Title:**
Made a driving visualiser that works properly with Apple Music (no 5-user API cap like Spotify)

**Body:**

Most third-party music apps end up Spotify-first, and Apple Music users get the
leftovers. This one went the other way, for a boring reason: Spotify caps
outside apps at five users unless you're a company with 250k+ monthly users.
Apple's MusicKit has no such limit.

So Cruise FM gives Apple Music subscribers the full thing — play, pause, skip,
scrub, pick a song out of the queue — all from inside a full-screen driving
visual. Ten mood stations, and you link your own playlists to them.

Because it hands playback to the Music app rather than running its own player,
your lock screen and CarPlay controls keep working normally, and the music
survives you closing the app.

Free, no account, no ads. iOS 16.4+.
<https://apps.apple.com/app/id6793233679>

One known gap I'd flag: Apple doesn't expose artwork for library tracks, so
covers are looked up from the public catalogue and occasionally miss on obscure
releases. Working on it.

---

## 4. r/apphookup — short and factual

This sub is for deals, so keep it plain and don't sell.

**Title:**
[iOS] Cruise FM — driving visualiser for Apple Music / Spotify — Free (no ads, no IAP)

**Body:**

Mood stations instead of genres, and eight full-screen visual modes for the
drive — record deck, cassette, mirror ball, retro tuner, synthwave horizon.

Free with no in-app purchases and no ads. No account needed to look around.

Full playback control needs Apple Music (Spotify is limited to five users by
their API rules); with anything else it runs as visuals while you play music in
your own app.

<https://apps.apple.com/app/id6793233679>

---

## 5. r/outrun or r/synthwave — content, not promotion

**This one is a video post, not a link post.** A clip of Horizon mode — the sun
sliced by scan lines over the receding grid — belongs in these subs on its own
merits. Put the clip in the post, say what it is in one line, and put the App
Store link in a **comment**, not the title or body.

**Title:**
Made a retrowave driving mode that runs behind your own music

**Comment (post it yourself, immediately):**

It's a mode in a driving app I built — the grid and the sun react to what's
playing. Free, iOS: <https://apps.apple.com/app/id6793233679>

If it doesn't fit the sub's rules, no hard feelings, happy to take it down.

That last line matters. It reads as someone who respects the sub rather than
someone farming it, and mods respond to it.

---

## Car subreddits — participate, don't post

r/cars, r/driving, r/CarsUK and most of the big ones **ban self-promotion
outright**, and posting anyway gets you removed and sometimes banned. They're
still where your people are, so the play is different: be a normal member, and
mention the app only where it genuinely answers someone's question.

The exception worth watching for: threads asking "what do you listen to on long
drives" or "best apps for road trips" appear constantly. Answering one honestly,
as a person who happens to have made a thing, is allowed almost everywhere and
converts far better than a post would.

---

## Afterwards

Write down what actually happened — which sub, how many upvotes, how many
comments, and how many installs that day. You have no analytics by design, so
App Store Connect's daily download count is the only signal, and a Reddit post
shows up as an unmistakable spike. That's how you learn which of these five was
worth the shot before you spend the rest.
