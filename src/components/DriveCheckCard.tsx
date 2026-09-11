import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { cachedSessionKind } from '@/utils/sessionKind';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { resumeDriveClock, suspendDriveClock } from '@/utils/driveStats';

// A long album side of untouched playback before we wonder who's driving.
const PROMPT_AFTER_MS = 45 * 60 * 1000;
// How long the card waits for an answer before the drive clock takes a break.
const ANSWER_WINDOW_MS = 2 * 60 * 1000;

/**
 * "Are you driving?" — the honest-stats check.
 *
 * If music plays this long with no touch at all, this card slides over
 * whichever mode (or mini-player) is up. Answering keeps the drive counting;
 * ignoring it quietly pauses the drive clock — the music and visuals carry
 * on, but the parked hours stop inflating Drives/Time Cruised/streaks.
 * Any later playback touch resumes the clock from that moment.
 *
 * The clock also rides the play state: paused music means a paused drive
 * clock, so a drive left paused overnight banks nothing either.
 */
export function DriveCheckCard() {
  // Nothing to check when they have already told us. This card exists ONLY
  // because the app cannot otherwise tell whether anyone is driving — asking
  // somebody who answered "just listening" would be asking a question we have
  // the answer to, and it is the most intrusive thing in the app.
  const kind = cachedSessionKind();
  const np = useNowPlaying();
  const [asking, setAsking] = useState(false);
  const [round, setRound] = useState(0);
  const suspendedRef = useRef(false);
  const askedAtRef = useRef(0);

  const active = !!np.session && np.playing;
  const stationId = np.session?.stationId;
  const mode = np.session?.mode;

  // The drive clock rides the play state: pause banks what's counted so
  // far and stops the clock; play starts it again.
  useEffect(() => {
    if (!np.session) return;
    if (np.playing) resumeDriveClock();
    else suspendDriveClock(Date.now()).catch(() => {});
  }, [np.playing, np.session]);

  // Any sign of life while the music runs brings a card-paused clock back.
  useEffect(() => {
    if (!suspendedRef.current || !np.playing) return;
    suspendedRef.current = false;
    resumeDriveClock();
  }, [np.activityTick, np.playing, np.expanded, stationId, mode]);

  // Quiet playback arms the prompt; any activity re-winds it.
  useEffect(() => {
    if (!active || asking) return;
    const t = setTimeout(() => {
      askedAtRef.current = Date.now();
      setAsking(true);
    }, PROMPT_AFTER_MS);
    return () => clearTimeout(t);
  }, [active, asking, round, np.activityTick, np.expanded, stationId, mode]);

  // Nobody answered — bank only up to when we asked, then stop counting.
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => {
      suspendedRef.current = true;
      suspendDriveClock(askedAtRef.current).catch(() => {});
      setAsking(false);
    }, ANSWER_WINDOW_MS);
    return () => clearTimeout(t);
  }, [asking]);

  // Session ended some other way — clean slate for the next drive.
  useEffect(() => {
    if (np.session) return;
    setAsking(false);
    suspendedRef.current = false;
  }, [np.session]);

  // An open sheet holds the card back rather than cancelling it: iOS refuses
  // to present a third modal window and eats every touch instead, so this
  // would freeze the app rather than ask a question. `asking` stays true, so
  // it appears the moment the sheet closes — and someone reading a song list
  // has plainly answered the question anyway.
  if (kind !== 'driving') return null;
  if (!asking || !np.session || np.sheetCount > 0) return null;

  const stillCruising = () => {
    if (suspendedRef.current) {
      suspendedRef.current = false;
      resumeDriveClock();
    }
    setAsking(false);
    setRound((r) => r + 1);
  };
  const parkedUp = () => {
    setAsking(false);
    np.stop();
  };

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible transparent animationType="fade" statusBarTranslucent onRequestClose={stillCruising}>
      <View style={dc.scrim}>
        <View style={dc.card}>
          <View style={dc.iconRing}>
            <MaterialCommunityIcons name="steering" size={28} color="#ffffff" />
          </View>
          <Text style={dc.title}>Are you driving?</Text>
          <Text style={dc.sub}>
            The music's been rolling for a while with no sign of you. Tap in and
            this drive keeps counting — otherwise your drive time takes a break
            while the music plays on.
          </Text>
          <TouchableOpacity onPress={stillCruising} activeOpacity={0.85} style={dc.cta}>
            <Text style={dc.ctaText}>Still cruising</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={parkedUp} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={dc.later}>I&apos;ve parked up — end drive</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Dark glass, white hairline, one solid-white primary pill — the language the
 * rest of the app settled on (the platform picker caught up to it on 03.08,
 * the Profile page and settings cards before that). This card had been left
 * on the pre-July violet: a purple-rimmed slab with a violet gradient button,
 * which is why the owner recognised it as old the moment it appeared (06.08).
 * Violet survives in the app only on Switch accents now.
 */
const dc = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,4,10,0.86)',
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
    paddingVertical: 30,
    gap: 12,
    backgroundColor: '#0a0a10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconRing: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 2,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  // The app's standard primary: solid white, dark type.
  cta: {
    alignSelf: 'stretch',
    borderRadius: 26,
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 10,
    backgroundColor: '#ffffff',
  },
  ctaText: { color: '#0a0a12', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  later: { color: 'rgba(255,255,255,0.5)', fontSize: 13.5, fontWeight: '600', paddingTop: 8 },
});
