import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandIntro, holdSplashScreen } from '@/components/BrandIntro';
import { initCrashReports } from '@/utils/crashReports';

// First thing on launch, so even startup crashes get reported.
initCrashReports();
// Keep the native splash up until BrandIntro is on screen to take over from
// it — without this the mark is gone the moment the first screen mounts,
// which is the "it happens in a flash" the owner reported.
holdSplashScreen();
import { AppearanceProvider, useAppearance } from '@/context/AppearanceContext';
import { ThemeProvider as CruiseThemeProvider, useTheme } from '@/context/ThemeContext';
import { MotionProvider } from '@/context/MotionContext';
import { NowPlayingProvider } from '@/context/NowPlayingContext';
import { EntitlementsProvider } from '@/context/EntitlementsContext';
import { PlatformSelector, usePlatformSelector } from '@/components/PlatformSelector';
import { setPlatformSkipped } from '@/utils/musicPlatform';
import { claimFounderIfEligible } from '@/utils/founder';
import { AutoUpdateHost } from '@/components/AutoUpdateHost';
import { NotificationHost } from '@/components/NotificationHost';
import { WidgetSyncHost } from '@/components/WidgetSyncHost';
import { NotifyPrompt } from '@/components/NotifyPrompt';

// Stamp launch-week devices as Founders (fire-and-forget, idempotent).
claimFounderIfEligible();

function AppShell() {
  const platformSelector = usePlatformSelector();
  const { theme } = useTheme();
  const { palette } = useAppearance();
  // The platform sheet is a Modal, and a Modal renders above the app root —
  // on a first launch it was covering the opening logo about a third of the
  // way through it. The brand goes first, then the question.
  const [introDone, setIntroDone] = useState(false);

  const handleDismiss = async (skipped?: boolean) => {
    if (skipped) await setPlatformSkipped();
    platformSelector.dismiss();
  };

  // Ambient glow tracks accent color and glow intensity
  const glowAlpha = Math.round(theme.glowIntensity * 0.22 * 255).toString(16).padStart(2, '0');
  const glowColor = theme.accentColor + glowAlpha;

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.ambientGlow, { backgroundColor: glowColor }]} />
      <Slot />
      <PlatformSelector
        visible={introDone && platformSelector.visible}
        onDismiss={handleDismiss}
      />
      {/* Local notifications: schedules them, and turns a tap into a drive.
          Renders nothing. The prompt asks only after the third drive, and
          only when the app is otherwise quiet. */}
      {/* Keeps the app on the newest version by itself, so nobody has to know
          the Check-for-updates button exists. Restarts only on returning from
          a real absence, and never during a drive or over a sheet. */}
      <AutoUpdateHost />
      <NotificationHost />
      <WidgetSyncHost />
      <NotifyPrompt />
      {/* Last child, so it covers everything including the platform sheet. */}
      <BrandIntro onDone={() => setIntroDone(true)} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <NavigationSkin>
        <CruiseThemeProvider>
          <MotionProvider>
            <EntitlementsProvider>
              <NowPlayingProvider>
                <AppShell />
              </NowPlayingProvider>
            </EntitlementsProvider>
          </MotionProvider>
        </CruiseThemeProvider>
      </NavigationSkin>
    </AppearanceProvider>
  );
}

/**
 * THE PAGE GROUND IS REACT NAVIGATION'S, not ours — every tab paints itself
 * transparent so the shared ground shows through, and that ground is whatever
 * this ThemeProvider hands the navigator (its DarkTheme is literally rgb(1,1,1),
 * which is the near-black the app has always sat on). So this one swap turns
 * every page over at once; without it a page would be paper with a black margin
 * wherever its own content did not reach.
 */
function NavigationSkin({ children }: { children: React.ReactNode }) {
  const { palette } = useAppearance();
  const nav = palette.mode === 'light'
    ? { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: palette.bg } }
    : DarkTheme;
  return <ThemeProvider value={nav}>{children}</ThemeProvider>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
    width: 480,
    height: 480,
    borderRadius: 240,
  },
});
