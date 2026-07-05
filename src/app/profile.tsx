import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';

const STATS = [
  { label: 'Total Drives', value: '142' },
  { label: 'Hours Driven', value: '387' },
  { label: 'Favorite Station', value: 'Night Run FM' },
];

const PREMIUM_ITEMS = [
  { icon: '🎵', label: 'All 7 Stations', sub: 'Unlock Rain Drive, Coastal, Mountain, Tunnel' },
  { icon: '🎬', label: 'Visual Modes', sub: 'Cassette, Vinyl & Retro Radio modes' },
  { icon: '🌙', label: 'Offline Listening', sub: 'Download and drive without signal' },
  { icon: '✨', label: 'Night Driver Badge', sub: 'Show off your midnight credentials' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>ND</Text>
          </View>
          <Text style={styles.name}>Night Driver</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>✦ FREE PLAN</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          {STATS.map((stat, i) => (
            <View key={stat.label} style={[styles.statRow, i < STATS.length - 1 && styles.statBorder]}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Premium upgrade */}
        <View style={styles.upgradeCard}>
          <Text style={styles.upgradeEyebrow}>CRUISE FM PREMIUM</Text>
          <Text style={styles.upgradeTitle}>Unlock the full night.</Text>
          <Text style={styles.upgradeSub}>
            Get access to all stations, visual modes, and offline listening.
          </Text>

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

          <Pressable style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>
        </View>

        {/* Settings rows */}
        <View style={styles.settingsCard}>
          {['Account Settings', 'Notifications', 'Privacy', 'About Cruise FM'].map(
            (item, i, arr) => (
              <Pressable
                key={item}
                style={[styles.settingsRow, i < arr.length - 1 && styles.settingsBorder]}>
                <Text style={styles.settingsLabel}>{item}</Text>
                <Text style={styles.settingsArrow}>›</Text>
              </Pressable>
            ),
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Cruise.midnight,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Cruise.violet,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Cruise.violet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  name: {
    color: Cruise.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: Cruise.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.3)',
  },
  premiumText: {
    color: Cruise.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  statsCard: {
    backgroundColor: Cruise.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.15)',
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  statBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: Cruise.textSecondary,
    fontSize: 14,
  },
  statValue: {
    color: Cruise.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeCard: {
    // @ts-ignore
    experimental_backgroundImage: 'linear-gradient(145deg, #2A0A6B 0%, #0E1540 100%)',
    borderRadius: 18,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.4)',
  },
  upgradeEyebrow: {
    color: Cruise.violet,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  upgradeTitle: {
    color: Cruise.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  upgradeSub: {
    color: Cruise.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  featureList: {
    gap: 12,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  featureIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureLabel: {
    color: Cruise.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  featureSub: {
    color: Cruise.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  upgradeBtn: {
    marginTop: 6,
    backgroundColor: Cruise.violet,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: Cruise.violet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: Cruise.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  settingsBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingsLabel: {
    color: Cruise.textPrimary,
    fontSize: 14,
  },
  settingsArrow: {
    color: Cruise.textMuted,
    fontSize: 20,
  },
});
