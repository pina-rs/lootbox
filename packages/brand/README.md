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

## Files

`pnpm export` writes SVG lockups to `assets/logo`, app icons to `assets/icons`, and the favicon and touch icon to `apps/platform/public`. The tests fail when a committed SVG no longer matches its component, so run the export after any design change.

| File                                             | For                                      |
| ------------------------------------------------ | ---------------------------------------- |
| `logo/lockup-horizontal.svg`                     | Default logo on light grounds            |
| `logo/lockup-horizontal-reverse.svg`             | On ink, deep teal, or photos             |
| `logo/lockup-stacked.svg`                        | Square spaces: avatars, stickers, splash |
| `logo/mark.svg`, `logo/mark-compact.svg`         | The chest alone                          |
| `logo/wordmark.svg`, `logo/wordmark-reverse.svg` | The word alone                           |
| `logo/favicon.svg`                               | Browser tabs; redrawn on a 32 px grid    |
| `icons/*.png`                                    | App stores, PWA manifests, touch icons   |

## Rules of thumb

- Use `full` from 64 px, `compact` from 24 px, and the favicon below that.
- Keep clear space of at least the lid's height around a lockup.
- Never recolour the chest. On dark grounds, switch the word to ivory with `tone="dark"` and leave the chest as it is.
- Keep the eyes. They're what makes the chest a character rather than clip art.

The wordmark outlines come from Bungee by David Jonathan Ross, licensed under the SIL Open Font License 1.1.
