import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';

/**
 * Live loudness of the sound around the phone, as a smoothed 0..1 value —
 * the engine behind music-reactive visuals.
 *
 * How it works: with the mic metering on, expo-audio reports a dBFS level
 * (~-60 quiet … 0 loud) a few times a second. We map that to 0..1 and ease it
 * so bars breathe instead of jitter. The recorder runs in `mixWithOthers`
 * mode, so it listens *alongside* Spotify without interrupting or ducking it —
 * the whole point is to react to the music that's playing.
 *
 * Nothing is ever written to disk or sent anywhere; only the loudness number
 * is read. Safe everywhere: on web, without permission, or on any error it
 * reports `available: false` and the caller keeps its timed animation.
 */

const POLL_MS = 70;
// dBFS window we treat as silence → full. Tightened around where music
// actually sits so the level swings hard between quiet and loud passages.
const DB_FLOOR = -50;
const DB_CEIL = -12;

function normalize(db: number | undefined): number {
  if (db == null || !isFinite(db)) return 0;
  const t = (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
  const c = Math.max(0, Math.min(1, t));
  // Smoothstep expands the contrast: quiet parts drop lower, loud beats
  // punch higher, so the reaction is obvious rather than a gentle hum.
  return c * c * (3 - 2 * c);
}

export function useMicLevel(active: boolean): { level: number; available: boolean } {
  // Hooks must run unconditionally, so the recorder is always created; we just
  // don't start it unless we're active and permitted. Metering must be enabled
  // in the options for the status to carry a level.
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, POLL_MS);

  const [granted, setGranted] = useState(false);
  const [recording, setRecording] = useState(false);
  const smoothed = useRef(0);
  const [level, setLevel] = useState(0);

  const wantOn = active && Platform.OS !== 'web';

  // Resolve permission once we actually want the mic on (lazy — no prompt on
  // launch, only when a reactive visual first needs it).
  useEffect(() => {
    if (!wantOn || granted) return;
    let alive = true;
    (async () => {
      try {
        const existing = await getRecordingPermissionsAsync();
        const ok = existing.granted || (await requestRecordingPermissionsAsync()).granted;
        if (alive && ok) setGranted(true);
      } catch {
        // denied / unavailable — caller falls back
      }
    })();
    return () => { alive = false; };
  }, [wantOn, granted]);

  // Start/stop the recorder to match wantOn + permission.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (wantOn && granted && !recording) {
          await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'mixWithOthers', playsInSilentMode: true });
          await recorder.prepareToRecordAsync();
          recorder.record();
          if (alive) setRecording(true);
        } else if ((!wantOn || !granted) && recording) {
          try { await recorder.stop(); } catch {}
          if (alive) { setRecording(false); smoothed.current = 0; setLevel(0); }
        }
      } catch {
        if (alive) setRecording(false);
      }
    })();
    return () => { alive = false; };
  }, [wantOn, granted, recording]);

  // Stop cleanly on unmount.
  useEffect(() => {
    return () => { try { recorder.stop(); } catch {} };
  }, []);

  // Ease each metering sample toward the target so the visuals glide.
  useEffect(() => {
    if (!recording) return;
    const target = normalize(state.metering);
    // Snappy attack so beats jump, slower release so bars fall between them.
    const k = target > smoothed.current ? 0.8 : 0.3;
    smoothed.current = smoothed.current + (target - smoothed.current) * k;
    setLevel(smoothed.current);
  }, [state.metering, recording]);

  return { level, available: recording };
}
