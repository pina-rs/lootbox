---
name: Lootbox by Pina
description: A dark mechanical gift workshop with an inspectable prize manifest.
colors:
  ink: "#0b0d0c"
  paper: "#f5f1df"
  muted: "#a4aca2"
  line: "#2c302c"
  lime: "#c9ff43"
  lime-hover: "#dcff8c"
  orange: "#ff5c35"
  cyan: "#45e9ff"
  field-surface: "#151b13"
  field-border: "#485042"
  field-error: "#ffc3ae"
  invalid-border: "#ec9578"
typography:
  display:
    fontFamily: "Bungee, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 48px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "16px"
    lineHeight: 1.85
  label:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "13px"
  input:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "14px"
    lineHeight: 1.35
  action:
    fontFamily: "Space Grotesk Variable, sans-serif"
    fontSize: "15px"
    fontWeight: 700
rounded:
  field: "0"
spacing:
  compact: "8px"
  field: "12px"
  control-gap: "16px"
  section: "20px"
  group: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.lime-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "10px 16px"
  button-quiet-hover:
    textColor: "{colors.lime}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    size: "44px"
  input:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.paper}"
    typography: "{typography.input}"
    rounded: "{rounded.field}"
    padding: "{spacing.field}"
  navigation:
    backgroundColor: "transparent"
    textColor: "#b4bcb1"
    padding: "10px 16px"
  navigation-current:
    textColor: "{colors.paper}"
---

# Design System: Lootbox by Pina

## Overview

**Creative North Star: "The Cargo Gift Workshop"**

Lootbox is a quiet, near-black workbench wrapped around a tangible mechanical crate. Acid-lime actions and warm paper text make the operating surface clear; the crate supplies the suspense through metal plates, a sealed lid, and a luminous reveal. This is an extension of the incumbent identity, not a replacement world.

The product's playful promise sits beside an inspectable treasury. Forms, facts, receipts, and current odds use restrained rules and legible text so the theatrical object never has to explain transaction state. The interface identifies its local test environment and keeps asynchronous results available as text.

**Key Characteristics:**

- A code-native cargo crate is the signature object.
- Near-black metal, warm paper, and acid-lime controls define the working palette.
- Bungee gives identity and reveals their character; Space Grotesk carries the work.
- Ruled manifests and aligned facts provide structure without a card grid.
- Motion belongs to the opening sequence, with a static reduced-motion equivalent.

Recorded from the effective cascade in `src/styles.css` followed by `src/workshop.css`, the rendered components in `src/App.tsx` and `src/lootbox/Machine.tsx`, and the desktop/mobile review captures. The token values above describe implemented roles; they are not all CSS custom properties.

## Colors

A near-black green foundation and warm off-white text hold a vivid acid-lime accent, with orange and cyan reserved for the crate and interaction states.

### Primary

- **Acid Lime** (`lime`): brand, primary actions, current-navigation underline, inventory bars, probabilities, completed opening steps, and prize titles.
- **Lit Lime** (`lime-hover`): primary-action hover fill.

### Secondary

- **Seal Orange** (`orange`): the crate's hazard material, burn light, and reveal particles. It is not the current workshop's primary action color.
- **Soft Warning** (`field-error`) and **Warning Edge** (`invalid-border`): readable adjacent validation text and invalid input borders.

### Tertiary

- **Signal Cyan** (`cyan`): keyboard focus, committed/redeemed crate effects, and reveal particles.

### Neutral

- **Night Metal** (`ink`): the page ground and text on lime controls.
- **Warm Paper** (`paper`): primary text and control values.
- **Sage Gray** (`muted`): supporting explanations, fact labels, inventory counts, and receipts. The workshop override is authoritative, not the darker initial declaration in the legacy stylesheet.
- **Panel Seam** (`line`): structural dividers between workbench regions and manifest rows.
- **Recessed Field** (`field-surface`) and **Field Edge** (`field-border`): editable control surfaces and their borders.

**The Signal Has a Job Rule.** Lime identifies an action, an active or completed state, or an inventory value; it also belongs to the crate's luminous material. Orange and cyan remain supporting signals.

The sidecar's synthesized tonal ramps are preview metadata, not additional application colors.

## Typography

**Display Font:** Bungee, with sans-serif fallback.\
**Body Font:** Space Grotesk Variable, with sans-serif fallback.\
**Technical Text:** the browser's monospace family for addresses and transaction signatures.

Bungee is compact, heavy in silhouette, and intentionally playful. Space Grotesk stays quieter and supports the dense operating details. The implementation uses role-specific sizes rather than a single mathematical type scale.

### Hierarchy

- **Display:** workspace and guide headings use the frontmatter display role. At the small breakpoint they use a fixed size (31px).
- **Title:** opening-table, manifest, and funding-summary headings use the title role. Creator legends are larger (20px); guide subsection headings are larger again (24px, 23px on small screens).
- **Body:** the frontmatter body role describes guide paragraphs. Operational supporting copy is more compact (12–15px), with explicit generous line-height where it forms paragraphs.
- **Label:** form labels use the label role; helper and validation text use smaller text (12px). These remain sentence-case operating labels.
- **Input:** input values use the input role and inherit the same body family.
- **Action:** primary actions use the action role. Quiet actions are smaller (13px).
- **Prize:** revealed prize titles return to Bungee (20px, line-height 1.4).

**The Two Voices Rule.** Use Bungee for identity, main headings, and the recorded prize; keep forms, navigation, explanations, and financial facts in Space Grotesk. Use tabular numerals for counts, odds, and aligned values.

## Layout

The application shell is centered with a maximum width (1480px) and desktop side padding (48px). The inherited main region also has its own centered width constraint, so it must not be assumed to fill every shell. Recurring spaces are recorded above; they describe the observed rhythm rather than a newly imposed spacing scale.

The opening workbench is a ruled three-column composition: a narrow control drawer (220px), a flexible stage with a minimum width (300px), and an inventory manifest (280px). Its minimum height is 520px. The primary stage action fills its available width up to 380px.

Creator setup is a flexible form beside a funding summary (320px), separated by a larger gutter (64px). Prize rows use aligned fields, not floating cards. The guide is a narrower reading column (maximum 760px); helper copy is limited to 70ch.

Responsive changes are structural:

- At 1120px and below, shell padding and column widths tighten, the creator gutter contracts, and prize fields become two columns.
- At 860px and below, navigation moves to a full-width second header row. The opening drawer spans above the stage and manifest; the creator summary moves below the form and its duplicate crate is hidden.
- At 720px and below, the inherited main-width rule applies a centered maximum (520px) within 92vw. This is an existing cascade constraint, not a second navigation breakpoint.
- At 600px and below, shell padding becomes 18px. The opening stage comes first, followed by the drawer and manifest. Creator pairs stack, dispatch wraps, and transaction signatures move below their labels.

**The Manifest Before Cards Rule.** Use the implemented ruled rows and aligned fact pairs for inventory and operational data; preserve the stage as the distinct visual region.

## Elevation & Depth

The workbench is flat: thin seams, recessed inputs, and a subdued radial light behind the crate create separation. Navigation uses an inset lime underline, not a floating tab. Buttons do not inherit the unused legacy action shadows.

The crate has physical construction depth: inset metal edging, dark offset lid/body planes, a blurred floor shadow, and emitted light. These are illustration materials, not a general elevation scale for containers. Their exact shadow snippets live in the sidecar.

**The Object Owns Depth Rule.** Keep dimensional construction and luminous effects on the crate; use rules and tonal separation for the surrounding workbench.

## Shapes

Operating surfaces use straight edges. Inputs explicitly have square corners, quiet buttons are outlined rectangles, and the primary action clips opposite corners with a small diagonal cut (9px). The clipped action echoes the crate's cut metal silhouette without turning every container into an object.

Circles belong to the small connection indicator, crate orbit, light core, and rivets. The connection indicator is a dot, not a pill-shaped status container. Icons are stroked SVGs from the existing Lucide set.

## Components

### Buttons

Primary actions are bright, cut-corner workbench controls. Their padding and type are recorded above; their minimum height is 50px. Hover lightens the fill. Keyboard focus uses a dark inset outline so it remains visible inside the clipped silhouette.

Quiet actions are transparent outlined rectangles with a minimum height of 44px. Hover changes both border and text to lime. Icon-only removal controls use a 44px square target and retain an accessible name. Disabled buttons reduce opacity and show an unavailable cursor; do not substitute color alone for the explanatory state text.

### Inputs / Fields

Fields are recessed, square, full-width surfaces with a minimum height of 46px. Labels sit above values; optional information and helper copy remain adjacent. Focus uses a cyan outline (2px) with an offset (4px).

Invalid creator values receive an invalid border plus a nearby text error, linked with `aria-describedby` and marked with `aria-invalid`. The funding action also has a textual validation summary when unavailable. Disabled fields fade independently from buttons.

### Navigation

The three workspace destinations are text-and-icon buttons inside a labeled navigation landmark. Current state is exposed with `aria-current="page"` and an inset lime baseline. Hover adds a dark green surface; keyboard focus retains the shared cyan outline. On smaller screens the destinations remain visible across a second header row.

### Manifests / Facts

Prize rows carry a name, remaining count, right-aligned percentage, a thin proportional lime bar, and a disclosure for technical assets. Depleted prizes are muted and struck through. Aligned definition-list pairs carry facts and funding totals. These are rows within a shared surface, not interchangeable decorative cards.

### Feedback / Reveal

Transaction notices remain text status messages. Errors use a warm dark surface, readable warning text, and a recovery action. The revealed prize appears as a lime Bungee title with delivery state beneath it.

A persistent, polite, atomic live region announces the recorded prize and its delivery state. The visible prize can animate, but the announcement does not depend on a timed toast or on the decorative crate being exposed to assistive technology.

### Mechanical Crate

The crate is code-native CSS, with no required raster asset. It carries received, committed, burning, revealed, and redeemed phases through its lid, light, core, and particles. The workbench disables idle breathing and orbit rotation; state-specific animation remains on the object.

Received motion uses a short settle-in, reveal opens the lid, and recorded-prize text appears beneath it. The animation presents a recorded result rather than determining it. The crate is `aria-hidden`; controls, steps, and text communicate the state. Reduced-motion preference disables workshop animation and transitions while preserving the same usable states.

## Do's and Don'ts

### Do:

- **Do** preserve the mechanical crate as the identity anchor and keep the workbench visually quiet.
- **Do** use the implemented ruled manifests, aligned facts, and tabular numbers for treasury information.
- **Do** pair invalid fields with adjacent readable errors and accessible descriptions.
- **Do** retain persistent text status, the polite atomic prize announcement, visible keyboard focus, and reduced-motion behavior.
- **Do** keep test-network and test-asset limitations visible.

### Don'ts:

- **Don't** make animation or the decorative crate the only source of result or transaction state.
- **Don't** replace the incumbent Bungee/Space Grotesk pairing or acid-lime mechanical palette during a local extension.
- **Don't** import the inactive legacy hero, eyebrow, reward-card, or offset-shadow button styles into new workshop surfaces.
- **Don't** treat tiny lettering within the crate illustration as a text-size precedent for controls, instructions, or important information.

Not canonized: the crate's miniature decorative lettering is illustration detail, not readable UI typography; inactive legacy hero, eyebrow, and reward-card rules are not the current workshop system. This record does not claim that the narrow finish-review confirmation was a new whole-surface audit.
