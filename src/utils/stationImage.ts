import type { ImageSourcePropType } from 'react-native';

/**
 * A station's picture, in the shape React Native's own `Image` will accept.
 *
 * THE TRAP, and it cost the home shelf its artwork (owner, 13.08: "the
 * backgrounds don't come up on the cards for my stations"). A station's `image`
 * is one of two quite different things:
 *
 *   • a BUILT-IN station's is a bundled asset — a NUMBER, from require()
 *   • a CUSTOM station's is a file on the phone — a STRING path
 *
 * React Native's `Image` and `ImageBackground` take the number happily and
 * silently draw NOTHING for the string: a file path has to be wrapped as
 * `{ uri }`. So every custom station rendered as an empty dark square, while
 * the ten built-ins were fine — and the truthiness check in front of it
 * (`station.image ? <Image/> : <Gradient/>`) made it worse, because the string
 * is truthy, so the gradient fallback never ran either.
 *
 * expo-image accepts both forms, which is why the full-screen backdrop and the
 * hero never showed this: they use it. Anything still on RN's `Image` must come
 * through here.
 */
export function stationImageSource(image: unknown): ImageSourcePropType | null {
  if (typeof image === 'number') return image;
  if (typeof image === 'string' && image.length > 0) return { uri: image };
  return null;
}
