# Repository agent instructions

## Pre-release protocol policy

This repository is pre-release. The program has not been released under a compatibility tag and has not been deployed as a supported on-chain protocol.

- Breaking changes are allowed while the protocol is being designed and implemented.
- Use the canonical, unversioned name for instructions, accounts, APIs, documentation, storage keys, and domain separators.
- Do not add numbered release prefixes or suffixes to identifiers or protocol documentation.
- Do not preserve compatibility aliases or deprecated paths for unreleased designs.
- Regenerate every generated client after changing the program schema; never patch generated source by hand.
- Keep Rust, TypeScript, and Dart planners semantically aligned and covered by shared test vectors.

This policy changes only after both of the following are true:

1. The repository has an explicit release tag defining a compatibility boundary.
2. The corresponding program is live on-chain as a supported deployment.

After that point, incompatible changes must use an explicit compatibility strategy approved by the maintainer.
