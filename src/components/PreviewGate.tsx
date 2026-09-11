import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlossSheen } from '@/components/GlossSheen';
import { MODE_CATALOG } from '@/constants/modeCatalog';
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

  const label = MODE_CATALOG.find((m) => m.id === mode)?.label ?? 'This mode';
  const dismiss = () => { setGateOpen(false); np.stop(); };
  const goPremium = () => { setGateOpen(false); np.stop(); router.push('/premium'); };

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
        <Text style={pg.sub}>
          {label} is a Premium mode. Try everything free for 7 days — cancel anytime.
        </Text>
        <TouchableOpacity onPress={goPremium} activeOpacity={0.9} style={pg.cta}>
          <LinearGradient
            colors={['#F7B733', '#F59E0B']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={pg.ctaText}>Start free trial</Text>
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
