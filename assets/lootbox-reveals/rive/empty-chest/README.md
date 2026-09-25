# Empty Chest collectibles

An empty Unlisted box is empty, but not nothing. Each of the 13 empty copies is backed by one compressed NFT from this series: a closed chest that wobbles, cracks its lid, and lets one absurd, worthless, charming thing peek out.

| `variant` | Contents                         |
| --------- | -------------------------------- |
| 0         | A Moth                           |
| 1         | One Odd Sock                     |
| 2         | An IOU for 0 Shares              |
| 3         | A Cobweb, Tenant Included        |
| 4         | A Dust Bunny                     |
| 5         | A Rubber Duck                    |
| 6         | A Sold Out Tag                   |
| 7         | A Lost Button                    |
| 8         | A Paper Crown                    |
| 9         | A Snail                          |
| 10        | A Crumpled Receipt               |
| 11        | The Ghost of a Share Certificate |
| 12        | An Echo                          |

Names and one-line descriptions live in `apps/web/src/launch/emptyChests.ts`, the single source for the metadata, the website, and the mint script. The collectible name is `Empty Chest #<variant + 1> — <Contents>`.

## Runtime contract

- Artboard `Empty chest`, 640 × 640, transparent. Default state machine `Empty chest`.
- View model `Empty chest`:
  - `variant` (number, default `-1`): picks the thing. The chest stays closed and still until it is `0`–`12`. Changing it later swaps the thing at the next loop.
  - `reveal` (trigger): a one-shot 2.8 s open. The lid pops, the thing performs, the lid clunks shut, and both layers return to the idle loop in step.
- Layer `Chest`: `Closed` → `Chest idle` (4 s loop: wobble, lid lifts a crack, lid clunks shut, dust puffs) and `Chest reveal`.
- Layer `Thing`: `No thing` → `Thing N idle` (4 s loop, synchronized with the chest) and `Thing N reveal`.

The file carries no Luau scripts, fonts, or images, so it needs no `--publish` signing for the web runtime. Lettering (IOU, SOLD OUT, TOTAL, HELLO?) is a tiny stroke font drawn with native paths in `generate.ts`.

## Edit and rebuild

Use Node 24 or later, Rive CLI 1.1 or later, and Playwright's Chromium (`pnpm --dir apps/web exec playwright install chromium`).

1. Edit the chest silhouette, lid, or lock in `scene.rml` outside the generated markers.
2. Edit the things, their motion, the dust, or the state machine in `generate.ts`.
3. Rebuild from the repository root:

   ```sh
   node assets/lootbox-reveals/rive/empty-chest/build.ts
   rive inspect assets/lootbox-reveals/rive/empty-chest --summary
   ```

The build regenerates the marked RML sections, verifies and compiles `empty_chest.riv`, and writes into `apps/web/public/nft/empty-chest/`:

- `empty-chest.riv`, the runtime file for the website and `play.html`;
- `<variant>.png`, a 1024² ivory poster at the idle loop's peek pose, rendered by `apps/web/tools/render-empty-chest-posters.ts` in the same browser runtime as the website;
- `<variant>.json`, the Metaplex metadata the minted leaves point at.

`play.html` is hand-written and needs no build step. Commit the source and outputs together. Minted leaves are immutable, so once a series is minted never move or rename the hosted JSON, PNG, or player.

## Preview

```sh
rive assets/lootbox-reveals/rive/empty-chest --data=variant=4
rive assets/lootbox-reveals/rive/empty-chest --screenshot=/tmp/peek.png --data=variant=5 --advance=1.9s
rive assets/lootbox-reveals/rive/empty-chest --screenshot=/tmp/reveal.png --data=variant=10 --data=reveal=1 --advance=1s
```

CLI screenshots use the viewer's gray background; the posters and web runtime draw on ivory.

## Asset provenance

The chest body, lid, and lock reuse this repository's original ink-chest paths. Every thing, the dust, and the lettering are original native vector paths and keyframes authored for this repository under its Apache-2.0 license.
