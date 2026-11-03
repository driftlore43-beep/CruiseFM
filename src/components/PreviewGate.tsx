import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlossSheen } from '@/components/GlossSheen';
import { isProMode, isProStation, modeLabel } from '@/constants/modeCatalog';
import { STATIONS } from '@/constants/stations';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { isSpotifyConnected, pause as pauseSpotify } from '@/utils/spotify';

// How long a free user gets to taste a locked mode before the gate drops.
const PREVIEW_MS = 30000;

/**
 * Preview gate — after the taste, this slides over the still-moving visuals.
 *
 * Rendered INSIDE each mode's own Modal (like HandoffOverlay), not as a
 * sibling Modal: iOS refuses to present a second modal window on top of an
 * already-presented one, which made the old NowPlayingHost-mounted gate
 * silently never appear — the music paused at 30s but no card came.
 *
 * `onSilence` should be the mode's own spotify.pause so the pause is stamped
 * as a user-style control — otherwise the next poll can briefly adopt stale
 * "still playing" state and the scene keeps dancing over a silent room.
 */
export function PreviewGate({ onSilence }: { onSilence?: () => void }) {
  const np = useNowPlaying();
  const [gateOpen, setGateOpen] = useState(false);
  const previewActive = !!np.session?.preview;
  const mode = np.session?.mode;
  const stationId = np.session?.stationId;

  useEffect(() => {
    if (!previewActive) { setGateOpen(false); return; }
    const t = setTimeout(() => {
      np.expand();          // bring the visuals back if they minimized
      setGateOpen(true);
      // The taste is over: freeze the scene AND silence the music.
      np.setPlaying(false);
      if (onSilence) {
        onSilence();
      } else {
        isSpotifyConnected()
          .then((c) => { if (c) pauseSpotify().catch(() => {}); })
          .catch(() => {});
      }
    }, PREVIEW_MS);
    return () => clearTimeout(t);
    // Restart the clock whenever a new preview session begins.
  }, [previewActive, mode]);

  if (!gateOpen || !previewActive) return null;

  // NAME WHAT IS ACTUALLY LOCKED. This card used to say "<mode> is a Premium
  // mode" whatever the session was, which was safe only while a premium
  // STATION could not be reached — a locked FM row was not tappable. Now that
  // it is (03.11), a free mode on a premium station would have been announced
  // as "Cassette is a Premium mode", and Cassette is free. A paywall that
  // misnames what it is selling is worse than no paywall.
  const lockedMode = !!mode && isProMode(mode);
  const lockedStation = !!stationId && isProStation(stationId);
  const modeName = modeLabel(mode);
  const stationName = STATIONS.find((s) => s.id === stationId)?.name ?? 'This station';
  // When both are locked the MODE is named: it is what fills the screen, so
  // it is what they were actually looking at when they pressed.
  const focus = lockedMode ? modeName : lockedStation ? stationName : modeName;
  const pitch = lockedMode && lockedStation
    ? `${modeName} and ${stationName} are both Premium. Unlock them along with every other mode and mood.`
    : lockedStation
      ? `${stationName} is a Premium station. Unlock it along with every other mood and mode.`
      : `${modeName} is a Premium mode. Unlock it along with every other mode and mood.`;

  const dismiss = () => { setGateOpen(false); np.stop(); };
  const goPremium = () => {
    setGateOpen(false);
    // CARRY WHAT THEY WERE LOOKING AT (03.11). The session still has to end —
    // the taste is over, and a preview left alive could be pressed play on
    // from the mini-player, which is a hole straight through the paywall —
    // but `stop()` alone threw away the one thing that made somebody press
    // the button, and the Premium page opened on a generic feature list. The
    // mode and the thing that is locked travel with them, so the page leads
    // with it and the showcase opens on it rather than wherever its own
    // carousel happened to be. `focus` is read before `stop()` clears the
    // session; it is a plain const from this render, so it survives.
    const params: Record<string, string> = { focus };
    // Only a PREMIUM mode names a showcase scene — the free modes have none,
    // so a station-locked taste leaves the carousel on its own rotation.
    if (lockedMode && mode) params.scene = mode;
    np.stop();
    router.push({ pathname: '/premium', params });
  };

  return (
    <View style={[StyleSheet.absoluteFill, pg.scrim, { zIndex: 999, elevation: 999 }]}>
      <View style={pg.card}>
        <LinearGradient
          colors={['rgba(245,158,11,0.30)', 'rgba(122,70,10,0.22)', 'rgba(20,14,4,0.35)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <GlossSheen radius={24} />
        <Text style={pg.crest}>✦</Text>
        <Text style={pg.title}>Like what you're seeing?</Text>
        {/* THIS CARD DOES NOT NAME THE TERMS, on purpose.
            It used to promise "free for 7 days", typed in — and a trial
            length belongs to the product in App Store Connect, not to a
            card drawn mid-drive that cannot wait on the store to answer.
            The paywall reads the real trial and the real price and states
            them; this only has to get somebody there. */}
        <Text style={pg.sub}>{pitch}</Text>
        <TouchableOpacity onPress={goPremium} activeOpacity={0.9} style={pg.cta}>
          <LinearGradient
            colors={['#F7B733', '#F59E0B']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={pg.ctaText}>See Premium</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
          <Text style={pg.later}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pg = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(2,2,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
    backgroundColor: 'rgba(16,12,4,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  crest: { color: '#F5B014', fontSize: 26 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  cta: {
    alignSelf: 'stretch',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaText: { color: '#2a1a00', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  later: { color: 'rgba(255,255,255,0.45)', fontSize: 13.5, fontWeight: '600', paddingTop: 6 },
});
