---
lootbox_program: feat
lootbox_sdk: feat
lootbox_sdk_typescript: feat
lootbox_sdk_dart: feat
---

# Sell a locked lootbox's boxes on a bonding curve

A creator can move at least 20 boxes of a locked lootbox into a box curve with `openBoxCurve`. Anyone can then buy boxes with `buyCurveBoxes` at `startPrice + priceStep × sold`, and any holder can sell back with `sellCurveBoxes` for the most recent positions' prices, so the curve's reserve always covers every buyback. A capped creator fee of at most 5% applies to both directions. Trading ends when the curve sells out, which pays the whole reserve to the creator in the same transaction, or at the lootbox's reveal time. `closeBoxCurve` then returns any reserve and unsold boxes and closes both accounts. Every trade emits `BoxCurveTraded`. The Rust, TypeScript, and Dart SDKs price trades identically against shared vectors, and the TypeScript client opens, buys, sells, and closes curves.
