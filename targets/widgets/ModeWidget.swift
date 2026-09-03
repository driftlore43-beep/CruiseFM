import AppIntents
import SwiftUI
import WidgetKit

/**
 * THE MODE, AS AN OBJECT — a small tile carrying the thing itself.
 *
 * Two looks of one idea, so one gallery row rather than two: the mirror ball
 * and the CD are both "your station's mode, drawn as the object it is named
 * after". A third (the record) already lives on the Deck's own small tile and
 * is deliberately not repeated here.
 *
 * NEITHER OF THEM SAYS ANYTHING IT CANNOT KNOW. The ball carries the station's
 * name; the CD carries no words at all, only the cover of the last song, which
 * is a fact about the past (owner, 03.09: "the CD Mode should remove all texts
 * — place only the last played song on the CD"). Nothing here claims to be
 * playing.
 *
 * AND NEITHER SPINS. iOS redraws a widget a handful of times a day and only
 * countdown text may animate itself — true of every app. A still ball is what
 * one looks like in a photograph anyway.
 */
@available(iOSApplicationExtension 17.0, *)
enum ModeLook: String, AppEnum {
  case mirrorBall
  case cd

  static let defaultLook: ModeLook = .mirrorBall

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
  static var caseDisplayRepresentations: [ModeLook: DisplayRepresentation] = [
    .mirrorBall: DisplayRepresentation(title: "Mirror ball",
                                       subtitle: "The ball, lit the way the app draws it"),
    .cd: DisplayRepresentation(title: "CD",
                               subtitle: "The last song, printed on a disc in its case"),
  ]
}

@available(iOSApplicationExtension 17.0, *)
struct ModeLookIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "The Mode"
  static var description = IntentDescription("Choose which object to show.")

  @Parameter(title: "Look", default: .mirrorBall)
  var look: ModeLook

  init() {}
  init(look: ModeLook) { self.look = look }
}

enum ModeStyle { case mirrorBall, cd }

struct ModeEntry: TimelineEntry {
  let date: Date
  let station: WidgetStation?
  let lastPlayed: LastPlayedInfo?
  let ready: Bool
  let style: ModeStyle
}

private func modeEntry(_ style: ModeStyle) -> ModeEntry {
  guard let snap = SnapshotStore.load() else {
    return ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: style)
  }
  let station = snap.lastDrive ?? snap.onAir.first
  return ModeEntry(date: Date(), station: station, lastPlayed: snap.lastPlayed,
                   ready: true, style: style)
}

private func modeTimeline(_ style: ModeStyle) -> Timeline<ModeEntry> {
  Timeline(entries: [modeEntry(style)], policy: .after(Date().addingTimeInterval(3600)))
}

struct ModeProvider: TimelineProvider {
  func placeholder(in c: Context) -> ModeEntry {
    ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .mirrorBall)
  }
  func getSnapshot(in c: Context, completion: @escaping (ModeEntry) -> Void) {
    completion(modeEntry(.mirrorBall))
  }
  func getTimeline(in c: Context, completion: @escaping (Timeline<ModeEntry>) -> Void) {
    completion(modeTimeline(.mirrorBall))
  }
}

@available(iOSApplicationExtension 17.0, *)
struct ModeIntentProvider: AppIntentTimelineProvider {
  func placeholder(in c: Context) -> ModeEntry {
    ModeEntry(date: Date(), station: nil, lastPlayed: nil, ready: false, style: .mirrorBall)
  }
  func snapshot(for configuration: ModeLookIntent, in c: Context) async -> ModeEntry {
    modeEntry(style(configuration.look))
  }
  func timeline(for configuration: ModeLookIntent, in c: Context) async -> Timeline<ModeEntry> {
    modeTimeline(style(configuration.look))
  }
  private func style(_ look: ModeLook) -> ModeStyle {
    switch look {
    case .mirrorBall: return .mirrorBall
    case .cd:         return .cd
    }
  }
}

// ── the drawing ────────────────────────────────────────────────────────────

struct ModeView: View {
  var entry: ModeEntry

  var body: some View {
    if !entry.ready || entry.station == nil {
      NotReadyView()
    } else {
      let s = entry.station!
      switch entry.style {
      case .mirrorBall: ball(s)
      case .cd:         disc(s)
      }
    }
  }

  private func ball(_ s: WidgetStation) -> some View {
    ZStack {
      RadialGradient(colors: [Color(hex: "#191c26"), Color(hex: "#05060a")],
                     center: .init(x: 0.5, y: 0.34), startRadius: 0, endRadius: 150)
      BeamField()
      VStack(spacing: 0) {
        // The stem. A ball hangs from something; without it this is a sphere
        // floating in a box.
        Rectangle().fill(.white.opacity(0.30)).frame(width: 1.5, height: 13)
        MirrorBall(size: 108)
        Spacer(minLength: 5)
        Text(s.name).font(.system(size: 13, weight: .heavy))
          .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.75)
      }
      .padding(.top, 9).padding(.bottom, 11).padding(.horizontal, 8)
    }
    .widgetURL(s.url(mode: "disco"))
  }

  // NOT ONE WORD ON IT. The disc carries the cover of the last song and
  // nothing else; the case is what says which app it belongs to.
  private func disc(_ s: WidgetStation) -> some View {
    ZStack {
      LinearGradient(colors: [Color(hex: "#1c1f26"), Color(hex: "#080a0e")],
                     startPoint: .topLeading, endPoint: .bottomTrailing)
      JewelCase()
      CompactDisc(cover: Art.lastPlayed(), accent: s.accentColor, size: 104)
        .offset(x: 5)
    }
    .widgetURL(s.url(mode: "cd"))
  }
}

/// Beams thrown off the ball. Fixed, never turning — a lamp is bolted to the
/// room, and there is nothing here that could animate anyway.
private struct BeamField: View {
  var body: some View {
    ZStack {
      ForEach(Array([(-74.0, 0.15), (-48.0, 0.10), (-20.0, 0.13),
                     (14.0, 0.09), (42.0, 0.14), (68.0, 0.10)].enumerated()),
              id: \.offset) { _, b in
        LinearGradient(colors: [Color(hex: "#d6e6ff").opacity(b.1), .clear],
                       startPoint: .top, endPoint: .bottom)
          .frame(width: 1.2, height: 190)
          .rotationEffect(.degrees(b.0), anchor: .top)
          .offset(y: -46)
      }
    }
    .allowsHitTesting(false)
  }
}

/**
 * The ball, built the way the APP builds it (owner, 03.09: "mirror ball needs
 * to reflect the same as it is on the app").
 *
 * It is a real sphere projection, not a grid of squares squeezed at the edges:
 * each mirror is a quad between two latitudes and two longitudes, back-face
 * culled, so rows compress toward the poles and columns converge on their own.
 *
 * BRIGHTNESS COMES FROM WHERE A MIRROR POINTS, NOT WHERE IT SITS. The
 * reflection direction is r = 2(n·v)n − v, and a mirror is bright when that
 * points at one of three fixed lamps. Neighbours point about eleven degrees
 * apart and reflection doubles that, so they land on completely different
 * parts of the room and come out wildly different — the dark-beside-bright
 * checkerboard is what reads as chrome. A positional gradient, which is what
 * this drew before, reads as a painted sphere.
 *
 * BRICK BOND (alternate rows offset half a column) is how a real ball is
 * built, and it also stops the columns stacking into continuous vertical
 * seams that read as a drawn grid.
 *
 * Everything here is computed once in `tiles` and never animated.
 */
struct MirrorBall: View {
  let size: CGFloat
  var rows: Int = 15
  var cols: Int = 26

  var body: some View {
    ZStack {
      Circle().fill(
        RadialGradient(colors: [Color(hex: "#2a2c33"), Color(hex: "#08090c")],
                       center: .init(x: 0.38, y: 0.30), startRadius: 0, endRadius: size * 0.62))
      ForEach(tiles, id: \.id) { t in
        Path { p in
          p.move(to: t.pts[0])
          for q in t.pts.dropFirst() { p.addLine(to: q) }
          p.closeSubpath()
        }
        .fill(Color(white: t.v))
      }
      Circle().stroke(.white.opacity(0.10), lineWidth: 1)
    }
    .frame(width: size, height: size)
    .shadow(color: Color(hex: "#bed7ff").opacity(0.30), radius: 18)
  }

  private struct Tile { let id: Int; let pts: [CGPoint]; let v: Double }

  private var tiles: [Tile] {
    let r = size / 2, tilt = -0.16, shrink = 0.91
    let lamps: [(Double, Double, Double)] = [
      norm((-0.58, -0.55, 0.60)), norm((0.66, -0.10, 0.74)), norm((0.06, 0.62, 0.78)),
    ]
    var out: [Tile] = []
    var seed = 11
    func rnd() -> Double {                   // a fixed shuffle, so the ball is
      seed = (seed &* 1103515245 &+ 12345) & 0x7fffffff   // the same every draw
      return Double(seed % 1000) / 1000.0 - 0.5
    }
    for i in 0..<rows {
      let la0 = .pi * (Double(i) / Double(rows)) - .pi / 2
      let la1 = .pi * (Double(i + 1) / Double(rows)) - .pi / 2
      let bond = i % 2 == 0 ? 0.0 : 0.5
      for j in 0..<cols {
        let lo0 = 2 * .pi * ((Double(j) + bond) / Double(cols))
        let lo1 = 2 * .pi * ((Double(j) + 1 + bond) / Double(cols))
        var pts: [CGPoint] = []
        var ax = 0.0, ay = 0.0, az = 0.0
        var visible = true
        for (la, lo) in [(la0, lo0), (la0, lo1), (la1, lo1), (la1, lo0)] {
          let x = cos(la) * sin(lo), y = sin(la), z = cos(la) * cos(lo)
          let yt = y * cos(tilt) - z * sin(tilt)
          let zt = y * sin(tilt) + z * cos(tilt)
          if zt < 0.03 { visible = false; break }        // back-face cull
          pts.append(CGPoint(x: x, y: yt))
          ax += x; ay += yt; az += zt
        }
        guard visible, pts.count == 4 else { continue }
        // Shrink toward the tile's own centre — the GAP is the grid.
        let mx = pts.map(\.x).reduce(0, +) / 4, my = pts.map(\.y).reduce(0, +) / 4
        let quad = pts.map { CGPoint(x: r + (mx + ($0.x - mx) * shrink) * r,
                                     y: r - (my + ($0.y - my) * shrink) * r) }
        let n = norm((ax / 4, ay / 4, az / 4))
        let ndv = n.2                                    // n · (0,0,1)
        let refl = norm((2 * ndv * n.0, 2 * ndv * n.1, 2 * ndv * n.2 - 1))
        var b = 0.20
        for L in lamps {
          let d = max(0, refl.0 * L.0 + refl.1 * L.1 + refl.2 * L.2)
          b += 0.86 * pow(d, 9)
        }
        b += rnd() * 0.26          // each mirror catches its own bit of room
        b = min(1, max(0.05, b))
        out.append(Tile(id: i * cols + j, pts: quad, v: 0.10 + 0.90 * pow(b, 0.72)))
      }
    }
    return out
  }

  private func norm(_ v: (Double, Double, Double)) -> (Double, Double, Double) {
    let m = (v.0 * v.0 + v.1 * v.1 + v.2 * v.2).squareRoot()
    return m == 0 ? v : (v.0 / m, v.1 / m, v.2 / m)
  }
}

/**
 * The jewel case. Owner, 03.09: "don't forget the case it usually is in."
 *
 * WHAT MAKES IT READ AS A CASE is the hinge spine down one side and the four
 * corner posts that hold the tray — not the pane of plastic. The first
 * attempt had only the pane and a couple of floating blocks, and read as
 * glass laid over a disc.
 */
private struct JewelCase: View {
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 4)
        .fill(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.02), .white.opacity(0.10)],
                             startPoint: .topLeading, endPoint: .bottomTrailing))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(.white.opacity(0.30), lineWidth: 2))

      // hinge spine
      HStack(spacing: 0) {
        LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.04)],
                       startPoint: .leading, endPoint: .trailing)
          .frame(width: 17)
          .overlay(HStack { Spacer(); Rectangle().fill(.white.opacity(0.20)).frame(width: 1) })
          .overlay(
            VStack(spacing: 14) {
              ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2)
                  .fill(.white.opacity(0.16))
                  .overlay(RoundedRectangle(cornerRadius: 2).stroke(.white.opacity(0.24), lineWidth: 1))
                  .frame(width: 11, height: 19)
              }
            })
        Spacer(minLength: 0)
      }

      // corner posts
      VStack {
        HStack { post(.topLeading); Spacer(); post(.topTrailing) }
        Spacer()
        HStack { post(.bottomLeading); Spacer(); post(.bottomTrailing) }
      }
      .padding(7)

      // one diagonal sweep of light on the plastic
      RoundedRectangle(cornerRadius: 4)
        .fill(LinearGradient(stops: [
          .init(color: .white.opacity(0.20), location: 0.04),
          .init(color: .clear, location: 0.26),
          .init(color: .clear, location: 0.74),
          .init(color: .white.opacity(0.10), location: 0.96),
        ], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
    .padding(11)
    .allowsHitTesting(false)
  }

  private func post(_ corner: Alignment) -> some View {
    let top = corner == .topLeading || corner == .topTrailing
    let leading = corner == .topLeading || corner == .bottomLeading
    return ZStack {
      VStack { if !top { Spacer() }; Rectangle().frame(height: 2.5); if top { Spacer() } }
      HStack { if !leading { Spacer() }; Rectangle().frame(width: 2.5); if leading { Spacer() } }
    }
    .foregroundColor(.white.opacity(0.34))
    .frame(width: 15, height: 15)
  }
}

/// A disc with the last cover printed on it, under the diffraction the plastic
/// throws. The rainbow sits OVER the art rather than under it, because a CD's
/// sheen is on its surface — the app's own CD deck settled this on 03.08.
struct CompactDisc: View {
  let cover: Image?
  let accent: Color
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle().fill(Color(white: 0.08))
      if let cover {
        cover.resizable().aspectRatio(contentMode: .fill)
          .frame(width: size, height: size)
          .clipShape(Circle())
          .brightness(-0.06).saturation(1.1)
      } else {
        Circle().fill(accent.opacity(0.55))
      }
      Circle().fill(
        AngularGradient(colors: [Color(hex: "#6ad0ff"), Color(hex: "#b98cff"), Color(hex: "#ff9ad0"),
                                 Color(hex: "#ffd68a"), Color(hex: "#a8ffcf"), Color(hex: "#6ad0ff")],
                        center: .center, angle: .degrees(20)))
        .blendMode(.overlay)
      // the single specular sweep
      Circle().fill(
        LinearGradient(stops: [
          .init(color: .white.opacity(0.34), location: 0.05),
          .init(color: .clear, location: 0.28),
          .init(color: .clear, location: 0.68),
          .init(color: .white.opacity(0.20), location: 0.92),
        ], startPoint: .topLeading, endPoint: .bottomTrailing))
      // hub, stacking ring, spindle
      Circle().fill(Color(white: 0.88).opacity(0.60))
        .frame(width: size * 0.31, height: size * 0.31)
        .overlay(Circle().stroke(.white.opacity(0.45), lineWidth: 1)
                   .frame(width: size * 0.31, height: size * 0.31))
      Circle().fill(Color(hex: "#090a0e"))
        .frame(width: size * 0.14, height: size * 0.14)
        .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 1)
                   .frame(width: size * 0.14, height: size * 0.14))
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .shadow(color: .black.opacity(0.62), radius: 9, y: 5)
  }
}

// ── the two configurations ─────────────────────────────────────────────────

@available(iOSApplicationExtension 17.0, *)
struct ModeConfigurableWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "CruiseMode", intent: ModeLookIntent.self,
                           provider: ModeIntentProvider()) { entry in
      ModeView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("The Mode")
    .description("Your mode as an object. Long-press to switch between the mirror ball and the CD.")
    .supportedFamilies([.systemSmall])
  }
}

struct ModeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CruiseMode", provider: ModeProvider()) { entry in
      ModeView(entry: entry).cruiseContainerBackground()
    }
    .configurationDisplayName("The Mode")
    .description("The mirror ball, lit the way the app draws it.")
    .supportedFamilies([.systemSmall])
  }
}
