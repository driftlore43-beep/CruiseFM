import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { STATIONS, stationDial } from '@/constants/stations';
import { primaryOnAir, upNext, clockLabel } from '@/constants/schedule';
import { resolveAnyStation, cachedCustomStations, loadCustomStations } from '@/utils/customStations';
import { loadLastCruise } from '@/utils/lastCruise';
import { getDriveStats } from '@/utils/driveStats';
import { cachedSessionKind, loadSessionKind, words } from '@/utils/sessionKind';

/**
 * WHAT THE HOME SCREEN AND LOCK SCREEN WIDGETS READ.
 *
 * A widget cannot run our JavaScript — it is a separate iOS process that
 * WidgetKit wakes on its own schedule — so everything it shows has to be
 * written down for it in advance, in a place both processes can see (an App
 * Group container). This file is the app's side of that: it gathers a
 * snapshot and hands it over. The Swift widget only ever reads.
 *
 * THE TIMELINE IS THE WHOLE TRICK, and it is what makes a static widget feel
 * like a living radio. iOS budgets a widget to roughly a handful of refreshes
 * a day, so "ask the app what's on air" every few minutes is not available to
 * anyone, us included. But WidgetKit takes a TIMELINE — a list of entries
 * with the time each becomes current — and renders them itself, with no
 * refresh spent and the app not running at all. Cruise FM already owns a real
 * broadcast schedule (constants/schedule.ts), so the changeovers for the next
 * 24 hours are knowable in advance and are written down here. The widget then
 * genuinely changes through the day — Night Run at night, Sunset at dusk —
 * while never once animating or waking us.
 *
 * COLOURS, NOT PHOTOGRAPHS, for this first round, and it is a real constraint
 * rather than a shortcut: a widget extension cannot read the app's bundled
 * assets, and a custom station's photo lives in documentDirectory, which is
 * outside the shared container. Getting pictures across means copying files
 * into the App Group at save time — worth doing, but a later round. The
 * app's own Modes page is gradient glass rather than photographs, so a
 * coloured tile carrying the dial number and the station's icon is the
 * house language, not a compromise.
 *
 * NOTHING HERE REACHES A PHONE WITHOUT A NEW BINARY. The widget extension is
 * native. This file ships over the air ahead of it and no-ops until the
 * bridge exists — the same arrangement appleMusic.ts had while MusicKit was
 * still queued, so it can be written, reviewed and tested long before the
 * build that gives it somewhere to write to.
 */

/** One station as a widget draws it. No image — see the note above. */
export type WidgetStation = {
  id: string;
  name: string;
  tagline: string;
  /** "92.1 FM" / "810 AM" — set in the app's own seven-segment face. */
  dial: string;
  /** MaterialCommunityIcons glyph name; the extension carries the same font. */
  icon: string;
  /** Deep → mid → black, the station's own card ramp. */
  colors: [string, string, string];
  accent: string;
};

/** One changeover on the broadcast timeline. */
export type WidgetOnAir = WidgetStation & {
  /** Epoch ms at which this station becomes the one on air. */
  at: number;
};

export type WidgetSnapshot = {
  /** Bumped when the shape changes, so an old widget binary reading a newer
   *  snapshot can decline rather than misdraw. */
  version: number;
  updatedAt: number;
  /** Where "Start Drive" goes. Null until they have driven once. */
  lastDrive: (WidgetStation & { mode: string }) | null;
  /** Now first, then every changeover for the next 24h. */
  onAir: WidgetOnAir[];
  /** "UP NEXT · Sunset AM at 5pm", already worded. */
  upNextLine: string | null;
  stats: {
    streakDays: number;
    sessionsThisWeek: number;
    totalMinutes: number;
    /** "DRIVES" or "SESSIONS" — the wording rule lives in sessionKind.ts and
     *  must not be re-decided in Swift. */
    countLabel: string;
    timeLabel: string;
  };
};

export const WIDGET_SNAPSHOT_VERSION = 1;

/** How far ahead the timeline is written. A widget reloads long before this
 *  runs out; a day is simply more than enough that it never shows empty. */
const TIMELINE_HOURS = 24;

type Bridge = {
  /** Writes the snapshot into the App Group and asks WidgetKit to reload. */
  setSnapshot(json: string): Promise<void>;
};

/**
 * Absent on web, on Android, and on every iOS build cut before the widget
 * extension existed. `requireOptionalNativeModule` returns null rather than
 * throwing, which is the contract this file needs.
 */
const bridge: Bridge | null =
  Platform.OS === 'ios' ? requireOptionalNativeModule<Bridge>('CruiseWidgets') : null;

/** True only in builds carrying the widget extension. */
export function widgetsAvailable(): boolean {
  return bridge != null;
}

/** Flatten a station down to the handful of fields a widget draws. */
export function toWidgetStation(id: string): WidgetStation {
  const s = resolveAnyStation(id);
  const known = STATIONS.some((x) => x.id === s.id);
  const dial = stationDial(s.id, known ? s.premium : false);
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    dial: `${dial.label} ${dial.band}`,
    icon: s.iconName ?? s.icon,
    colors: s.cardGradient,
    // The accent slot every mode wears — eqColors[1] where a station has a
    // ramp, its mid gradient stop otherwise. Same rule as the app itself, so
    // a widget can never disagree with the screen it links into.
    accent: s.eqColors?.[1] ?? s.cardGradient[1],
  };
}

/**
 * Every changeover between now and TIMELINE_HOURS from now.
 *
 * Walked hour by hour because the schedule's windows are whole hours, so an
 * hourly step lands exactly on every boundary and cannot miss one; runs of
 * the same station are then collapsed, leaving one entry per actual change.
 * The first entry is always NOW, or a widget rendered mid-hour would have
 * nothing current to show.
 *
 * Exported and pure so it can be checked offline against the real schedule —
 * a wrong timeline is a widget that names a station that is not on air, which
 * is the same class of untruth the notification rules exist to prevent.
 */
export function buildOnAirTimeline(now: Date = new Date(), hours = TIMELINE_HOURS): WidgetOnAir[] {
  const out: WidgetOnAir[] = [];
  for (let h = 0; h <= hours; h++) {
    const at = new Date(now.getTime() + h * 3600_000);
    // Step to the top of the hour for every entry after the first, so a
    // changeover is stamped at the moment it happens rather than at whatever
    // minute past the hour this happened to run.
    if (h > 0) at.setMinutes(0, 0, 0);
    const id = primaryOnAir(at);
    if (out.length && out[out.length - 1].id === id) continue;
    out.push({ ...toWidgetStation(id), at: at.getTime() });
  }
  return out;
}

/** "UP NEXT · Sunset AM at 5pm", or null when nothing is scheduled after this. */
export function upNextLine(now: Date = new Date()): string | null {
  const next = upNext(now);
  if (!next) return null;
  return `${resolveAnyStation(next.id).name} at ${clockLabel(next.hour)}`;
}

/**
 * Gather everything the widgets read. Safe to call at any time; it never
 * throws, because a failed snapshot must leave the last good one in place
 * rather than blank the widgets.
 */
export async function buildWidgetSnapshot(now: Date = new Date()): Promise<WidgetSnapshot> {
  // Custom stations may not be in the sync cache yet on a cold start, and a
  // snapshot naming a station it cannot describe is worse than a late one.
  if (!cachedCustomStations().length) await loadCustomStations().catch(() => {});
  await loadSessionKind().catch(() => {});

  const [last, stats] = await Promise.all([
    loadLastCruise().catch(() => null),
    getDriveStats().catch(() => null),
  ]);
  const w = words(cachedSessionKind());
  const kind = cachedSessionKind();

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    updatedAt: now.getTime(),
    lastDrive: last ? { ...toWidgetStation(last.stationId), mode: last.mode } : null,
    onAir: buildOnAirTimeline(now),
    upNextLine: upNextLine(now),
    stats: {
      streakDays: stats?.streakDays ?? 0,
      // Their own kind, so a desk listener is never shown a drive count of
      // zero beside a week of real listening (the 13.08 rule).
      sessionsThisWeek: kind === 'driving' ? (stats?.drivesThisWeek ?? 0) : (stats?.listensThisWeek ?? 0),
      totalMinutes: stats?.totalMinutes ?? 0,
      countLabel: w.countLabel,
      timeLabel: w.timeLabel,
    },
  };
}

/**
 * Build a snapshot and hand it to the widgets. A no-op on any build without
 * the extension, and silent on failure — a widget that is briefly out of
 * date is a far smaller problem than an app that stumbles trying to update
 * one, and this runs on paths (drive start, drive end, foreground) where
 * nothing may block or throw.
 */
export async function publishWidgetData(): Promise<void> {
  if (!bridge) return;
  try {
    await bridge.setSnapshot(JSON.stringify(await buildWidgetSnapshot()));
  } catch {
    // The last good snapshot stays on disk; the next call will try again.
  }
}
