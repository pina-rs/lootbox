{ pkgs, inputs, ... }:
let
  custom = inputs.ifiokjr-nixpkgs.packages.${pkgs.stdenv.hostPlatform.system};
in
{
  packages = with pkgs; [
    cargo-audit
    cargo-deny
    cargo-run-bin
    custom.agave
    custom.sbpf-linker
    custom.surfpool
    dart
    dprint
    git
    libiconv
    nodejs_24
    nixfmt
    perl
    pnpm
    rustup
    zlib
  ];

  env = {
    PINA_BPF_TOOLCHAIN = "nightly-2025-11-20";
    SBF_TOOLS_VERSION = "v1.54";
  };

  scripts = {
    pina.exec = ''
      set -euo pipefail

      if [ -n "''${PINA_BIN:-}" ]; then
        exec "$PINA_BIN" "$@"
      fi

      cargo bin pina_cli "$@"
    '';
    "install:all".exec = ''
      set -euo pipefail
      cargo bin --install
      pnpm install
      (cd sdks/dart && dart pub get)
      pnpm --dir apps/web exec playwright install chromium
    '';
    "fix:format".exec = ''
      set -euo pipefail
      dprint fmt
      dart format sdks/dart 2>/dev/null || true
      dart format programs/lootbox_program/clients/dart 2>/dev/null || true
      clean:generated
    '';
    "clean:generated".exec = ''
      set -euo pipefail
      find programs/lootbox_program/clients \
        -type f \
        \( -name '*.rs' -o -name '*.ts' -o -name '*.dart' -o -name '*.toml' -o -name '*.yaml' \) \
        -exec perl -0pi -e 's/[ \t]+(?=\r?$)//mg; s/(?:\r?\n)+\z/\n/' {} +
    '';
    "build:program".exec = ''
      set -euo pipefail
      pina build --project programs/lootbox_program
    '';
    "build:test-programs".exec = ''
      set -euo pipefail
      pina build --project tests/fixtures/mock_switchboard
    '';
    "generate:clients".exec = ''
      set -euo pipefail
      generated_client_modules="$PWD/programs/lootbox_program/clients/typescript/lootbox_program/node_modules"
      rm -rf -- "$generated_client_modules"
      pina generate --project programs/lootbox_program --npx node
      clean:generated
      pnpm install --frozen-lockfile
    '';
    "test:unit".exec = ''
      set -euo pipefail
      cargo test --workspace --all-features
      pnpm --dir sdks/typescript test
      (cd sdks/dart && dart test)
    '';
    "test:surfpool".exec = ''
      set -euo pipefail
      build:program
      build:test-programs
      PINA_SBF_ARTIFACT="$PWD/target/deploy/lootbox_program.so" \
        MOCK_SWITCHBOARD_SBF_ARTIFACT="$PWD/target/deploy/mock_switchboard.so" \
        cargo test \
          --manifest-path programs/lootbox_program/tests/surfpool/Cargo.toml \
          --locked \
          -- \
          --ignored \
          --nocapture
    '';
    "test:web".exec = ''
      set -euo pipefail
      pnpm --dir apps/web test
      pnpm --dir apps/web test:e2e
    '';
    "lint:all".exec = ''
      set -euo pipefail
      pina lint --project programs/lootbox_program
      cargo clippy --workspace --all-features --all-targets -- -D warnings
      dprint check
      pnpm --dir sdks/typescript check
      pnpm --dir apps/web lint
      (cd sdks/dart && dart analyze)
    '';
    "security:audit".exec = ''
      set -euo pipefail
      cargo audit --deny warnings
      cargo audit --deny warnings --file tests/fixtures/mock_switchboard/Cargo.lock
      cargo deny check advisories bans sources
      pnpm audit --audit-level high
    '';
    "verify:all".exec = ''
      set -euo pipefail
      lint:all
      security:audit
      test:unit
      test:surfpool
      pnpm --dir apps/web build
      test:web
    '';
  };

  enterShell = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
