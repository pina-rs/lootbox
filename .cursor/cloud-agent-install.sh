#!/usr/bin/env bash
# Bootstrap a Linux cloud agent the same way CI does.
# Single-user Nix (no daemon) so a warm boot still has a working store.
# Flakes and nix-command are enabled, devenv comes from the revision in
# devenv.lock via devenv.cachix.org, and both tools are on the default PATH.
# Idempotent.
set -euo pipefail

if [ -f "${PWD}/devenv.lock" ]; then
	root="$PWD"
else
	root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$root"

nix_conf_snippet() {
	cat <<'EOF'
accept-flake-config = true
experimental-features = nix-command flakes
extra-substituters = https://devenv.cachix.org
extra-trusted-public-keys = devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=
EOF
}

ensure_nix_conf() {
	local line file
	mkdir -p "${HOME}/.config/nix"
	file="${HOME}/.config/nix/nix.conf"
	touch "$file"
	while IFS= read -r line; do
		[ -n "$line" ] || continue
		if ! grep -qxF "$line" "$file"; then
			printf '%s\n' "$line" >>"$file"
		fi
	done < <(nix_conf_snippet)
	# The daemon installer reads /etc; single-user reads the user file.
	# Writing both keeps `nix config show` stable either way.
	if sudo -n true >/dev/null 2>&1; then
		sudo mkdir -p /etc/nix
		sudo touch /etc/nix/nix.conf
		while IFS= read -r line; do
			[ -n "$line" ] || continue
			if ! sudo grep -qxF "$line" /etc/nix/nix.conf; then
				printf '%s\n' "$line" | sudo tee -a /etc/nix/nix.conf >/dev/null
			fi
		done < <(nix_conf_snippet)
	fi
}

load_nix() {
	if [ -f "${HOME}/.nix-profile/etc/profile.d/nix.sh" ]; then
		# shellcheck disable=SC1091
		. "${HOME}/.nix-profile/etc/profile.d/nix.sh"
	fi
}

# /usr/local/bin is on the default PATH for login and non-login shells.
# The wrappers source the single-user profile (certs, NIX_PROFILES) and then
# exec the real binaries. They do not start a daemon.
publish_tools() {
	local nix_bin devenv_bin
	nix_bin="${HOME}/.nix-profile/bin/nix"
	devenv_bin="${HOME}/.nix-profile/bin/devenv"
	if [ ! -x "$nix_bin" ]; then
		return 0
	fi
	sudo tee /usr/local/bin/nix >/dev/null <<EOF
#!/bin/bash
set -euo pipefail
if [ -f "\$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
	. "\$HOME/.nix-profile/etc/profile.d/nix.sh"
fi
exec ${nix_bin} "\$@"
EOF
	sudo chmod 755 /usr/local/bin/nix
	if [ -x "$devenv_bin" ]; then
		sudo tee /usr/local/bin/devenv >/dev/null <<EOF
#!/bin/bash
set -euo pipefail
if [ -f "\$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
	. "\$HOME/.nix-profile/etc/profile.d/nix.sh"
fi
exec ${devenv_bin} "\$@"
EOF
		sudo chmod 755 /usr/local/bin/devenv
	fi
}

if [ ! -x "${HOME}/.nix-profile/bin/nix" ]; then
	extra="$(mktemp)"
	nix_conf_snippet >"$extra"
	curl --fail --silent --show-error --location https://nixos.org/nix/install |
		sh -s -- --no-daemon --yes --nix-extra-conf-file "$extra"
	rm -f "$extra"
fi

load_nix
ensure_nix_conf
publish_tools

if ! nix store ping >/dev/null 2>&1; then
	echo "single-user nix store is not reachable" >&2
	nix store ping >&2 || true
	exit 1
fi

devenv_revision="$(
	nix eval --impure --raw --expr '
		let
			lock = builtins.fromJSON (builtins.readFile ./devenv.lock);
		in
			lock.nodes.devenv.locked.rev
	'
)"

# Pin the same devenv CI installs (devenv.lock), from devenv.cachix.org.
# Nix 2.35 spells the profile command `nix profile add`.
if ! nix profile list 2>/dev/null | grep -q "devenv/${devenv_revision}"; then
	nix profile remove devenv >/dev/null 2>&1 || true
	nix profile add --accept-flake-config "github:cachix/devenv/${devenv_revision}#devenv"
fi

publish_tools

# Build the devenv shell closure once so later commands hit the cache.
devenv shell -- true

devenv shell -- pnpm install --frozen-lockfile
devenv shell -- bash -lc 'cd sdks/dart && dart pub get --enforce-lockfile'
devenv shell -- pnpm --dir apps/web exec playwright install --with-deps chromium

env -i HOME="$HOME" USER="${USER:-ubuntu}" \
	PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
	bash --noprofile --norc -c 'nix --version >/dev/null && devenv version >/dev/null && nix store ping >/dev/null'
