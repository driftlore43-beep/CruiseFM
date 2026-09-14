import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/**
 * WHERE A DECK GETS ITS SIZE FROM.
 *
 * Every fullscreen mode presents inside its own `Modal`, i.e. its own iOS
 * window, and every one of them decided portrait-vs-landscape from
 * `useWindowDimensions()`. That reads the ROOT window's size, published by
 * React Native from the root view controller — and on an iPad the owner
 * caught it plainly wrong (2026-09-14): a landscape screen drawing the
 * portrait layout with the scene cut off at 768pt, and a portrait screen
 * drawing the docked landscape deck. Her own words, "it seems to not be
 * permanent", are the tell: a value that arrives late rather than one that
 * is wrong for ever.
 *
 * THE HONEST SOURCE IS THE VIEW'S OWN LAYOUT. `onLayout` fires from the
 * real layout pass of the very view being drawn into, so it cannot be a
 * frame behind the thing it describes, and it cannot be about some other
 * window. `useDeckMeasure()` is that measurement; the window is used only
 * for the first frame, before any layout has happened.
 *
 * AND THE MEASUREMENT IS SHARED DOWNWARD, because the mode is not the only
 * thing that asked the window: AmbientGlow sizes its haze from it (a haze
 * built for a portrait screen is exactly the seam she photographed),
 * ModeActionRow decides whether to show the share pill by it, and
 * LandscapeChrome caps its own column by it. `useDeckSize()` reads the
 * provider when it is inside a deck and falls back to the window
 * everywhere else, so a component used on a normal page is unchanged.
 */

export type DeckSize = { width: number; height: number };

const DeckSizeContext = createContext<DeckSize | null>(null);

export const DeckSizeProvider = DeckSizeContext.Provider;

/**
 * The size of the surface this component is drawn on: the deck's own
 * measured box inside a mode, the window anywhere else.
 */
export function useDeckSize(): DeckSize {
  const win = useWindowDimensions();
  const ctx = useContext(DeckSizeContext);
  return ctx ?? { width: win.width, height: win.height };
}

/**
 * For a mode's root view. Spread `onLayout` onto it and hand `size` to a
 * `DeckSizeProvider` wrapping the whole tree.
 *
 * The comparison is deliberately loose (a whole point): iPad reports
 * fractional heights while a keyboard or a status bar settles, and
 * re-rendering a 3000-path scene because a box moved a quarter of a point
 * is exactly the kind of per-frame work this app keeps deleting.
 */
export function useDeckMeasure() {
  const win = useWindowDimensions();
  const [box, setBox] = useState<DeckSize | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 1 || height < 1) return;
    setBox((prev) => (
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    ));
  }, []);

  const width = box?.width ?? win.width;
  const height = box?.height ?? win.height;
  const size = useMemo(() => ({ width, height }), [width, height]);

  return { size, winW: width, winH: height, isLandscape: width > height, onLayout };
}
