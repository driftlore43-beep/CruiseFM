import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { PaywallShowcase } from '@/components/PaywallShowcase';
import { SettingsSheet, type SettingsPage } from '@/components/SettingsSheet';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import { STATIONS } from '@/constants/stations';
import { Cruise } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementsContext';
import { getPlans, purchasePremium, restorePremium, type Plan } from '@/utils/purchases';

/**
 * The photograph behind the full-bleed hero.
 *
 * WITHOUT ONE THAT LOOK DOES NOT WORK, and the render proved it: the showcase
 * is DRAWN shapes on nothing, so running it to the screen's edges just gives a
 * big black rectangle with a small tuner in it. Every real deck in this app is
 * a blurred station photograph with the object standing on it — that backdrop
 * IS the look being borrowed, so the hero has to borrow it too.
 *
 * Deliberately one of the PREMIUM stations (After Hours FM), since this screen
 * exists to sell them, and deliberately the pre-blurred copy: re-blurring a
 * full-size image on the main thread is what got the app killed once already.
 */
const HERO_PHOTO = require('../../assets/stations/blur/after-midnight.jpg');

const AMBER      = '#F59E0B';
const AMBER_SOFT = 'rgba(245,158,11,0.14)';
const AMBER_LINE = 'rgba(245,158,11,0.35)';

// ── HOW THIS SCREEN LOOKS ────────────────────────────────────────────────────
//
// The paywall was the last screen in the app still wearing the pre-July
// treatment: a coloured GROUND with brand-coloured slabs on it and a gradient
// button. Every other screen was talked out of that one at a time — the
// platform picker on 03.08, the settings pages on 30.07, the "Are you
// driving?" card on 06.08 — and each time the answer was the same shape:
// neutral dark material, the brand colour kept for marks and lighting, and a
// SOLID pill in the opposite of the page for the one button that matters.
//
// These are three answers to how far to take that here. Only the chosen one
// should survive; delete the other two rather than leaving a switch behind.

type LookId = 'glass' | 'hero' | 'lit';

type Look = {
  /** The page itself. */
  ground: readonly [string, string, string];
  /** Background light: a flat disc, a real radial bloom, or nothing. */
  bloom: 'disc' | 'soft' | 'none';
  /** Full-bleed showcase with the title laid over it. */
  hero: boolean;
  /** Feature list: five bordered cards, or one hairline-divided list. */
  features: 'cards' | 'rows';
  cardBg: string;
  cardBorder: string;
  iconBg: string;
  iconBorder: string;
  /** The app's primary button is a solid pill in the opposite of the page. */
  whiteCta: boolean;
};

const GLASS_BG = 'rgba(255,255,255,0.04)';
const GLASS_LINE = 'rgba(255,255,255,0.12)';

const LOOKS: Record<LookId, Look> = {
  // A — the app's own clothes. Neutral near-black, hairline glass, amber kept
  // for the premium marks and nothing else.
  glass: {
    ground: ['#0a0a10', '#0a0a10', '#07070c'],
    bloom: 'none',
    hero: false,
    features: 'cards',
    cardBg: GLASS_BG,
    cardBorder: GLASS_LINE,
    iconBg: 'rgba(255,255,255,0.06)',
    iconBorder: GLASS_LINE,
    whiteCta: true,
  },
  // B — the modes ARE the pitch. The showcase runs to the screen's edges with
  // the title on it, exactly the way a real deck is built, and everything
  // below compresses to a list so the picture is what the page is.
  hero: {
    ground: ['#0a0a10', '#0a0a10', '#07070c'],
    bloom: 'none',
    hero: true,
    features: 'rows',
    cardBg: 'transparent',
    cardBorder: 'transparent',
    iconBg: 'rgba(255,255,255,0.06)',
    iconBorder: GLASS_LINE,
    whiteCta: true,
  },
  // C — keeps the warmth, but as LIGHT rather than paint. The material goes
  // neutral and a real amber bloom sits behind the stage — the mirror ball's
  // own rule, and the fix for the muddy brown the flat disc was making.
  lit: {
    ground: ['#0d0b08', '#0a0a0d', '#08080b'],
    bloom: 'soft',
    hero: false,
    features: 'cards',
    cardBg: 'rgba(255,255,255,0.045)',
    cardBorder: 'rgba(255,255,255,0.10)',
    iconBg: AMBER_SOFT,
    iconBorder: AMBER_LINE,
    whiteCta: true,
  },
};

// TEMP_LOOK_PREVIEW — how the three are rendered side by side. Goes when one
// is chosen.
const LOOK_ID: LookId = ((globalThis as any).__paywallLook as LookId) ?? 'lit';
const look = LOOKS[LOOK_ID];

/**
 * A real amber bloom — a radial falloff rather than a circle with a radius.
 *
 * The old one was a 340pt View with borderRadius 170 at 10% amber, which is a
 * flat DISC: its edge is plainly visible behind the stage and it reads as a
 * brown stain rather than light. Every other light layer in this app was
 * talked out of exactly that shape (the mirror ball's rim, the vinyl's
 * wedges, the CD's fan) for the same reason: a hard edge on a light reads as
 * a sticker.
 */
function Bloom() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="pwBloom" cx="50%" cy="20%" rx="78%" ry="42%">
          <Stop offset="0" stopColor={AMBER} stopOpacity={0.20} />
          <Stop offset="0.45" stopColor={AMBER} stopOpacity={0.07} />
          <Stop offset="1" stopColor={AMBER} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#pwBloom)" />
    </Svg>
  );
}

// Everything on this page is DERIVED, never typed out. The last version was
// written by hand and went stale the moment the line-up changed: it was still
// selling the Circular EQ (free since 25.07) and had never heard of Mirror
// Ball, CD, or the premium FM band.
const PRO_MODES = MODE_CATALOG.filter((m) => m.pro).map((m) => m.label);
const FREE_MODES = MODE_CATALOG.filter((m) => !m.pro).map((m) => m.label);
const PREMIUM_STATIONS = STATIONS.filter((s) => s.premium).length;

/** "A, B and C" */
function list(items: string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
/** "A, B, C" — for the comparison rows, where space is tighter. */
const commas = (items: string[]) => items.join(', ');

const FEATURES: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'album',
    title: `${PRO_MODES.length} Premium Visual Modes`,
    desc: `${list(PRO_MODES)} — the richest ways to drive.`,
  },
  {
    icon: 'radio-tower',
    title: 'The Whole FM Band',
    desc: `All ${PREMIUM_STATIONS} premium stations, on top of the free AM dial.`,
  },
  {
    icon: 'palette',
    title: 'Visual Mood Themes',
    desc: 'Every premium mood palette, plus unique imagery and colour.',
  },
  {
    icon: 'playlist-music',
    title: 'Unlimited Stations',
    desc: 'Build as many of your own as your drives demand.',
  },
  {
    icon: 'star-four-points',
    title: 'Future Premium Additions',
    desc: 'New modes and moods, added over time — always included.',
  },
];

const COMPARISON: { label: string; free: boolean; premium: boolean }[] = [
  { label: commas(FREE_MODES),                         free: true,  premium: true },
  { label: 'AM band stations',                         free: true,  premium: true },
  { label: 'Basic playback controls',                  free: true,  premium: true },
  { label: 'Badges & achievements',                    free: true,  premium: true },
  { label: commas(PRO_MODES),                          free: false, premium: true },
  { label: `FM band — ${PREMIUM_STATIONS} stations`,   free: false, premium: true },
  { label: 'All premium mood themes',                  free: false, premium: true },
  { label: 'Unlimited custom stations',                free: false, premium: true },
  { label: 'Future premium modes',                     free: false, premium: true },
];

// Alert.alert is a no-op in the browser — fall back to the native web dialog
// so the Safari-preview flow still talks back.
function notify(title: string, message: string, onDone?: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    onDone?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onDone }]);
}

const PLAN_NAME: Record<Plan['kind'], string> = {
  monthly: 'Monthly',
  annual: 'Yearly',
  lifetime: 'One payment, forever',
  other: 'Premium',
};

/**
 * How much cheaper a plan works out than paying monthly — COMPUTED from the
 * two real prices, never typed.
 *
 * "Save 25%" was a decision about £1.99 against £18, and it is only true in
 * that one currency at those two exact numbers. Working it out from whatever
 * the store actually charges keeps it true in every storefront, and keeps it
 * true if either price is ever changed in App Store Connect without anybody
 * remembering this line exists.
 */
function savingVs(monthly: Plan | undefined, plan: Plan): number | null {
  if (!monthly || plan.kind === 'monthly') return null;
  if (!plan.perMonth || !monthly.price) return null;
  const pct = Math.round((1 - plan.perMonth / monthly.price) * 100);
  return pct > 0 ? pct : null;
}

/** "3 days" / "1 week" / "1 month" — whatever the product's trial really is. */
function trialLabel(days: number): string {
  if (days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  if (days % 30 === 0)  return days === 30 ? '1 month' : `${days / 30} months`;
  if (days % 7 === 0)   return days === 7 ? '1 week' : `${days / 7} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

function PlanRow({ plan, on, saving, onPress }: {
  plan: Plan; on: boolean; saving: number | null; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${PLAN_NAME[plan.kind]}, ${plan.priceString}`}
      style={({ pressed }) => [styles.planRow, on && styles.planRowOn, pressed && { opacity: 0.9 }]}>
      <View style={[styles.planTick, on && styles.planTickOn]}>
        {on && <MaterialCommunityIcons name="check" size={13} color="#2a1a00" />}
      </View>
      <View style={styles.planText}>
        <Text style={styles.planName}>{PLAN_NAME[plan.kind]}</Text>
        {/* The monthly equivalent is the store's own arithmetic, so an annual
            plan can be compared without anybody doing sums in their head. */}
        {plan.kind !== 'monthly' && !!plan.perMonthString && (
          <Text style={styles.planSub}>{plan.perMonthString} a month</Text>
        )}
      </View>
      {saving != null && (
        <View style={styles.saveChip}>
          <Text style={styles.saveChipText}>SAVE {saving}%</Text>
        </View>
      )}
      <Text style={styles.planPrice}>{plan.priceString}</Text>
    </Pressable>
  );
}

function TickCell({ on, amber }: { on: boolean; amber?: boolean }) {
  return (
    <View style={styles.compareIconCell}>
      <MaterialCommunityIcons
        name={on ? 'check' : 'minus'}
        size={16}
        color={on ? (amber ? AMBER : 'rgba(255,255,255,0.85)') : 'rgba(255,255,255,0.25)'}
      />
    </View>
  );
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { refreshSubscription, isPro } = useEntitlements();
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<SettingsPage | null>(null);

  /**
   * What the store says is on sale.
   *
   *   undefined — still asking
   *   null      — could not ask (offline, store refused, no billing here)
   *   []        — asked, and nothing is on sale
   *   [...]     — real plans, with real prices
   *
   * The three failure shapes are kept apart on purpose, because the screen
   * must say something different about each and may never paper over any of
   * them with a made-up number.
   */
  const [plans, setPlans] = useState<Plan[] | null | undefined>(undefined);
  const [chosen, setChosen] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setPlans(undefined);
    const found = await getPlans();
    setPlans(found);
    // Default to the entry price — getPlans() already sorts monthly first.
    setChosen(found?.[0]?.id ?? null);
  }, []);


  /**
   * NOTHING may reach a purchase offer while the app is free.
   *
   * Build 18 was rejected under Guideline 2.1(b) (06.08) after a reviewer
   * reached this screen: the Profile upgrade card was still shown to
   * everyone, and it advertised "£1.99 / month · Unlock Premium" in a
   * submission that declares no in-app purchases. Hiding the entry point
   * (62cf67d) was the right fix and landed 19 minutes AFTER build 18 was
   * cut — which is precisely why the entry point must not be the ONLY
   * defence. This screen now refuses to render an offer whenever the user
   * already has everything, whatever route reached it (a stale card, a
   * deep link, a future button someone forgets to gate).
   *
   * It comes back on its own when payments ship, because isPro will then
   * mean what it says.
   */
  useEffect(() => {
    if (!isPro) return;
    // Deferred, and only when there IS somewhere to go back to: a deep link
    // straight at this route mounts it as the first screen, and navigating
    // during that first render throws ("Attempted to navigate before
    // mounting the Root Layout"). The render guard below is what actually
    // withholds the offer; this only tidies up the navigation after it.
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 0);
    return () => clearTimeout(t);
  }, [isPro]);

  // Don't wake the store for a screen that is about to show nothing. The hook
  // itself is unconditional (it sits above the isPro guard below); only the
  // fetch is skipped.
  useEffect(() => { if (!isPro) loadPlans(); }, [isPro, loadPlans]);

  if (isPro) return <View style={styles.root} />;

  const selected = plans?.find((pl) => pl.id === chosen) ?? null;
  const monthly = plans?.find((pl) => pl.kind === 'monthly');

  async function handleUnlock() {
    // No plan means no price on screen, so there is nothing honest to charge
    // for — the button is disabled in that state anyway.
    if (busy || !selected) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    const outcome = await purchasePremium(selected.id);
    await refreshSubscription();
    setBusy(false);
    if (outcome === 'purchased') {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notify('Welcome to Premium', 'Every mode, every mood — they are all yours.', () => router.back());
    } else if (outcome === 'unavailable') {
      notify('Not available yet', 'Purchases only work in the installed app, not this preview.');
    } else if (outcome === 'error') {
      notify('Something went wrong', 'No charge was made. Please try again in a moment.');
    }
    // 'cancelled' — the user changed their mind; no popup needed.
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    const restored = await restorePremium();
    await refreshSubscription();
    setBusy(false);
    if (restored) {
      notify('Premium restored', 'Welcome back — everything is unlocked again.', () => router.back());
    } else {
      notify('Nothing to restore', 'No previous Premium subscription was found for this account.');
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={look.ground}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {look.bloom === 'soft' && <Bloom />}
      {look.bloom === 'disc' && <View style={styles.glowOrb} pointerEvents="none" />}

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>

          {/* THE MODES ARE THE PITCH. Boxed, the showcase reads as a widget
              demonstrating the app; full-bleed with the title on it, it reads
              as the app — which is how every real deck in this app is built,
              and the modes are the thing nobody else has. */}
          {look.hero ? (
            <View style={styles.heroWrap}>
              <Image
                source={HERO_PHOTO}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={0}
              />
              {/* The drawn modes have to read ON the photograph, so it sits
                  back the same way a deck's own scrim holds its backdrop
                  down under white type. */}
              <View style={styles.heroVeil} pointerEvents="none" />
              <PaywallShowcase boxed={false} badge={false} height={302} chips="none" />
              <LinearGradient
                colors={['transparent', 'rgba(10,10,16,0.62)', look.ground[0]]}
                locations={[0, 0.55, 1]}
                style={styles.heroScrim}
                pointerEvents="none"
              />
              <View style={styles.heroText}>
                <Text style={styles.title}>Cruise FM Premium</Text>
                <Text style={styles.subtitle}>Unlock the full atmosphere.</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Cruise FM Premium</Text>
                <Text style={styles.subtitle}>Unlock the full atmosphere.</Text>
              </View>
              <PaywallShowcase
                badge={false}
                chips={look.whiteCta ? 'white' : 'amber'}
                cardBg={look.cardBg}
                cardBorder={look.cardBorder}
              />
            </>
          )}

          {/* Feature cards */}
          <View style={look.features === 'rows' ? styles.featureRows : styles.featureList}>
            {FEATURES.map((f, i) => (
              <View
                key={f.title}
                style={
                  look.features === 'rows'
                    ? [styles.featureRow, i > 0 && styles.featureRowBorder]
                    : [styles.featureCard, { backgroundColor: look.cardBg, borderColor: look.cardBorder }]
                }>
                <View style={[
                  styles.featureIconWrap,
                  { backgroundColor: look.iconBg, borderColor: look.iconBorder },
                  look.features === 'rows' && styles.featureIconSmall,
                ]}>
                  <MaterialCommunityIcons
                    name={f.icon}
                    size={look.features === 'rows' ? 19 : 22}
                    color="#fff"
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Comparison */}
          <Text style={styles.sectionLabel}>FREE VS PREMIUM</Text>
          <View style={styles.compareCard}>
            <View style={styles.compareHeadRow}>
              <Text style={[styles.compareCell, styles.compareFeatureHead]}>Feature</Text>
              <Text style={[styles.compareCol, styles.compareColHead]}>Free</Text>
              <Text style={[styles.compareCol, styles.compareColHead, { color: AMBER }]}>Premium</Text>
            </View>
            {COMPARISON.map((row, i) => (
              <View
                key={row.label}
                style={[styles.compareRow, i < COMPARISON.length - 1 && styles.compareRowBorder]}>
                <Text style={styles.compareCell}>{row.label}</Text>
                <TickCell on={row.free} />
                <TickCell on={row.premium} amber />
              </View>
            ))}
          </View>

          {/* ── PRICE ────────────────────────────────────────────────────
              EVERY NUMBER HERE COMES FROM THE STORE.

              This block used to read `£1.99 / month · 7-day free trial`,
              typed straight into the file. Both halves were claims the app
              could not keep: the App Store prices per COUNTRY, so £1.99 is
              simply not what an Australian, American or Japanese listener is
              charged, and the trial length belongs to the product rather
              than to this screen. A paywall showing a different number from
              the one the till takes is dishonest before it is anything else,
              and Apple rejects it besides.

              So when there is no price to show, this says so and offers a
              retry. It never falls back to a number — the same rule the seek
              bar follows when it prints `--:--` rather than a `0:00` it
              cannot stand behind. */}

          {plans === undefined && (
            <Text style={styles.priceStatus}>Checking prices…</Text>
          )}

          {plans === null && (
            <View style={styles.priceProblem}>
              <Text style={styles.priceStatus}>Prices aren&apos;t loading right now.</Text>
              <Pressable onPress={loadPlans} hitSlop={10}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          )}

          {plans?.length === 0 && (
            <Text style={styles.priceStatus}>
              Premium isn&apos;t on sale yet. Everything you can see today is yours for free.
            </Text>
          )}

          {/* One plan: the price IS the statement, so give it the room. */}
          {selected && plans!.length === 1 && (
            <View style={styles.priceRow}>
              <Text style={styles.price}>{selected.priceString}</Text>
              {!!selected.per && <Text style={styles.pricePer}>/ {selected.per}</Text>}
            </View>
          )}

          {/* Several: a picker, with the saving worked out rather than typed. */}
          {selected && plans!.length > 1 && (
            <View style={styles.planList} accessibilityRole="radiogroup">
              {plans!.map((pl) => (
                <PlanRow
                  key={pl.id}
                  plan={pl}
                  on={pl.id === selected.id}
                  saving={savingVs(monthly, pl)}
                  onPress={() => setChosen(pl.id)}
                />
              ))}
            </View>
          )}

          {selected && (
            <Text style={styles.trialNote}>
              {selected.trialDays
                ? `${trialLabel(selected.trialDays)} free, then ${selected.priceString}`
                : selected.priceString}
              {selected.per ? ` per ${selected.per} · cancel anytime` : ' · one payment'}
            </Text>
          )}

          {/* CTAs */}
          <Pressable
            style={({ pressed }) => [
              styles.unlockBtn,
              (pressed || busy) && { opacity: 0.9 },
              !selected && styles.unlockBtnOff,
            ]}
            onPress={handleUnlock}
            disabled={busy || !selected}>
            {/* A SOLID PILL IN THE OPPOSITE OF THE PAGE is this app's primary
                button everywhere else — the home hero, the create sheet, the
                platform picker, the "Are you driving?" card. A gradient here
                was the last survivor of the treatment they were all moved
                off. */}
            <LinearGradient
              colors={look.whiteCta ? ['#ffffff', '#f2f0ea'] : ['#F7B733', '#F59E0B']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.unlockGradient}>
              <Text style={styles.unlockText}>
                {busy ? 'One moment…' : selected?.trialDays ? 'Start free trial' : 'Unlock Premium'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={handleRestore} hitSlop={8} disabled={busy}>
            <Text style={styles.laterText}>Restore purchases</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.laterText}>Maybe Later</Text>
          </Pressable>

          {/* ── THE SMALL PRINT APPLE REQUIRES ───────────────────────────────
              A screen selling an auto-renewing subscription has to carry, in
              the app itself: what it is called, how long it runs, what it
              costs, and working links to the Terms of Use and the Privacy
              Policy. Both documents have existed in Settings all along and
              this screen never linked them, which is one of the commonest
              rejections there is — and a cheap one to leave lying around,
              given what the last two cost.

              The renewal sentence only appears for something that actually
              renews, so a one-off Founder purchase is never described as a
              subscription. */}
          {!!selected?.per && (
            <Text style={styles.finePrint}>
              Cruise FM Premium renews automatically at {selected.priceString} per {selected.per}{' '}
              unless it is cancelled at least 24 hours before the period ends. Manage or cancel it
              any time in your App Store account settings.
            </Text>
          )}

          <View style={styles.legalRow}>
            <Pressable onPress={() => setLegal('terms')} hitSlop={10}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => setLegal('privacyPolicy')} hitSlop={10}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* The legal documents, read in place rather than thrown out to a
          browser — leaving the app mid-purchase is how a purchase is lost.
          Safe as a Modal because /premium is a plain route rather than a
          modal presentation, which is the same arrangement Profile uses. */}
      <SettingsSheet page={legal} onClose={() => setLegal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0602' },
  glowOrb: {
    position: 'absolute',
    top: '6%',
    alignSelf: 'center',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  content: { paddingHorizontal: 22, paddingTop: 48 },

  // Full-bleed hero: escapes the scroll content's own gutter and top pad so
  // the picture runs to the screen's edges, the way a real deck does.
  heroWrap: { marginHorizontal: -22, marginTop: -48, marginBottom: 26, overflow: 'hidden' },
  heroVeil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(6,6,12,0.52)' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '76%' },
  heroText: {
    position: 'absolute', left: 22, right: 22, bottom: 20,
    alignItems: 'center',
  },

  header: { alignItems: 'center', marginBottom: 22 },
  title: {
    color: '#fff', fontSize: 27, fontWeight: '700',
    letterSpacing: 0.2, marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14.5,
    textAlign: 'center', lineHeight: 20,
  },

  featureList: { gap: 12, marginBottom: 32 },
  // The list form: no five separate slabs, just rows on hairlines. Five
  // bordered cards is most of this page's scrolling for no extra meaning.
  featureRows: { marginBottom: 30 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  featureRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  featureIconSmall: { width: 38, height: 38, borderRadius: 11 },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.16)',
  },
  featureIconWrap: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: AMBER_SOFT,
    borderWidth: 1, borderColor: AMBER_LINE,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 3 },
  featureTitle: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  featureDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 18 },

  sectionLabel: {
    color: 'rgba(245,158,11,0.7)', fontSize: 10.5, fontWeight: '800',
    letterSpacing: 2, marginBottom: 12,
  },
  compareCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  compareHeadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  compareRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  compareCell: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 13, paddingRight: 8 },
  compareFeatureHead: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  compareCol: { width: 58, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  compareColHead: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 0.5 },
  compareIconCell: { width: 58, alignItems: 'center' },

  // Prices that could not be fetched — stated, never invented.
  priceStatus: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14,
    textAlign: 'center', lineHeight: 20, marginBottom: 4,
  },
  priceProblem: { alignItems: 'center', gap: 6 },
  retryText: { color: AMBER, fontSize: 14, fontWeight: '700' },

  planList: { gap: 10, marginBottom: 4 },
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  planRowOn: { borderColor: AMBER_LINE, backgroundColor: AMBER_SOFT },
  planTick: {
    width: 21, height: 21, borderRadius: 11,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  planTickOn: { backgroundColor: AMBER, borderColor: AMBER },
  planText: { flex: 1, gap: 2 },
  planName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  planSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  saveChip: {
    backgroundColor: AMBER, borderRadius: 7,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  // Dark ink on amber: white on this fill measures under 2:1, which is the
  // exact fault the shuffle pill was rebuilt around on 01.09.
  saveChipText: { color: '#2a1a00', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  planPrice: { color: '#fff', fontSize: 16, fontWeight: '800' },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  price: { color: '#fff', fontSize: 34, fontWeight: '800' },
  pricePer: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  trialNote: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12.5,
    textAlign: 'center', marginTop: 6, marginBottom: 22,
  },

  unlockBtn: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: look.whiteCta ? '#000' : AMBER,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: look.whiteCta ? 0.35 : 0.5,
    shadowRadius: 18, elevation: 10,
  },
  unlockGradient: { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  unlockText: { color: '#2a1a00', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  unlockBtnOff: { opacity: 0.4 },
  laterBtn: { alignItems: 'center', paddingTop: 16 },
  laterText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },

  finePrint: {
    color: 'rgba(255,255,255,0.34)', fontSize: 11, lineHeight: 16,
    textAlign: 'center', marginTop: 22, paddingHorizontal: 4,
  },
  legalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 14,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDot: { color: 'rgba(255,255,255,0.3)', fontSize: 12.5 },
});
