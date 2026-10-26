#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
python_bin=""
for candidate in python3.14 python3.13 python3.12 python3.11 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    version="$($candidate -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    major="${version%%.*}"
    minor="${version#*.}"
    if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]] && [ "$major" -eq 3 ] && [ "$minor" -ge 11 ]; then
      python_bin="$candidate"
      break
    fi
  fi
done
[ -n "$python_bin" ] || { echo "Python 3.11 ou supérieur requis." >&2; exit 2; }
exec "$python_bin" "$root/tests/documentation-validator.test.py"
