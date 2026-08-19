import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { APP_STORE_URL, checkForStoreUpdate, dismissStoreUpdate } from '@/utils/appStoreUpdate';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

/**
 * "Some apps require you to go to the App Store and update from there" —
 * owner, 19.08. See appStoreUpdate.ts for the whole reasoning; this is just
 * the card. Shown only when Apple's own listing is genuinely ahead of what's
 * installed, and only once per version — dismissing it means "not now", not
 * "never tell me again", so the next real release still gets to ask.
 */
export function AppStoreUpdateCard() {
  const su = useStyles(make_su);
  const pal = usePalette();
  const [storeVersion, setStoreVersion] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      checkForStoreUpdate().then((v) => { if (active) setStoreVersion(v); });
      return () => { active = false; };
    }, []),
  );

  if (!storeVersion) return null;

  const dismiss = () => {
    dismissStoreUpdate(storeVersion).catch(() => {});
    setStoreVersion(null);
  };

  return (
    <Pressable
      style={su.card}
      onPress={() => Linking.openURL(APP_STORE_URL).catch(() => {})}>
      <View style={su.iconRing}>
        <Ionicons name="arrow-up-circle" size={20} color={pal.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={su.title}>Update available</Text>
        <Text style={su.sub}>
          Cruise FM {storeVersion} is on the App Store — tap to update.
        </Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} style={su.close}>
        <Ionicons name="close" size={16} color={pal.ink(0.55)} />
      </Pressable>
    </Pressable>
  );
}

const make_su = (p: Palette) => StyleSheet.create({
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
    backgroundColor: p.mode === 'dark' ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: p.mode === 'dark' ? 'rgba(245,158,11,0.34)' : 'rgba(245,158,11,0.30)',
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.mode === 'dark' ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.14)',
    borderWidth: 1, borderColor: p.mode === 'dark' ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.32)',
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', letterSpacing: 0 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  close: { alignSelf: 'flex-start', padding: 2 },
});
