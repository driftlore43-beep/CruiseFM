import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clampCrop, coverScale, cropFromScroll, type ChosenPhoto, type CropRect,
} from '@/utils/stationPhoto';

/**
 * Frame your photo against the shape it will actually be seen at.
 *
 * WHY THIS EXISTS: a station photo is used at three quite different shapes —
 * full-screen and very tall behind a drive, a wide banner on the station page,
 * a short strip on the list row — and one crop cannot flatter all three. So it
 * is framed for the BACKDROP, because that is the one you look at for the whole
 * session; the card and the hero are glimpses, and they centre-crop from what
 * you chose. iOS's own editor was never an option: it forces a square and
 * ignores the aspect you ask for (see choosePhoto).
 *
 * The frame therefore matches the SCREEN's aspect, which is why it comes out
 * tall and narrow — it is a little picture of the phone.
 *
 * IT IS A SCROLL VIEW, NOT A GESTURE, and that is the whole design decision.
 * The first build hand-rolled pan and pinch with PanResponder, as the modes do.
 * Measured in the browser, it received GRANT, exactly ONE move, then TERMINATE:
 * something in the tree took the gesture away after a single frame, and
 * `onPanResponderTerminationRequest: () => false` does not stop a native view
 * doing that. (The create sheet's ScrollView was the obvious suspect and was
 * ruled out — this sheet is mounted after it closes, so it was never an
 * ancestor.) Rather than keep guessing at which view, and ship a gesture that
 * cannot be verified without a device, the cropper is now built the way iOS
 * builds its own: a scroll view clipped to the frame, panned and pinched by the
 * platform. There is no gesture code left for anything to fight over.
 *
 * PINCH-ZOOM IS iOS-ONLY in React Native's ScrollView (zoomScale has no Android
 * implementation). Android still pans, and Android is not shipping yet; if it
 * does, this is the place that needs a second look.
 */

type Props = {
  photo: ChosenPhoto | null;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
};

export function PhotoFrameSheet({ photo, onCancel, onConfirm }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The frame is the shape of the screen, because that is where the photo ends
  // up. Sized off height so it stays a phone shape rather than a letterbox.
  const frameH = Math.min(winH * 0.52, 440);
  const frameW = Math.min(winW - 72, frameH * (winW / winH));

  const img = photo ?? { uri: '', width: 1, height: 1 };
  // Lay the photo out at cover size: it fills the frame in one axis and
  // overflows in the other, and that overflow is exactly what you scroll.
  const base = useMemo(
    () => coverScale(img.width, img.height, frameW, frameH),
    [img.width, img.height, frameW, frameH],
  );
  const contentW = img.width * base;
  const contentH = img.height * base;

  // Live scroll position. Refs, not state — reading them on confirm costs
  // nothing, and re-rendering on every scroll frame would cost a great deal.
  // SEEDED with the same centred position the scroll view is given below.
  // onScroll only fires once something moves, so without this, framing a photo
  // and pressing Use straight away would crop the top-left corner rather than
  // the middle they were looking at.
  const zoom = useRef(1);
  const off = useRef({ x: (contentW - frameW) / 2, y: (contentH - frameH) / 2 });
  useEffect(() => {
    off.current = { x: (contentW - frameW) / 2, y: (contentH - frameH) / 2 };
    zoom.current = 1;
  }, [contentW, contentH, frameW, frameH]);
  const [, force] = useState(0);

  const confirm = () => {
    onConfirm(clampCrop(
      cropFromScroll(off.current.x, off.current.y, zoom.current, base, frameW, frameH),
      img.width, img.height,
    ));
  };

  const canZoom = Platform.OS === 'ios';

  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onCancel}
      supportedOrientations={['portrait']}>
      <View style={[s.root, {
        paddingTop: Math.max(insets.top, 20) + 10,
        paddingBottom: Math.max(insets.bottom, 20) + 10,
      }]}>
        <Text style={s.title}>Frame your photo</Text>
        <Text style={s.sub}>
          {canZoom ? 'Drag to move, pinch to zoom. ' : 'Drag to move. '}
          This is what sits behind your drive.
        </Text>

        <View style={[s.frame, { width: frameW, height: frameH }]}>
          {!!photo && (
            <ScrollView
              key={photo.uri}
              // A cover fit overflows in exactly ONE axis, and that is the one
              // to scroll. RN's ScrollView only scrolls the axis it is told
              // about — a vertical one will not move sideways however wide its
              // content is, which is why the first attempt sat still. (Once
              // zoomed on iOS both axes overflow, and UIScrollView handles the
              // other one itself.)
              horizontal={contentW > frameW + 0.5}
              style={{ width: frameW, height: frameH }}
              contentContainerStyle={{ width: contentW, height: contentH }}
              // Start on the middle of the photo — the best guess available
              // before they touch anything.
              contentOffset={{ x: (contentW - frameW) / 2, y: (contentH - frameH) / 2 }}
              minimumZoomScale={1}
              maximumZoomScale={canZoom ? 6 : 1}
              bouncesZoom={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const n = e.nativeEvent;
                off.current = { x: n.contentOffset.x, y: n.contentOffset.y };
                zoom.current = (n as unknown as { zoomScale?: number }).zoomScale ?? 1;
              }}
              onLayout={() => force((v) => v + 1)}>
              <ExpoImage
                source={{ uri: photo.uri }}
                style={{ width: contentW, height: contentH }}
                contentFit="fill"
                transition={0}
              />
            </ScrollView>
          )}
          {/* A hairline border and the thirds, so it reads as a viewfinder
              rather than as an already-cropped picture. Never over the touch
              surface — pointerEvents none on every one. */}
          <View pointerEvents="none" style={s.rule} />
          <View pointerEvents="none" style={[s.third, { top: frameH / 3 }]} />
          <View pointerEvents="none" style={[s.third, { top: (frameH * 2) / 3 }]} />
          <View pointerEvents="none" style={[s.thirdV, { left: frameW / 3 }]} />
          <View pointerEvents="none" style={[s.thirdV, { left: (frameW * 2) / 3 }]} />
        </View>

        <View style={s.actions}>
          <Pressable style={s.ghost} onPress={onCancel}>
            <Text style={s.ghostText}>Cancel</Text>
          </Pressable>
          <Pressable style={s.primary} onPress={confirm}>
            <Text style={s.primaryText}>Use photo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05050a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13.5, textAlign: 'center',
    paddingHorizontal: 34, lineHeight: 19,
  },
  frame: { overflow: 'hidden', borderRadius: 10, backgroundColor: '#0b0b12' },
  rule: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 2, borderColor: '#fff', borderRadius: 10,
  },
  third: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)',
  },
  thirdV: {
    position: 'absolute', top: 0, bottom: 0,
    width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  ghost: {
    paddingHorizontal: 26, paddingVertical: 14, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)',
  },
  ghostText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '700' },
  primary: { paddingHorizontal: 34, paddingVertical: 14, borderRadius: 999, backgroundColor: '#fff' },
  primaryText: { color: '#0a0a10', fontSize: 15, fontWeight: '800' },
});
