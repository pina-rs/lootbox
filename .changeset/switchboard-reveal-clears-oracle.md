---
lootbox_program: fix
---

# Accept Switchboard reveals that clear the bound oracle

Switchboard On-Demand zeroes the randomness account's `oracle` field when it records a reveal, so the post-reveal check that compared it with the committed oracle rejected every real devnet reveal. The oracle is now bound only before the reveal CPI, which verifies the proof against it; the mock Switchboard program mirrors the real behavior.
