import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A driver's own order for the Modes list — Ethan's ask (25.08): "I use the
 * Tuner, CD, Vinyl, and Cassette the most so it would be nice to have the
 * option move those to the front."
 *
 * Deliberately just a saved ORDER, not a saved SPLIT: the free-first section
 * grouping (INCLUDED / PREMIUM on the Modes tab) is the paywall's shop
 * window and stays fixed — a mode never crosses out of its own group, it
 * only moves within it. `applyModeOrder` enforces that by construction.
 */

export const MODE_ORDER_KEY = 'cruisefm_mode_order';

export async function getModeOrder(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(MODE_ORDER_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}

export async function saveModeOrder(order: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MODE_ORDER_KEY, JSON.stringify(order));
  } catch {
    // A missed save just means the order resets to default — never worth
    // interrupting a drive over.
  }
}

/**
 * Reorders `items` by a saved custom order, one group at a time (free modes
 * among themselves, premium modes among themselves), so the section split
 * can never be disturbed. Anything the saved order doesn't mention — no
 * order saved yet, or a mode added since — keeps its place in the catalogue
 * order within its own group, which is a stable sort's job for free.
 */
export function applyModeOrder<T extends { id: string; pro: boolean }>(
  items: T[],
  order: string[] | null,
): T[] {
  if (!order || !order.length) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  const withRank = (m: T) => (rank.has(m.id) ? rank.get(m.id)! : Infinity);
  const free = items.filter((m) => !m.pro).map((m, i) => ({ m, i }))
    .sort((a, b) => withRank(a.m) - withRank(b.m) || a.i - b.i).map((x) => x.m);
  const pro = items.filter((m) => m.pro).map((m, i) => ({ m, i }))
    .sort((a, b) => withRank(a.m) - withRank(b.m) || a.i - b.i).map((x) => x.m);
  return [...free, ...pro];
}

/**
 * Swaps `id` with its neighbour in the same group (same `pro` flag), inside
 * the full saved order array — so moving a free mode never touches where the
 * premium modes sit relative to each other, and vice versa. Returns the same
 * array reference when there's nowhere to move (already first/last in its
 * group), so callers can skip the save.
 */
export function moveModeWithinGroup(
  order: string[],
  id: string,
  dir: -1 | 1,
  proOf: (modeId: string) => boolean,
): string[] {
  const group = proOf(id);
  const idxInGroup = order.map((mid, i) => ({ mid, i })).filter((x) => proOf(x.mid) === group);
  const pos = idxInGroup.findIndex((x) => x.mid === id);
  const swapPos = pos + dir;
  if (pos < 0 || swapPos < 0 || swapPos >= idxInGroup.length) return order;
  const a = idxInGroup[pos].i;
  const b = idxInGroup[swapPos].i;
  const next = order.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
