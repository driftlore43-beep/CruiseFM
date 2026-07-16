import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SettingsInfoRow, SettingsPageShell, SettingsSection } from '@/components/SettingsPageShell';
import { GlossSheen } from '@/components/GlossSheen';
import { Cruise } from '@/constants/theme';
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type LegalDoc } from '@/constants/legal';
import { DEFAULT_DRIVER_NAME, getDriverName, setDriverName } from '@/utils/driverName';

export type SettingsPage =
  | 'account' | 'notifications' | 'privacy' | 'about' | 'refer'
  | 'privacyPolicy' | 'terms';

const TITLES: Record<SettingsPage, string> = {
  account: 'Account Settings',
  notifications: 'Notifications',
  privacy: 'Privacy',
  about: 'About Cruise FM',
  refer: 'Refer a Friend',
  privacyPolicy: 'Privacy Policy',
  terms: 'Terms of Service',
};

// ── Full-screen settings modal — presented over the current screen so there's
// no route change to swipe-back from (which on web reset the tab to home). ──
export function SettingsSheet({ page, onClose }: { page: SettingsPage | null; onClose: () => void }) {
  // Sub-page navigation (Privacy → Privacy Policy / Terms) stays inside the
  // sheet: back returns to the parent page, not to the profile.
  const [sub, setSub] = useState<SettingsPage | null>(null);
  useEffect(() => { if (page == null) setSub(null); }, [page]);

  const active = sub ?? page;
  const handleBack = () => { if (sub) setSub(null); else onClose(); };

  return (
    <Modal visible={page != null} transparent animationType="slide" onRequestClose={handleBack} statusBarTranslucent>
      {active && (
        <SettingsPageShell title={TITLES[active]} onBack={handleBack}>
          {active === 'account' && <AccountBody />}
          {active === 'notifications' && <NotificationsBody />}
          {active === 'privacy' && <PrivacyBody onOpen={setSub} />}
          {active === 'about' && <AboutBody />}
          {active === 'refer' && <ReferBody />}
          {active === 'privacyPolicy' && <LegalBody doc={PRIVACY_POLICY} />}
          {active === 'terms' && <LegalBody doc={TERMS_OF_SERVICE} />}
        </SettingsPageShell>
      )}
    </Modal>
  );
}

// ── Legal documents (shared renderer) ───────────────────────────────────────
function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <Text style={styles.legalUpdated}>Last updated {doc.updated}</Text>
      <Text style={styles.legalIntro}>{doc.intro}</Text>
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ marginBottom: 18 }}>
          <Text style={styles.legalHeading}>{s.heading}</Text>
          <Text style={styles.legalBody}>{s.body}</Text>
        </View>
      ))}
    </>
  );
}

// ── Account ──────────────────────────────────────────────────────────────────
function AccountBody() {
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDriverName().then((n) => { setName(n); setLoaded(true); });
  }, []);

  const commit = (value: string) => {
    setName(value);
    setDriverName(value); // empty falls back to the default next load
  };

  return (
    <>
      <SettingsSection label="PROFILE">
        <View style={[styles.nameRow, styles.nameRowBorder]}>
          <Text style={styles.nameRowLabel}>Display Name</Text>
          <TextInput
            value={loaded ? name : ''}
            onChangeText={commit}
            placeholder={DEFAULT_DRIVER_NAME}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.nameInput}
            maxLength={24}
            returnKeyType="done"
            selectionColor={Cruise.violetLight}
          />
          <MaterialCommunityIcons name="pencil-outline" size={15} color="rgba(255,255,255,0.4)" />
        </View>
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
        ios_backgroundColor="rgba(255,255,255,0.15)"
        {...({ activeThumbColor: '#fff' } as object)}
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
function PrivacyBody({ onOpen }: { onOpen: (p: SettingsPage) => void }) {
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
        <Pressable style={[styles.legalRow, styles.legalRowBorder]} onPress={() => onOpen('privacyPolicy')}>
          <Text style={styles.legalRowLabel}>Privacy Policy</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
        <Pressable style={styles.legalRow} onPress={() => onOpen('terms')}>
          <Text style={styles.legalRowLabel}>Terms of Service</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
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
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'web') {
      // Browsers: native share sheet where supported (phones), otherwise
      // copy the message so the button always does something.
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try { await nav.share({ text: SHARE_MESSAGE }); } catch { /* dismissed */ }
        return;
      }
      let ok = false;
      try { await nav?.clipboard?.writeText(SHARE_MESSAGE); ok = true; } catch { /* blocked */ }
      if (!ok && typeof document !== 'undefined') {
        // Legacy copy path for browsers that deny the clipboard API.
        try {
          const ta = document.createElement('textarea');
          ta.value = SHARE_MESSAGE;
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.remove();
        } catch { /* nothing more we can do */ }
      }
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
      return;
    }
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
      <GlossSheen radius={20} />
      <MaterialCommunityIcons name="star-four-points" size={30} color={Cruise.violetLight} style={{ marginBottom: 4 }} />

      <Text style={styles.referTitle}>Share the drive.</Text>
      <Text style={styles.referSub}>
        Know someone who'd love turning their playlists into a mood station? Send them Cruise FM.
      </Text>
      <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.88 }]} onPress={handleShare}>
        <LinearGradient
          colors={['rgba(155,95,255,0.30)', 'rgba(123,56,224,0.16)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons
          name={copied ? 'check' : 'share-variant'}
          size={16}
          color="#fff"
        />
        <Text style={styles.shareBtnText}>{copied ? 'Link copied' : 'Share Cruise FM'}</Text>
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
    // Premium glass: transparent violet with a bright rim, not a solid fill.
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 28, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(155,95,255,0.65)',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8,
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  nameRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  nameRowLabel: { color: '#fff', fontSize: 14.5, fontWeight: '600', flex: 1 },
  nameInput: {
    color: Cruise.violetLight, fontSize: 14, fontWeight: '600',
    textAlign: 'right', minWidth: 120, paddingVertical: 8,
  },
  legalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15,
  },
  legalRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  legalRowLabel: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  legalUpdated: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: '600',
    letterSpacing: 0.4, marginBottom: 14,
  },
  legalIntro: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21, marginBottom: 22 },
  legalHeading: { color: '#fff', fontSize: 14.5, fontWeight: '700', marginBottom: 5 },
  legalBody: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 },
});
