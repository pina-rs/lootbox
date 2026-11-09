#!/usr/bin/env bash
# The Nix daemon does not survive a snapshot, and these VMs do not run
# systemd. Start it and wait until the socket answers.
set -euo pipefail

if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then
	# shellcheck disable=SC1091
	. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
fi

if [ -x /nix/var/nix/profiles/default/bin/nix ]; then
	sudo ln -sfn /nix/var/nix/profiles/default/bin/nix /usr/local/bin/nix
fi
if [ -x "${HOME}/.nix-profile/bin/devenv" ]; then
	sudo ln -sfn "${HOME}/.nix-profile/bin/devenv" /usr/local/bin/devenv
fi

if ! nix store ping >/dev/null 2>&1; then
	if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
		sudo systemctl start nix-daemon || true
	fi
fi

if ! nix store ping >/dev/null 2>&1; then
	sudo mkdir -p /var/log
	sudo sh -c 'nohup /nix/var/nix/profiles/default/bin/nix-daemon >>/var/log/nix-daemon.log 2>&1 &'
fi

for _ in $(seq 1 30); do
	if nix store ping >/dev/null 2>&1; then
		exit 0
	fi
	sleep 1
done

echo "nix-daemon did not become ready" >&2
exit 1
