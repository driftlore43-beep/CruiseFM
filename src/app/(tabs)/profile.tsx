import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { ThemeGenerator } from '@/components/ThemeGenerator';
import { PLATFORMS, PlatformId, getSavedPlatform } from '@/utils/musicPlatform';
import { PlatformSelector } from '@/components/PlatformSelector';
import { SpotifyConnectRow } from '@/components/SpotifyConnectRow';

const STATS = [
  { label: 'Total Drives',    value: '142' },
  { label: 'Hours Driven',    value: '387' },
  { label: 'Favorite Station', value: 'Night Run FM' },
];

const PREMIUM_ITEMS = [
  { icon: '💿', label: 'Premium Music Modes', sub: 'Vinyl & Retro Radio' },
  { icon: '🎨', label: 'Visual Mood Themes',  sub: 'All premium palettes & imagery' },
  { icon: '🎵', label: 'Unlimited Playlists', sub: 'Build as many stations as you like' },
  { icon: '✦', label: 'Future Additions',     sub: 'New modes & moods, always included' },
];

function useMusicPlatformInfo() {
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const refresh = () => {
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') {
        const p = PLATFORMS[id as Exclude<PlatformId, 'none'>];
        setName(p?.name ?? null);
        setColor(p?.color ?? null);
      } else {
        setName(id === 'none' ? 'None / Other' : null);
        setColor(null);
      }
    });
  };

  useEffect(() => { refresh(); }, []);
  return { name, color, refresh };
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { name: platformName, color: platformColor, refresh: refreshPlatform } = useMusicPlatformInfo();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [themeGenVisible, setThemeGenVisible] = useState(false);

  const handlePlatformRowPress = () => setSelectorVisible(true);
  const handlePlatformDismiss = () => {
    setSelectorVisible(false);
    refreshPlatform();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>ND</Text>
          </View>
          <Text style={styles.name}>Night Driver</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>✦ FREE PLAN</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          {STATS.map((stat, i) => (
            <View key={stat.label} style={[styles.statRow, i < STATS.length - 1 && styles.statBorder]}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.upgradeCard}>
          {/* @ts-ignore */}
          <View style={[StyleSheet.absoluteFill, styles.upgradeBg,
          // @ts-ignore
          { experimental_backgroundImage: 'linear-gradient(145deg, #2A0A6B 0%, #0E1540 100%)' }]} />
          <Text style={styles.upgradeEyebrow}>CRUISE FM PREMIUM</Text>
          <Text style={styles.upgradeTitle}>Unlock the full driving atmosphere.</Text>
          <Text style={styles.upgradeSub}>Premium modes, mood themes, and unlimited playlists.</Text>
          <View style={styles.featureList}>
            {PREMIUM_ITEMS.map((item) => (
              <View key={item.label} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{item.icon}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureLabel}>{item.label}</Text>
                  <Text style={styles.featureSub}>{item.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/premium')}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>
        </View>

        <View style={styles.settingsCard}>
          {/* My Theme row */}
          <Pressable
            style={[styles.settingsRow, styles.settingsBorder]}
            onPress={() => setThemeGenVisible(true)}>
            <View style={styles.themeRowLeft}>
              <Text style={styles.settingsLabel}>🎨  Custom Theme</Text>
              <View style={[styles.proBadge, { backgroundColor: theme.accentColor + '22', borderColor: theme.accentColor + '55' }]}>
                <Text style={[styles.proBadgeText, { color: theme.accentColor }]}>PRO</Text>
              </View>
            </View>
            <View style={[styles.themeColorDot, { backgroundColor: theme.accentColor, shadowColor: theme.accentColor }]} />
            <Text style={styles.settingsArrow}>›</Text>
          </Pressable>

          {/* Music Platform row */}
          <Pressable
            style={[styles.settingsRow, styles.settingsBorder]}
            onPress={handlePlatformRowPress}>
            <View style={styles.platformRowLeft}>
              <Text style={styles.settingsLabel}>Music Platform</Text>
              {platformName && (
                <View style={styles.platformRowMeta}>
                  {platformColor && (
                    <View style={[styles.platformDotSmall, { backgroundColor: platformColor,
                      shadowColor: platformColor }]} />
                  )}
                  <Text style={[styles.platformRowName, platformColor ? { color: platformColor } : null]}>
                    {platformName}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.settingsArrow}>›</Text>
          </Pressable>

          {/* Spotify Connect row */}
          <SpotifyConnectRow />

          {['Account Settings', 'Notifications', 'Privacy', 'About Cruise FM'].map((item, i, arr) => (
            <Pressable key={item} style={[styles.settingsRow, i < arr.length - 1 && styles.settingsBorder]}>
              <Text style={styles.settingsLabel}>{item}</Text>
              <Text style={styles.settingsArrow}>›</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      <PlatformSelector
        visible={selectorVisible}
        onDismiss={handlePlatformDismiss}
      />

      <ThemeGenerator
        visible={themeGenVisible}
        onClose={() => setThemeGenVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 10 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Cruise.violet, alignItems: 'center', justifyContent: 'center',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  avatarInitials: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { color: Cruise.textPrimary, fontSize: 22, fontWeight: '700' },
  planBadge: {
    backgroundColor: Cruise.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(123, 56, 224, 0.3)',
  },
  planText: { color: Cruise.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  statsCard: {
    backgroundColor: Cruise.surface, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(123, 56, 224, 0.15)',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  statBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  statLabel: { color: Cruise.textSecondary, fontSize: 14 },
  statValue: { color: Cruise.textPrimary, fontSize: 14, fontWeight: '600' },
  upgradeCard: {
    borderRadius: 18, padding: 22, gap: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(123, 56, 224, 0.4)',
  },
  upgradeBg: { borderRadius: 18 },
  upgradeEyebrow: { color: Cruise.violet, fontSize: 10, fontWeight: '700', letterSpacing: 2.5 },
  upgradeTitle: { color: Cruise.textPrimary, fontSize: 22, fontWeight: '700' },
  upgradeSub: { color: Cruise.textSecondary, fontSize: 13, lineHeight: 19 },
  featureList: { gap: 12, marginTop: 4 },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: { fontSize: 18, marginTop: 1 },
  featureText: { flex: 1, gap: 2 },
  featureLabel: { color: Cruise.textPrimary, fontSize: 14, fontWeight: '600' },
  featureSub: { color: Cruise.textSecondary, fontSize: 12, lineHeight: 16 },
  upgradeBtn: {
    marginTop: 6, backgroundColor: Cruise.violet, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 14, elevation: 8,
  },
  upgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  settingsCard: {
    backgroundColor: Cruise.surface, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15 },
  settingsBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  settingsLabel: { color: Cruise.textPrimary, fontSize: 14 },
  settingsArrow: { color: Cruise.textMuted, fontSize: 20 },
  platformRowLeft: { flex: 1, gap: 3 },
  platformRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platformDotSmall: {
    width: 7, height: 7, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 4, elevation: 2,
  },
  platformRowName: { color: Cruise.textSecondary, fontSize: 12, fontWeight: '500' },
  themeRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeColorDot: {
    width: 10, height: 10, borderRadius: 5, marginRight: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 5, elevation: 3,
  },
  proBadge: {
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
});
