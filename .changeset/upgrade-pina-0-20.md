---
lootbox_program: none
lootbox_sdk: none
---

# Upgrade the framework to Pina 0.20.0

Move `pina` from 0.19 to 0.20.0 and regenerate the migration documents for the reset ABI document format (`abiVersion` "0.20"): the manifest drops every derived field and the publication ledger is rebuilt with zero receipts and no pending record, matching the pre-deployment state. Generated clients are re-rendered by `pina generate`.
