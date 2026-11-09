#!/usr/bin/env bash
#
# Enables the repository hooks that guard this project. Run once after cloning.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/*

printf 'Hooks enabled: core.hooksPath=%s\n' "$(git config core.hooksPath)"

if ! command -v gitleaks >/dev/null 2>&1; then
  printf '\nWarning: gitleaks is not installed, so the secret scan will block every commit.\n'
  printf 'Install it with: brew install gitleaks\n'
fi
