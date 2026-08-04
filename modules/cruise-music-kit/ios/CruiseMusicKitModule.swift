import ExpoModulesCore
import MusicKit

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
      let player = ApplicationMusicPlayer.shared
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
      try? await ApplicationMusicPlayer.shared.play()
    }

    AsyncFunction("pause") {
      guard #available(iOS 16.0, *) else { return }
      ApplicationMusicPlayer.shared.pause()
    }

    AsyncFunction("next") { () async in
      guard #available(iOS 16.0, *) else { return }
      try? await ApplicationMusicPlayer.shared.skipToNextEntry()
    }

    AsyncFunction("previous") { () async in
      guard #available(iOS 16.0, *) else { return }
      try? await ApplicationMusicPlayer.shared.skipToPreviousEntry()
    }

    AsyncFunction("seekTo") { (positionMs: Double) in
      guard #available(iOS 16.0, *) else { return }
      ApplicationMusicPlayer.shared.playbackTime = max(0, positionMs / 1000)
    }

    AsyncFunction("setShuffle") { (on: Bool) in
      guard #available(iOS 16.0, *) else { return }
      ApplicationMusicPlayer.shared.state.shuffleMode = on ? .songs : .off
    }

    AsyncFunction("setRepeat") { (mode: String) in
      guard #available(iOS 16.0, *) else { return }
      switch mode {
      case "track":   ApplicationMusicPlayer.shared.state.repeatMode = .one
      case "context": ApplicationMusicPlayer.shared.state.repeatMode = .all
      default:        ApplicationMusicPlayer.shared.state.repeatMode = MusicPlayer.RepeatMode.none
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
      let player = ApplicationMusicPlayer.shared
      player.queue = ApplicationMusicPlayer.Queue(for: full.tracks ?? [])
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
      let player = ApplicationMusicPlayer.shared
      if let start = tracks.first(where: { $0.id.rawValue == trackId }) {
        player.queue = ApplicationMusicPlayer.Queue(for: tracks, startingAt: start)
      } else {
        player.queue = ApplicationMusicPlayer.Queue(for: tracks)
      }
      try await player.prepareToPlay()
      try await player.play()
    }

    AsyncFunction("userPlaylists") { () async -> [[String: String]] in
      guard #available(iOS 16.0, *) else { return [] }
      var request = MusicLibraryRequest<Playlist>()
      request.limit = 100
      guard let response = try? await request.response() else { return [] }
      return response.items.map { ["id": $0.id.rawValue, "name": $0.name] }
    }
  }

  /// A usable URL for a queue entry's artwork.
  ///
  /// The entry's own artwork is nil more often than you'd expect, so the
  /// SONG's artwork is tried as well — for anything added from the Apple
  /// Music catalogue that resolves even when the entry's doesn't. A track
  /// imported from the user's own files has only local artwork, which
  /// MusicKit exposes no URL for at all; that returns nil and the deck falls
  /// back to the station's colours, which is the honest outcome.
  @available(iOS 16.0, *)
  private static func artworkURL(for entry: ApplicationMusicPlayer.Queue.Entry) -> String? {
    if let url = entry.artwork?.url(width: 600, height: 600) { return url.absoluteString }
    if case let .song(song) = entry.item,
       let url = song.artwork?.url(width: 600, height: 600) { return url.absoluteString }
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
