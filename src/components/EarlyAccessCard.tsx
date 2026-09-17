import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import type { Palette } from '@/utils/appearance';
import { EARLY_ACCESS_TOLD_KEY } from '@/utils/earlyAccess';

/**
 * "PREMIUM IS YOURS" — the one-time card for a phone that used Cruise FM
 * before the paywall existed (utils/earlyAccess). Owner, 17.09.
 *
 * THIS CARD IS THE PRIMARY WAY ANYONE FINDS OUT, and the notification is the
 * backup, not the other way round: a notification needs the permission most
 * people have never been asked for (it is asked after the third drive, and a
 * denial is near-permanent), so on plenty of phones it can never arrive. The
 * home page is looked at by everyone.
 *
 * Same weight and shape as the what's-new card beside it, but wearing the
 * paywall's gold rather than neutral glass — it is the ONE card on this page
 * that is about Premium, and gold is what Premium wears everywhere else
 * (the Profile chip, the badge). Sits above the what's-new card because
 * telling someone what they own outranks telling them what changed.
 *
 * SHOWN IS TOLD. Marked the moment it appears, never re-shown — the rule the
 * rate card and the what's-new card both follow. The ✕ is tidiness.
 */
export function EarlyAccessCard() {
  const s = useStyles(make);
  const pal = usePalette();
  const { earlyAccess } = useEntitlements();
  const [show, setShow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!earlyAccess) return;
      let active = true;
      (async () => {
        const told = await AsyncStorage.getItem(EARLY_ACCESS_TOLD_KEY).catch(() => null);
        if (!active || told === 'true') return;
        setShow(true);
        AsyncStorage.setItem(EARLY_ACCESS_TOLD_KEY, 'true').catch(() => {});
      })();
      return () => { active = false; };
    }, [earlyAccess]),
  );

  if (!show) return null;

  return (
    <View style={s.card}>
      <View style={s.iconRing}>
        <MaterialCommunityIcons name="star-four-points" size={18} color={pal.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>PREMIUM IS YOURS</Text>
        <Text style={s.title}>You were here before Premium existed.</Text>
        <Text style={s.sub}>
          So every mode and every mood stays unlocked on this phone. Nothing to buy, nothing that runs out.
        </Text>
      </View>
      <Pressable onPress={() => setShow(false)} hitSlop={12} style={s.close}>
        <Ionicons name="close" size={16} color={pal.ink(0.55)} />
      </Pressable>
    </View>
  );
}

const make = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    // A whisper of the gold in the surface, so the card reads as Premium's
    // before a word is read — and no more, because a solid amber card on
    // this page means "something you need to do" (the update card).
    backgroundColor: p.gold + (p.mode === 'dark' ? '14' : '1A'),
    borderWidth: 1,
    borderColor: p.gold + '66',
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.gold + '1F',
    borderWidth: 1, borderColor: p.gold + '55',
  },
  eyebrow: {
    color: p.gold, fontSize: 9.5, fontWeight: '700', letterSpacing: 2,
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', marginTop: 3 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  close: { alignSelf: 'flex-start', padding: 2 },
});
