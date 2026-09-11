import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Cruise } from '@/constants/theme';
import { getDriveStats } from '@/utils/driveStats';
import { loadCustomStations } from '@/utils/customStations';
import { requestCreateStation } from '@/utils/createStationRequest';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

const DISMISS_KEY = 'cruise_make_station_dismissed';

/**
 * An invitation to make a station of your own — the one thing in the app that
 * turns it from somebody else's ten moods into yours.
 *
 * EARNED, NOT SHOWN ON DAY ONE, and that is the whole design. Asking a stranger
 * to build something before they know what a station IS gets ignored, and the
 * cost of a prompt people learn to dismiss is much higher than the prompt is
 * worth. It waits for `MIN_SESSIONS` real listening sessions — the app's own
 * definition, two banked minutes each, so mode-peeking doesn't count — by which
 * point they have used a station and the offer means something.
 *
 * It also stands down the moment it stops being true: make a station and it is
 * gone for good, because the shelf above it takes over the job. Dismissing it
 * is equally permanent. It is an invitation, and an invitation asks once.
 */
const MIN_SESSIONS = 2;

export function MakeStationCard() {
  const ms = useStyles(make_ms);
  const pal = usePalette();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [dismissed, mine, stats] = await Promise.all([
          AsyncStorage.getItem(DISMISS_KEY),
          loadCustomStations(),
          getDriveStats(),
        ]);
        if (!active) return;
        setShow(dismissed !== 'true' && mine.length === 0 && stats.totalSessions >= MIN_SESSIONS);
      })();
      return () => { active = false; };
    }, []),
  );

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(DISMISS_KEY, 'true').catch(() => {});
  };

  const make = () => {
    // The sheet lives on the Stations page — see createStationRequest.
    requestCreateStation();
    router.push('/stations');
  };

  return (
    <Pressable style={ms.card} onPress={make}>
      <View style={ms.iconRing}>
        <MaterialCommunityIcons name="radio-tower" size={20} color={Cruise.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ms.title}>Make a station of your own</Text>
        <Text style={ms.sub}>
          Your photo behind it, your colour, your playlist. It sits on the dial
          with the rest.
        </Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} style={ms.close}>
        <Ionicons name="close" size={16} color={pal.ink(0.55)} />
      </Pressable>
    </Pressable>
  );
}

const make_ms = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,154,46,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,154,46,0.34)',
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,154,46,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,154,46,0.36)',
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', letterSpacing: 0 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  close: { alignSelf: 'flex-start', padding: 2 },
});
