---
lootbox_cli: fix
---

# Send every fulfill-template-open account in its own slot

`lootbox fulfill-template-open` passed the service vault twice and never sent the Switchboard reward escrow, so every account from `opening` onward landed one slot early and the program rejected the instruction. The command now takes `--reward-escrow` (the wrapped-SOL associated token account of the randomness account) and sends each named account in the slot the program reads it from.
