# Performance benchmark policy

`compare.mjs` compares the pull request against its base with these rules:

- Any instruction regressing by at least `fail.deltaCu` **and** `fail.deltaPercent` fails the gate. The warn band is reported in the PR comment.
- Binary growth beyond `size.failBytes` or `size.failPercent` fails the gate. An intentional size increase raises `approvedBinarySize` in the same pull request.
- `advisory` lists case patterns that are reported but never enforced. `box_curve/*` is advisory because Surfpool's local runtime meters those four instructions with a per-boot variance quantized at one sha256-syscall, independent of fixture keys; the other cases are byte-identical across runs. See `docs/performance.md`.
- `approvedTotals` records intentional per-instruction regressions the same way.
