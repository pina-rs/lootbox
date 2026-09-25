---
name: Unlisted
description: A warm ivory giveaway page built around a cartoon chest you press and hold to open.
colors:
  ivory: "#f3edda"
  ivory-deep: "#e9dfc3"
  paper: "#fbf8ee"
  ink: "#1d1a14"
  ink-soft: "#4a4336"
  muted: "#6b6250"
  line: "#d6caa9"
  teal: "#16796d"
  teal-bright: "#34a898"
  teal-deep: "#0e4f47"
  gold: "#f0b429"
  gold-soft: "#f8dc8c"
  coral: "#d9534a"
  focus: "#0b63ce"
typography:
  display:
    fontFamily: "Bungee, sans-serif"
    fontSize: "clamp(34px, 7.4vw, 64px)"
    fontWeight: 400
    lineHeight: 1.02
  section:
    fontFamily: "Bungee, sans-serif"
    fontSize: "24px"
  body:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "16px"
    lineHeight: 1.55
  label:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: ".08em"
rounded:
  control: "14px"
  card: "18px"
  pill: "999px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.ink}"
    shadow: "0 3px 0 {colors.ink}"
    minHeight: "48px"
  button-primary:
    backgroundColor: "{colors.gold}"
  card:
    backgroundColor: "{colors.paper}"
    border: "2.5px solid {colors.ink}"
    shadow: "0 6px 0 {colors.ink}"
---

# Design System: Unlisted

## Overview

**Creative North Star: "The chest on the kitchen table."** A giveaway should feel like a present, not a trading terminal. The page is warm ivory paper with heavy ink outlines and chunky offset shadows, the same inked, cel-shaded language as the cartoon chest renders. The ivory is exactly the render background (`#f3edda`), so the chest and its reaction clips sit on the page with no box around them.

The twist is physical: you press and hold the chest to open a box. Holding squashes and shakes it, fills a charge ring, raises a warm glow, and pulses haptics on phones. A full charge starts the real burn-and-commit transaction; the chest keeps rumbling while the Switchboard oracle reveals, then bursts into the reaction for the recorded tier and a prize card rises beneath it. The hold is honest anticipation that covers real latency, never a slot-machine spin.

The creator playground at `/playground` keeps the earlier dark mechanical workbench (Bungee, Space Grotesk, acid lime on near-black). It is an operating tool for developers, not the public face.

## Colors

- **Ivory** is the page ground; **Paper** lifts cards, inputs, and buttons one step.
- **Ink** draws every outline, offset shadow, and primary text. **Ink Soft** and **Muted** carry supporting copy; Muted still passes AA on Ivory.
- **Teal** (from the chest body) marks brand emphasis, links, the hold ring, and odds bars.
- **Gold** (from the chest trim) is the primary action fill, the busy ring while the oracle rolls, and the headline-tier highlight.
- **Coral** (the lock plate) is reserved for errors and the brand mark's keyhole.
- **Focus Blue** is only for keyboard focus rings, so focus never reads as brand color.

## Typography

Bungee for identity: the hero line, section titles, the countdown, the box balance, and the prize title. Space Grotesk for everything read or operated. Tabular numerals for odds, values, copies, and the countdown. Labels are small uppercase with tracking; they never carry essential information alone.

## Layout

Mobile first, one column with a 16px gutter: title, chest, hint, then the lede and countdown, so the chest is inside the first phone viewport. From 900px the hero becomes two columns (title and countdown left, chest right), and below it "Your boxes" sits beside "What's inside"; "How a box works" and the disclosures span the width. No horizontal scroll at any width.

## Components

### Chest

A single `button` covers the chest. Pointer down or Space/Enter down starts the charge; release before 1.2s drains it. The charge is a CSS custom property (`--charge`) written per animation frame, driving squash, shake amplitude, glow, and the ring's dash offset. Phases are exposed as `data-phase` (`idle`, `charging`, `burning`, `rolling`, `revealing`, `revealed`, `claiming`, `claimed`, `failed`) and the tier as `data-reaction`.

When the chest cannot open (before the reveal date, no wallet, no boxes, oracle not wired), a press rattles it once and a status message explains why. "Open without holding" is always offered beside an armed chest.

Reaction clips are 720 px VP9 WebM with alpha, with an H.264 MP4 fallback on the ivory background. `mix-blend-mode: darken` makes the MP4 background disappear on the matching page colour. The closed-chest still is the poster; each reaction's final pose is the resting image after the reveal. `big-prize` plays for the headline tier (highest value, or rarest when unpriced); everything else plays `small-prize`. `disappointed` is not shipped.

### Prize card

Rises beneath the chest with a short overshoot. It shows the stock logo, exact token amount, approximate USD value, a gold "Claim to wallet" action, and explorer links to the opening receipt, the randomness transaction, and the claim transaction. It appears on reveal end, on skip, or immediately under reduced motion.

### Manifest

Ruled rows, not cards: logo, company, exact amount, approximate value, copies left, and live odds with a thin teal bar. The headline bundle gets a gold halo on its logo. Depleted rows fade and strike through but stay visible at 0%.

### Buttons and fields

Paper fill, 2px ink border, 3px offset ink shadow that compresses on press. Minimum 48px tall. Fields are white with 2px ink borders and 10px corners.

## Motion

Motion belongs to the chest and the prize card's entrance. Under `prefers-reduced-motion`, shake, rumble, rattle, and the reaction clip are removed: the chest shows the final pose, and the prize card appears at once. The charge ring still fills, because it communicates the hold.

## Accessibility

- The chest is a named button with a described hint; the decorative media is `aria-hidden`.
- A polite, atomic live region announces every phase in text, including the recorded prize before any animation finishes.
- Keyboard: Space or Enter hold on the chest, plus the plain open button. Focus rings are 3px blue with offset.
- Axe (WCAG 2 A/AA) runs in the Playwright suite on the landing, connected, and prize screens.

## Do's and Don'ts

- **Do** keep the result, receipt, and claim in text, independent of the clip.
- **Do** keep every disclosure on the page.
- **Don't** add purchase language or flows. Boxes are given away.
- **Don't** put the chest in a framed box; the ivory ground is the stage.
- **Don't** reuse the dark workbench palette on the public site.
