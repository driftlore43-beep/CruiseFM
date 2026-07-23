import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';
import { STATIONS } from '@/constants/stations';
import { useTheme } from '@/context/ThemeContext';
import { useMotion } from '@/context/MotionContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { OWNER_MODE } from '@/constants/config';
import { PLATFORMS, PlatformId, getSavedPlatform } from '@/utils/musicPlatform';
import { PlatformSelector } from '@/components/PlatformSelector';
import { SpotifyConnectRow } from '@/components/SpotifyConnectRow';
import { SettingsSheet, type SettingsPage } from '@/components/SettingsSheet';
import { GlossSheen } from '@/components/GlossSheen';
import { getDriveLog, getDriveStats } from '@/utils/driveStats';
import { judgeBadges, type JudgedBadge } from '@/constants/badges';
import { isFounder } from '@/utils/founder';
import { appVersionLabel } from '@/utils/appVersion';
import { DEFAULT_DRIVER_NAME, getDriverName, initialsFor } from '@/utils/driverName';

function stationName(id: string | null): string {
  return STATIONS.find((s) => s.id === id)?.name ?? '—';
}

function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  if (hours === 0) return '0';
  return hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1);
}

const PREMIUM_ITEMS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string }[] = [
  { icon: 'album',            label: 'Premium Music Modes', sub: 'Vinyl, Tuner, Horizon & Orb' },
  { icon: 'palette',          label: 'Visual Mood Themes',  sub: 'All premium palettes & imagery' },
  { icon: 'playlist-music',   label: 'Unlimited Playlists', sub: 'Build as many stations as you like' },
  { icon: 'star-four-points', label: 'Future Additions',    sub: 'New modes & moods, always included' },
];

const SETTINGS_ITEMS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; page: SettingsPage }[] = [
  { icon: 'account-outline',     label: 'Account Settings', page: 'account' },
  { icon: 'bell-outline',        label: 'Notifications',    page: 'notifications' },
  { icon: 'shield-lock-outline', label: 'Privacy',           page: 'privacy' },
  { icon: 'information-outline', label: 'About Cruise FM',   page: 'about' },
  { icon: 'gift-outline',        label: 'Refer a Friend',    page: 'refer' },
];

// Card gradients — same treatment as the Modes screen: bold, fairly opaque
// per-card hues (not a washed-out transparent tint) so each card reads as
// its own mood, with "Cruise FM Premium" the one fixed-violet exception.
const STATS_GRADIENT    = ['#1a4f74', '#123049', '#0a1a2a'] as const;
// Badges live between the blue stats and the amber upgrade card — deep teal.
const BADGES_GRADIENT   = ['#14554a', '#0d3a34', '#071d1c'] as const;
// Premium card matches the amber /premium screen it links to; Settings gets the violet.
const UPGRADE_GRADIENT  = ['#a84f1c', '#7a3712', '#3a1808'] as const;
const SETTINGS_GRADIENT = ['#2c1848', '#1c1038', '#0d0718'] as const;
const GRADIENT_LOCATIONS = [0, 0.55, 1] as const;

// Diagonal glass-reflection streak laid over every card's top-left corner.
const SHEEN_GRADIENT = ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.03)', 'transparent'] as const;

function CardSheen() {
  return (
    <LinearGradient
      colors={SHEEN_GRADIENT}
      start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.9 }}
      style={styles.cardSheen}
      pointerEvents="none"
    />
  );
}

// Neutral translucent-white chip + bold white icon — matches the Modes
// screen's mode-card icon treatment. The card itself carries the hue.
function IconChip({ icon, size = 38 }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; size?: number }) {
  return (
    <View style={[styles.iconChip, { width: size, height: size, borderRadius: size / 2 }]}>
      <MaterialCommunityIcons name={icon} size={size * 0.5} color="#fff" />
    </View>
  );
}

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
  const { dataSaver, setDataSaver, autoDim, setAutoDim } = useMotion();
  const { devFreePreview, setDevFreePreview } = useEntitlements();
  const { name: platformName, color: platformColor, refresh: refreshPlatform } = useMusicPlatformInfo();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null);
  const [stats, setStats] = useState<{ totalDrives: number; totalMinutes: number; favoriteStationId: string | null } | null>(null);
  const [driverName, setDriverNameState] = useState(DEFAULT_DRIVER_NAME);
  const [badges, setBadges] = useState<JudgedBadge[]>([]);

  // Real numbers from the drive log, refreshed each time the tab is focused.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDriveStats().then((s) => { if (active) setStats(s); });
      getDriverName().then((n) => { if (active) setDriverNameState(n); });
      Promise.all([getDriveLog(), isFounder()]).then(([log, founder]) => {
        if (active) setBadges(judgeBadges(log, { founder }));
      });
      return () => { active = false; };
    }, []),
  );

  const earnedCount = badges.filter((b) => b.earned).length;
  // Reserved badges only join the denominator once actually granted, so the
  // count never reads "12 of 11".
  const judgeable = badges.filter((b) => !b.reserved || b.earned).length;

  const STATS: { label: string; value: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { label: 'Total Drives',     value: String(stats?.totalDrives ?? 0),        icon: 'steering' },
    { label: 'Hours Driven',     value: formatHours(stats?.totalMinutes ?? 0),  icon: 'clock-outline' },
    { label: 'Favorite Station', value: stationName(stats?.favoriteStationId ?? null), icon: 'radio-tower' },
  ];

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
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={[theme.accentColor, Cruise.violetDim]}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.85, y: 1 }}
              style={styles.avatar}>
              <View style={styles.avatarHighlight} pointerEvents="none" />
              <Text style={styles.avatarInitials}>{initialsFor(driverName)}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.name}>{driverName}</Text>
          <View style={styles.planBadge}>
            <LinearGradient
              colors={[theme.accentColor + '2e', theme.accentColor + '0a']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <MaterialCommunityIcons name="star-four-points" size={11} color={theme.accentColor} />
            <Text style={[styles.planText, { color: theme.accentColor }]}>FREE PLAN</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <LinearGradient colors={STATS_GRADIENT} locations={GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <CardSheen />
          <GlossSheen radius={20} />
          {STATS.map((stat, i) => (
            <View key={stat.label} style={[styles.statRow, i < STATS.length - 1 && styles.statBorder]}>
              <View style={styles.statRowLeft}>
                <IconChip icon={stat.icon} size={34} />
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.badgesCard}>
          <LinearGradient colors={BADGES_GRADIENT} locations={GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <CardSheen />
          <GlossSheen radius={20} />
          <View style={styles.badgesHeader}>
            <Text style={styles.badgesEyebrow}>BADGES</Text>
            <Text style={styles.badgesCount}>{earnedCount} of {judgeable} earned</Text>
          </View>
          <View style={styles.badgeGrid}>
            {badges.map((b) => {
              const founder = !!b.reserved;
              return (
                <View
                  key={b.id}
                  style={[
                    styles.badgeCell,
                    b.earned && styles.badgeCellEarned,
                    founder && styles.badgeCellFounder,
                  ]}>
                  <View style={[
                    styles.badgeIconRing,
                    b.earned && styles.badgeIconRingEarned,
                    founder && styles.badgeIconRingFounder,
                  ]}>
                    <MaterialCommunityIcons
                      name={b.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={22}
                      color={founder ? '#F7B733' : b.earned ? '#fff' : 'rgba(255,255,255,0.30)'}
                    />
                  </View>
                  <Text style={[styles.badgeName, (b.earned || founder) && styles.badgeNameLit]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                  {founder && (
                    <View style={styles.founderTag}>
                      <Text style={styles.founderTagText}>FIRST 500</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.upgradeCard}>
          <LinearGradient colors={UPGRADE_GRADIENT} locations={GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.upgradeGlow} pointerEvents="none" />
          <CardSheen />
          <GlossSheen radius={20} />
          <Text style={styles.upgradeEyebrow}>CRUISE FM PREMIUM</Text>
          <Text style={styles.upgradeTitle}>Unlock the full driving atmosphere.</Text>
          <Text style={styles.upgradeSub}>Premium modes, mood themes, and unlimited playlists.</Text>
          <View style={styles.featureList}>
            {PREMIUM_ITEMS.map((item) => (
              <View key={item.label} style={styles.featureRow}>
                <IconChip icon={item.icon} />
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
            <LinearGradient
              colors={['#F7B733', '#F59E0B']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>
        </View>

        <View style={styles.settingsCard}>
          <LinearGradient colors={SETTINGS_GRADIENT} locations={GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <CardSheen />
          <GlossSheen radius={20} />
          {/* Custom Theme was removed until it applies app-wide (only accent +
              glow worked). Station moods now colour the app automatically. */}

          {/* Data Saver toggle — forces still backgrounds for everyone */}
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="motion-play-outline" size={34} />
              <View>
                <Text style={styles.settingsLabel}>Data Saver</Text>
                <Text style={styles.dataSaverSub}>Still backgrounds · less battery & data</Text>
              </View>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={setDataSaver}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.18)"
              {...({ activeThumbColor: '#fff' } as object)}
            />
          </View>

          {/* Auto-dim toggle — head-unit style screen dimming mid-drive */}
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="brightness-6" size={34} />
              <View>
                <Text style={styles.settingsLabel}>Auto-dim while driving</Text>
                <Text style={styles.dataSaverSub}>Screen eases down after 30s untouched · tap to wake · big battery saver</Text>
              </View>
            </View>
            <Switch
              value={autoDim}
              onValueChange={setAutoDim}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.18)"
              {...({ activeThumbColor: '#fff' } as object)}
            />
          </View>


          {/* Music Platform row */}
          <Pressable
            style={[styles.settingsRow, styles.settingsBorder]}
            onPress={handlePlatformRowPress}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="music-box-multiple-outline" size={34} />
              <View>
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
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>

          {/* Spotify Connect row */}
          <SpotifyConnectRow />

          {/* Dev-only: see every lock, shimmer and preview as a free user would */}
          {OWNER_MODE && (
            <View style={[styles.settingsRow, styles.settingsBorder]}>
              <View style={styles.platformRowLeft}>
                <IconChip icon="eye-outline" size={34} />
                <View>
                  <Text style={styles.settingsLabel}>Free-user preview</Text>
                  <Text style={styles.dataSaverSub}>Dev only · view the app without Premium</Text>
                </View>
              </View>
              <Switch
                value={devFreePreview}
                onValueChange={setDevFreePreview}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(255,255,255,0.18)"
                {...({ activeThumbColor: '#fff' } as object)}
              />
            </View>
          )}

          {SETTINGS_ITEMS.map((item, i) => (
            <Pressable
              key={item.label}
              style={[styles.settingsRow, i < SETTINGS_ITEMS.length - 1 && styles.settingsBorder]}
              onPress={() => setSettingsPage(item.page)}>
              <View style={styles.platformRowLeft}>
                <IconChip icon={item.icon} size={34} />
                <Text style={styles.settingsLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          ))}
        </View>

        <Text style={styles.versionText}>{appVersionLabel()}</Text>

      </ScrollView>

      <PlatformSelector
        visible={selectorVisible}
        onDismiss={handlePlatformDismiss}
      />

      <SettingsSheet
        page={settingsPage}
        onClose={() => {
          setSettingsPage(null);
          // The name may have been edited in Account Settings.
          getDriverName().then(setDriverNameState);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 12 },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 8,
  },
  avatarHighlight: {
    position: 'absolute', top: -20, left: -20, right: -20, height: 60,
    backgroundColor: 'rgba(255,255,255,0.20)', transform: [{ rotate: '-20deg' }],
  },
  avatarInitials: { color: '#fff', fontSize: 26, fontWeight: '700' },
  name: { color: Cruise.textPrimary, fontSize: 22, fontWeight: '700' },
  planBadge: {
    borderRadius: 20, overflow: 'hidden',
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(155,95,255,0.4)',
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  planText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  statsCard: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(94,199,255,0.35)',
    shadowColor: '#5EC7FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 6,
  },
  cardSheen: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
  },
  iconChip: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  statRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  statLabel: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  statValue: { color: Cruise.textPrimary, fontSize: 14, fontWeight: '600' },
  badgesCard: {
    borderRadius: 20, overflow: 'hidden', padding: 16, gap: 12,
    borderWidth: 1, borderColor: 'rgba(75,220,190,0.35)',
    shadowColor: '#4BDCBE', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 6,
  },
  badgesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgesEyebrow: { color: '#4BDCBE', fontSize: 10, fontWeight: '700', letterSpacing: 2.5 },
  badgesCount: { color: Cruise.textSecondary, fontSize: 12, fontWeight: '600' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: {
    width: '31%', flexGrow: 1, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 8, gap: 5,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeCellEarned: {
    backgroundColor: 'rgba(155,95,255,0.16)',
    borderColor: 'rgba(155,95,255,0.55)',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 4,
  },
  badgeCellFounder: {
    backgroundColor: 'rgba(247,183,51,0.08)',
    borderColor: 'rgba(247,183,51,0.45)',
  },
  badgeIconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeIconRingEarned: {
    backgroundColor: 'rgba(155,95,255,0.30)',
    borderColor: 'rgba(200,160,255,0.7)',
  },
  badgeIconRingFounder: {
    backgroundColor: 'rgba(247,183,51,0.12)',
    borderColor: 'rgba(247,183,51,0.5)',
  },
  badgeName: { color: 'rgba(255,255,255,0.45)', fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  badgeNameLit: { color: '#fff' },
  badgeDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 9.5, lineHeight: 12.5, textAlign: 'center' },
  founderTag: {
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5,
    backgroundColor: 'rgba(247,183,51,0.14)',
    borderWidth: 1, borderColor: 'rgba(247,183,51,0.4)',
  },
  founderTagText: { color: '#F7B733', fontSize: 7.5, fontWeight: '800', letterSpacing: 0.8 },
  upgradeCard: {
    borderRadius: 20, padding: 22, gap: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,150,90,0.5)',
    shadowColor: '#FF8A3C', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 22, elevation: 10,
  },
  upgradeGlow: {
    position: 'absolute', top: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#F7B733', opacity: 0.20,
  },
  upgradeEyebrow: { color: '#F7B733', fontSize: 10, fontWeight: '700', letterSpacing: 2.5 },
  upgradeTitle: { color: Cruise.textPrimary, fontSize: 22, fontWeight: '700' },
  upgradeSub: { color: Cruise.textSecondary, fontSize: 13, lineHeight: 19 },
  featureList: { gap: 14, marginTop: 4 },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  featureText: { flex: 1, gap: 2 },
  featureLabel: { color: Cruise.textPrimary, fontSize: 14, fontWeight: '600' },
  featureSub: { color: Cruise.textSecondary, fontSize: 12, lineHeight: 16 },
  upgradeBtn: {
    marginTop: 6, borderRadius: 12, paddingVertical: 13, alignItems: 'center', overflow: 'hidden',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 14, elevation: 8,
  },
  upgradeBtnText: { color: '#2a1a00', fontSize: 15, fontWeight: '700' },
  settingsCard: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(155,95,255,0.35)',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 6,
  },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  settingsBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  settingsLabel: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  settingsArrow: { color: 'rgba(255,255,255,0.5)', fontSize: 20 },
  platformRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  platformRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  platformDotSmall: {
    width: 7, height: 7, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 4, elevation: 2,
  },
  platformRowName: { color: Cruise.textSecondary, fontSize: 12, fontWeight: '500' },
  dataSaverSub: { color: Cruise.textSecondary, fontSize: 11.5, marginTop: 2 },
  themeRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeColorDot: {
    width: 10, height: 10, borderRadius: 5, marginRight: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 5, elevation: 3,
  },
  proBadge: {
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1,
  },
  proBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  versionText: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '600',
    textAlign: 'center', letterSpacing: 0.3, marginTop: 4,
  },
});
