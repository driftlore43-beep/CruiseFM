import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { getDriveStats } from '@/utils/driveStats';
import { REVIEW_URL, loadRateState, markAsked, shouldAskForRating } from '@/utils/rateApp';
import { words, useSessionKind } from '@/utils/sessionKind';
import type { Palette } from '@/utils/appearance';

/**
 * "Enjoying Cruise FM?" — asked once, after three real sessions, never during
 * a drive. All the reasoning lives in utils/rateApp; this is only the card.
 *
 * It marks itself asked the moment it APPEARS rather than when it is
 * answered: being shown is the ask, and someone who simply scrolls past has
 * still been asked. That is what makes this a single-ask card instead of one
 * that quietly reappears until it gets its way.
 *
 * iOS only — it is the only store Cruise FM is on, and a review link that
 * goes nowhere is worse than no card.
 */
export function RateCard() {
  const r = useStyles(make_r);
  const pal = usePalette();
  const np = useNowPlaying();
  const kind = useSessionKind();
  const [show, setShow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'ios') return;
      let active = true;
      (async () => {
        const [state, stats] = await Promise.all([
          loadRateState().catch(() => null),
          getDriveStats().catch(() => null),
        ]);
        if (!active || !state) return;
        const ok = shouldAskForRating({
          now: Date.now(),
          state,
          // BOTH KINDS. Someone who listens at a desk has used the app just as
          // much as someone who drives — the 13.08 rule.
          sessions: stats?.totalSessions ?? 0,
          inDrive: !!np.session,
        });
        if (!ok) return;
        setShow(true);
        // Shown is asked.
        void markAsked();
      })();
      return () => { active = false; };
      // np.session deliberately not a dependency: this should settle once on
      // arrival, not re-evaluate mid-visit and pop up as a drive is minimised.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!show) return null;

  const w = words(kind);

  return (
    <View style={r.card}>
      <View style={r.iconRing}>
        <Ionicons name="star" size={18} color={pal.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={r.title}>Enjoying Cruise FM?</Text>
        <Text style={r.sub}>
          A rating helps other {w.noun === 'drive' ? 'drivers' : 'listeners'} find it.
        </Text>
        <View style={r.row}>
          <Pressable
            style={r.primary}
            onPress={() => {
              Linking.openURL(REVIEW_URL).catch(() => {});
              setShow(false);
            }}>
            <Text style={r.primaryText}>Rate it</Text>
          </Pressable>
          <Pressable style={r.secondary} onPress={() => setShow(false)}>
            <Text style={r.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const make_r = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: p.mode === 'dark' ? 'rgba(255,255,255,0.05)' : p.ink(0.04),
    borderWidth: 1,
    borderColor: p.ink(0.12),
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.ink(0.06),
    borderWidth: 1, borderColor: p.ink(0.12),
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800' },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  // The app's primary button: a solid pill in the OPPOSITE of the page.
  primary: {
    paddingVertical: 9, paddingHorizontal: 18, borderRadius: 11,
    backgroundColor: p.mode === 'light' ? p.text : '#FFFFFF',
  },
  primaryText: {
    color: p.mode === 'light' ? p.panel : '#0a0a10',
    fontSize: 13.5, fontWeight: '700',
  },
  secondary: { paddingVertical: 9, paddingHorizontal: 12 },
  secondaryText: { color: p.ink(0.55), fontSize: 13.5, fontWeight: '600' },
});
