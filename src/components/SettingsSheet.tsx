import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { SettingsInfoRow, SettingsPageShell, SettingsSection } from '@/components/SettingsPageShell';
import { Cruise } from '@/constants/theme';

export type SettingsPage = 'account' | 'notifications' | 'privacy' | 'about' | 'refer';

const TITLES: Record<SettingsPage, string> = {
  account: 'Account Settings',
  notifications: 'Notifications',
  privacy: 'Privacy',
  about: 'About Cruise FM',
  refer: 'Refer a Friend',
};

// ── Full-screen settings modal — presented over the current screen so there's
// no route change to swipe-back from (which on web reset the tab to home). ──
export function SettingsSheet({ page, onClose }: { page: SettingsPage | null; onClose: () => void }) {
  return (
    <Modal visible={page != null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {page && (
        <SettingsPageShell title={TITLES[page]} onBack={onClose}>
          {page === 'account' && <AccountBody />}
          {page === 'notifications' && <NotificationsBody />}
          {page === 'privacy' && <PrivacyBody />}
          {page === 'about' && <AboutBody />}
          {page === 'refer' && <ReferBody />}
        </SettingsPageShell>
      )}
    </Modal>
  );
}

// ── Account ──────────────────────────────────────────────────────────────────
function AccountBody() {
  return (
    <>
      <SettingsSection label="PROFILE">
        <SettingsInfoRow label="Display Name" value="Night Driver" />
        <SettingsInfoRow label="Email" value="Not connected" />
        <SettingsInfoRow label="Plan" value="Free" last />
      </SettingsSection>
      <SettingsSection label="ACCOUNT">
        <SettingsInfoRow label="Change Password" value="Coming soon" />
        <SettingsInfoRow label="Delete Account" value="Coming soon" last />
      </SettingsSection>
    </>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────
const PREFS_KEY = 'cruisefm_notification_prefs';
type Prefs = { newStations: boolean; weeklyRecap: boolean; premiumOffers: boolean };
const DEFAULT_PREFS: Prefs = { newStations: true, weeklyRecap: true, premiumOffers: false };

function ToggleRow({
  label, sub, value, onChange, last,
}: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && styles.toggleBorder]}>
      <View style={{ flex: 1, paddingRight: 12, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: Cruise.violet }}
        thumbColor="#fff"
      />
    </View>
  );
}

function NotificationsBody() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    });
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  return (
    <>
      <SettingsSection label="DRIVE ALERTS">
        <ToggleRow label="New Stations" sub="Get notified when a new mood station launches"
          value={prefs.newStations} onChange={(v) => update({ newStations: v })} />
        <ToggleRow label="Weekly Drive Recap" sub="A Sunday summary of your week's drives"
          value={prefs.weeklyRecap} onChange={(v) => update({ weeklyRecap: v })} last />
      </SettingsSection>
      <SettingsSection label="OFFERS">
        <ToggleRow label="Premium Offers" sub="Occasional deals on Cruise FM Premium"
          value={prefs.premiumOffers} onChange={(v) => update({ premiumOffers: v })} last />
      </SettingsSection>
    </>
  );
}

// ── Privacy ──────────────────────────────────────────────────────────────────
function PrivacyBody() {
  return (
    <>
      <SettingsSection label="WHAT WE STORE">
        <View style={styles.para}>
          <Text style={styles.paraText}>
            Cruise FM keeps everything on your device. Your Spotify connection, chosen theme,
            linked playlists, and drive history never leave your phone — there's no Cruise FM
            server collecting or selling your data.
          </Text>
        </View>
      </SettingsSection>
      <SettingsSection label="THIRD PARTIES">
        <SettingsInfoRow label="Spotify" value="Playback only" />
        <SettingsInfoRow label="Analytics" value="None" last />
      </SettingsSection>
      <SettingsSection label="LEGAL">
        <SettingsInfoRow label="Privacy Policy" value="Coming soon" />
        <SettingsInfoRow label="Terms of Service" value="Coming soon" last />
      </SettingsSection>
    </>
  );
}

// ── About ────────────────────────────────────────────────────────────────────
function AboutBody() {
  return (
    <>
      <View style={{ alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Image
          source={require('../../assets/images/logo-mark.png')}
          style={{ width: 84, height: 84 }}
          resizeMode="contain"
        />
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 2 }}>CRUISE FM</Text>
        <Text style={styles.aboutTagline}>
          Spotify organises by artist and genre. Cruise FM organises by how a drive feels.
        </Text>
      </View>
      <SettingsSection label="VERSION">
        <SettingsInfoRow label="App Version" value="1.0.0" last />
      </SettingsSection>
      <SettingsSection label="CREDITS">
        <View style={styles.para}>
          <Text style={styles.paraText}>
            Built for drivers who want their music to match the mood of the road — mood stations,
            cinematic visual modes, and a driving companion that stays out of your way.
          </Text>
        </View>
      </SettingsSection>
    </>
  );
}

// ── Refer a Friend ───────────────────────────────────────────────────────────
const SHARE_MESSAGE =
  "I've been using Cruise FM to turn my Spotify playlists into a proper driving experience — mood stations, cinematic visual modes, the works. Worth a try: https://cruisefm.app";

function ReferBody() {
  async function handleShare() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({ message: SHARE_MESSAGE });
    } catch {
      // user dismissed the share sheet
    }
  }

  return (
    <View style={styles.referCard}>
      <LinearGradient
        colors={['rgba(155,95,255,0.30)', 'rgba(74,31,138,0.20)', 'rgba(14,21,64,0.30)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons name="star-four-points" size={30} color={Cruise.violetLight} style={{ marginBottom: 4 }} />

      <Text style={styles.referTitle}>Share the drive.</Text>
      <Text style={styles.referSub}>
        Know someone who'd love turning their playlists into a mood station? Send them Cruise FM.
      </Text>
      <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.88 }]} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share Cruise FM</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  toggleLabel: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  toggleSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 16 },
  para: { paddingHorizontal: 16, paddingVertical: 15 },
  paraText: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 20 },
  aboutTagline: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  referCard: {
    borderRadius: 20, padding: 26, gap: 12, overflow: 'hidden', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(155,95,255,0.45)',
  },
  referTitle: { color: '#fff', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  referSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 6 },
  shareBtn: {
    backgroundColor: Cruise.violet, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 28,
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
