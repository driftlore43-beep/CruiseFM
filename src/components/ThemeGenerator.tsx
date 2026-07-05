import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardStyle, CruiseTheme, DEFAULT_THEME, FontStyle, useTheme } from '@/context/ThemeContext';

// ── Data ──────────────────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { name: 'Violet',  color: '#7B38E0' },
  { name: 'Cyan',    color: '#00B4D8' },
  { name: 'Amber',   color: '#C8860A' },
  { name: 'Rose',    color: '#FF2D6B' },
  { name: 'Emerald', color: '#00C896' },
  { name: 'Gold',    color: '#D4AF37' },
  { name: 'Coral',   color: '#FF6B4A' },
  { name: 'Ice',     color: '#A8D8EA' },
] as const;

const BACKGROUNDS = [
  { name: 'Midnight',     emoji: '🌙', colors: ['#0A0F2B', '#1a1a3a'] as [string, string] },
  { name: 'Deep Space',   emoji: '🌌', colors: ['#050510', '#0d0d2b'] as [string, string] },
  { name: 'Sunset',       emoji: '🌅', colors: ['#1a0a00', '#2a1000'] as [string, string] },
  { name: 'Forest Night', emoji: '🌲', colors: ['#021a15', '#051f0f'] as [string, string] },
] as const;

const GLOW_STOPS = ['Off', 'Subtle', 'Medium', 'Intense'] as const;
const GLOW_VALUES: number[] = [0, 0.33, 0.66, 1];

const FONT_OPTIONS: { key: FontStyle; label: string; fontFamily: string }[] = [
  { key: 'cinematic', label: 'Cinematic', fontFamily: 'serif' },
  { key: 'modern',    label: 'Modern',    fontFamily: 'normal' },
  { key: 'retro',     label: 'Retro',     fontFamily: 'Courier New' },
];

const CARD_OPTIONS: { key: CardStyle; label: string; desc: string }[] = [
  { key: 'minimal',       label: 'Minimal',      desc: 'Flat dark' },
  { key: 'gradient',      label: 'Gradient',      desc: 'Depth & color' },
  { key: 'glassmorphism', label: 'Glass',         desc: 'Frosted layer' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function bgMatches(a: [string, string], b: [string, string]) {
  return a[0] === b[0] && a[1] === b[1];
}

function closestGlowIdx(v: number) {
  return GLOW_VALUES.reduce((best, gv, i) =>
    Math.abs(gv - v) < Math.abs(GLOW_VALUES[best] - v) ? i : best, 0);
}

// ── Live Preview Card ─────────────────────────────────────────────────────────
function PreviewCard({ draft }: { draft: CruiseTheme }) {
  const font = FONT_OPTIONS.find(f => f.key === draft.fontStyle)?.fontFamily ?? 'serif';
  const glowOpacity = draft.glowIntensity * 0.55;

  return (
    <View style={[
      pv.card,
      { borderColor: draft.accentColor + '88', shadowColor: draft.accentColor, shadowOpacity: glowOpacity },
    ]}>
      {draft.cardStyle === 'minimal' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', borderRadius: 14 }]} />
      )}
      {draft.cardStyle === 'gradient' && (
        <LinearGradient colors={draft.background} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
      )}
      {draft.cardStyle === 'glassmorphism' && (
        <>
          <LinearGradient colors={draft.background} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
          }]} />
        </>
      )}
      <View style={pv.inner}>
        <View style={[pv.dot, { backgroundColor: draft.accentColor, shadowColor: draft.accentColor }]} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[pv.title, { fontFamily: font }]}>Night Run FM</Text>
          <Text style={[pv.sub, { color: draft.accentColor, fontFamily: font }]}>88.7 · Midnight Drive</Text>
        </View>
        <View style={[pv.playBtn, { backgroundColor: draft.accentColor, shadowColor: draft.accentColor }]}>
          <Text style={pv.playIcon}>▶</Text>
        </View>
      </View>
    </View>
  );
}

// ── Glow slider ───────────────────────────────────────────────────────────────
function GlowSlider({
  glowIdx, accentColor, onChange,
}: {
  glowIdx: number; accentColor: string; onChange: (idx: number) => void;
}) {
  const [trackW, setTrackW] = useState(0);
  const fillPct = trackW > 0 ? (glowIdx / 3) * trackW : 0;

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ height: 40, justifyContent: 'center' }}
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        {/* Track background */}
        <View style={sl.track}>
          {/* Filled portion */}
          <View style={[sl.fill, { width: fillPct, backgroundColor: accentColor }]} />
        </View>
        {/* Stop dots — each tappable */}
        {GLOW_VALUES.map((_, i) => {
          const pos = trackW > 0 ? (i / 3) * trackW : 0;
          const active = i === glowIdx;
          return (
            <Pressable
              key={i}
              hitSlop={12}
              onPress={() => onChange(i)}
              style={[sl.stopWrap, { left: pos - 10 }]}>
              <View style={[
                sl.dot,
                active && { width: 18, height: 18, borderRadius: 9, backgroundColor: accentColor,
                  shadowColor: accentColor, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 },
                !active && { backgroundColor: '#2a2a4a' },
              ]} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {GLOW_STOPS.map(s => (
          <Text key={s} style={sl.label}>{s}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Card style mini preview ───────────────────────────────────────────────────
function CardMini({ style: cs, accent }: { style: CardStyle; accent: string }) {
  switch (cs) {
    case 'minimal':
      return <View style={[cm.base, { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }]} />;
    case 'gradient':
      return (
        <LinearGradient
          colors={['#1a1050', '#0a0a20']}
          style={[cm.base, { borderColor: accent + '50' }]} />
      );
    case 'glassmorphism':
      return (
        <View style={[cm.base, {
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.20)',
        }]}>
          <View style={[StyleSheet.absoluteFill, { borderRadius: 8, backgroundColor: 'rgba(100,80,200,0.12)' }]} />
        </View>
      );
  }
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.label}>{label}</Text>
      {children}
    </View>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function ThemeGenerator({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme: saved, setTheme, resetTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<CruiseTheme>({ ...saved });
  const [saved_, setSaved_] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const saveScale    = useRef(new Animated.Value(1)).current;

  // Sync draft when modal opens
  useEffect(() => {
    if (visible) setDraft({ ...saved });
  }, [visible]);

  const accentName = ACCENT_COLORS.find(c => c.color === draft.accentColor)?.name ?? '';
  const glowIdx = closestGlowIdx(draft.glowIntensity);

  const handleSave = async () => {
    await setTheme(draft);
    setSaved_(true);
    // Pulse animation
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.06, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.spring(saveScale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 6 }),
    ]).start();
    // Toast fade in/out
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setSaved_(false));
  };

  const handleReset = async () => {
    setDraft({ ...DEFAULT_THEME });
    await resetTheme();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[tg.root, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>

        {/* Header */}
        <View style={tg.header}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={tg.eyebrow}>MY THEME</Text>
            <Text style={tg.title}>Make Cruise FM yours</Text>
          </View>
          <Pressable onPress={onClose} style={tg.closeBtn} hitSlop={8}>
            <Text style={tg.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[tg.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}>

          {/* Live preview */}
          <View style={tg.previewWrap}>
            <Text style={tg.previewLabel}>PREVIEW</Text>
            <PreviewCard draft={draft} />
          </View>

          {/* ── Accent Color ── */}
          <Section label="ACCENT COLOR">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ac.row}>
              {ACCENT_COLORS.map(({ name, color }) => {
                const sel = draft.accentColor === color;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setDraft(d => ({ ...d, accentColor: color }))}
                    style={[ac.circle, { backgroundColor: color },
                      sel && { borderWidth: 2.5, borderColor: '#fff',
                        shadowColor: color, shadowOpacity: 0.7, shadowRadius: 8, elevation: 6 },
                    ]}
                  />
                );
              })}
            </ScrollView>
            {accentName ? <Text style={ac.name}>{accentName}</Text> : null}
          </Section>

          {/* ── Background Mood ── */}
          <Section label="BACKGROUND MOOD">
            <View style={bg_.grid}>
              {BACKGROUNDS.map(mood => {
                const sel = bgMatches(draft.background, mood.colors);
                return (
                  <Pressable
                    key={mood.name}
                    onPress={() => setDraft(d => ({ ...d, background: mood.colors }))}
                    style={[bg_.card, sel && { borderColor: draft.accentColor,
                      shadowColor: draft.accentColor, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 }]}>
                    <LinearGradient colors={mood.colors} style={bg_.swatch} />
                    <Text style={bg_.emoji}>{mood.emoji}</Text>
                    <Text style={bg_.name}>{mood.name}</Text>
                    {sel && <View style={[bg_.checkDot, { backgroundColor: draft.accentColor }]} />}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Glow Intensity ── */}
          <Section label="GLOW INTENSITY">
            <GlowSlider
              glowIdx={glowIdx}
              accentColor={draft.accentColor}
              onChange={i => setDraft(d => ({ ...d, glowIntensity: GLOW_VALUES[i] }))}
            />
          </Section>

          {/* ── Font Style ── */}
          <Section label="FONT STYLE">
            <View style={fs_.row}>
              {FONT_OPTIONS.map(f => {
                const sel = draft.fontStyle === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setDraft(d => ({ ...d, fontStyle: f.key }))}
                    style={[fs_.pill, sel && {
                      backgroundColor: draft.accentColor + '22',
                      borderColor: draft.accentColor,
                    }]}>
                    <Text style={[
                      fs_.text,
                      { fontFamily: f.fontFamily },
                      sel && { color: draft.accentColor },
                    ]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Card Style ── */}
          <Section label="CARD STYLE">
            <View style={cs_.row}>
              {CARD_OPTIONS.map(c => {
                const sel = draft.cardStyle === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setDraft(d => ({ ...d, cardStyle: c.key }))}
                    style={[cs_.opt, sel && {
                      borderColor: draft.accentColor,
                      shadowColor: draft.accentColor, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
                    }]}>
                    <CardMini style={c.key} accent={draft.accentColor} />
                    <Text style={[cs_.label, sel && { color: draft.accentColor }]}>{c.label}</Text>
                    <Text style={cs_.desc}>{c.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Save button */}
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                tg.saveBtn,
                { backgroundColor: draft.accentColor,
                  shadowColor: draft.accentColor,
                  opacity: pressed ? 0.85 : 1 },
              ]}>
              <Text style={tg.saveBtnText}>
                {saved_ ? '✓  Theme Saved!' : 'Save My Theme'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Reset */}
          <Pressable onPress={handleReset} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={tg.resetText}>Reset to Default</Text>
          </Pressable>

        </ScrollView>

        {/* Toast */}
        <Animated.View style={[tg.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={tg.toastText}>Theme saved! ✓</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tg = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#0a0a1a' },
  header:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingBottom: 16, gap: 12 },
  eyebrow:   { color: '#7B38E0', fontSize: 10, fontWeight: '700', letterSpacing: 3 },
  title:     { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeBtn:  {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '400' },
  scroll:       { paddingHorizontal: 16, paddingTop: 8, gap: 24 },
  previewWrap:  { gap: 8 },
  previewLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginLeft: 4 },
  saveBtn:      {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 10,
  },
  saveBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  resetText:    { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '500' },
  toast:        {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: '#1a1a2e', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(123,56,224,0.35)',
    shadowColor: '#7B38E0', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  toastText:    { color: '#fff', fontSize: 14, fontWeight: '600' },
});

const sec = StyleSheet.create({
  wrap:  { gap: 12 },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginLeft: 2 },
});

const pv = StyleSheet.create({
  card: {
    borderRadius: 14, overflow: 'hidden', borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, elevation: 10,
  },
  inner:    { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  dot:      {
    width: 10, height: 10, borderRadius: 5,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4,
  },
  title:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  sub:      { fontSize: 13, fontWeight: '500' },
  playBtn:  {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  playIcon: { color: '#fff', fontSize: 13, marginLeft: 2 },
});

const sl = StyleSheet.create({
  track:    { height: 4, borderRadius: 2, backgroundColor: '#1e1e3a', overflow: 'visible' },
  fill:     { height: 4, borderRadius: 2 },
  stopWrap: { position: 'absolute', top: -8, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  label:    { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Courier New', letterSpacing: 0.5, fontWeight: '600' },
});

const ac = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 12, paddingHorizontal: 2, paddingVertical: 4, alignItems: 'center' },
  circle: { width: 34, height: 34, borderRadius: 17, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  name:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginLeft: 4, marginTop: 4 },
});

const bg_ = StyleSheet.create({
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:     {
    width: '47.5%', borderRadius: 12, overflow: 'hidden', padding: 12, gap: 6,
    backgroundColor: '#111', borderWidth: 1.5, borderColor: '#1e1e3a',
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  swatch:   { height: 28, borderRadius: 6, marginBottom: 2 },
  emoji:    { fontSize: 20 },
  name:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  checkDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
});

const fs_ = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#1e1e3a', backgroundColor: '#111',
  },
  text: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
});

const cs_ = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 10 },
  opt:   {
    flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#1e1e3a', backgroundColor: '#0d0d1a',
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  desc:  { color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center' },
});

const cm = StyleSheet.create({
  base: { width: '100%', height: 40, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
});
