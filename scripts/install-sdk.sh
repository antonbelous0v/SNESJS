#!/usr/bin/env bash
set -euo pipefail

COMMIT="5e21ccfe80720f7ffffc739bb1db6165b0a96eea"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/opensnes"

if [ -d "$VENDOR/.git" ]; then
  echo "OpenSNES already vendored at $VENDOR"
  exit 0
fi

echo "Cloning OpenSNES at $COMMIT into $VENDOR ..."
git clone --recursive https://github.com/k0b3n4irb/opensnes.git "$VENDOR"
git -C "$VENDOR" checkout "$COMMIT"
git -C "$VENDOR" submodule update --init --recursive

echo "Building compiler and library ..."
make -C "$VENDOR" compiler
make -C "$VENDOR" lib

echo "OpenSNES SDK installed. Run 'snes doctor' to verify."
