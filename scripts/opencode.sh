#!/usr/bin/env bash
# Launch OpenCode with memory guard rails for its JavaScript runtime.
#
# The shipped OpenCode binary is built on Bun, and Bun's JavaScriptCore does
# not implement V8's --max-old-space-size. The V8 heap cap is therefore applied
# only to a Node runtime; a Bun runtime can opt into a hard address-space limit
# instead. Use scripts/opencode-memory.sh to report and compact the data
# directory.
set -euo pipefail

program=${0##*/}

usage() {
  cat <<'EOF'
Usage: opencode.sh [--wrapper-help] [opencode arguments...]

Launch OpenCode with memory guard rails for its JavaScript runtime.

Options:
  --wrapper-help   Print this wrapper's help and exit. Every other argument,
                   including --help and -h, is passed through to opencode.

Environment:
  WIPPA_OPENCODE_RUNTIME
                   auto (default), node, or bun. auto reads the first line of
                   the opencode launcher for "node" or "bun". For an ELF
                   binary it treats a "Bun v" string as bun; if that heuristic
                   does not match it defaults to bun with a warning.
  WIPPA_OPENCODE_HEAP_MB
                   V8 old-space cap in MiB, 256 to 8192 (default: 2048).
                   Applied only when the runtime is node, by appending
                   --max-old-space-size to NODE_OPTIONS unless that flag is
                   already present.
  WIPPA_OPENCODE_ADDRESS_SPACE_MB
                   Opt-in hard address-space limit in MiB for the bun runtime,
                   applied with ulimit -v before exec. A low limit can abort
                   the process.

The shipped Bun binary ignores --max-old-space-size. All arguments other than
--wrapper-help are passed through to opencode unchanged.
EOF
}

if [ "$#" -gt 0 ] && [ "$1" = "--wrapper-help" ]; then
  usage
  exit 0
fi

runtime=${WIPPA_OPENCODE_RUNTIME:-auto}
case "$runtime" in
  auto|node|bun) ;;
  *)
    printf '%s: WIPPA_OPENCODE_RUNTIME must be auto, node, or bun (got "%s")\n' \
      "$program" "$runtime" >&2
    exit 2
    ;;
esac

if ! command -v opencode >/dev/null 2>&1; then
  printf '%s: opencode was not found on PATH\n' "$program" >&2
  exit 127
fi
opencode_bin=$(command -v opencode)

# detect_runtime prints "node" or "bun". It returns 0 when the launcher names
# its runtime, and 1 when the ELF heuristic did not match and bun is assumed.
detect_runtime() {
  local bin=$1 first_line
  if [ "$(head -c 4 -- "$bin" 2>/dev/null)" = $'\177ELF' ]; then
    if grep -aq 'Bun v' "$bin" 2>/dev/null; then
      printf 'bun\n'
      return 0
    fi
    printf 'bun\n'
    return 1
  fi
  # Bound the read: a non-ELF binary may have no early newline.
  first_line=$(head -c 200 -- "$bin" 2>/dev/null | tr -d '\000' | sed -n '1p')
  case "$first_line" in
    *node*) printf 'node\n'; return 0 ;;
    *bun*) printf 'bun\n'; return 0 ;;
  esac
  printf 'bun\n'
  return 1
}

if [ "$runtime" = "auto" ]; then
  if detected=$(detect_runtime "$opencode_bin"); then
    runtime=$detected
  else
    runtime=$detected
    printf '%s: could not identify the opencode runtime; defaulting to bun (set WIPPA_OPENCODE_RUNTIME to override)\n' \
      "$program" >&2
  fi
fi

if [ "$runtime" = "node" ]; then
  heap_mb=${WIPPA_OPENCODE_HEAP_MB:-2048}

  case "$heap_mb" in
    ''|*[!0-9]*)
      printf '%s: WIPPA_OPENCODE_HEAP_MB must be a whole number between 256 and 8192 (got "%s")\n' \
        "$program" "$heap_mb" >&2
      exit 2
      ;;
  esac
  # Reject values too long to convert safely before the arithmetic below.
  # Strip leading zeros first so 00002048 is still 2048.
  heap_digits=${heap_mb#"${heap_mb%%[!0]*}"}
  if [ -z "$heap_digits" ]; then
    heap_digits=0
  fi
  if [ "${#heap_digits}" -gt 4 ]; then
    printf '%s: WIPPA_OPENCODE_HEAP_MB must be between 256 and 8192 MiB (got %s)\n' \
      "$program" "$heap_mb" >&2
    exit 2
  fi
  # Force decimal so a value such as 0400 is not read as octal.
  heap_mb=$((10#$heap_digits))

  if [ "$heap_mb" -lt 256 ] || [ "$heap_mb" -gt 8192 ]; then
    printf '%s: WIPPA_OPENCODE_HEAP_MB must be between 256 and 8192 MiB (got %s)\n' \
      "$program" "$heap_mb" >&2
    exit 2
  fi

  node_options=${NODE_OPTIONS:-}
  if printf '%s' "$node_options" | grep -Eq '(^|[[:space:]])--max-old-space-size([=[:space:]]|$)'; then
    printf '%s: NODE_OPTIONS already sets --max-old-space-size; leaving it unchanged\n' "$program" >&2
  else
    if [ -n "$node_options" ]; then
      export NODE_OPTIONS="${node_options} --max-old-space-size=${heap_mb}"
    else
      export NODE_OPTIONS="--max-old-space-size=${heap_mb}"
    fi
  fi
else
  printf '%s: the shipped Bun binary ignores --max-old-space-size; no V8 heap cap is applied\n' \
    "$program" >&2

  address_space_mb=${WIPPA_OPENCODE_ADDRESS_SPACE_MB:-}
  if [ -n "$address_space_mb" ]; then
    case "$address_space_mb" in
      ''|*[!0-9]*)
        printf '%s: WIPPA_OPENCODE_ADDRESS_SPACE_MB must be a whole number of MiB, at least 1 (got "%s")\n' \
          "$program" "$address_space_mb" >&2
        exit 2
        ;;
    esac
    address_digits=${address_space_mb#"${address_space_mb%%[!0]*}"}
    if [ -z "$address_digits" ]; then
      address_digits=0
    fi
    if [ "${#address_digits}" -gt 7 ]; then
      printf '%s: WIPPA_OPENCODE_ADDRESS_SPACE_MB is too large (got %s)\n' \
        "$program" "$address_space_mb" >&2
      exit 2
    fi
    address_space_mb=$((10#$address_digits))
    if [ "$address_space_mb" -lt 1 ]; then
      printf '%s: WIPPA_OPENCODE_ADDRESS_SPACE_MB must be at least 1 MiB (got %s)\n' \
        "$program" "$address_space_mb" >&2
      exit 2
    fi
    if ! ulimit -v $((address_space_mb * 1024)); then
      printf '%s: could not apply a %s MiB address-space limit with ulimit -v\n' \
        "$program" "$address_space_mb" >&2
      exit 1
    fi
    printf '%s: applied a %s MiB address-space limit with ulimit -v; a low limit can abort opencode\n' \
      "$program" "$address_space_mb" >&2
  fi
fi

exec "$opencode_bin" "$@"
