import AppIntents
import SwiftUI
import WidgetKit

/**
 * LAST PLAYED — the song, as an object.
 *
 * THREE LOOKS OF ONE IDEA, not three widgets. Each of these shows the same
 * thing: the last song the app saw, and which station it came from. They
 * differ only in what they pretend to be — a desktop CD player, a pocket
 * player, a ticket stub. That is exactly what a Look setting is for, and it
 * keeps the gallery at one row instead of three (the same reasoning as
 * DeckLook, written out there).
 *
 * THE PICTURE IS THE SONG'S OWN COVER, falling back to the station's
 * photograph when there isn't one. It was the other way round from 03.09 to
 * 20.09, on the owner's reasoning that a custom station's photograph would
 * otherwise never appear anywhere; On Air, Start Drive and the Deck's Road
 * look all show it now, so that no longer held, and a widget called LAST
 * PLAYED showing something other than the last played thing was the first
 * thing the app's only regular outside user noticed, twice. See
 * Art.songCover, which carries the full reversal.
 *
 * IT SAYS "LAST PLAYED" AND NEVER "NOW PLAYING", in every look. A widget is
 * redrawn a handful of times a day, so by the time anyone reads this the song
 * has usually changed — "now playing" would be wrong most of the time it was
 * seen. "Last played" is a claim about the PAST and stays true however stale
 * the widget gets. That one word is the whole honesty of this widget and is
 * the thing to protect if it is ever redrawn.
 *
 * WITH NOTHING REMEMBERED IT SAYS SO rather than inventing a song. A player
 * with an empty screen is a real state and reads fine; a made-up track does
 * not.
 */
@available(iOSApplicationExtension 17.0, *)
enum LastPlayedLook: String, AppEnum {
  /// The desktop CD player — the Y2K window the share cards already use.
  case cdPlayer
  /// A pocket player: a screen, a cover, and a control ring.
  case player
  /// The drive as a ticket stub, torn across the middle.
  case stub

  static let defaultLook: LastPlayedLook = .cdPlayer

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
  static var caseDisplayRepresentations: [LastPlayedLook: DisplayRepresentation] = [
    .cdPlayer: DisplayRepresentation(title: "CD player",
                                     subtitle: "The song in a desktop window"),
    .player: DisplayRepresentation(title: "Pocket player",
                                   subtitle: "A little player with your station on its screen"),
    .stub: DisplayRepresentation(title: "Ticket stub",
                                 subtitle: "The drive as a printed stub"),
  ]
}

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedLookIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Last Played"
  static var description = IntentDescription("Choose how the song is drawn.")

  @Parameter(title: "Look", default: .cdPlayer)
  var look: LastPlayedLook

  /// Which station this tile follows. Nil (and the sentinel's empty id) mean
  /// "my last station", which is what this widget did before pinning existed.
  /// The SONG is always the last one the app heard — pinning a station does
  /// not pin a song, because there is only ever one last song. See
  /// StationPick.swift.
  @Parameter(title: "Station")
  var station: StationEntity?

  init() {}
  init(look: LastPlayedLook) { self.look = look }
}

/// Version-agnostic, so the pre-17 fallback can name a look without importing
/// AppIntents — the same split DeckStyle makes for the Deck.
enum LastPlayedStyle { case cdPlayer, player, stub }

struct LastPlayedEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
  let style: LastPlayedStyle
}

// The pinned station arrives as a bare id, not a StationEntity: the entity is
// iOS 17 only and this is shared with the plain provider older phones get.
private func lpEntry(_ style: LastPlayedStyle, pinned: String? = nil) -> LastPlayedEntry {
  guard let snap = SnapshotStore.load() else {
    return LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  // Pinned, else the last drive, else whatever is on air — so a first-time
  // listener gets a real station rather than an empty frame.
  return LastPlayedEntry(date: Date(), station: snap.station(pinned: pinned),
                         lastPlayed: snap.lastPlayed, ready: true, style: style)
}

private func lpTimeline(_ style: LastPlayedStyle, pinned: String? = nil) -> Timeline<LastPlayedEntry> {
  // One entry, refreshed in an hour. The song only changes when the app plays
  // one, and the app republishes the snapshot whenever it is backgrounded —
  // a far better signal than any schedule guessed at here.
  Timeline(entries: [lpEntry(style, pinned: pinned)],
           policy: .after(Date().addingTimeInterval(3600)))
}

struct LastPlayedProvider: TimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
    // A REAL ENTRY, NOT AN EMPTY ONE.
    //
    // WidgetKit draws `placeholder` REDACTED — every piece of text becomes a
    // grey capsule — so a placeholder built from nothing renders as a blank
    // grey tile, which is precisely what the owner reports on an iPad (14.09)
    // and could not find a cause for. A tile stuck on its placeholder and a
    // tile that failed outright look identical from the outside.
    //
    // Reading the snapshot here costs one synchronous read of shared
    // UserDefaults, which the timeline does anyway, and it makes the two
    // cases tell themselves apart: a widget stuck on its placeholder now
    // shows real content, so if a grey tile fills in, the drawing was never
    // the problem — it never received a timeline.
    lpEntry(.cdPlayer)
  }
  func getSnapshot(in c: Context, completion: @escaping (LastPlayedEntry) -> Void) {
    completion(lpEntry(.cdPlayer))
  }
  func getTimeline(in c: Context, completion: @escaping (Timeline<LastPlayedEntry>) -> Void) {
    completion(lpTimeline(.cdPlayer))
  }
}

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedIntentProvider: AppIntentTimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
    // A REAL ENTRY, NOT AN EMPTY ONE.
    //
    // WidgetKit draws `placeholder` REDACTED — every piece of text becomes a
    // grey capsule — so a placeholder built from nothing renders as a blank
    // grey tile, which is precisely what the owner reports on an iPad (14.09)
    // and could not find a cause for. A tile stuck on its placeholder and a
    // tile that failed outright look identical from the outside.
    //
    // Reading the snapshot here costs one synchronous read of shared
    // UserDefaults, which the timeline does anyway, and it makes the two
    // cases tell themselves apart: a widget stuck on its placeholder now
    // shows real content, so if a grey tile fills in, the drawing was never
    // the problem — it never received a timeline.
    lpEntry(.cdPlayer)
  }
  func snapshot(for configuration: LastPlayedLookIntent, in c: Context) async -> LastPlayedEntry {
    lpEntry(style(configuration.look), pinned: configuration.station?.id)
  }
  func timeline(for configuration: LastPlayedLookIntent, in c: Context) async -> Timeline<LastPlayedEntry> {
    lpTimeline(style(configuration.look), pinned: configuration.station?.id)
  }
  private func style(_ look: LastPlayedLook) -> LastPlayedStyle {
    switch look {
    case .cdPlayer: return .cdPlayer
    case .player:   return .player
    case .stub:     return .stub
    }
  }
}

// ── the drawing ────────────────────────────────────────────────────────────

private let paper = Color(red: 0.969, green: 0.953, blue: 0.914)
private let paperDeep = Color(red: 0.914, green: 0.890, blue: 0.831)
private let paperInk = Color(red: 0.106, green: 0.122, blue: 0.153)
/// The Y2K window's greys, lifted straight from the share card so the two
/// cannot end up being different shades of the same joke.
private let face = Color(red: 0.765, green: 0.780, blue: 0.796)
private let faceLit = Color(red: 0.875, green: 0.890, blue: 0.902)
private let faceDim = Color(red: 0.506, green: 0.541, blue: 0.580)

struct LastPlayedView: View {
  var entry: LastPlayedEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      // ── THE TALL TILE ─────────────────────────────────────────────────
      // Ethan, 23.09, with a mockup of his own: the Pocket Player "as a
      // Face", drawn tall with the screen above and the wheel below. The
      // owner picked that arrangement off `docs/design/big_tiles.py`.
      //
      // ALL THREE LOOKS GET A TALL ARRANGEMENT, and that is not generosity
      // — `.supportedFamilies` sits on the WIDGET, not on the look, so a
      // size offered for the player is offered for the CD window and the
      // stub as well. Without a tall arrangement those two would be drawn
      // stretched at a size the gallery advertises, which reads as a bug
      // rather than a choice.
      //
      // THE TALL VERSIONS SHARE THEIR PARTS WITH THE WIDE ONES rather than
      // being redrawn (`playerScreen`, `cdTitleBar`, `cdBody`, `caseMetal`,
      // `controlWheel`): they are one look at two sizes, which is the whole
      // claim the gallery row makes, and a second copy of a drawing is a
      // second thing that can drift from the one being judged.
      if family == .systemLarge {
        switch entry.style {
        case .cdPlayer: cdPlayerTall(s)
        case .player:   playerTall(s)
        case .stub:     stubTall(s)
        }
      } else {
        switch entry.style {
        case .cdPlayer: cdPlayer(s)
        case .player:   player(s)
        case .stub:     stub(s)
        }
      }
    }
  }

  // ── THE CD PLAYER ───────────────────────────────────────────────────────
  // Owner, 03.09: "make sure the card isn't [floating] inside the bubble.
  // Create the Winamp as if it's the shape of the widget." So the window IS
  // the widget — the title bar runs to the edges and the bevel is the
  // widget's own rim, rather than a little grey card sitting inside a rounded
  // rectangle with a gap all round it.
  private func cdPlayer(_ s: WidgetStation) -> some View {
    ZStack(alignment: .topLeading) {
      // THE FACE CATCHES THE LIGHT AT THE TOP AND DOES NOT DARKEN AT THE FOOT.
      //
      // Owner, 14.09: "the winamp widget still has that bottom vignette -
      // could we remove it? i really don't know where this is coming from."
      // She could not find it because it was never a layer — the foot BAND
      // came off on 09.09 when she first asked, and what was left is this
      // gradient's own last stop, `faceDim.opacity(0.30)`, which shades the
      // bottom of the panel from inside the fill that makes it plastic. Two
      // different things wearing the same appearance, which is exactly why
      // removing one of them looked like nothing had happened.
      //
      // The top lift stays: a moulded panel is lit from above and 03.09 added
      // this shading precisely because dropping the raised rim had left the
      // window reading flat. Only the darkening goes, so the face runs even
      // from just below the title bar to the bottom edge.
      LinearGradient(colors: [faceLit.opacity(0.55), face, face, face],
                     startPoint: .top, endPoint: .bottom)
      // NO FRAME AROUND THE WINDOW. This drew a raised bevel round the whole
      // widget and inset the title bar by 4pt, which left a grey rectangle
      // between the widget's own edge and the orange — the owner called it
      // twice: "make sure that this is gone and that the card is the shape of
      // the widget itself." The window IS the widget, so the title bar runs
      // into the top corners and the body runs into the bottom ones.
      //
      // The raised/sunken language is not lost by dropping it: it lives on
      // the BUTTONS and the FIELDS inside, which is where anyone reads it.
      VStack(spacing: 0) {
        cdTitleBar(s)
        cdBody(s, cover: 106)
      }

      // ── THE EDGES ───────────────────────────────────────────────────────
      // Owner, 03.09: "create shadowing on the edges of the winamp - so it
      // looks less flat." Losing the raised frame in the previous round is
      // what flattened it, and the frame is not coming back — she asked for
      // that gone twice.
      //
      // SO THIS IS SHADING, NOT A RIM: every one of these is a gradient that
      // fades to nothing INWARD, so there is no edge anywhere for the eye to
      // catch. A hard-edged stroke at the boundary is exactly the rectangle
      // border that was removed, however thin it is drawn — the app's own
      // decks learned the same thing about light (25.08: any light drawn as a
      // hard-edged shape eventually reads as a drawn artefact).
      WindowShading()
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE TITLE BAR, SHARED BY BOTH SIZES. The tall window is the same
  /// window, so its bar has to be the same bar — drawn twice it is two
  /// things that can drift, which is how a look ends up with two versions
  /// of itself in one gallery row.
  private func cdTitleBar(_ s: WidgetStation) -> some View {
    HStack(spacing: 8) {
      discGlyph(size: 18)
      // NOT hardcoded white: the bar is the station's own colour now, so
      // a cream station gets near-black lettering and a navy one white.
      // See titleBarInk in Snapshot.swift for why that is measured.
      Text("Cruise FM").font(pixelFont(15)).foregroundColor(s.titleBarInk)
      Spacer(minLength: 4)
      ForEach(["_", "[]", "X"], id: \.self) { c in
        ZStack {
          face
          bevel(raised: true, width: 2)
          Text(c).font(pixelFont(10)).foregroundColor(paperInk)
        }
        .frame(width: 20, height: 17)
      }
    }
    .padding(.horizontal, 10)
    .frame(height: 32)
    // THE STATION'S OWN COLOUR (owner, 09.09: "im not sure where that
    // yellow top banner is coming from — change it to the colour of the
    // chosen station"). It replaces the prototype's fixed gold.
    //
    // IT IS A DERIVED RAMP, NOT THE ACCENT ITSELF, and the reason is a
    // bug that already shipped once: build 42 dropped the station's
    // accent into the MIDDLE stop of the gold, which broke the one-way
    // dark-to-light ramp a title bar needs AND put a near-white band
    // under white type for a pale custom station. `titleBarRamp` takes
    // the station's hue and saturation and replaces the brightness
    // outright, then pulls the whole ramp down if its bright end would
    // out-shine the gold — so white type here is never worse than on the
    // look that was signed off. MEASURED across the palette: the gold's
    // bright end is 2.22:1 against white and the worst station is 2.37.
    .background(s.titleBarRamp)
  }

  /// The window's contents: the cover, the two fields and the foot row.
  /// `cover` is the only thing that differs between the two sizes.
  private func cdBody(_ s: WidgetStation, cover: CGFloat) -> some View {
    HStack(alignment: .top, spacing: 11) {
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        if let art = Art.songCover(station: s.image) {
          art.resizable().aspectRatio(contentMode: .fill).padding(3)
        } else {
          // Neither a cover nor a photograph: a custom station with no
          // picture. Its own colour, not a grey slab.
          s.gradient.padding(3)
        }
      }
      .frame(width: cover, height: cover)
      .clipped()

      VStack(alignment: .leading, spacing: 7) {
        field("Artist:", entry.lastPlayed?.artist ?? "—")
        field("Track:", entry.lastPlayed?.title ?? "—")
        Spacer(minLength: 0)
        HStack(spacing: 9) {
          ZStack {
            face
            bevel(raised: true, width: 2)
            Triangle().fill(paperInk).frame(width: 11, height: 13).offset(x: 1)
          }
          .frame(width: 52, height: 27)
          // faceDim is a grey tuned for the chrome around it, and against
          // the panel it sat at roughly 1.9:1 — present, unreadable, and
          // reading as disabled rather than quiet. paperInk at 0.62 is the
          // same ink the fields use, stepped back.
          Text("\(s.name) · \(s.dial)").font(pixelFont(10))
            .foregroundColor(paperInk.opacity(0.62)).lineLimit(1)
        }
      }
    }
    .padding(.horizontal, 12)
    .padding(.top, 4)
    .padding(.bottom, 12)
  }

  /// `arrow` draws the dropdown tip a period dialog puts on a combo box. It
  /// is window furniture and claims nothing — unlike a slider or a state
  /// toggle, a tip does not assert a value we would have to know.
  private func field(_ caption: String, _ value: String, arrow: Bool = false) -> some View {
    HStack(spacing: 7) {
      // 52, AND IT WAS MEASURED OFF THE ttf's OWN hmtx RATHER THAN GUESSED,
      // twice now. At 11pt in DotGothic16: "Artist:" 38.50, "Track:" 33.00,
      // "Mode:" 27.50 and — the one that moved this number — "Station:"
      // 44.00. It was 46, which is 2pt of headroom on the longest caption,
      // and 40 before that, where 1.5pt of headroom on "Artist:" was spent
      // truncating it to "Arti···". `fixedSize` on top of that: this is a
      // static label, so it must never be the thing that gives way — if
      // anything has to shrink it is the value beside it, which is free to.
      Text(caption).font(pixelFont(11)).foregroundColor(paperInk)
        .fixedSize().frame(width: 52, alignment: .leading)
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        HStack(spacing: 0) {
          Text(value).font(pixelFont(12)).foregroundColor(.black)
            .lineLimit(1).padding(.horizontal, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
          if arrow {
            ZStack {
              face
              bevel(raised: true, width: 2)
              // THE TARGET'S OWN SHAPE, not a character. A "\u{25BC}" would
              // depend on the system font covering it, and this extension
              // cannot be compiled or rendered here to find out it does not —
              // a triangle turned over cannot fail that way.
              Triangle().fill(paperInk).frame(width: 7, height: 5)
                .rotationEffect(.degrees(180))
            }
            .frame(width: 18, height: 20)
            .padding(.trailing, 3)
          }
        }
      }
      .frame(height: 26)
    }
  }

  /// The little rainbow disc in the title bar — a CD seen face-on.
  private func discGlyph(size: CGFloat) -> some View {
    ZStack {
      Circle().fill(
        AngularGradient(colors: [Color(hex: "#8fd8ff"), Color(hex: "#c9a7ff"), Color(hex: "#ffb4dc"),
                                 Color(hex: "#ffe1a3"), Color(hex: "#b9ffd9"), Color(hex: "#8fd8ff")],
                        center: .center))
      Circle().stroke(.white.opacity(0.6), lineWidth: 1.5)
      Circle().fill(face).frame(width: size * 0.34, height: size * 0.34)
    }
    .frame(width: size, height: size)
  }

  /// Raised or sunken chrome, as two inset strokes. SwiftUI has no inset box
  /// shadow, so the bevel is drawn as borders on the shape itself.
  private func bevel(raised: Bool, width: CGFloat) -> some View {
    let lit = raised ? Color.white : faceDim
    let dim = raised ? faceDim : Color.white
    return ZStack {
      VStack(spacing: 0) { lit.frame(height: width); Spacer(minLength: 0); dim.frame(height: width) }
      HStack(spacing: 0) { lit.frame(width: width); Spacer(minLength: 0); dim.frame(width: width) }
    }
    .allowsHitTesting(false)
  }

  // ── THE POCKET PLAYER ───────────────────────────────────────────────────
  // The owner's own idea, from a photograph of an iPod.
  //
  // IT IS DRAWN AS *A* PLAYER, NOT AS AN iPOD, AND THAT IS DELIBERATE. The
  // recognisable part of that object is a click wheel with four printed
  // commands and a MENU above them; that is Apple's own industrial design,
  // and this app is submitted to Apple. So the wheel here is a plain ring
  // with no printing on it and the proportions are the widget's own. The
  // nostalgia survives the change; the trade-dress problem does not.
  //
  // AND THE RING DOES NOTHING, ON PURPOSE. A widget can carry real buttons
  // since iOS 17, but Cruise FM does not play the audio — Spotify and Apple
  // Music do — so a skip button would have to reach a music service from
  // inside this extension, which is its own round of work. Until then the
  // ring is ornament, the way the cassette's reels are ornament, and it is
  // kept plain rather than made the hero so it does not read as a control
  // that is broken.
  private func player(_ s: WidgetStation) -> some View {
    ZStack {
      caseMetal
      HStack(spacing: 0) {
        playerScreen(s, cover: 74, title: 17, artist: 12, eyebrow: 7.5,
                     dialSize: 10, pad: 10)
          .padding(.vertical, 14)
          .padding(.leading, 14)
        // SMALLER THAN IT WAS (112 / 17), because it was winning an argument
        // it should not have been in: at 112 plus its padding the ring took
        // 146 of the widget's 338 points — 43% of the tile for something that
        // is deliberately ornament — and the SONG, which is what this widget
        // is about, was left with about 73 and printed "Breaka…". This gives
        // the title back 24 points and costs the ring nothing anyone reads.
        controlWheel(diameter: 96)
          .padding(.horizontal, 13)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /**
   * THE SAME PLAYER, STOOD UP (Ethan, 23.09, with a mockup of his own: the
   * Pocket Player "as a Face"). The owner picked this arrangement over a
   * cover-led one off `docs/design/big_tiles.py`: the screen keeps the
   * cover BESIDE the words, exactly as the wide tile does, and the wheel
   * moves from the right-hand side to underneath.
   *
   * SO IT IS ONE OBJECT AT TWO SIZES, NOT TWO LOOKS. Every part comes from
   * the same three helpers the wide tile uses, and the only things that
   * differ are the numbers handed to them — which is what stops the tall
   * version quietly becoming a different player over the next few rounds.
   *
   * THE HEIGHTS ARE SPENT DELIBERATELY: screen 172, wheel 128, 12 between
   * them and 14 of case all round comes to 340 of a 354pt tile, so there is
   * 14pt of slack and nothing has to be compressed to fit. Drawn any other
   * way round — a taller screen, a smaller wheel — the wheel stops reading
   * as the object it is and becomes a button.
   */
  private func playerTall(_ s: WidgetStation) -> some View {
    ZStack {
      caseMetal
      VStack(spacing: 12) {
        playerScreen(s, cover: 108, title: 20, artist: 13, eyebrow: 8.5,
                     dialSize: 11, pad: 14)
          .frame(height: 172)
        controlWheel(diameter: 128)
      }
      .padding(14)
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE BRUSHED-SILVER CASE, shared by both sizes (owner, 09.09: "the
  /// surface is looking too flat, enhance detail with silver and shading").
  /// The old face was one four-stop diagonal ramp across the whole widget,
  /// which is a painted panel — a real metal case is lit from ABOVE, catches
  /// one broad sheen across its middle, and turns out of the light at every
  /// edge.
  ///
  /// EVERY LAYER IS FALLOFF AND NOTHING IS A STROKE, which is this file's
  /// own rule (03.09): a hard edge anywhere on the face reads as a drawn
  /// border, and the owner has now made that note twice about the Winamp.
  /// The sheen fades to nothing at both ends for the same reason.
  private var caseMetal: some View {
    ZStack {
      LinearGradient(colors: [Color(white: 0.97), Color(white: 0.90),
                              Color(white: 0.83), Color(white: 0.78)],
                     startPoint: .top, endPoint: .bottom)
      LinearGradient(stops: [
        .init(color: .clear, location: 0.10),
        .init(color: .white.opacity(0.42), location: 0.32),
        .init(color: .clear, location: 0.54),
      ], startPoint: .topLeading, endPoint: .bottomTrailing)
      LinearGradient(stops: [
        .init(color: .clear, location: 0.58),
        .init(color: .white.opacity(0.20), location: 0.74),
        .init(color: .clear, location: 0.92),
      ], startPoint: .topLeading, endPoint: .bottomTrailing)
      MetalShading()
    }
  }

  /// The sunken screen. One helper for both sizes — see `playerTall`.
  private func playerScreen(_ s: WidgetStation, cover: CGFloat, title: CGFloat,
                            artist: CGFloat, eyebrow: CGFloat,
                            dialSize: CGFloat, pad: CGFloat) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 5).fill(Color(hex: "#0a0c12"))
      // THE SCREEN IS SUNK INTO THE CASE, so its surround is dark where the
      // metal turns down into the well and lit where it comes back up on the
      // far side. One even grey stroke reads as a drawn box.
      RoundedRectangle(cornerRadius: 5).stroke(
        LinearGradient(colors: [Color(white: 0.34), Color(white: 0.58),
                                Color(white: 0.96)],
                       startPoint: .top, endPoint: .bottom), lineWidth: 2)

      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .top, spacing: 11) {
          playerCover(s, size: cover)
          VStack(alignment: .leading, spacing: 4) {
            Text(entry.lastPlayed?.title ?? s.name)
              .font(.system(size: title, weight: .heavy))
              .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.7)
            if let lp = entry.lastPlayed {
              Text(lp.artist).font(.system(size: artist))
                .foregroundColor(.white.opacity(0.66)).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }
        Spacer(minLength: 4)
        // NO PROGRESS BAR. A bar claims a position in a song, and the only
        // thing known here is that this played at some point.
        HStack {
          Text("LAST PLAYED").font(.system(size: eyebrow, weight: .heavy)).tracking(1.3)
            .foregroundColor(.white.opacity(0.48))
          Spacer(minLength: 4)
          DialText(dial: s.dial, size: dialSize, color: .white.opacity(0.58))
        }
      }
      .padding(pad)
    }
  }

  /// THE COVER, SIZED THEN CLIPPED — and the order is the fix for a bug that
  /// shipped in build 43.
  ///
  ///     art.resizable().aspectRatio(contentMode: .fill)
  ///       .clipShape(RoundedRectangle(cornerRadius: 3))
  ///     ...
  ///     .frame(width: 74, height: 74)
  ///
  /// `.clipShape` there trims the image to ITS OWN bounds, which `.fill` has
  /// already made larger than the slot, so it clips nothing at all; and
  /// `.frame` on the ZStack fixes the size this stack REPORTS without
  /// clipping what is drawn inside it. So a 74pt slot drew a photograph a
  /// widget and a half tall, over the tile's rounded corners and across
  /// LAST PLAYED. `cruiseBackdrop` gives the image a box that accepts the
  /// proposal, and the corner rounding moves onto the stack where it bites.
  private func playerCover(_ s: WidgetStation, size: CGFloat) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 3).fill(Color(white: 0.16))
      if let art = Art.songCover(station: s.image) {
        art.cruiseBackdrop()
      } else {
        s.gradient
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: 3))
  }

  /// THE CONTROL: A PLAIN RING, DELIBERATELY UNLABELLED.
  ///
  /// The recognisable part of an iPod is a click wheel with four printed
  /// commands and a MENU above them; that is Apple's own industrial design,
  /// and this app is submitted to Apple. So the wheel here carries no
  /// printing and the proportions are the widget's own. The nostalgia
  /// survives the change; the trade-dress problem does not.
  ///
  /// AND THE RING DOES NOTHING, ON PURPOSE. A widget can carry real buttons
  /// since iOS 17, but Cruise FM does not play the audio — Spotify and Apple
  /// Music do — so a skip button would have to reach a music service from
  /// inside this extension, which is its own round of work. Until then it is
  /// ornament, the way the cassette's reels are, and it is kept plain rather
  /// than made the hero so it cannot read as a control that is broken.
  ///
  /// EVERY PART IS A SHARE OF THE DIAMETER, so the tall tile's larger wheel
  /// is the same wheel rather than a second drawing: at 96 these are exactly
  /// the numbers the medium tile shipped with (46, 40, 14, 34, 52).
  private func controlWheel(diameter d: CGFloat) -> some View {
    ZStack {
      Circle().fill(
        LinearGradient(colors: [Color(white: 0.99), Color(white: 0.86), Color(white: 0.77)],
                       startPoint: .topLeading, endPoint: .bottomTrailing))
      // A MACHINED RING IS BRIGHT WHERE THE LAMP IS AND DARK OPPOSITE, so
      // its edge is a sweep rather than one flat line — the same argument
      // that took the record's rim off a plain stroke on 04.09.
      Circle().strokeBorder(
        AngularGradient(stops: [
          .init(color: .white.opacity(0.95), location: 0),
          .init(color: .black.opacity(0.10), location: 0.30),
          .init(color: .white.opacity(0.55), location: 0.56),
          .init(color: .black.opacity(0.14), location: 0.82),
          .init(color: .white.opacity(0.95), location: 1),
        ], center: .center, angle: .degrees(-130)), lineWidth: 1.6)
      // the dish: the wheel's face falls away toward its middle
      Circle().fill(
        RadialGradient(colors: [.black.opacity(0.13), .clear],
                       center: .center, startRadius: 0, endRadius: d * 0.479))
      Circle().fill(
        LinearGradient(colors: [Color(white: 0.97), Color(white: 0.86), Color(white: 0.80)],
                       startPoint: .top, endPoint: .bottom))
        .frame(width: d * 0.417, height: d * 0.417)
      // the hub sits proud: a lit crown, a shadow under its far side
      Circle().strokeBorder(
        LinearGradient(colors: [.white.opacity(0.90), .black.opacity(0.12)],
                       startPoint: .top, endPoint: .bottom), lineWidth: 1.2)
        .frame(width: d * 0.417, height: d * 0.417)
      Circle().fill(
        RadialGradient(colors: [.clear, .black.opacity(0.16)],
                       center: .init(x: 0.5, y: 0.16),
                       startRadius: d * 0.146, endRadius: d * 0.354))
        .frame(width: d * 0.542, height: d * 0.542)
    }
    .frame(width: d, height: d)
  }

  // ── THE STUB ────────────────────────────────────────────────────────────
  // THE TICKET IS A BOARDING PASS NOW (owner, 09.09: "the barcode is way too
  // long... rearrange the ticket so the dotted line runs vertically, and the
  // barcode is vertical and on the right — like a plane ticket. The text sits
  // on the left"). She picked arrangement B off `docs/design/ticket.py`, drawn
  // at this widget's real 338x158: the tear runs the FULL height, so the
  // counterfoil is a genuinely detachable stub carrying its own slice of the
  // banner rather than a strip hanging under one.
  //
  // THAT ALSO FIXES THE BARCODE BY GEOMETRY RATHER THAN BY TUNING. Across the
  // ticket's width it had to be 46 bars to read as printed at all, which is
  // the "far too long" she photographed; down a 58pt counterfoil the same
  // idea needs a couple of dozen and cannot compete with the song, because it
  // no longer shares an axis with it.
  private func stub(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)

      HStack(spacing: 0) {
        // ── the half you keep ──────────────────────────────────────────────
        VStack(alignment: .leading, spacing: 0) {
          HStack {
            Text("CRUISE FM").font(.system(size: 10, weight: .heavy)).tracking(1.6)
              .foregroundColor(.white)
            Spacer()
            Text("ADMIT ONE").font(.system(size: 8, weight: .heavy)).tracking(1.4)
              .foregroundColor(.white.opacity(0.45))
          }
          .padding(.horizontal, 15)
          .frame(height: 30)
          .background(paperInk)

          VStack(alignment: .leading, spacing: 0) {
            Text("LAST PLAYED").font(.system(size: 8, design: .monospaced)).tracking(1.6)
              .foregroundColor(paperInk.opacity(0.45))
            if let lp = entry.lastPlayed {
              Text(lp.title).font(.system(size: 21, weight: .heavy))
                .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.6)
                .padding(.top, 1)
              Text(lp.artist).font(.system(size: 14))
                .foregroundColor(paperInk.opacity(0.62)).lineLimit(1).minimumScaleFactor(0.7)
            } else {
              Text(s.tagline).font(.system(size: 14))
                .foregroundColor(paperInk.opacity(0.55)).lineLimit(2).padding(.top, 2)
            }

            Spacer(minLength: 4)

            // The station and its dial sit at the foot, where a pass prints
            // the route. The dial is NOT ink-aligned here: nothing is stacked
            // above or below it, so there is no column for it to line up with.
            HStack(alignment: .bottom) {
              VStack(alignment: .leading, spacing: 1) {
                Text("STATION").font(.system(size: 8, design: .monospaced)).tracking(1.6)
                  .foregroundColor(paperInk.opacity(0.45))
                Text(s.name).font(.system(size: 15, weight: .heavy))
                  .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.7)
              }
              Spacer(minLength: 6)
              DialText(dial: s.dial, size: 14, color: paperInk)
            }
          }
          .padding(.horizontal, 14)
          .padding(.top, 10)
          .padding(.bottom, 11)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        tear

        // ── the counterfoil ────────────────────────────────────────────────
        VStack(spacing: 0) {
          paperInk.frame(height: 30)
          barcode.padding(.top, 9).padding(.bottom, 3)
          Text(splitDial(s.dial).number).font(dialFont(9))
            .foregroundColor(paperInk.opacity(0.55))
            .padding(.bottom, 8)
        }
        .frame(width: 58)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// THE TEAR RUNS THE WHOLE HEIGHT, and it changes colour half way down
  /// because what it crosses changes. Over the paper it is ink; over the
  /// banner an ink dash on an ink ground is invisible, so that stretch is
  /// white — the same hairline the prototype puts between the two halves of
  /// the banner. One colour the whole way would simply vanish at the top.
  ///
  /// Drawn as a stack of real dashes rather than a masked rule: a mask that
  /// does not size exactly to its host shifts the pattern, and there is no
  /// compiler here to catch it. The notches deliberately hang half off each
  /// edge — the tile clips them, which is what makes them read as bitten out.
  private var tear: some View {
    ZStack {
      VStack(spacing: 0) {
        dashes(4, color: .white.opacity(0.18)).frame(height: 30)
        dashes(15, color: paperInk.opacity(0.30)).frame(maxHeight: .infinity)
      }
      VStack(spacing: 0) {
        notch.offset(y: -6.5)
        Spacer(minLength: 0)
        notch.offset(y: 6.5)
      }
    }
    .frame(width: 1)
  }

  private var notch: some View {
    Circle().fill(Color.black.opacity(0.30)).frame(width: 13, height: 13)
  }

  private func dashes(_ count: Int, color: Color) -> some View {
    VStack(spacing: 4) {
      ForEach(0..<count, id: \.self) { _ in
        Rectangle().fill(color).frame(width: 1, height: 5)
      }
    }
  }

  /// THE BARCODE STANDS UP, down the counterfoil, which is where a boarding
  /// pass keeps it. Flexible spacers between the bars let it fill whatever
  /// height it is handed, so the count is not tied to the widget's size.
  private var barcode: some View {
    VStack(spacing: 0) {
      ForEach(0..<24, id: \.self) { i in
        Rectangle().fill(paperInk)
          .frame(width: i % 4 == 0 ? 22 : 30, height: i % 3 == 0 ? 3 : 2)
        if i < 23 { Spacer(minLength: 0.5) }
      }
    }
    .frame(maxHeight: .infinity)
  }

  // ── THE TALL ARRANGEMENTS ──────────────────────────────────────────────

  /**
   * THE CD PLAYER, TALL — the window, then the disc in the room it makes.
   *
   * NOT THE WINDOW STRETCHED, which is the whole design decision here. A
   * Winamp window is a wide, short thing: its title bar, its cover and its
   * two fields all have a natural height, and pulling them down a 354pt tile
   * leaves a dialog with a dead band inside it. So the window keeps very
   * nearly the proportions it has on the medium tile and the height that is
   * left over is spent on the disc itself, sitting on a shelf underneath.
   *
   * The room takes the station's own light, the same derivation the record
   * and the mirror ball stand in (`tileHalo`'s arithmetic, 22.09), rather
   * than a fixed colour — a dark tile with a coloured pool under the disc.
   */
  private func cdPlayerTall(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [Color(hex: "#1b1f28"), Color(hex: "#0a0c11")],
                     startPoint: .top, endPoint: .bottom)
      // THE LAMP SITS LOW AND BEHIND THE WINDOW'S FOOT. It used to light a
      // disc on a shelf; with the window taking the tile there is no shelf,
      // and a glow behind a grey dialog only greys it. What is left of the
      // room is what stops the tile reading as a screenshot of a dialog
      // rather than a dialog standing in one. Falloff, never a blur — a blur
      // is the one thing in this target that forces an offscreen buffer.
      RadialGradient(stops: [
        .init(color: s.accentColor.opacity(0.26), location: 0.00),
        .init(color: s.accentColor.opacity(0.11), location: 0.58),
        .init(color: s.accentColor.opacity(0.00), location: 1.00),
      ], center: .init(x: 0.5, y: 0.90), startRadius: 0, endRadius: 210)

      ZStack {
        LinearGradient(colors: [faceLit.opacity(0.55), face, face, face],
                       startPoint: .top, endPoint: .bottom)
        VStack(spacing: 0) {
          cdTitleBar(s)
          cdBodyTall(s)
        }
        WindowShading()
      }
      .clipShape(RoundedRectangle(cornerRadius: 3))
      .padding(13)
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /**
   * THE TALL WINDOW'S CONTENTS — cover and controls across the top, four
   * labelled fields the full width beneath.
   *
   * THIS REVERSED A DECISION MADE THE DAY BEFORE, on the owner's own
   * evidence. 24.09 argued a Winamp window is a wide, short thing, so the
   * honest tall version is the window with a record shelf under it rather
   * than the window stretched — and it spent about 60% of the tile on a disc
   * in a lit room. She then put the shipped tile beside the app's own Y2K
   * SHARE CARD ("can we change the CD player to a larger Winamp like the
   * share cards the app delivers") and the card plainly reads more like a
   * player: it fills its frame with WINDOW.
   *
   * THE OLD ARGUMENT'S FAULT WAS OFFERING ONE WAY TO SPEND HEIGHT. A window
   * does not have to STRETCH its existing rows to grow; it can carry MORE
   * ROWS, which is what the share card does. That is a genuinely taller
   * dialog rather than a short one pulled out of shape.
   *
   * THREE THINGS ON THAT CARD CANNOT COME ACROSS, and each is this app's own
   * honesty rule rather than a drawing problem.
   *
   *   THE SCRUB BAR. A widget is redrawn a handful of times a day, so it
   *   cannot know where a song is up to — which is exactly why this tile
   *   says LAST PLAYED and never NOW PLAYING. The Y2K card itself had its
   *   own decorative bar taken to zero on 12.08 for the same reason: "the
   *   times either side read 0:00 and a bar sitting 42% along beside them
   *   says two different things at once."
   *
   *   THE VOLUME. We do not know it, and a level bar drawn at a guessed
   *   height is an invented readout.
   *
   *   SHUFFLE, REPEAT AND THE HEART. All three are STATE. The app knows two
   *   of them during a drive; the snapshot carries none, and a value from
   *   the last time the app ran would be stale by the time anyone looked.
   *
   * THE FOUR FIELDS ARE WHAT DOES COME ACROSS, and they are the best part of
   * her card: artist, track, station and mode are all real, all already in
   * the snapshot, and four full-width rows are the one thing a tall tile has
   * room for and a wide one never will.
   *
   * THE TRANSPORT IS THREE BUTTONS, NOT HER CARD'S ELEVEN, and stays
   * ornament — the settled rule for this target: the wide window already
   * draws a play button that does nothing, and the Pocket Player's wheel is
   * deliberately plain "so it does not read as a control that is broken".
   * Eleven at this size is a row of grey smudges, and a wall of dead
   * controls is the exact thing that rule exists to avoid.
   *
   * COUNTED RATHER THAN EYEBALLED, at 338x354 with 13 of padding, so the
   * window has 312x328: title bar 32, air 10, cover row 120, air 12, four
   * fields 125 (4 x 26, 3 x 7 between), bottom padding 12 — 311 of 328, so
   * nothing is compressed to fit. The cluster beside the cover gets
   * 288 - 120 - 11 = 157, which takes three 42pt buttons with 6 between.
   */
  private func cdBodyTall(_ s: WidgetStation) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 11) {
        ZStack {
          Color.white
          bevel(raised: false, width: 2)
          if let art = Art.songCover(station: s.image) {
            art.resizable().aspectRatio(contentMode: .fill).padding(3)
          } else {
            // Neither a cover nor a photograph: a custom station with no
            // picture. Its own colour, not a grey slab.
            s.gradient.padding(3)
          }
        }
        .frame(width: 120, height: 120)
        .clipped()

        VStack(spacing: 0) {
          // The window's own disc, not a mode indicator: this look IS the CD
          // player, and the Mode field below says in words what is playing.
          // Her card carries a CD and a tape deck as decoration; one object
          // that belongs to the window beats two that belong to neither.
          discGlyph(size: 46)
          Spacer(minLength: 6)
          HStack(spacing: 6) {
            transportKey(.back)
            transportKey(.play)
            transportKey(.forward)
          }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
      }

      VStack(spacing: 7) {
        field("Artist:", entry.lastPlayed?.artist ?? "—", arrow: true)
        field("Track:", entry.lastPlayed?.title ?? "—", arrow: true)
        field("Station:", "\(s.name) · \(s.dial)", arrow: true)
        // The app's own label for the deck, sent in the snapshot rather than
        // mapped here — see `modeName` in Snapshot.swift for why.
        field("Mode:", s.modeName ?? "—", arrow: true)
      }
    }
    .padding(.horizontal, 12)
    .padding(.top, 10)
    .padding(.bottom, 12)
  }

  private enum TransportKey { case back, play, forward }

  /// One of the three. ORNAMENT, and drawn quiet on purpose — see the note
  /// on `cdBodyTall`. A period key is a raised face with a dark glyph on it;
  /// nothing here is a control and nothing here claims to be.
  private func transportKey(_ kind: TransportKey) -> some View {
    ZStack {
      face
      bevel(raised: true, width: 2)
      switch kind {
      case .play:
        Triangle().fill(paperInk).frame(width: 10, height: 12).offset(x: 1)
      case .back, .forward:
        HStack(spacing: 1.5) {
          Triangle().fill(paperInk).frame(width: 7, height: 9)
          Triangle().fill(paperInk).frame(width: 7, height: 9)
        }
        // A back key is the forward key turned round, which is how the glyph
        // is built everywhere else in this app rather than a second drawing.
        .rotationEffect(.degrees(kind == .back ? 180 : 0))
      }
    }
    .frame(width: 42, height: 30)
  }

  /**
   * THE STUB, TALL — and the tear turns with the tile.
   *
   * The medium ticket is a boarding pass: the tear runs the full HEIGHT and
   * the counterfoil is a column down the right, which is what a wide stub
   * does. Stand the same ticket up and that stops being true — a tall stub
   * tears ACROSS, and the counterfoil becomes its foot. Keeping the vertical
   * tear would have left a 58pt column running the whole 354pt of the tile,
   * which is a bookmark rather than a ticket.
   *
   * THE PICTURE IS THE HEIGHT THE MEDIUM TILE NEVER HAD. There is no room
   * for one at 158pt tall, so the wide ticket is type alone; here the cover
   * sits under the banner and the song is printed beneath it, which is the
   * order a real pass puts them in.
   */
  private func stubTall(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)

      VStack(spacing: 0) {
        HStack {
          Text("CRUISE FM").font(.system(size: 11, weight: .heavy)).tracking(1.6)
            .foregroundColor(.white)
          Spacer(minLength: 6)
          // The dial in the banner rather than at the foot: on a tall ticket
          // the head is where a pass prints the flight, and the station's
          // name takes the counterfoil below.
          DialText(dial: s.dial, size: 15, color: Color(hex: "#FF9A2E"))
        }
        .padding(.horizontal, 16)
        .frame(height: 38)
        .background(paperInk)

        // 110, NOT 118, AND IT WAS COUNTED RATHER THAN EYEBALLED: with a
        // two-line song title the stack came to 356 of a 354pt tile and
        // something would have had to give. Banner 38, picture 110 + 14 of
        // air, the song block 107, the tear 13, the counterfoil 58 and 8
        // between them is 348, so nothing is compressed to fit.
        ZStack {
          if let art = Art.songCover(station: s.image) {
            art.cruiseBackdrop()
          } else {
            // A custom station with neither a cover nor a photograph: its
            // own colour, which is a real picture rather than a hole.
            s.gradient
          }
        }
        .frame(height: 110)
        .clipped()
        .padding(.horizontal, 14)
        .padding(.top, 14)

        VStack(alignment: .leading, spacing: 0) {
          Text("LAST PLAYED").font(.system(size: 8.5, design: .monospaced)).tracking(1.6)
            .foregroundColor(paperInk.opacity(0.45))
          if let lp = entry.lastPlayed {
            Text(lp.title).font(.system(size: 24, weight: .heavy))
              .foregroundColor(paperInk).lineLimit(2).minimumScaleFactor(0.6)
              .padding(.top, 3)
            Text(lp.artist).font(.system(size: 15))
              .foregroundColor(paperInk.opacity(0.62)).lineLimit(1).minimumScaleFactor(0.7)
              .padding(.top, 3)
          } else {
            Text(s.tagline).font(.system(size: 15))
              .foregroundColor(paperInk.opacity(0.55)).lineLimit(3).padding(.top, 3)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 15)
        .padding(.top, 14)

        Spacer(minLength: 8)

        tearAcross

        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text("STATION").font(.system(size: 8, design: .monospaced)).tracking(1.6)
              .foregroundColor(paperInk.opacity(0.45))
            Text(s.name).font(.system(size: 17, weight: .heavy))
              .foregroundColor(paperInk).lineLimit(1).minimumScaleFactor(0.7)
          }
          Spacer(minLength: 8)
          barcodeAcross
        }
        .padding(.horizontal, 15)
        .padding(.top, 12)
        .padding(.bottom, 14)
      }
    }
    .widgetURL(s.url(mode: s.mode))
  }

  /// The tear, laid on its side. Real dashes rather than a masked rule, for
  /// the reason the vertical one gives: a mask that does not size exactly to
  /// its host shifts the pattern, and there is no compiler here to catch it.
  /// The notches hang half off each edge and the tile clips them, which is
  /// what makes them read as bitten out rather than drawn on.
  private var tearAcross: some View {
    ZStack {
      HStack(spacing: 0) {
        ForEach(0..<24, id: \.self) { i in
          Rectangle().fill(paperInk.opacity(0.30)).frame(width: 6, height: 1)
          if i < 23 { Spacer(minLength: 0.5) }
        }
      }
      HStack(spacing: 0) {
        notch.offset(x: -6.5)
        Spacer(minLength: 0)
        notch.offset(x: 6.5)
      }
    }
    .frame(height: 13)
  }

  /// The barcode lies down too, beside the station's name. Flexible spacers
  /// between the bars let it fill whatever width it is handed.
  private var barcodeAcross: some View {
    HStack(alignment: .bottom, spacing: 0) {
      ForEach(0..<26, id: \.self) { i in
        Rectangle().fill(paperInk)
          .frame(width: i % 3 == 0 ? 3 : 2, height: i % 4 == 0 ? 22 : 30)
        if i < 25 { Spacer(minLength: 0.5) }
      }
    }
    .frame(height: 30)
  }
}

/// The light on a moulded panel: a catch along the top and the two sides
/// turning out of the light. Gradients only — see the note at the call site.
///
/// THERE IS NO FOOT BAND, and its absence is a decision (owner, 09.09:
/// "remove the bottom shading -- its not necessary"). It was added on 03.09
/// to give the window depth after the raised rim came off, and on a tile that
/// now fills its own edges it only darkened the row the song sits on. The top
/// catch and the two sides carry the moulding on their own.
private struct WindowShading: View {
  var body: some View {
    ZStack {
      // top: the edge nearest the light
      VStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.34), .clear], startPoint: .top, endPoint: .bottom)
          .frame(height: 10)
        Spacer(minLength: 0)
      }
      // sides: turning out of the light, the right harder than the left
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.18)], startPoint: .leading, endPoint: .trailing)
          .frame(width: 14)
      }
    }
    .allowsHitTesting(false)
  }
}

/// The light on a brushed metal case. Heavier than `WindowShading` in both
/// directions, because a metal edge catches harder than a moulded plastic one
/// and the shadow under it is sharper. Still pure falloff — nothing here is a
/// stroke, so there is no boundary anywhere to read as a drawn border.
private struct MetalShading: View {
  var body: some View {
    ZStack {
      VStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
          .frame(height: 9)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.20)], startPoint: .top, endPoint: .bottom)
          .frame(height: 14)
      }
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.30), .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: 10)
        Spacer(minLength: 0)
        LinearGradient(colors: [.clear, .black.opacity(0.16)], startPoint: .leading, endPoint: .trailing)
          .frame(width: 12)
      }
    }
    .allowsHitTesting(false)
  }
}

/// A play triangle. `Path` rather than an SF Symbol so it matches the blunt,
/// square-cornered look of the rest of the window chrome.
struct Triangle: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: r.minX, y: r.minY))
    p.addLine(to: CGPoint(x: r.maxX, y: r.midY))
    p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
    p.closeSubpath()
    return p
  }
}

// ── the two configurations ─────────────────────────────────────────────────
// Same split as the Deck: 17 and later get the look setting, older phones get
// the default look. They share a `kind` so the gallery shows one row.

@available(iOSApplicationExtension 17.0, *)
struct LastPlayedConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseLastPlayed", intent: LastPlayedLookIntent.self,
                           provider: LastPlayedIntentProvider()) { entry in
      LastPlayedView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Last Played")
    .description("The last song you heard. Long-press to change the look, or pin it to a station.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .cruiseFullBleed()
  }
}

struct LastPlayedWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseLastPlayed", provider: LastPlayedProvider()) { entry in
      LastPlayedView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("Last Played")
    .description("The last song you heard, in a desktop CD player.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .cruiseFullBleed()
  }
}
