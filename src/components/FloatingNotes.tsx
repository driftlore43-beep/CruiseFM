import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Floating music notes that drift up and away from a mode's visual while
 * music plays. Shared by every mode — each passes its own accent colour so
 * the notes match the station's mood. Originally lived inside VinylMode.
 *
 * Driven by a single rAF clock (the modes' own pattern — RN Animated stalls
 * on web). Mount it absolutely over the visual it should emit from; it
 * measures itself, so no explicit sizes are needed:
 *   - `ring` emitter: notes appear around a circle (vinyl disc, orb).
 *   - `band` emitter: notes appear across the width (bars, dials, grids).
 */

type NoteItem = {
  id: number; x: number; y: number; icon: string;
  size: number; driftX: number; birth: number; dur: number; bwd: boolean;
};
const NOTE_ICONS = ['music-note-eighth', 'music-note-quarter', 'music-note-sixteenth', 'music'];
let _noteId = 0;

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
  const notesRef = useRef<NoteItem[]>([]);
  const box = useRef({ w: 0, h: 0 });
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!playing) { notesRef.current = []; setTick((t) => t + 1); return; }
    let raf = 0;
    let last = 0;
    let lastSpawn = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 33) {
        last = now;
        const interval = scrubbing && scrubDir === 'fwd' ? 300 : spawnMs;
        const { w, h } = box.current;
        if (w && h && now - lastSpawn >= interval) {
          lastSpawn = now;
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
          notesRef.current.push({
            id: _noteId++, x, y,
            icon: NOTE_ICONS[Math.floor(Math.random() * NOTE_ICONS.length)],
            size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
            driftX: bwd ? (-10 + Math.random() * 20) * -1 : -30 + Math.random() * 60,
            birth: now,
            dur: bwd ? 1400 : 2000,
            bwd,
          });
        }
        notesRef.current = notesRef.current.filter((n) => now - n.birth < n.dur);
        setTick((t) => t + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scrubbing, scrubDir, emitter, ringRadius, spawnMs]);

  const now = Date.now();

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => { box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}>
      {notesRef.current.map((note) => {
        const p = Math.min(1, (now - note.birth) / note.dur);
        const e = 1 - (1 - p) * (1 - p); // ease-out quad, like the original timing curve
        const tyEnd = note.bwd ? 60 : (scrubbing ? -rise - 40 : -rise);
        const opacity = e < 0.08 ? (e / 0.08) * 0.9
          : e < 0.8 ? 0.9 - ((e - 0.08) / 0.72) * 0.3
          : 0.6 - ((e - 0.8) / 0.2) * 0.6;
        const scale = 1 + (note.bwd ? 0.4 : -0.6) * e;
        return (
          <View key={note.id} style={{
            position: 'absolute', left: note.x, top: note.y,
            transform: [{ translateX: note.driftX * e }, { translateY: tyEnd * e }, { scale }],
            opacity,
          }}>
            <MaterialCommunityIcons name={note.icon as any} size={note.size} color={color} />
          </View>
        );
      })}
    </View>
  );
}
