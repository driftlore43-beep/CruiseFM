import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlossSheen } from '@/components/GlossSheen';
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
          <LinearGradient
            colors={['rgba(123,56,224,0.30)', 'rgba(58,26,110,0.22)', 'rgba(10,6,24,0.35)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GlossSheen radius={24} />
          <View style={dc.iconRing}>
            <MaterialCommunityIcons name="steering" size={30} color="#C9A6FF" />
          </View>
          <Text style={dc.title}>Are you driving?</Text>
          <Text style={dc.sub}>
            The music's been rolling for a while with no sign of you. Tap in and
            this drive keeps counting — otherwise your drive time takes a break
            while the music plays on.
          </Text>
          <TouchableOpacity onPress={stillCruising} activeOpacity={0.9} style={dc.cta}>
            <LinearGradient
              colors={['#9B5FFF', '#7B38E0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={dc.ctaText}>Still cruising</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={parkedUp} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={dc.later}>I've parked up — end drive</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dc = StyleSheet.create({
  scrim: {
    flex: 1,
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
    backgroundColor: 'rgba(12,8,24,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(123,56,224,0.45)',
  },
  iconRing: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(123,56,224,0.18)',
    borderWidth: 1, borderColor: 'rgba(155,95,255,0.4)',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: 'rgba(255,255,255,0.72)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  cta: {
    alignSelf: 'stretch',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  later: { color: 'rgba(255,255,255,0.45)', fontSize: 13.5, fontWeight: '600', paddingTop: 6 },
});
