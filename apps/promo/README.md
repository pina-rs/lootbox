# lootbox.pina.rs promo videos

Motion design for lootbox.pina.rs, made with [Remotion](https://www.remotion.dev/) from the site's own pieces. The chest is `@pina-rs/lootbox-brand`, moving with the same motion functions the site plays, and the odds strip, curve chart, steppers, and action cards come from `@pina-rs/lootbox-ui`. The pages use the platform's real stylesheet. When the product's look changes, the videos change with it: re-render.

Every sound is original. The music and effects are synthesised by `audio/render.ts`, so nothing here can be claimed on X or YouTube.

## Videos

| Id                                                   | Shape      | Length  | What                                                                                           |
| ---------------------------------------------------- | ---------- | ------- | ---------------------------------------------------------------------------------------------- |
| `chest-reel`                                         | 16:9       | 10 s    | Reference: the chest's whole performance on the site, one column per reaction.                 |
| `sting-wide`, `sting-square`                         | 16:9, 1:1  | 5 s     | The logo: the chest drops in, pops, the letters rain down, and the chest and word trade looks. |
| `fill-it-wide`                                       | 16:9       | 24 s    | The creator's side: the real wizard, prizes, collectibles, the lock.                           |
| `open-it-tall`                                       | 9:16       | 15 s    | The holder's side on a phone: a box arrives, hold to open, the jackpot, claim.                 |
| `hand-it-out-wide`                                   | 16:9       | 34 s    | Airdrop to a list, then a box curve selling out.                                               |
| `tour-wide`                                          | 16:9       | 70 s    | **Alternative A.** Calm, complete product tour over the lo-fi bed.                             |
| `story-square`                                       | 1:1        | 27 s    | **Alternative B.** The chest tells its own story in speech bubbles.                            |
| `hype-tall`                                          | 9:16       | 15 s    | **Alternative C.** Word slams on the beat, then fast cuts.                                     |
| `creator-a-tall`, `creator-b-wide`, `creator-c-tall` | 9:16, 16:9 | 15–56 s | Edit templates for your own recording of scripts A, B, and C in `talk/SCRIPTS.md`.             |
| `x-avatar`, `x-banner`, `share-card`                 | stills     |         | Profile picture, profile banner, and link preview.                                             |

## Render

```sh
pnpm --dir apps/promo render                       # everything into out/
pnpm --dir apps/promo render hype-tall sting-wide  # just these
pnpm --dir apps/promo render --stills fill-it-wide 30,120,240   # frames for review
pnpm --dir apps/promo studio                       # scrub and tweak in the browser
```

Renders need Chrome Headless Shell. Install Playwright's (`pnpm --dir apps/platform exec playwright install chromium`) and the script finds it, or set `REMOTION_BROWSER` to a binary.

`webpack-override.ts` makes Remotion compile JSX with React's automatic runtime. Remotion reads that setting from tsconfig through an API that TypeScript 7 removed.

## Your own recording

1. Record one of the scripts in `talk/SCRIPTS.md`, following the tips at the end.
2. Put the file in `public/footage/`. The folder is gitignored, so your footage stays on your machine.
3. Render the matching template with your file:

   ```sh
   pnpm --dir apps/promo exec remotion render src/index.ts creator-b-wide out/mine.mp4 \
     --props='{"script":"B","footage":"take-1.mp4","name":"Ifiok Jr."}'
   ```

4. Retime the captions and inserts in `src/data/scripts.ts` to your take. The cues are seconds from your first word.

Without footage, a talking chest stands in, so the edit can be previewed before you record.

## Music and sound

```sh
pnpm --dir apps/promo audio    # regenerate everything, then publish into public/audio
```

| Track          | Feel                                     | Used by                              |
| -------------- | ---------------------------------------- | ------------------------------------ |
| `treasure-hop` | The bouncy brand theme, 116 BPM          | `story-square`; cuts `-30` and `-15` |
| `vault-lofi`   | A lo-fi bed that leaves room for a voice | `tour-wide`, the creator templates   |
| `big-reveal`   | A build, an impact, and a drop, 124 BPM  | `hand-it-out-wide`, `hype-tall`      |
| `logo-sting`   | Four seconds: sparkle, thunk, bloom      | the stings                           |

Each track ships with a cue sheet (`public/audio/music/*.json`) listing every bar, so cuts land on the downbeat. See `audio/README.md` for how the synthesis and mastering work.
