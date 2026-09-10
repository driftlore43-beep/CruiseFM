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
 * THE PICTURE IS THE STATION'S OWN PHOTOGRAPH, not the song's cover — the
 * owner's call (03.09) "so people can add their photos in", since a custom
 * station carries a picture the listener chose and a cover very often does
 * not exist at all. The WORDS still name the song, which is what the widget
 * is about. See Art.cover.
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

private func lpEntry(_ style: LastPlayedStyle) -> LastPlayedEntry {
  guard let snap = SnapshotStore.load() else {
    return LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  // Never driven? Fall back to whatever is on air, so a first-time listener
  // gets a real station rather than an empty frame.
  let station = snap.lastDrive ?? snap.onAir.first
  return LastPlayedEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                         ready: true, style: style)
}

private func lpTimeline(_ style: LastPlayedStyle) -> Timeline<LastPlayedEntry> {
  // One entry, refreshed in an hour. The song only changes when the app plays
  // one, and the app republishes the snapshot whenever it is backgrounded —
  // a far better signal than any schedule guessed at here.
  Timeline(entries: [lpEntry(style)], policy: .after(Date().addingTimeInterval(3600)))
}

struct LastPlayedProvider: TimelineProvider {
  func placeholder(in c: Context) -> LastPlayedEntry {
    LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .cdPlayer)
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
    LastPlayedEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .cdPlayer)
  }
  func snapshot(for configuration: LastPlayedLookIntent, in c: Context) async -> LastPlayedEntry {
    lpEntry(style(configuration.look))
  }
  func timeline(for configuration: LastPlayedLookIntent, in c: Context) async -> Timeline<LastPlayedEntry> {
    lpTimeline(style(configuration.look))
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
      switch entry.style {
      case .cdPlayer: cdPlayer(s)
      case .player:   player(s)
      case .stub:     stub(s)
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
      // The face is not a flat fill: a moulded plastic panel is lit from
      // above, so it is faintly brighter at the top than at the foot.
      LinearGradient(colors: [faceLit.opacity(0.55), face, face,
                              faceDim.opacity(0.30)],
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
        // title bar
        HStack(spacing: 8) {
          discGlyph(size: 18)
          Text("Cruise FM").font(pixelFont(15)).foregroundColor(.white)
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

        HStack(alignment: .top, spacing: 11) {
          ZStack {
            Color.white
            bevel(raised: false, width: 2)
            if let art = Art.cover(station: s.image) {
              art.resizable().aspectRatio(contentMode: .fill).padding(3)
            } else {
              // Neither a cover nor a photograph: a custom station with no
              // picture. Its own colour, not a grey slab.
              s.gradient.padding(3)
            }
          }
          .frame(width: 106, height: 106)
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

  private func field(_ caption: String, _ value: String) -> some View {
    HStack(spacing: 7) {
      // 46, NOT 40. "Artist:" measures 38.5pt of glyph at 11pt in DotGothic16
      // (measured off the ttf's own hmtx, not guessed), so a 40pt column left
      // 1.5pt of headroom and iOS spent it truncating the label to "Arti···".
      // `fixedSize` on top of that: this is a static label, so it must never
      // be the thing that gives way — if anything has to shrink it is the
      // value beside it, which is already free to.
      Text(caption).font(pixelFont(11)).foregroundColor(paperInk)
        .fixedSize().frame(width: 46, alignment: .leading)
      ZStack {
        Color.white
        bevel(raised: false, width: 2)
        Text(value).font(pixelFont(12)).foregroundColor(.black)
          .lineLimit(1).padding(.horizontal, 7)
          .frame(maxWidth: .infinity, alignment: .leading)
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
      // BRUSHED SILVER, NOT A FLAT WASH (owner, 09.09: "the surface is looking
      // too flat, enhance detail with silver and shading"). The old face was
      // one four-stop diagonal ramp across the whole widget, which is a
      // painted panel — a real metal case is lit from ABOVE, catches one broad
      // sheen across its middle, and turns out of the light at every edge.
      //
      // EVERY LAYER IS FALLOFF AND NOTHING IS A STROKE, which is this file's
      // own rule (03.09): a hard edge anywhere on the face reads as a drawn
      // border, and the owner has now made that note twice about the Winamp.
      // The sheen fades to nothing at both ends for the same reason.
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

      HStack(spacing: 0) {
        // the screen
        ZStack {
          RoundedRectangle(cornerRadius: 5).fill(Color(hex: "#0a0c12"))
          // THE SCREEN IS SUNK INTO THE CASE, so its surround is dark where
          // the metal turns down into the well and lit where it comes back
          // up on the far side. One even grey stroke reads as a drawn box.
          RoundedRectangle(cornerRadius: 5).stroke(
            LinearGradient(colors: [Color(white: 0.34), Color(white: 0.58),
                                    Color(white: 0.96)],
                           startPoint: .top, endPoint: .bottom), lineWidth: 2)

          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 11) {
              // THE PHOTOGRAPH SPILLED OFF THE WHOLE WIDGET ON BUILD 43, and
              // this is the shape that did it:
              //
              //     art.resizable().aspectRatio(contentMode: .fill)
              //       .clipShape(RoundedRectangle(cornerRadius: 3))
              //     ...
              //     .frame(width: 74, height: 74)
              //
              // `.clipShape` here trims the image to ITS OWN bounds, which
              // `.fill` has already made larger than the slot, so it clips
              // nothing at all; and `.frame` on the ZStack fixes the size
              // this stack REPORTS without clipping what is drawn inside it.
              // So a 74pt slot drew a photograph a widget and a half tall,
              // over the tile's rounded corners and across LAST PLAYED.
              //
              // The order is the fix: size first, then clip. cruiseBackdrop
              // gives the image a box that accepts the proposal, and the
              // corner rounding moves onto the stack where it can bite.
              ZStack {
                RoundedRectangle(cornerRadius: 3).fill(Color(white: 0.16))
                if let art = Art.cover(station: s.image) {
                  art.cruiseBackdrop()
                } else {
                  s.gradient
                }
              }
              .frame(width: 74, height: 74)
              .clipShape(RoundedRectangle(cornerRadius: 3))

              VStack(alignment: .leading, spacing: 4) {
                Text(entry.lastPlayed?.title ?? s.name)
                  .font(.system(size: 17, weight: .heavy))
                  .foregroundColor(.white).lineLimit(2).minimumScaleFactor(0.7)
                if let lp = entry.lastPlayed {
                  Text(lp.artist).font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.66)).lineLimit(1)
                }
              }
              Spacer(minLength: 0)
            }
            Spacer(minLength: 4)
            // NO PROGRESS BAR. A bar claims a position in a song, and the
            // only thing known here is that this played at some point.
            HStack {
              Text("LAST PLAYED").font(.system(size: 7.5, weight: .heavy)).tracking(1.3)
                .foregroundColor(.white.opacity(0.48))
              Spacer(minLength: 4)
              DialText(dial: s.dial, size: 10, color: .white.opacity(0.58))
            }
          }
          .padding(10)
        }
        .padding(.vertical, 14)
        .padding(.leading, 14)

        // the control: a plain ring, deliberately unlabelled
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
                           center: .center, startRadius: 0, endRadius: 46))
          Circle().fill(
            LinearGradient(colors: [Color(white: 0.97), Color(white: 0.86), Color(white: 0.80)],
                           startPoint: .top, endPoint: .bottom))
            .frame(width: 40, height: 40)
          // the hub sits proud: a lit crown, a shadow under its far side
          Circle().strokeBorder(
            LinearGradient(colors: [.white.opacity(0.90), .black.opacity(0.12)],
                           startPoint: .top, endPoint: .bottom), lineWidth: 1.2)
            .frame(width: 40, height: 40)
          Circle().fill(
            RadialGradient(colors: [.clear, .black.opacity(0.16)],
                           center: .init(x: 0.5, y: 0.16), startRadius: 14, endRadius: 34))
            .frame(width: 52, height: 52)
        }
        // SMALLER THAN IT WAS (112 / 17), because it was winning an argument
        // it should not have been in: at 112 plus its padding the ring took
        // 146 of the widget's 338 points — 43% of the tile for something that
        // is deliberately ornament — and the SONG, which is what this widget
        // is about, was left with about 73 and printed "Breaka…". This gives
        // the title back 24 points and costs the ring nothing anyone reads.
        .frame(width: 96, height: 96)
        .padding(.horizontal, 13)
      }
    }
    .widgetURL(s.url(mode: s.mode))
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
    .description("The last song you heard. Long-press to change the look — CD player, pocket player or ticket stub.")
    .supportedFamilies([.systemMedium])
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
    .supportedFamilies([.systemMedium])
    .cruiseFullBleed()
  }
}
