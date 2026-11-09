#!/usr/bin/env bash
# Single-user Nix has no daemon. Refresh the PATH wrappers and leave.
# A warm boot that skips this script still works: the wrappers live in
# /usr/local/bin, which is on the default PATH.
set -euo pipefail

nix_bin="${HOME}/.nix-profile/bin/nix"
devenv_bin="${HOME}/.nix-profile/bin/devenv"

if [ -x "$nix_bin" ]; then
	sudo tee /usr/local/bin/nix >/dev/null <<EOF
#!/bin/bash
set -euo pipefail
if [ -f "\$HOME/.nix-profile/etc/profile.d/nix.sh" ]; then
	. "\$HOME/.nix-profile/etc/profile.d/nix.sh"
fi
exec ${nix_bin} "\$@"
EOF
	sudo chmod 755 /usr/local/bin/nix
fi

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

if [ ! -x /usr/local/bin/nix ]; then
	echo "nix is not installed" >&2
	exit 1
fi

nix store ping >/dev/null
