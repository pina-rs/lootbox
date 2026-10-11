# lootbox.pina.rs promo audio

Original music and sound effects for the lootbox.pina.rs promo videos. The code synthesises every sound from oscillators and seeded noise. There are no samples, soundfonts, loops or downloads. That keeps the audio free of copyright claims on X, and each run produces byte-identical files.

## Regenerate

Requirements: Node 24 or newer (it runs the `.ts` files directly through type stripping), plus `ffmpeg` and `ffprobe` on `PATH`. Nothing needs installing.

```sh
node render.ts                      # everything, into out/ (cleans out/ first)
node render.ts treasure-hop ui-pop  # only these; out/report.md then covers just them
```

A full render takes a few minutes, most of it JS synthesis. The command exits non-zero if any delivery check fails.

Optional type check, which needs `@types/node` somewhere TypeScript can find it: `tsc -p .`

## Output

| Path                          | What                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `out/music/<track>.wav`       | 48 kHz / 24-bit stereo master (-14 LUFS integrated, true peak ≤ -1 dBTP)                                                                                     |
| `out/music/<track>.m4a`       | AAC 192 kb/s copy of the same master (every track except the WAV-only loop)                                                                                  |
| `out/music/<track>.json`      | Cue sheet: BPM, beats per bar, swing, start time of every bar and section, named markers (hits, impact, loop points)                                         |
| `out/sfx/<name>.wav` / `.m4a` | Sound effects with the true peak normalised to -3 dBTP                                                                                                       |
| `out/waveforms/<track>.png`   | `showwavespic` picture of each music track, for checking dynamics at a glance                                                                                |
| `out/report.md`               | Duration, integrated loudness, true peak, sample peak, LRA and DC offset for every file, plus the mastering decisions, bus balance and every pass/fail check |

Cue-sheet bars are numbered from 1. All times are seconds from the start of the file on the straight (unswung) grid, so a cut placed on `startSeconds` lands on the downbeat.

## Tracks

| Track             | Tempo / key                              | Shape                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `treasure-hop`    | 116 BPM, C major, light 16th swing       | Brand theme. Intro 4 bars (marimba only), A 8 (marimba hook, bass, claps on 2 and 4, shaker), B 8 (square-lead tune, comping marimba, tambourine, pad), breakdown 4 (drums out, marimba low-pass sweep, riser, clap build, reverse cymbal), final A 8 (hook doubled by the lead, four on the floor), outro 2 (tag, then final chord hit and tail). About 71 s. |
| `treasure-hop-30` | same                                     | Intro 2 bars, then B (re-harmonised to end on G7), then the final hit. The requested structure is 11 bars at 116 BPM, so it runs about 23 s, not 30.                                                                                                                                                                                                           |
| `treasure-hop-15` | same                                     | Intro 2 bars, then a 4-bar A whose second phrase re-answers over F–G7, then a button hit. About 14 s.                                                                                                                                                                                                                                                          |
| `vault-lofi`      | 84 BPM, F major, heavy 16th swing (0.64) | Voice-over bed. Intro 4 bars (filtered keys, crackle), core 8, core with melody 8, breakdown 4 (rim and hats, darker keys), ending 2 (clean final F6add9). About 75 s. Keys, melody and snare are cut around 2.4 kHz to leave room for speech.                                                                                                                 |
| `vault-lofi-loop` | same                                     | The 8-bar core as a seamless loop (see below).                                                                                                                                                                                                                                                                                                                 |
| `big-reveal`      | 124 BPM, C major                         | Intro 4 bars (filtered pulsing saws), build 4 (accelerating snare roll, riser, filter opening, reverse cymbal), impact, drop 8 (pumping saw chords, rolling bass, four on the floor, lead hook doubled by marimba), then a sting. About 33 s.                                                                                                                  |
| `logo-sting`      | 120 BPM grid                             | Exactly 4.0 s: sparkle arpeggio, chest thunk on beat 2 (0.5 s), C add9 bloom, then a shimmer tail.                                                                                                                                                                                                                                                             |

The three `treasure-hop` versions come from the same section renderers, arranged differently in `songs/treasure-hop.ts`. No audio is cut, so every edit ends on a real ringing chord.

**Looping the lo-fi bed.** `vault-lofi-loop.wav` renders the core three times with identical random streams and keeps the middle pass. Reverb, delay and note tails from the previous pass are therefore already inside the loop's first bar. Eight bars at 84 BPM come to 1,097,142.86 samples, so the loop is rendered 0.00005 BPM faster, at exactly 1,097,143 samples. That makes the three passes bit-identical, and the report measures the seam. The loop ships as WAV only. AAC can't loop sample-accurately because of encoder priming, and a file that starts mid-signal made ffmpeg's AAC encoder overshoot to -0.3 dBTP. In the full `vault-lofi` mix, the `loop start` and `loop end` markers bracket the same core.

## Sound effects

`ui-click`, `ui-pop` (bubble), `blip-up` / `blip-down` (counter ticks), `type-tick`, `whoosh`, `whoosh-reverse`, `coin-clink`, `coins-cascade`, `sparkle`, `chest-creak` (a hinge whose creak rises in pitch, playful rather than scary), `chest-thud`, `lock-click`, `drumroll` (2 s roll ending on a crash), `fanfare-short` (1.5 s synth brass, G to C), `aww` (a comic falling wah-wah), `cash-register`, `notification` (a two-note rising chime). They borrow the music's marimba, bells and brass, so the two sit together.

## How it works

```
synthesis (instruments, drums) -> Session buses (mixer.ts)
  -> bus inserts, kick sidechain, delay/reverb sends -> stereo mix
  -> JS master bus: DC high-pass, gain to -14 LUFS, 5 ms look-ahead true-peak limiter at -2 dBTP
  -> 24-bit pre-master (.work/)
  -> ffmpeg loudnorm, two passes, linear mode -> out/music/*.wav -> AAC .m4a
  -> cue sheet, waveform, ebur128 / volumedetect / astats analysis, checks, report.md
```

The JS master lands each mix within a few hundredths of a LU of the target. That leaves loudnorm's second pass only a small linear gain trim, with no dynamic processing. Loudnorm doesn't flush its last analysis window, so it under-reads short files. The measurement therefore runs on the file plus 3 s of silence. The silence sits below the -70 LUFS gate and is trimmed off again.

## Files

| File             | Purpose                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `render.ts`      | Entry point: renders, masters, encodes and analyses every track and effect, then writes the report                    |
| `buffer.ts`      | Sample-rate constant, stereo buffers, constant-power panning, edge fades, dB helpers                                  |
| `wav.ts`         | Hand-written 24-bit PCM WAV encoder, and the reader used to verify ffmpeg's output                                    |
| `random.ts`      | Seeded Mulberry32 PRNG with labelled forks (the source of all determinism)                                            |
| `dsp.ts`         | PolyBLEP saw/pulse, triangle, 2-operator FM, exponential ADSR, RBJ biquads, zero-delay-feedback SVF                   |
| `effects.ts`     | Freeverb-style stereo reverb, tempo-synced ping-pong delay, tanh saturation, sidechain key and duck, tape wow/flutter |
| `loudness.ts`    | BS.1770-4 gated integrated loudness and 4x-oversampled true-peak envelope                                             |
| `mastering.ts`   | JS master bus (loudness target and look-ahead limiter) and SFX peak normalisation                                     |
| `mixer.ts`       | `Session`: named buses, insert chains, sends, sidechain and mixdown                                                   |
| `theory.ts`      | Note names, chord symbols, automatic voice leading, compact phrase notation (`"E5/.5 G5/.25 r/1"`)                    |
| `timeline.ts`    | Bar/beat grid, swing, humanisation (±5 ms, velocity spread), cue-sheet builder                                        |
| `song.ts`        | `Stage` (places swung, humanised notes and phrases), arrangement layout, `SongRender` type                            |
| `instruments.ts` | FM marimba, FM electric piano, FM bell, square lead, triangle bass, sub bass, supersaw, pad, pluck bass, brass        |
| `drums.ts`       | Kick, snare, clap, hats, shaker, tambourine, rim, toms, crash, reverse cymbal, riser, impact, vinyl crackle           |
| `songs/*.ts`     | One file per piece: harmony, melody, arrangement and mix                                                              |
| `sfx.ts`         | All sound effects                                                                                                     |
| `ffmpeg.ts`      | ffmpeg/ffprobe wrappers: two-pass loudnorm, AAC, analysis, waveform                                                   |
| `checks.ts`      | Delivery checks: loudness, true peak, clipping, DC, grid alignment, loop seam                                         |
| `report.ts`      | Builds `out/report.md`                                                                                                |
