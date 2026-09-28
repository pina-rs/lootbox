# @pina-rs/lootbox-brand

The lootbox logo as React SVG components, plus the palette they share with the site and the promo videos.

The mark is the cartoon chest from the reveal animations, lid lifted, peeking out at you. The wordmark is LOOTBOX drawn from Bungee's outlines, with the two O's of LOOT turned into a pair of eyes. In every lockup the chest and the word look at each other.

## Use

```tsx
import { ChestMark, Logo, Wordmark } from "@pina-rs/lootbox-brand";

<Logo height={48} />                        // horizontal lockup, ink type
<Logo layout="stacked" tone="dark" />       // ivory type for dark grounds
<ChestMark variant="compact" size={32} />   // header and small icons
<Wordmark height={20} title="" />           // decorative next to a named link
```

Every moving part is a prop, so animation tools such as Remotion drive the same drawing frame by frame:

| Prop              | Component               | Range                                                    |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| `open`            | `ChestMark`             | 0 shut (eyes hidden), 1 the logo's peek, up to 2         |
| `look`            | `ChestMark`, `Wordmark` | `{ x, y }` from -1 to 1                                  |
| `blink`           | `ChestMark`, `Wordmark` | 0 open, 1 shut                                           |
| `letterTransform` | `Wordmark`              | an extra SVG transform per letter, for bounces and drops |

The mark exposes `data-part="eye"` and `data-part="lid"` for CSS-only motion, which the site header uses for its blink.

To draw the chest or the word inside your own SVG, place `ChestArt` or `WordmarkArt` in a group with `chestTransform(x, y, size)` or `wordmarkTransform(x, y, height)`. They take the same pose props and draw exactly what `ChestMark` and `Wordmark` draw, without a nested `<svg>`.

## The chest as a character

`ChestFigure` gives the mark a body: squash, tilt, and hops pivot on its feet, and its floor shadow shrinks as it rises. `src/motion.ts` performs it as pure functions of time, each returning a `ChestFrame`:

| Function                   | When                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `idleFrame(t)`             | Waiting to be picked up: breathing, blinking, glancing, a hop now and then |
| `chargeFrame(level, t)`    | Held down: the lid pressed shut and rattling, squashed, squinting          |
| `waitFrame(t)`             | Waiting on the chain: rumbling, lid chattering, eyes darting               |
| `revealFrame(reaction, t)` | The reveal: `big-prize`, `small-prize`, or `disappointed`                  |
| `restFrame(reaction, t)`   | The pose it keeps afterwards, still breathing and blinking                 |
| `nopeFrame(frame, t)`      | A head shake for a hold that cannot open anything                          |

lootbox.so and the Unlisted site play these every animation frame, and the promo videos play them per video frame, so the chest moves the same way everywhere. `mixFrames` blends one phase into the next. The `chest-reel` composition in `apps/promo` shows the whole performance for each reaction.

## Files

Every logo is a vector: an SVG, and a PDF of the same drawing for print shops and tools that prefer PDF. Each SVG is one flat `<svg>` of paths, with no fonts, images, or nested viewports, and its clip and gradient ids carry the file's name so several files can share a document.

`pnpm export` writes the logos to `assets/logo`, app icons to `assets/icons`, and the favicon and touch icon to `apps/platform/public`. The PDFs are printed by headless Chrome, whose PDF backend keeps clips as real clipping paths, so install Playwright's Chromium first: `pnpm --dir apps/platform exec playwright install chromium`. The tests fail when a committed SVG no longer matches its component, so run the export after any design change.

| File                                                         | For                                      |
| ------------------------------------------------------------ | ---------------------------------------- |
| `logo/lockup-horizontal.{svg,pdf}`                           | Default logo on light grounds            |
| `logo/lockup-horizontal-reverse.{svg,pdf}`                   | On ink, deep teal, or photos             |
| `logo/lockup-stacked.{svg,pdf}`                              | Square spaces: avatars, stickers, splash |
| `logo/mark.{svg,pdf}`, `logo/mark-compact.{svg,pdf}`         | The chest alone                          |
| `logo/wordmark.{svg,pdf}`, `logo/wordmark-reverse.{svg,pdf}` | The word alone                           |
| `logo/favicon.svg`                                           | Browser tabs; redrawn on a 32 px grid    |
| `icons/app-icon.svg`                                         | The app icon as a vector                 |
| `icons/*.png`                                                | App stores, PWA manifests, touch icons   |

## Rules of thumb

- Use `full` from 64 px, `compact` from 24 px, and the favicon below that.
- Keep clear space of at least the lid's height around a lockup.
- Never recolour the chest. On dark grounds, switch the word to ivory with `tone="dark"` and leave the chest as it is.
- Keep the eyes. They're what makes the chest a character rather than clip art.

The wordmark outlines come from Bungee by David Jonathan Ross, licensed under the SIL Open Font License 1.1.
