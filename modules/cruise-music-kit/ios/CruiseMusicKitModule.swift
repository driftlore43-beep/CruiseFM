import ExpoModulesCore
import MediaPlayer
import MusicKit
import UIKit

/**
 * CruiseMusicKit — the native half of Apple Music support.
 *
 * The JS side (src/utils/appleMusic.ts) was written first and is already
 * shipping; this implements the contract it documents, name for name. Nothing
 * here is Cruise FM's own logic — station rules, playlist linking and the
 * strict-playlist gate all live in JS and are shared with Spotify. This file
 * only has to answer honestly about MusicKit.
 *
 * WHY MUSICKIT: Spotify caps a development-tier app at five listeners and
 * will not hand over a playlist's contents at all. Apple Music has no such
 * gate — any subscriber gets full in-app playback and a readable library.
 *
 * EVERY function degrades rather than throws. The JS front door already
 * treats a missing module as "unavailable", and a thrown promise inside a
 * drive would surface as a dead transport with no explanation.
 */
/**
 * WHICH PLAYER, and why it is the SYSTEM one (owner, 04.08: "when i swipe
 * Cruise FM to close, it closes the music also").
 *
 * `ApplicationMusicPlayer` owns its queue inside OUR process — force-quit the
 * app and the music dies with it, which is what she saw. Worse for a DRIVING
 * app: anything iOS does to us in the background takes the music with it, and
 * switching to Maps mid-drive is not an edge case, it is the normal case.
 *
 * `SystemMusicPlayer` hands the queue to the Music app, which then owns
 * playback: it survives force-quit, it survives backgrounding, and it needs
 * no background-audio capability — the one Apple rejected build 7 over. It
 * also matches the arrangement Cruise FM already has with Spotify, where
 * their app plays and we are the visual layer.
 *
 * THE TRADE, stated plainly: the listener's Music app now shows what Cruise
 * FM started, because it genuinely is playing it. That is the honest
 * representation, and it is what makes the lock screen and CarPlay controls
 * work during a drive.
 *
 * One alias so the choice lives in a single place. If it is ever reverted,
 * `nowPlayingItem` below must go back to `applicationQueuePlayer` — the two
 * must always name the same player or artwork reads from the wrong queue.
 */
private typealias CruisePlayer = SystemMusicPlayer

public class CruiseMusicKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CruiseMusicKit")

    // ── Authorization ───────────────────────────────────────────────────
    // Apple allows ONE prompt per install, so this is only ever called from a
    // deliberate tap on the connect card — never on launch (owner, 29.07).
    AsyncFunction("requestAuthorization") { () async -> String in
      guard #available(iOS 15.0, *) else { return "restricted" }
      return Self.statusString(await MusicAuthorization.request())
    }

    AsyncFunction("authorizationStatus") { () async -> String in
      guard #available(iOS 15.0, *) else { return "restricted" }
      return Self.statusString(MusicAuthorization.currentStatus)
    }

    /// Authorised is not the same as subscribed: someone can grant access and
    /// still have no Apple Music. The connect card says which, so the user
    /// isn't left guessing why nothing plays.
    AsyncFunction("canPlayCatalog") { () async -> Bool in
      guard #available(iOS 15.0, *) else { return false }
      for await subscription in MusicSubscription.subscriptionUpdates {
        return subscription.canPlayCatalogContent
      }
      return false
    }

    // ── What's playing ──────────────────────────────────────────────────
    AsyncFunction("currentEntry") { () async -> [String: Any?]? in
      guard #available(iOS 16.0, *) else { return nil }
      let player = CruisePlayer.shared
      guard let entry = player.queue.currentEntry else { return nil }

      var artist = ""
      var durationMs: Double? = nil
      if case let .song(song) = entry.item {
        artist = song.artistName
        if let d = song.duration { durationMs = d * 1000 }
      } else {
        artist = entry.subtitle ?? ""
      }

      return [
        "title": entry.title,
        "artist": artist,
        // A library track's artwork is LOCAL, so `url()` returns nil and the
        // deck came up blank (owner, 03.08). Fall back to writing the image
        // into the cache and handing back a file:// URL, which <Image> takes
        // exactly like a remote one.
        "artworkUrl": Self.artworkURL(for: entry),
        "durationMs": durationMs,
        "positionMs": player.playbackTime * 1000,
        "isPlaying": player.state.playbackStatus == .playing,
        // MusicKit exposes no name for the queue's source, so the pill falls
        // back to the station's own linked playlist name — which is what the
        // user chose anyway.
        "contextName": nil,
      ]
    }

    // ── Transport ───────────────────────────────────────────────────────
    AsyncFunction("play") { () async in
      guard #available(iOS 16.0, *) else { return }
      try? await CruisePlayer.shared.play()
    }

    AsyncFunction("pause") {
      guard #available(iOS 16.0, *) else { return }
      CruisePlayer.shared.pause()
    }

    AsyncFunction("next") { () async in
      guard #available(iOS 16.0, *) else { return }
      try? await CruisePlayer.shared.skipToNextEntry()
    }

    AsyncFunction("previous") { () async in
      guard #available(iOS 16.0, *) else { return }
      try? await CruisePlayer.shared.skipToPreviousEntry()
    }

    AsyncFunction("seekTo") { (positionMs: Double) in
      guard #available(iOS 16.0, *) else { return }
      CruisePlayer.shared.playbackTime = max(0, positionMs / 1000)
    }

    AsyncFunction("setShuffle") { (on: Bool) in
      guard #available(iOS 16.0, *) else { return }
      CruisePlayer.shared.state.shuffleMode = on ? .songs : .off
    }

    AsyncFunction("setRepeat") { (mode: String) in
      guard #available(iOS 16.0, *) else { return }
      switch mode {
      case "track":   CruisePlayer.shared.state.repeatMode = .one
      case "context": CruisePlayer.shared.state.repeatMode = .all
      default:        CruisePlayer.shared.state.repeatMode = MusicPlayer.RepeatMode.none
      }
    }

    // ── The listener's own library ──────────────────────────────────────
    /// Start a station's linked playlist. The id is the one handed back by
    /// `userPlaylists`, stored against the station as `applemusic:playlist:<id>`.
    AsyncFunction("playPlaylist") { (id: String) async throws in
      guard #available(iOS 16.0, *) else { return }
      var request = MusicLibraryRequest<Playlist>()
      request.filter(matching: \.id, equalTo: MusicItemID(id))
      let response = try await request.response()
      guard let playlist = response.items.first else { return }

      // `with(.tracks)` is required: a library playlist arrives without its
      // songs, and queueing it bare starts nothing at all.
      let full = try await playlist.with(.tracks)
      let player = CruisePlayer.shared
      player.queue = CruisePlayer.Queue(for: full.tracks ?? [])
      try await player.prepareToPlay()
      try await player.play()
    }

    /**
     * The songs inside one of the listener's playlists.
     *
     * This is the whole reason Apple Music is worth the work: Spotify's
     * development tier refuses a playlist's contents by every route we tried
     * (03.08), so the song picker could only ever show the queue. MusicKit
     * hands the tracks over directly.
     */
    AsyncFunction("playlistTracks") { (id: String) async -> [[String: Any?]] in
      guard #available(iOS 16.0, *) else { return [] }
      var request = MusicLibraryRequest<Playlist>()
      request.filter(matching: \.id, equalTo: MusicItemID(id))
      guard let playlist = try? await request.response().items.first,
            let full = try? await playlist.with(.tracks),
            let tracks = full.tracks else { return [] }
      return tracks.map { track in
        [
          "id": track.id.rawValue,
          "title": track.title,
          "artist": track.artistName,
          "durationMs": track.duration.map { $0 * 1000 },
        ]
      }
    }

    /// Jump straight to one song, keeping the rest of the playlist queued
    /// behind it — the same contract as Spotify's context+offset start, so
    /// skip still walks the playlist afterwards.
    AsyncFunction("playTrackInPlaylist") { (playlistId: String, trackId: String) async throws in
      guard #available(iOS 16.0, *) else { return }
      var request = MusicLibraryRequest<Playlist>()
      request.filter(matching: \.id, equalTo: MusicItemID(playlistId))
      guard let playlist = try await request.response().items.first,
            let tracks = try await playlist.with(.tracks).tracks else { return }
      let player = CruisePlayer.shared
      if let start = tracks.first(where: { $0.id.rawValue == trackId }) {
        player.queue = CruisePlayer.Queue(for: tracks, startingAt: start)
      } else {
        player.queue = CruisePlayer.Queue(for: tracks)
      }
      try await player.prepareToPlay()
      try await player.play()
    }

    /**
     * Artwork for the CURRENT song via MediaPlayer, for library tracks whose
     * MusicKit artwork has no URL (a known gap). MPMediaItemArtwork holds the
     * actual image; it is rendered once per item to a cache file and handed
     * back as file://. Separate from currentEntry ON PURPOSE — see the note
     * on artworkURL: this call is allowed to fail or dawdle, the poll is not.
     */
    AsyncFunction("libraryArtwork") { () async -> String? in
      guard #available(iOS 16.0, *) else { return nil }
      return await MainActor.run {
        guard let item = MPMusicPlayerController.systemMusicPlayer.nowPlayingItem,
              let art = item.artwork,
              let img = art.image(at: CGSize(width: 600, height: 600)) else { return nil }
        let dir = FileManager.default.temporaryDirectory
          .appendingPathComponent("cruise-art", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("\(item.persistentID).jpg")
        if !FileManager.default.fileExists(atPath: file.path) {
          guard let data = img.jpegData(compressionQuality: 0.9) else { return nil }
          try? data.write(to: file)
        }
        return file.absoluteString
      }
    }

    AsyncFunction("userPlaylists") { () async -> [[String: String]] in
      guard #available(iOS 16.0, *) else { return [] }
      var request = MusicLibraryRequest<Playlist>()
      request.limit = 100
      guard let response = try? await request.response() else { return [] }
      return response.items.map { ["id": $0.id.rawValue, "name": $0.name] }
    }
  }

  /// A usable URL for a queue entry's artwork — MusicKit sources only, and
  /// deliberately SYNCHRONOUS. Build 21 put the MediaPlayer fallback inline
  /// here and the whole of currentEntry stopped answering: no title, no
  /// artist, and the app read as "no track" for the entire drive. Whatever
  /// the fallback does, it may never sit between the poll and the song —
  /// it lives in `libraryArtwork` below, which JS calls separately and can
  /// afford to lose.
  @available(iOS 16.0, *)
  private static func artworkURL(for entry: CruisePlayer.Queue.Entry) -> String? {
    // Only http(s) URLs may leave this function. MusicKit hands back
    // `musicKit://` scheme URLs for library artwork, which only Apple's own
    // ArtworkImage view can render — React Native's <Image> silently draws
    // nothing, and because the string was non-empty the JS fallback chase
    // never ran (the found-but-blank bug, 04.08). JS filters the scheme too,
    // since this file only reaches phones at the next build.
    func loadable(_ u: URL) -> Bool { ["http", "https"].contains(u.scheme?.lowercased() ?? "") }
    if let url = entry.artwork?.url(width: 600, height: 600), loadable(url) { return url.absoluteString }
    if case let .song(song) = entry.item,
       let url = song.artwork?.url(width: 600, height: 600), loadable(url) { return url.absoluteString }
    return nil
  }

  @available(iOS 15.0, *)
  private static func statusString(_ status: MusicAuthorization.Status) -> String {
    switch status {
    case .authorized:    return "authorized"
    case .denied:        return "denied"
    case .restricted:    return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default:    return "restricted"
    }
  }
}
