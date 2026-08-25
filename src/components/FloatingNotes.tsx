import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAppActive } from '@/utils/useAppActive';
import { useMotion } from '@/context/MotionContext';

/**
 * Floating music notes that drift up and away from a mode's visual while
 * music plays. Shared by every mode — each passes its own accent colour so
 * the notes match the station's mood. Originally lived inside VinylMode.
 *
 * Mount it absolutely over the visual it should emit from; it measures
 * itself, so no explicit sizes are needed:
 *   - `ring` emitter: notes appear around a circle (vinyl disc, orb).
 *   - `band` emitter: notes appear across the width (bars, dials, grids).
 *
 * EVERY NOTE ANIMATES ITSELF, ON THE NATIVE DRIVER. This used to be one rAF
 * clock calling setState every 40ms — 25 React re-renders a second, for the
 * whole time music played, in SIX of the eight modes. That is the same
 * architecture that made Horizon "slow down the entire app" (04.08): the work
 * lands on the JS thread, and a busy JS thread delays every tap and every
 * JS-driven animation everywhere, not just here. It was paying an app-wide
 * performance tax for a decorative touch.
 *
 * Now React only re-renders when a note is BORN or DIES — roughly twice a
 * second at the default spawn rate, and the motion in between is entirely
 * native. The spawner is a plain interval rather than rAF, so it must be
 * AppState-gated (the 27.07 SIGKILL rule); rAF stopped itself in the
 * background, an interval would not.
 */

type NoteItem = {
  id: number; x: number; y: number; icon: string;
  size: number; driftX: number; rise: number; dur: number; bwd: boolean;
};
const NOTE_ICONS = ['music-note-eighth', 'music-note-quarter', 'music-note-sixteenth', 'music'];
let _noteId = 0;

/** One note, from birth to fade. Mounts, animates itself, asks to be removed. */
const Note = memo(function Note({
  note, color, onDone,
}: { note: NoteItem; color: string; onDone: (id: number) => void }) {
  // A single 0→1 value carries the whole life, eased exactly as the old
  // hand-rolled curve was (ease-out quad), so the motion is unchanged.
  const e = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(e, {
      toValue: 1,
      duration: note.dur,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => { if (finished) onDone(note.id); });
    return () => anim.stop();
  }, [e, note.dur, note.id, onDone]);

  return (
    <Animated.View
      style={{
        position: 'absolute', left: note.x, top: note.y,
        opacity: e.interpolate({
          // Same piecewise fade as before: a quick lift in, a long hold, a
          // fade out over the last fifth.
          inputRange: [0, 0.08, 0.8, 1],
          outputRange: [0, 0.9, 0.6, 0],
        }),
        transform: [
          { translateX: e.interpolate({ inputRange: [0, 1], outputRange: [0, note.driftX] }) },
          { translateY: e.interpolate({ inputRange: [0, 1], outputRange: [0, note.rise] }) },
          { scale: e.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + (note.bwd ? 0.4 : -0.6)] }) },
        ],
      }}>
      <MaterialCommunityIcons name={note.icon as never} size={note.size} color={color} />
    </Animated.View>
  );
});

export function FloatingNotes({
  playing,
  color,
  emitter = 'band',
  ringRadius,
  spawnMs = 550,
  sizeRange = [16, 28],
  rise = 140,
  scrubbing = false,
  scrubDir = null,
}: {
  playing: boolean;
  color: string;
  emitter?: 'ring' | 'band';
  /** ring emitter: circle radius; defaults to just inside the measured box */
  ringRadius?: number;
  /** ms between notes */
  spawnMs?: number;
  sizeRange?: [number, number];
  /** how far notes travel upward, px */
  rise?: number;
  /** vinyl-only: scrubbing changes tempo and direction */
  scrubbing?: boolean;
  scrubDir?: 'fwd' | 'bwd' | null;
}) {
  const box = useRef({ w: 0, h: 0 });
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const appActive = useAppActive();
  // ATMOSPHERE OFF MEANS OFF. Drifting notes are the room, not the mode, and
  // until 25.08 they ignored the setting entirely — only AmbientGlow read it,
  // so "off = clean scene" was true of the haze and of nothing else (owner,
  // with a recording: "some atmospheric pulse happens even when the atmosphere
  // button is off"). Gated HERE rather than at six call sites, the same way
  // AmbientGlow does it, so a seventh mode cannot forget.
  const { atmosphere } = useMotion();

  const drop = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!playing || !appActive || !atmosphere) { setNotes([]); return; }

    const spawn = () => {
      const { w, h } = box.current;
      if (!w || !h) return;
      const bwd = scrubbing && scrubDir === 'bwd';
      let x: number; let y: number;
      if (emitter === 'ring') {
        const r = ringRadius ?? Math.min(w, h) * 0.42;
        const angle = Math.random() * Math.PI * 2;
        x = w / 2 + Math.cos(angle) * r;
        y = h / 2 + Math.sin(angle) * r;
      } else {
        x = w * (0.08 + Math.random() * 0.84);
        y = h * (0.2 + Math.random() * 0.4);
      }
      setNotes((prev) => [...prev, {
        id: _noteId++, x, y,
        icon: NOTE_ICONS[Math.floor(Math.random() * NOTE_ICONS.length)],
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        driftX: bwd ? (-10 + Math.random() * 20) * -1 : -30 + Math.random() * 60,
        rise: bwd ? 60 : (scrubbing ? -rise - 40 : -rise),
        dur: bwd ? 1400 : 2000,
        bwd,
      }]);
    };

    const every = scrubbing && scrubDir === 'fwd' ? 300 : spawnMs;
    spawn();
    const id = setInterval(spawn, every);
    return () => clearInterval(id);
    // sizeRange and rise are read inside spawn; they are literals at every
    // call site, so they are deliberately not dependencies — including the
    // array would restart the spawner on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, appActive, atmosphere, scrubbing, scrubDir, emitter, ringRadius, spawnMs]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => { box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}>
      {notes.map((note) => (
        <Note key={note.id} note={note} color={color} onDone={drop} />
      ))}
    </View>
  );
}
