#!/usr/bin/env bash
# Bootstrap a Linux cloud agent the same way CI does.
# Installs multi-user Nix (flakes + nix-command), the devenv revision pinned in
# devenv.lock from the devenv.cachix.org cache, and workspace dependencies.
# Idempotent. The Nix daemon is started here because this image has no systemd;
# cloud-agent-start.sh brings it back on later boots.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

nix_conf_snippet() {
	cat <<'EOF'
accept-flake-config = true
experimental-features = nix-command flakes
extra-substituters = https://devenv.cachix.org
extra-trusted-public-keys = devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=
trusted-users = root ubuntu
EOF
}

ensure_nix_conf_lines() {
	local line
	sudo mkdir -p /etc/nix
	sudo touch /etc/nix/nix.conf
	while IFS= read -r line; do
		[ -n "$line" ] || continue
		if ! sudo grep -qxF "$line" /etc/nix/nix.conf; then
			printf '%s\n' "$line" | sudo tee -a /etc/nix/nix.conf >/dev/null
		fi
	done < <(nix_conf_snippet)
}

load_nix() {
	if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then
		# shellcheck disable=SC1091
		. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
	elif [ -f "$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
		# shellcheck disable=SC1091
		. "$HOME/.nix-profile/etc/profile.d/nix.sh"
	fi
}

# /usr/local/bin is on the default PATH for login and non-login shells.
# Nix's profile snippet is only sourced by login shells, so symlinks are
# what `bash --noprofile --norc` and other non-interactive commands see.
publish_tools() {
	if [ -x /nix/var/nix/profiles/default/bin/nix ]; then
		sudo ln -sfn /nix/var/nix/profiles/default/bin/nix /usr/local/bin/nix
	fi
	if [ -x "$HOME/.nix-profile/bin/devenv" ]; then
		sudo ln -sfn "$HOME/.nix-profile/bin/devenv" /usr/local/bin/devenv
	fi
}

nix_ready() {
	command -v nix >/dev/null 2>&1 && nix store ping >/dev/null 2>&1
}

if ! command -v nix >/dev/null 2>&1 && [ ! -x /nix/var/nix/profiles/default/bin/nix ]; then
	extra="$(mktemp)"
	nix_conf_snippet >"$extra"
	curl --fail --silent --show-error --location https://nixos.org/nix/install |
		sh -s -- --daemon --yes --nix-extra-conf-file "$extra"
	rm -f "$extra"
fi

load_nix
ensure_nix_conf_lines
publish_tools

# Cloud agent VMs do not boot systemd, and the official installer skips
# service setup when it cannot find one. Start the daemon directly.
if ! nix_ready; then
	if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
		sudo systemctl start nix-daemon || true
	fi
fi
if ! nix_ready && [ -x /nix/var/nix/profiles/default/bin/nix-daemon ]; then
	sudo mkdir -p /var/log
	sudo sh -c 'nohup /nix/var/nix/profiles/default/bin/nix-daemon >>/var/log/nix-daemon.log 2>&1 &'
	for _ in $(seq 1 30); do
		nix_ready && break
		sleep 1
	done
fi

if ! nix_ready; then
	echo "nix-daemon is not reachable" >&2
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

# Pin the same devenv CI installs (devenv.lock), and pull it from
# devenv.cachix.org instead of a floating nixpkgs#devenv. Nix 2.35 spells
# the profile command `nix profile add`.
if ! nix profile list 2>/dev/null | grep -q "devenv/${devenv_revision}"; then
	nix profile remove devenv >/dev/null 2>&1 || true
	nix profile add --accept-flake-config "github:cachix/devenv/${devenv_revision}#devenv"
fi

publish_tools

# Build the devenv shell closure once so later `devenv shell` commands hit
# the cache instead of evaluating and downloading it again.
devenv shell -- true

devenv shell -- pnpm install --frozen-lockfile
devenv shell -- bash -lc 'cd sdks/dart && dart pub get --enforce-lockfile'
# Chromium plus its system libraries. Web end-to-end tests need both.
devenv shell -- pnpm --dir apps/web exec playwright install --with-deps chromium

# Fail the install if a non-login shell cannot see either tool.
env -i HOME="$HOME" USER="${USER:-ubuntu}" \
	PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
	bash --noprofile --norc -c 'command -v nix >/dev/null && command -v devenv >/dev/null'
