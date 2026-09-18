# Preview and edit the ink chest

## Preview in the website

From the repository root, run:

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/web dev
```

Open [the animation preview](http://127.0.0.1:5173/reveal-preview.html). Choose **Wish granted**, **A nice surprise**, or **Not this time** to play or replay that reaction. The preview does not require Surfpool or award prizes.

To preview the real reveal flow, follow the playground setup in the repository README. Choose **Make a wish** before revealing an allocated prize. A match plays the big celebration. A miss plays the disappointed reaction. An empty wish plays the normal celebration. Wishes last until the tab reloads and never change the allocation or its odds.

## Edit and rebuild

Use Node 24 or later and Rive CLI 1.0.4. Install the workspace dependencies and Playwright's Chromium with `pnpm --dir apps/web exec playwright install chromium`. No Rive login or script signing is required.

1. Edit the native paths and paints in `scene.rml` outside the generated markers.
2. Edit the motion curves, brass details, or star trajectories in `generate.ts`.
3. Rebuild the website assets from the repository root:

   ```sh
   node assets/lootbox-reveals/rive/ink-chest/build.ts
   rive inspect assets/lootbox-reveals/rive/ink-chest --summary
   ```

The build replaces only the marked RML sections, compiles `ink-chest.riv`, and renders four transparent PNG stills into `apps/web/public/animations/ink-chest`. The still exporter uses the same browser Rive runtime as the website, without a dev server or external network. Commit the source and these outputs together. Website builds use the checked-in outputs without requiring the Rive CLI.

To inspect the big celebration in the native viewer, run:

```sh
rive assets/lootbox-reveals/rive/ink-chest --data=outcome=0
```

Use `outcome=1` for the normal celebration, `outcome=2` for the disappointed reaction, or `outcome=-1` for the closed chest. Restart the viewer to replay.

To render a promotional still at the star burst, run:

```sh
rive assets/lootbox-reveals/rive/ink-chest --screenshot=/tmp/ink-chest-promo.png --data=outcome=0 --advance=2.4s --viewport=1920x1920 --fit=contain
```

CLI screenshots include the viewer's opaque gray background. For transparent compositing, use the `.riv` file or the generated PNG stills instead.

## Verify changes

Run `pnpm --dir apps/web build` for the production bundle. After building the playground programs, run `devenv shell test:web` for the unit and desktop/mobile browser suites.

The browser tests exercise the native Rive file, all three reactions, replay, interruption, skipping, reduced motion, download failure, transparent canvas and PNG backgrounds, and the real prize claim flow. Claiming never waits for the illustration.

## Asset provenance

The chest, stars, gem, and token are original native vector paths and keyframes authored for this repository. The Rive file contains no downloaded game artwork, fonts, scripts, or external images. These source and generated assets follow the repository's Apache-2.0 license. Keep the repository license and the Rive runtime's bundled notices with distributions.

The artboard is 640 × 640 with a transparent background. Each reaction lasts five seconds. The big celebration uses 48 secondary stars. The website self-hosts the Rive file and WASM, loads the runtime on demand, and shows a matching transparent PNG for reduced motion or failed playback.

The Blender scenes, generation scripts, and rendered videos remain separate in the original checkout under `assets/lootbox-reveals/blender` and `assets/lootbox-reveals/build/cartoon-chest`. The Rive build does not read, replace, or remove them.
