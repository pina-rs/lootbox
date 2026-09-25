---
lootbox_program: feat
---

# Admit issuer-controlled tokenized stock prizes

`FundTokenPrize` now escrows PreStocks and Backed xStocks Token-2022 mints when their permanent delegate is an allowlisted issuer key. Such mints may carry a freeze authority, permanent delegate, initialized default account state, scaled UI amount, pause config, confidential-transfer config, a program-less transfer hook, and a transfer fee; every other Token-2022 mint keeps the strict metadata-only policy. Funding grosses up the current-epoch transfer fee with `TransferCheckedWithFee` and verifies the escrow received exactly the recorded amount, and paused mints are rejected. Winners receive the recorded amount minus the issuer's disclosed fee, and the security notes document the issuer powers the program cannot prevent.
