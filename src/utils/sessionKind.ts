import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Driving, or just listening.
 *
 * WHY THIS EXISTS (owner, 13.08): "having a driving mode and a non-driving
 * mode for those users who want to just display them on the phone while
 * working… that wording isn't always about driving." She is the case in point
 * — she uses it in her room — and it was already on record (11.08) that the
 * driving frame had a question mark over it.
 *
 * It also fixes something the app was vague about. Cruise FM cannot tell
 * whether anybody is driving; the "Are you driving?" card exists precisely
 * because it is guessing. Asking once replaces the guess with an answer, so
 * the numbers become true for the first time, and the card can stand down
 * entirely for someone who has already said no.
 *
 * ASKED ONCE, THEN REMEMBERED. A fork in front of every session would tax the
 * one-tap start, which is the best moment the app has. But a once-and-forever
 * answer is wrong too, because the context genuinely changes — car today, desk
 * tomorrow — so the answer is a remembered default with a visible switch.
 */
export type SessionKind = 'driving' | 'listening';

const KEY = 'cruisefm_session_kind';

/** Sync mirror, so a render can read it without waiting. Primed on load. */
let cached: SessionKind | null = null;

/** The remembered answer, or null if they have never been asked. */
export async function loadSessionKind(): Promise<SessionKind | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cached = raw === 'driving' || raw === 'listening' ? raw : null;
    return cached;
  } catch {
    return cached;
  }
}

/** What the last load found, for callers that must not wait. */
export function cachedSessionKind(): SessionKind {
  return cached ?? 'driving';
}

export async function setSessionKind(kind: SessionKind): Promise<void> {
  cached = kind;
  listeners.forEach((fn) => fn(kind));
  await AsyncStorage.setItem(KEY, kind).catch(() => {});
}

/**
 * The answer, live.
 *
 * It became observable when the car appeared on the scrub bar (13.08): the
 * seek bar is drawn inside eight different modes, none of which owns this
 * state, and "just listening" has to take the car off the road immediately
 * rather than at the next cold start. A subscription is the cheapest way for
 * any component anywhere to follow it without threading a prop through
 * everything.
 */
const listeners = new Set<(k: SessionKind) => void>();

export function subscribeSessionKind(fn: (k: SessionKind) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * THE VOCABULARY, in one place.
 *
 * The rule that shapes this, and it is a brand decision as much as a copy one:
 * KEEP THE DRIVING VOICE, SOFTEN ONLY THE CLAIMS. Cruise FM's character is the
 * road — it is the thing nobody else has, and the station names and taglines
 * work perfectly well at a desk ("Empty expressways. Blue-lit dashboards." is
 * evocative wherever you are sitting). So the atmosphere never changes. What
 * changes is every line that asserts something about the person: what the
 * start button promises, what the stats are counting, what a badge says you
 * did.
 */
export type Words = {
  /** The big button with nothing saved yet. */
  start: string;
  /** The big button when there is something to pick up. */
  resume: string;
  /** "one more <noun>" */
  noun: string;
  /** "four <plural> this week" */
  plural: string;
  /** The stats strip's first column. */
  countLabel: string;
  /** The stats strip's time column — "CRUISED" reads oddly at a desk. */
  timeLabel: string;
  /** How the switch on the home page names this mode. */
  modeLabel: string;
};

const DRIVING: Words = {
  start: 'Start Drive',
  resume: 'Continue Drive',
  noun: 'drive',
  plural: 'drives',
  countLabel: 'DRIVES',
  timeLabel: 'CRUISED',
  modeLabel: 'Driving',
};

const LISTENING: Words = {
  start: 'Start Listening',
  resume: 'Keep Listening',
  noun: 'session',
  plural: 'sessions',
  countLabel: 'SESSIONS',
  timeLabel: 'LISTENED',
  modeLabel: 'Just listening',
};

export function words(kind: SessionKind): Words {
  return kind === 'driving' ? DRIVING : LISTENING;
}

/**
 * React's view of it. Primes itself from storage on mount — the sync cache is
 * only populated once something has loaded it, and a mode can be the first
 * screen a listener opens.
 */
export function useSessionKind(): SessionKind {
  const [kind, setKind] = useState<SessionKind>(cachedSessionKind());
  useEffect(() => {
    let alive = true;
    loadSessionKind().then((k) => { if (alive && k) setKind(k); });
    const off = subscribeSessionKind(setKind);
    return () => { alive = false; off(); };
  }, []);
  return kind;
}
