import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SettingsInfoRow, SettingsPageShell, SettingsSection } from '@/components/SettingsPageShell';
import { OWNER_MODE } from '@/constants/config';
import { Cruise } from '@/constants/theme';
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type LegalDoc } from '@/constants/legal';
import { sendTestCrash } from '@/utils/crashReports';
import { DEFAULT_DRIVER_NAME, getDriverName, setDriverName } from '@/utils/driverName';
import { disconnectSpotify } from '@/utils/spotify';
import {
  DEFAULT_NOTIF_PREFS, getNotifPrefs, getPermissionState, requestPermission, setNotifPrefs,
  type NotifPermission, type NotifPrefs,
} from '@/utils/notifications';

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
            selectionColor="#ffffff"
          />
          <MaterialCommunityIcons name="pencil-outline" size={15} color="rgba(255,255,255,0.4)" />
        </View>
        <SettingsInfoRow label="Email" value="Not connected" />
        <SettingsInfoRow label="Plan" value="Free" last />
      </SettingsSection>
      <SettingsSection label="YOUR DATA">
        <View style={[styles.para, styles.paraBorder]}>
          <Text style={styles.paraText}>
            Cruise FM has no account or password — everything lives on this phone. Deleting your
            data disconnects Spotify and wipes your drive history, playlists, badges and settings
            from this device.
          </Text>
        </View>
        <DeleteDataRow />
      </SettingsSection>
    </>
  );
}

// Two-tap delete: first tap arms it (and quietly disarms after a few seconds),
// second tap actually wipes. No accounts exist, so "delete account" honestly
// means: disconnect Spotify + erase every locally stored trace of you.
function DeleteDataRow() {
  const [state, setState] = useState<'idle' | 'confirm' | 'done'>('idle');

  const handle = async () => {
    if (state === 'done') return;
    if (state === 'idle') {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setState('confirm');
      setTimeout(() => setState((s) => (s === 'confirm' ? 'idle' : s)), 4000);
      return;
    }
    try { await disconnectSpotify(); } catch {}
    try { await AsyncStorage.clear(); } catch {}
    setState('done');
  };

  const label = { idle: 'Delete My Data', confirm: 'Tap again to confirm', done: 'Data deleted' }[state];
  const value = { idle: undefined, confirm: 'This wipes everything', done: 'Restart the app ✓' }[state];

  return (
    <Pressable onPress={handle} style={({ pressed }) => pressed && state !== 'done' ? { opacity: 0.7 } : undefined}>
      <View style={styles.dangerRow}>
        <Text style={[styles.dangerLabel, state === 'done' && { color: 'rgba(255,255,255,0.5)' }]}>{label}</Text>
        {value != null && <Text style={styles.dangerValue}>{value}</Text>}
      </View>
    </Pressable>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────

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
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  /**
   * WITHOUT PERMISSION, EVERY TOGGLE BELOW IS DECORATIVE — it saves a
   * preference that can never produce a notification. The owner found this on
   * 11.08 ("it should be found in the settings page where the permissions can
   * come up"), and it is the same fault as a clock that runs over silence: a
   * control claiming to do something it cannot.
   *
   * So this page now states the real position and offers the way forward. iOS
   * allows exactly ONE system prompt, so once it is spent the only route is
   * the phone's own Settings, and we say so rather than pretending a button
   * will work.
   */
  const [perm, setPerm] = useState<NotifPermission>('unsupported');
  const refreshPerm = () => { getPermissionState().then(setPerm).catch(() => {}); };
  useEffect(() => { refreshPerm(); }, []);

  useEffect(() => { getNotifPrefs().then(setPrefs).catch(() => {}); }, []);

  const update = (patch: Partial<NotifPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    // Saving re-plans the schedule, so a toggle takes effect immediately.
    void setNotifPrefs(patch);
  };

  const off = perm !== 'granted' && perm !== 'unsupported';

  return (
    <>
      {off && (
        <SettingsSection label="PERMISSION">
          <View style={styles.permBox}>
            <Text style={styles.permTitle}>
              {perm === 'askable' ? 'Notifications are off' : 'Turned off in iOS Settings'}
            </Text>
            <Text style={styles.permBody}>
              {perm === 'askable'
                ? 'Nothing below can reach you until you turn them on. At most two a week, and they back off if you ignore them.'
                : 'Cruise FM can only ask once, and that ask has been used. You can switch them back on in the phone\u2019s Settings.'}
            </Text>
            <Pressable
              style={styles.permBtn}
              onPress={async () => {
                if (perm === 'askable') { await requestPermission(); refreshPerm(); }
                else Linking.openSettings().catch(() => {});
              }}>
              <Text style={styles.permBtnText}>
                {perm === 'askable' ? 'Turn on notifications' : 'Open iOS Settings'}
              </Text>
            </Pressable>
          </View>
        </SettingsSection>
      )}
      <SettingsSection label="DRIVE NUDGES">
        <ToggleRow label="When a station comes on air" sub="A couple a week, around the times you drive"
          value={prefs.onAir} onChange={(v) => update({ onAir: v })} />
        <ToggleRow label="Late night" sub="After Hours and Night Run, for 1am drives"
          value={prefs.lateNight} onChange={(v) => update({ lateNight: v })} last />
      </SettingsSection>
      <SettingsSection label="YOUR DRIVING">
        <ToggleRow label="Badges" sub="When you earn one"
          value={prefs.badges} onChange={(v) => update({ badges: v })} />
        <ToggleRow label="Sunday recap" sub="Your week on the road — nothing sent on an empty week"
          value={prefs.recap} onChange={(v) => update({ recap: v })} last />
      </SettingsSection>
      <SettingsSection label="WHAT'S NEW">
        <ToggleRow label="New Stations & Modes" sub="When a new mood station or visual mode launches — at most one per update"
          value={prefs.newStations} onChange={(v) => update({ newStations: v })} last />
      </SettingsSection>
      <View style={styles.para}>
        <Text style={styles.paraText}>
          Cruise FM sends at most two notifications a week, never two in a day, and
          fewer if you don&apos;t use them — if they go unopened it backs off, and
          eventually stops until you come back. Everything is scheduled on your
          phone; nothing is sent to a server, and nothing is ever sent to sell you
          something.
        </Text>
      </View>
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
            linked playlists, and drive history never leave your phone — there&apos;s no Cruise FM
            server collecting or selling your data. Notifications are scheduled on this phone
            too: nothing is sent to us, and there is nothing to send.
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
      {OWNER_MODE && <DiagnosticsSection />}
    </>
  );
}

// Owner-only: prove the Sentry pipeline end to end. Never shown to real users.
function DiagnosticsSection() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const handleTestCrash = async () => {
    if (status === 'sending') return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus('sending');
    const ok = await sendTestCrash();
    setStatus(ok ? 'sent' : 'failed');
  };

  const value = {
    idle:    'Tap to send',
    sending: 'Sending…',
    sent:    'Sent ✓ — check sentry.io',
    failed:  'Not available in this build',
  }[status];

  return (
    <SettingsSection label="DIAGNOSTICS (OWNER ONLY)">
      <Pressable onPress={handleTestCrash} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <SettingsInfoRow label="Test Crash Report" value={value} last />
      </Pressable>
    </SettingsSection>
  );
}

// ── Refer a Friend ───────────────────────────────────────────────────────────
const SHARE_MESSAGE =
  "I've been using Cruise FM to turn my Spotify playlists into a proper driving experience — mood stations, cinematic visual modes, the works. Worth a try: https://cruisefm.netlify.app";

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

  // Black glass with a white primary button — the same language as the rest
  // of the app (white play disc, white Tune-in pill). The old card was a
  // violet gradient slab with a glowing violet button, the last of the purple.
  return (
    <View style={styles.referCard}>
      <MaterialCommunityIcons name="star-four-points" size={28} color="rgba(255,255,255,0.85)" style={{ marginBottom: 4 }} />

      <Text style={styles.referTitle}>Share the drive.</Text>
      <Text style={styles.referSub}>
        Know someone who'd love turning their playlists into a mood station? Send them Cruise FM.
      </Text>
      <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]} onPress={handleShare}>
        <MaterialCommunityIcons
          name={copied ? 'check' : 'share-variant'}
          size={16}
          color="#0a0a10"
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
  // ── Notification permission ──
  permBox: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  permTitle: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  permBody: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 19 },
  permBtn: {
    alignSelf: 'flex-start', marginTop: 2,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999,
    backgroundColor: '#fff',
  },
  permBtnText: { color: '#0a0a10', fontSize: 14.5, fontWeight: '800' },

  para: { paddingHorizontal: 16, paddingVertical: 15 },
  paraBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  paraText: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 20 },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15,
  },
  dangerLabel: { color: '#FF5C5C', fontSize: 14.5, fontWeight: '700' },
  dangerValue: { color: 'rgba(255,92,92,0.75)', fontSize: 12.5, fontWeight: '600' },
  aboutTagline: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  referCard: {
    borderRadius: 20, padding: 26, gap: 12, overflow: 'hidden', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
  },
  referTitle: { color: '#fff', fontSize: 21, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  referSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginBottom: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 26, paddingVertical: 14, paddingHorizontal: 28,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  shareBtnText: { color: '#0a0a10', fontSize: 15, fontWeight: '700' },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  nameRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  nameRowLabel: { color: '#fff', fontSize: 14.5, fontWeight: '600', flex: 1 },
  nameInput: {
    color: '#ffffff', fontSize: 14, fontWeight: '600',
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
