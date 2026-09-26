# Exclusive NFT reveal

The animated companion to the Exclusive Lootbox NFT posters. One Rive file plays every combination of tier, contents, background, and pattern: the chest wobbles, the lid pops, the thing inside leaps out, and the celebration escalates with the tier.

All artwork comes from `@pina-rs/exclusive-nft-art` (`packages/exclusive-nft-art/src/art/`), the same vector model that renders the SVG posters. `generate.ts` only adds ids, per-tier color keys, visibility poses, motion, and the state machine, so the still and the animation cannot drift apart.

## Runtime contract

- Artboard `Exclusive NFT`, 1024 × 1024, full-bleed background. Default state machine `Exclusive NFT`.
- View model `Exclusive NFT`:
  - `tier` (number, default `0`): the chest finish and effects, 0–15.
  - `contents` (number, default `-1`): the thing inside, 0–19. The chest stays closed until it is set.
  - `background` (number, default `0`): the backdrop, 0–11.
  - `pattern` (number, default `0`): the engraving, 0–7.
  - `reveal` (trigger): a 3.2 s one-shot open, then the idle loop.
- Every number can change at any time; each selector layer returns through its rest pose, so the new value lands on the next frame.

The tier plaque and serial are not in the animation; hosts overlay them or show the SVG poster alongside.

## Layers

| Layer        | States                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Chest`      | `Closed` → `Idle` (4 s breathing loop) once `contents ≥ 0`; any state → `Reveal` on `reveal`, then back to `Idle`.   |
| `Tier`       | One pose per tier: 95 finish paints recolored plus halo, rays, foil, cosmic rings, and sparkle visibility.           |
| `Background` | One pose per backdrop.                                                                                               |
| `Pattern`    | One pose per engraving (body and lid).                                                                               |
| `Contents`   | One pose per contents item; `No contents` hides them all.                                                            |
| `Ambient`    | 8 s loop: rays turn one ray-width (seamless), sparkles twinkle out of phase, foil sheen drifts, the corona breathes. |
| `Drama`      | On `reveal`, one stage chosen by tier range from the tier table.                                                     |

Reveal drama escalates, and each stage includes everything below it:

| Tiers | Stage         | What happens                                        |
| ----- | ------------- | --------------------------------------------------- |
| 0–2   | `dust`        | Dust puffs out as the lid pops.                     |
| 3–8   | `glints`      | A fan of star glints winks around the lid.          |
| 9–10  | `goldBurst`   | Gold rays burst behind the chest with a shockwave.  |
| 11–12 | `holoShimmer` | A rainbow foil band sweeps across the whole scene.  |
| 13–15 | `cosmic`      | A starlight flash and particles spiralling outward. |

## Edit and rebuild

Edit art in `packages/exclusive-nft-art/src/art/` and motion or states in `generate.ts`, then from the repository root:

```sh
pnpm --dir packages/exclusive-nft-art build:rive
rive assets/lootbox-reveals/rive/exclusive-nft --verify
rive inspect assets/lootbox-reveals/rive/exclusive-nft --summary
```

`build.ts` regenerates `scene.rml`, verifies and compiles it, fails if the `.riv` reaches 250 KB, and copies it to `packages/exclusive-nft-art/assets/exclusive-nft.riv`. Never edit `scene.rml` by hand. The file carries no scripts, fonts, or images, so the web runtime needs no `--publish` signing.

## Preview

```sh
rive assets/lootbox-reveals/rive/exclusive-nft --data=tier=12 --data=contents=5 --data=background=5
rive assets/lootbox-reveals/rive/exclusive-nft --screenshot=/tmp/top.png \
  --data=tier=15 --data=contents=16 --data=background=5 --data=pattern=7 \
  --advance=0.1s --data=reveal=1 --advance=1s
```

## Asset provenance

The chest silhouette reuses this repository's Empty Chest paths. Every other shape, pattern, backdrop, effect, and keyframe is original native vector work authored for this repository under its Apache-2.0 license.
