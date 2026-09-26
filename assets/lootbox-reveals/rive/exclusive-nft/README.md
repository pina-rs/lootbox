# Exclusive NFT reveal

The animated companion to the Exclusive Lootbox NFT posters. One Rive file plays every trait vector: seven independent layers idle in a loop, and the `reveal` trigger pops the chest with a celebration that escalates with the finish.

All artwork and idle motion come from `@pina-rs/exclusive-nft-art` (`packages/exclusive-nft-art/src/art/`), the same vector model and motions that render the still and animated SVGs. `generate.ts` adds ids, bindings, finish poses, the reveal, and the state machine; `rml.ts` turns the model into RML.

## Runtime contract

- Artboard `Exclusive NFT`, 1024 × 1024, full bleed. Default state machine `Exclusive NFT`.
- View model `Exclusive NFT`, one number per layer and a trigger:

| Property     | Range   | Default | Drives                                                   |
| ------------ | ------- | ------- | -------------------------------------------------------- |
| `background` | 0–14    | 0       | the backdrop                                             |
| `finish`     | 0–15    | 0       | the chest's colors, glow, foil, and drama                |
| `pattern`    | 0–7     | 0       | the engraving                                            |
| `lock`       | 0–9     | 0       | the lock                                                 |
| `decoration` | 0–11    | 0       | the decoration                                           |
| `contents`   | 0–19    | -1      | the thing inside; the chest stays closed until it is set |
| `effect`     | 0–13    | 0       | the animated effect layer                                |
| `reveal`     | trigger |         | a 3.2 s one-shot open, then the idle pose                |

Values can change at any time and land on the next frame. The plaque and serial are not in the animation; `play.html` overlays the still poster's plaque.

## How it is built

- **Layers and z-order.** Each layer's traits are drawn in index order inside that layer's slot of the chest, back to front: background, finish glow, effect (behind), chest (feet, lid with pattern and decoration, contents, body with pattern, foil, and decoration, lock), effect (in front).
- **Visibility by data binding.** Every trait group binds its opacity to its layer's number through a formula converter that is 1 for that trait and 0 otherwise. Identical formulas are shared, so a trait's body and lid parts, and equal indices across layers, reuse one converter.
- **Render rules.** `packages/exclusive-nft-art/src/rules.ts` compiles into the same converters: a hide rule multiplies the trait's visibility by `1 − active`, and an offset rule binds the lock's offset node. They never affect odds.
- **Finish poses.** A `Finish` state machine layer recolors every slotted paint and sets the material glow and foil, one pose per finish.
- **Ambient loops.** Every model motion becomes an inner `Motion` node keyed in a looping animation; motions of equal duration share one animation on its own layer (`Ambient 0.5s` … `Ambient 8s`).
- **Reveal drama.** The `Drama` layer picks a stage by finish range; each stage includes the ones below:

| Finishes | Stage         | What happens                                        |
| -------- | ------------- | --------------------------------------------------- |
| 0–2      | `dust`        | Dust puffs out as the lid pops.                     |
| 3–8      | `glints`      | A fan of star glints winks around the lid.          |
| 9–10     | `goldBurst`   | Gold rays burst behind the chest with a shockwave.  |
| 11–12    | `holoShimmer` | A rainbow band sweeps across the whole scene.       |
| 13–15    | `cosmic`      | A starlight flash and particles spiralling outward. |

Keyed groups that scale or rotate sit at their pivot, so the burst fan and the corona turn about the aura centre.

## Edit and rebuild

Edit art or motion in `packages/exclusive-nft-art/src/`, and states or the reveal in `generate.ts`, then from the repository root:

```sh
pnpm --dir packages/exclusive-nft-art build:rive
rive assets/lootbox-reveals/rive/exclusive-nft --verify
rive inspect assets/lootbox-reveals/rive/exclusive-nft --summary
```

`build.ts` regenerates `scene.rml`, verifies and compiles it, fails if the `.riv` reaches 250 KB, and writes `exclusive-nft.riv` and `play.html` into `packages/exclusive-nft-art/assets/`. Never edit `scene.rml` by hand. The file carries no scripts, fonts, or images, so the web runtime needs no `--publish` signing.

## Preview

```sh
rive assets/lootbox-reveals/rive/exclusive-nft --data=contents=5 --data=effect=3 --data=decoration=6
rive assets/lootbox-reveals/rive/exclusive-nft --screenshot=/tmp/top.png \
  --data=background=14 --data=finish=15 --data=pattern=5 --data=lock=8 \
  --data=decoration=11 --data=contents=15 --data=effect=13 \
  --advance=0.1s --data=reveal=1 --advance=1s
```

## Asset provenance

The chest silhouette and the first thirteen contents reuse this repository's Empty Chest paths. Every other shape, pattern, backdrop, lock, decoration, effect, and keyframe is original native vector work authored for this repository under its Apache-2.0 license.
