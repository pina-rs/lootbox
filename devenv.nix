{ pkgs, inputs, ... }:
let
  custom = inputs.ifiokjr-nixpkgs.packages.${pkgs.stdenv.hostPlatform.system};
  kani = custom.kani.overrideAttrs (_: {
    # kani-compiler loads the driver from Kani's pinned rustup toolchain at
    # runtime, so it is intentionally absent while the bundle is packaged.
    autoPatchelfIgnoreMissingDeps = [ "librustc_driver-*.so" ];
  });
in
{
  packages = with pkgs; [
    cargo-audit
    cargo-deny
    cargo-llvm-cov
    custom.agave
    kani
    custom.monochange
    custom.pina
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
    "cargo-kani".exec = ''
      set -euo pipefail

      kani_bundle="${kani}"
      kani_toolchain="$(tr -d '\n' < "$kani_bundle/rust-toolchain-version")"
      if ! rustup run "$kani_toolchain" rustc --version >/dev/null 2>&1; then
        rustup toolchain install "$kani_toolchain"
      fi

      toolchain_cargo="$(rustup which --toolchain "$kani_toolchain" cargo)"
      toolchain_root="$(dirname "$(dirname "$toolchain_cargo")")"
      kani_runtime="$PWD/.devenv/$(basename "$kani_bundle")-$kani_toolchain"
      if [ ! -x "$kani_runtime/bin/kani-driver" ]; then
        mkdir -p "$PWD/.devenv"
        kani_runtime_tmp="$(mktemp -d "$PWD/.devenv/kani-runtime.XXXXXX")"
        trap 'rm -rf -- "$kani_runtime_tmp"' EXIT
        cp -R "$kani_bundle/." "$kani_runtime_tmp/"
        chmod -R u+w "$kani_runtime_tmp"
        ln -s "$toolchain_root" "$kani_runtime_tmp/toolchain"
        mv "$kani_runtime_tmp" "$kani_runtime"
        trap - EXIT
      fi

      loader_path_name="LD_LIBRARY_PATH"
      if [ "$(uname -s)" = "Darwin" ]; then
        loader_path_name="DYLD_FALLBACK_LIBRARY_PATH"
      fi
      loader_path="''${!loader_path_name:-}"
      filtered_loader_path=""
      if [ -n "$loader_path" ]; then
        while IFS= read -r path; do
          if [[ "$path" = */toolchains/*/lib ]]; then
            continue
          fi
          filtered_loader_path="''${filtered_loader_path:+$filtered_loader_path:}$path"
        done < <(printf '%s' "$loader_path" | tr ':' '\n')
      fi
      filtered_loader_path="$toolchain_root/lib''${filtered_loader_path:+:$filtered_loader_path}"
      export "$loader_path_name=$filtered_loader_path"

      export PATH="$toolchain_root/bin:$kani_runtime/bin:$PATH"
      export RUSTUP_TOOLCHAIN="$kani_toolchain"
      # Kani injects an unstable compiler feature into every crate. Cap the
      # workspace's unstable-features lint only for this verifier invocation.
      export RUSTFLAGS="''${RUSTFLAGS:+$RUSTFLAGS }--cap-lints=allow"
      exec "$kani_runtime/bin/kani-driver" "$@"
    '';
    kani.exec = ''
      set -euo pipefail
      cargo-kani "$@"
    '';
    "install:all".exec = ''
      set -euo pipefail
      pnpm install --frozen-lockfile
      (cd sdks/dart && dart pub get --enforce-lockfile)
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
      node tools/normalize-generated.mjs
      find programs/lootbox_program/clients \
        -type f \
        \( -name '*.rs' -o -name '*.ts' -o -name '*.dart' -o -name '*.toml' -o -name '*.yaml' \) \
        -exec perl -0pi -e 's/[ \t]+(?=\r?$)//mg; s/(?:\r?\n)+\z/\n/' {} +
    '';
    "build:program".exec = ''
      set -euo pipefail
      RUST_LOG=error pina build --project programs/lootbox_program
    '';
    "build:test-programs".exec = ''
      set -euo pipefail
      RUST_LOG=error pina build --project tests/fixtures/mock_switchboard
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
      node --test tools/normalize-generated.test.mjs
      cargo test --workspace --all-features
      pnpm --dir sdks/typescript test
      (cd sdks/dart && dart test)
    '';
    "test:coverage".exec = ''
      set -euo pipefail
      cargo llvm-cov test -p lootbox-cli --all-features --locked \
        --fail-under-lines 96 \
        --ignore-filename-regex 'lootbox-cli/src/main\.rs$'
    '';
    "test:kani".exec = ''
      set -euo pipefail
      cargo kani --package lootbox_program --lib --jobs --output-format terse
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
      node --test tools/playground.test.mjs
    '';
    "test:web".exec = ''
      set -euo pipefail
      pnpm --dir apps/web test
      pnpm --dir apps/web test:e2e
    '';
    "lint:all".exec = ''
      set -euo pipefail
      pina migrations check --project programs/lootbox_program
      pina lint --project programs/lootbox_program
      cargo clippy --workspace --all-features --all-targets --locked -- -D warnings
      cargo clippy \
        --manifest-path programs/lootbox_program/tests/surfpool/Cargo.toml \
        --all-features \
        --all-targets \
        --locked \
        -- \
        -D warnings
      cargo clippy \
        --manifest-path tests/fixtures/mock_switchboard/Cargo.toml \
        --all-features \
        --all-targets \
        --locked \
        -- \
        -D warnings
      RUSTDOCFLAGS="-D warnings" \
        cargo doc --workspace --all-features --no-deps --locked
      dprint check
      pnpm --dir sdks/typescript check
      pnpm --dir apps/web lint
      (cd sdks/dart && dart analyze --fatal-infos --fatal-warnings)
      ${custom.monochange}/bin/monochange check
    '';
    "security:audit".exec = ''
      set -euo pipefail
      cargo audit --deny warnings --ignore RUSTSEC-2025-0141
      cargo audit --deny warnings --ignore RUSTSEC-2025-0141 --file tests/fixtures/mock_switchboard/Cargo.lock
      cargo audit \
        --deny warnings \
        --file programs/lootbox_program/tests/surfpool/Cargo.lock \
        --ignore RUSTSEC-2020-0016 \
        --ignore RUSTSEC-2021-0139 \
        --ignore RUSTSEC-2021-0145 \
        --ignore RUSTSEC-2022-0093 \
        --ignore RUSTSEC-2024-0344 \
        --ignore RUSTSEC-2024-0375 \
        --ignore RUSTSEC-2024-0384 \
        --ignore RUSTSEC-2024-0388 \
        --ignore RUSTSEC-2024-0421 \
        --ignore RUSTSEC-2024-0436 \
        --ignore RUSTSEC-2025-0134 \
        --ignore RUSTSEC-2025-0141 \
        --ignore RUSTSEC-2025-0161 \
        --ignore RUSTSEC-2025-0167 \
        --ignore RUSTSEC-2026-0097 \
        --ignore RUSTSEC-2026-0098 \
        --ignore RUSTSEC-2026-0099 \
        --ignore RUSTSEC-2026-0104 \
        --ignore RUSTSEC-2026-0173 \
        --ignore RUSTSEC-2026-0186 \
        --ignore RUSTSEC-2026-0247 \
        --ignore RUSTSEC-2026-0258
      cargo deny check -D warnings advisories bans sources
      cargo deny \
        --manifest-path programs/lootbox_program/tests/surfpool/Cargo.toml \
        --config programs/lootbox_program/tests/surfpool/deny.toml \
        check \
        -D warnings \
        advisories bans sources
      pnpm audit --audit-level high
    '';
    "verify:all".exec = ''
      set -euo pipefail
      lint:all
      security:audit
      test:unit
      test:kani
      test:coverage
      test:surfpool
      pnpm --dir apps/web build
      test:web
    '';
  };

  enterShell = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
