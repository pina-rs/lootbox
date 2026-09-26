---
lootbox_sdk_typescript: docs
---

# Add the randomness lanes devnet spike

Add `spike:lanes`, a devnet script that tests reusable Switchboard randomness accounts, and document its findings in `docs/randomness-lanes.md`: accounts can be recommitted and fused with the previous reveal, same-slot commits get distinct values, and Switchboard accepts a commit over an unrevealed one, so the program must guard each lane itself.
