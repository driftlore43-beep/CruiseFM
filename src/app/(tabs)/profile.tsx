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
import { UpdateCheckRow } from '@/components/UpdateCheckRow';
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

const SETTINGS_ITEMS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; page: SettingsPage }[] = [
  { icon: 'account-outline',     label: 'Account Settings', page: 'account' },
  { icon: 'bell-outline',        label: 'Notifications',    page: 'notifications' },
  { icon: 'shield-lock-outline', label: 'Privacy',           page: 'privacy' },
  { icon: 'information-outline', label: 'About Cruise FM',   page: 'about' },
  { icon: 'gift-outline',        label: 'Refer a Friend',    page: 'refer' },
];

/**
 * ONE COLOURED CARD ON THE WHOLE PAGE (owner's pick, 29.07 — "P3").
 *
 * This page used to stack four full-size coloured panels — blue stats, teal
 * badges, amber upgrade, violet settings — and the badges panel was a card
 * containing twelve more cards, each with its own rim. Cards inside cards is
 * what made it read as busy rather than rich.
 *
 * The four hues were a deliberate one-colour-per-section idea, and it worked
 * when every other screen was coloured slabs too. Now that Stations, Modes and
 * Home are quiet, the only thing left that should ask for attention is the
 * upgrade card, so it is the only thing that gets to be a colour.
 */
// The premium gold, shared by the upgrade card's eyebrow and the plan chip.
const PREMIUM_GOLD = '#F7B733';
const UPGRADE_GRADIENT  = ['#3a1f0c', '#241206', '#140a04'] as const;
const GRADIENT_LOCATIONS = [0, 0.6, 1] as const;

// Diagonal glass-reflection streak laid over every card's top-left corner.
const SHEEN_GRADIENT = ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.03)', 'transparent'] as const;


// Neutral translucent-white chip + bold white icon — matches the Modes
// screen's mode-card icon treatment. The card itself carries the hue.
/**
 * A settings-row icon. Used to be a filled, rimmed circle ("chip") — the same
 * treatment the badge grid used, which meant a settings row and an achievement
 * looked equally important. It's a bare glyph in a fixed column now, exactly
 * like the Stations and Modes rows.
 */
function IconChip({ icon, size = 38 }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; size?: number }) {
  return (
    <View style={{ width: 24, alignItems: 'center' }}>
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.55)} color="rgba(255,255,255,0.6)" />
    </View>
  );
}

function useMusicPlatformInfo() {
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [id, setId] = useState<PlatformId | null>(null);

  const refresh = () => {
    getSavedPlatform().then((id) => {
      setId(id);
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
  return { name, color, id, refresh };
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { dataSaver, setDataSaver, autoDim, setAutoDim, atmosphere, setAtmosphere, softAtmosphere, setSoftAtmosphere, daylight, setDaylight } = useMotion();
  const { devFreePreview, setDevFreePreview, isPro } = useEntitlements();
  const { name: platformName, color: platformColor, id: platformId, refresh: refreshPlatform } = useMusicPlatformInfo();
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

  // One line, not three rows. Favourite station is dropped when there isn't
  // one yet rather than printing a dash — a new driver reads two facts, not
  // two facts and an apology.
  const drives = stats?.totalDrives ?? 0;
  const fave = stats?.favoriteStationId ? stationName(stats.favoriteStationId) : null;
  const STAT_LINE = [
    `${drives} ${drives === 1 ? 'drive' : 'drives'}`,
    `${formatHours(stats?.totalMinutes ?? 0)}h cruised`,
    fave,
  ].filter(Boolean).join(' · ');

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

        {/* Name as the page title, avatar shrunk to a chip beside it — the same
            left-aligned heading the other three pages use. It was centred at
            28pt under an 84pt avatar, which read as a settings screen from a
            different app. */}
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            <LinearGradient
              colors={[theme.accentColor, Cruise.violetDim]}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.85, y: 1 }}
              style={styles.avatar}>
              <View style={styles.avatarHighlight} pointerEvents="none" />
              <Text style={styles.avatarInitials}>{initialsFor(driverName)}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{driverName}</Text>
            {/* Premium wears the paywall's gold, not the app's violet — it
                is the same badge as the upgrade card's eyebrow and should
                read as the same thing. Free stays on the accent. */}
            <View style={[styles.planBadge, isPro && { borderColor: PREMIUM_GOLD + '66' }]}>
              <MaterialCommunityIcons name="star-four-points" size={10} color={isPro ? PREMIUM_GOLD : theme.accentColor} />
              <Text style={[styles.planText, { color: isPro ? PREMIUM_GOLD : theme.accentColor }]}>
                {isPro ? 'PREMIUM' : 'FREE PLAN'}
              </Text>
            </View>
          </View>
        </View>

        {/* Three numbers on one line. They were three rows of a blue glass card
            with an icon chip each; a statistic is the least interesting thing
            on a page about badges, so it gets a line, not a panel. */}
        <Text style={styles.statLine}>{STAT_LINE}</Text>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <Text style={styles.sectionMeta}>{earnedCount} of {judgeable} earned</Text>
        </View>
        {/* The collection, all of it visible at once. Locked tiles stay in place
            and stay legible — you can't want to finish a set you can't see. */}
        <View style={styles.badgeGrid}>
          {badges.map((b) => {
            const founder = !!b.reserved;
            return (
              <View key={b.id} style={styles.badgeCellWrap}>
                <View style={[
                  styles.badgeTile,
                  b.earned && styles.badgeTileEarned,
                  founder && styles.badgeTileFounder,
                ]}>
                  <MaterialCommunityIcons
                    name={b.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={30}
                    color={founder ? '#F7B733' : b.earned ? '#fff' : 'rgba(255,255,255,0.22)'}
                  />
                  <Text
                    style={[styles.badgeName, (b.earned || founder) && styles.badgeNameLit]}
                    numberOfLines={2}>
                    {b.name}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Never sell Premium to someone who already has it — which, while
            LAUNCH_FREE is on, is EVERYONE. Beyond being nonsense to the user,
            it is an App Review risk: this submission declares no in-app
            purchases, so a reviewer reaching a card that advertises
            "£1.99 / month" with nothing able to take the money is squarely
            Guideline 3.1.1. The card returns by itself when payments ship,
            because isPro will then mean what it says. */}
        {!isPro && (
        <View style={styles.upgradeCard}>
          <LinearGradient colors={UPGRADE_GRADIENT} locations={GRADIENT_LOCATIONS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.upgradeGlow} pointerEvents="none" />
          <Text style={styles.upgradeEyebrow}>CRUISE FM PREMIUM</Text>
          <Text style={styles.upgradeTitle}>Unlock the full driving atmosphere.</Text>
          {/* The four-item feature list lived here; /premium exists to make the
              pitch properly, and repeating it on the way there made this card
              taller than the badge collection it sat under. */}
          <Text style={styles.upgradeSub}>Premium modes, mood themes and unlimited stations.</Text>
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/premium')}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>
        </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>
        <View style={styles.settingsCard}>
          {/* Custom Theme was removed until it applies app-wide (only accent +
              glow worked). Station moods now colour the app automatically. */}

          {/* Data Saver toggle — forces still backgrounds for everyone */}
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="motion-play-outline" size={34} />
              <View style={styles.settingsTextBlock}>
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

          {/* Daylight — sits directly above Auto-dim, which it overrules. */}
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="white-balance-sunny" size={34} />
              <View style={styles.settingsTextBlock}>
                <Text style={styles.settingsLabel}>Daylight</Text>
                <Text style={styles.dataSaverSub}>
                  Stronger contrast for driving in sun · brighter labels, deeper scrims · turns auto-dim off
                </Text>
              </View>
            </View>
            <Switch
              value={daylight}
              onValueChange={setDaylight}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.18)"
              {...({ activeThumbColor: '#fff' } as object)}
            />
          </View>

          {/* Auto-dim toggle — head-unit style screen dimming mid-drive.
              Hidden while Daylight is on: it cannot fire then, and a toggle
              that does nothing is worse than no toggle. */}
          {!daylight && (
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="brightness-6" size={34} />
              <View style={styles.settingsTextBlock}>
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
          )}

          {/* Atmosphere toggle — the smoke-machine haze in every mode */}
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="weather-fog" size={34} />
              <View style={styles.settingsTextBlock}>
                <Text style={styles.settingsLabel}>Atmosphere</Text>
                <Text style={styles.dataSaverSub}>Smoke-machine haze pulsing with the music · off = clean scene</Text>
              </View>
            </View>
            <Switch
              value={atmosphere}
              onValueChange={setAtmosphere}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.18)"
              {...({ activeThumbColor: '#fff' } as object)}
            />
          </View>

          {/* Softer Atmosphere — sits directly under the Atmosphere toggle it
              modifies, and hides entirely when the haze is off. */}
          {atmosphere && (
          <View style={[styles.settingsRow, styles.settingsBorder]}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="blur" size={34} />
              <View style={styles.settingsTextBlock}>
                <Text style={styles.settingsLabel}>Softer Atmosphere</Text>
                <Text style={styles.dataSaverSub}>Half-strength haze · off = the full smoke machine</Text>
              </View>
            </View>
            <Switch
              value={softAtmosphere}
              onValueChange={setSoftAtmosphere}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: Cruise.violet }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,255,255,0.18)"
              {...({ activeThumbColor: '#fff' } as object)}
            />
          </View>
          )}

          {/* Music Platform row */}
          <Pressable
            style={[styles.settingsRow, styles.settingsBorder]}
            onPress={handlePlatformRowPress}>
            <View style={styles.platformRowLeft}>
              <IconChip icon="music-box-multiple-outline" size={34} />
              <View style={styles.settingsTextBlock}>
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

          {/* Spotify's connection belongs to the Spotify CHOICE, not to the
              app at large (owner, 04.08: "I've accidentally pressed Spotify
              connect multiple times where I either unlink Spotify by accident
              or link Spotify when I'm using Apple Music"). Showing it beside
              Music Platform regardless of the platform invited exactly that,
              and offering two live services at once is the same mistake the
              playback switchboard was making underneath. Pick a service and
              the app commits to it. */}
          {platformId === 'spotify' && <SpotifyConnectRow />}

          {/* Over-the-air updates arrive silently, which made them look like
              they never arrived at all. This gives them a button. */}
          <UpdateCheckRow />

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
        {/* The one place in the app that says who made it. Deliberately quiet
            and deliberately last: it is attribution, not a banner. */}
        <Text style={styles.byline}>A Strofi Technologies app</Text>

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
  // ── Identity ──────────────────────────────────────────────────────────────
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  name: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,56,224,0.45)',
  },
  planText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  statLine: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 14,
  },

  // ── Section headings, shared by Badges and Settings ────────────────────────
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 34,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },

  // ── The badge collection ──────────────────────────────────────────────────
  // Three across, square, all twelve on screen at once. Padding on the cell
  // rather than a gap on the grid: a wrapping flex row with gaps leaves a
  // ragged last line, and these must sit on a strict 3-column grid.
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginTop: 2,
  },
  badgeCellWrap: {
    width: '33.333%',
    padding: 5,
  },
  badgeTile: {
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    backgroundColor: '#0a0a10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  // Earned tiles lift off the page; locked ones stay flat and dark but never
  // vanish, so the set still reads as something to finish.
  badgeTileEarned: {
    backgroundColor: '#1b1b24',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeTileFounder: {
    backgroundColor: '#2e2007',
    borderColor: 'rgba(247,183,51,0.45)',
  },
  badgeName: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
  badgeNameLit: { color: '#fff' },

  // ── The one coloured card ─────────────────────────────────────────────────
  upgradeCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    marginTop: 34,
    borderWidth: 1,
    borderColor: 'rgba(247,183,51,0.28)',
  },
  upgradeBtn: {
    alignSelf: 'flex-start',
    marginTop: 18,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F7B733',
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  // No panel: the rows are the list. Negative margin puts the hairlines out to
  // the screen edges while the content keeps the page's 22pt inset.
  settingsCard: {
    marginHorizontal: -22,
  },

  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 48 },
  // A hairline ring, not the old violet drop-shadow halo: the avatar is 60pt
  // beside the name now rather than 80pt centred above it, and a glow at that
  // size just muddies the initials.
  avatarRing: {
    borderRadius: 32,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHighlight: {
    position: 'absolute', top: -20, left: -20, right: -20, height: 60,
    backgroundColor: 'rgba(255,255,255,0.20)', transform: [{ rotate: '-20deg' }],
  },
  avatarInitials: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },

  upgradeGlow: {
    position: 'absolute', top: -50, left: -40,
    width: 190, height: 150, borderRadius: 95,
    backgroundColor: '#F7B733', opacity: 0.13,
  },
  upgradeEyebrow: { color: PREMIUM_GOLD, fontSize: 9.5, fontWeight: '800', letterSpacing: 2.4 },
  upgradeTitle: { color: Cruise.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: 0, marginTop: 8, lineHeight: 26 },
  upgradeSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  upgradeBtnText: { color: '#1a0e02', fontSize: 15, fontWeight: '800' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 15, gap: 16 },
  settingsBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.09)' },
  settingsLabel: { color: '#fff', fontSize: 16.5, fontWeight: '500' },
  settingsArrow: { color: 'rgba(255,255,255,0.5)', fontSize: 20 },
  platformRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  platformRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  platformDotSmall: {
    width: 7, height: 7, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 4, elevation: 2,
  },
  platformRowName: { color: Cruise.textSecondary, fontSize: 12, fontWeight: '500' },
  // flex:1 is load-bearing — without it a long subtitle keeps its natural
  // width and runs underneath the switch instead of wrapping short of it.
  settingsTextBlock: { flex: 1 },
  dataSaverSub: { color: Cruise.textSecondary, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
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
  byline: {
    color: 'rgba(255,255,255,0.22)', fontSize: 11, fontWeight: '600',
    textAlign: 'center', letterSpacing: 1.6, marginTop: 6, textTransform: 'uppercase',
  },
});
