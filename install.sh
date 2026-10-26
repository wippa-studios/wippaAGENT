#!/usr/bin/env bash
#
# install.sh - install the wippaAGENT agent set into OpenCode.
#
# The installer copies the agent definitions, the subagent search skill and the
# tools plugin into an OpenCode configuration directory. It never removes or
# overwrites anything it did not put there, unless --force is given.
#
# Source repository: https://github.com/wippa-studios/wippaAGENT
# The file agentWIPPA.md is the primary agent definition. It is an agent id,
# not the name of this repository.

set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd -P)"

REPOSITORY="wippa-studios/wippaAGENT"
PRIMARY_AGENT_FILE="agentWIPPA.md"
SKILL_NAME="wippa-subagent-search"
PLUGIN_NAME="wippa-subagent"

SCOPE="global"
PROJECT_DIR=""
DRY_RUN=0
FORCE=0
UNINSTALL=0
APPLY_CONFIG=0

INSTALLED_FILES=0
SKIPPED_FILES=0
REMOVED_FILES=0
KEPT_FILES=0
AGENTS_INSTALLED=0

usage() {
  cat <<'EOF'
Usage: install.sh [OPTIONS]

Install the wippaAGENT agent set into OpenCode.

Scope:
  --global            Install into ~/.config/opencode/          (default)
  --project [DIR]     Install into <DIR>/.opencode/              (DIR defaults to
                      the current directory)

Options:
  --dry-run           Print every planned action and write nothing
  --force             Overwrite files that already exist
  --uninstall         Remove the agent files, the skill and the plugin this
                      installer placed in the target
  --apply-config      Merge the required keys into the target opencode.json
                      (JSON or JSONC) without changing values that are already
                      set; validate it before copying anything
  -h, --help          Print this help and exit

Examples:
  ./install.sh
  ./install.sh --global
  ./install.sh --project /path/to/project
  ./install.sh --project --dry-run
  ./install.sh --global --force --apply-config
  ./install.sh --project /path/to/project --uninstall

Requirements:
  bash and the usual POSIX utilities (cat, cmp, cp, id, ls, mkdir, printf, rm, rmdir).
  Node is needed only for --apply-config.
EOF
}

say() {
  printf '%s\n' "$*"
}

step() {
  printf '\n%s\n' "$*"
}

info() {
  printf '  %s\n' "$*"
}

err() {
  printf 'error: %s\n' "$*" >&2
}

# ---------------------------------------------------------------- arguments

while [ "$#" -gt 0 ]; do
  case "$1" in
    --global)
      SCOPE="global"
      shift
      ;;
    --project)
      SCOPE="project"
      if [ "$#" -ge 2 ] && [ "${2#-}" = "$2" ] && [ -n "$2" ]; then
        PROJECT_DIR="$2"
        shift 2
      else
        shift
      fi
      ;;
    --project=*)
      SCOPE="project"
      PROJECT_DIR="${1#--project=}"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --uninstall)
      UNINSTALL=1
      shift
      ;;
    --apply-config)
      APPLY_CONFIG=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "unknown option: $1"
      usage >&2
      exit 2
      ;;
  esac
done

# ------------------------------------------------------------------- source

if [ ! -d "$SCRIPT_DIR/categories" ]; then
  err "categories/ not found in $SCRIPT_DIR"
  err "run this script from a checkout of the agent set"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/$PRIMARY_AGENT_FILE" ]; then
  err "$PRIMARY_AGENT_FILE not found in $SCRIPT_DIR"
  err "run this script from a checkout of the agent set"
  exit 1
fi

# ------------------------------------------------------------------- target

if [ "$SCOPE" = "global" ]; then
  TARGET_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
else
  BASE_DIR="${PROJECT_DIR:-$PWD}"
  if [ ! -d "$BASE_DIR" ]; then
    err "project directory does not exist: $BASE_DIR"
    exit 1
  fi
  BASE_DIR="$(cd "$BASE_DIR" && pwd -P)"
  TARGET_DIR="$BASE_DIR/.opencode"
fi

if [ "$SCOPE" = "global" ] && [ "$(id -u)" -eq 0 ]; then
  say "note: running as root — installed files will be owned by root"
fi

AGENTS_DIR="$TARGET_DIR/agents"
SKILLS_DIR="$TARGET_DIR/skills"
PLUGINS_DIR="$TARGET_DIR/plugins"
CONFIG_FILE="$TARGET_DIR/opencode.json"

# ------------------------------------------------------------------ helpers

# Compare two files byte for byte with cmp. Returns 0 when they are identical.
files_equal() {
  local left="$1"
  local right="$2"
  [ -f "$left" ] || return 1
  [ -f "$right" ] || return 1
  cmp -s "$left" "$right"
}

# Copy one file, honouring --force and --dry-run.
copy_file() {
  local src="$1"
  local dst="$2"

  if [ -e "$dst" ] && [ "$FORCE" -eq 0 ]; then
    SKIPPED_FILES=$((SKIPPED_FILES + 1))
    printf '  skipped    %s (already exists, use --force to overwrite)\n' "$dst"
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -e "$dst" ]; then
      printf '  would overwrite %s\n' "$dst"
    else
      printf '  would install  %s\n' "$dst"
    fi
    return 0
  fi

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  INSTALLED_FILES=$((INSTALLED_FILES + 1))
  printf '  installed  %s\n' "$dst"
}

# Copy a directory tree, file by file, so existing files are never overwritten
# without --force. Test files are skipped, so test code never reaches a user
# install.
copy_tree() {
  local src="$1"
  local dst="$2"
  local entry
  local name

  [ -d "$src" ] || return 0

  for entry in "$src"/*; do
    [ -e "$entry" ] || continue
    name="${entry##*/}"
    case "$name" in
      *.test.ts) continue ;;
    esac
    if [ -d "$entry" ]; then
      copy_tree "$entry" "$dst/$name"
    else
      copy_file "$entry" "$dst/$name"
    fi
  done
}

# Remove the files of a source tree from the matching destination tree. Only
# files that are identical to the source are removed, so anything the user
# changed afterwards is left in place.
remove_tree_files() {
  local src="$1"
  local dst="$2"
  local entry
  local name

  [ -d "$src" ] || return 0

  for entry in "$src"/*; do
    [ -e "$entry" ] || continue
    name="${entry##*/}"
    if [ -d "$entry" ]; then
      remove_tree_files "$entry" "$dst/$name"
    elif files_equal "$entry" "$dst/$name"; then
      if [ "$DRY_RUN" -eq 1 ]; then
        printf '  would remove  %s\n' "$dst/$name"
      else
        rm -f "$dst/$name"
      fi
      REMOVED_FILES=$((REMOVED_FILES + 1))
    elif [ -e "$dst/$name" ]; then
      KEPT_FILES=$((KEPT_FILES + 1))
      printf '  kept       %s (differs from the installed copy)\n' "$dst/$name"
    fi
  done
}

# Remove a directory only when it is empty, so nothing of the user's is lost.
remove_dir_if_empty() {
  local dir="$1"

  [ -d "$dir" ] || return 0

  if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '  would remove  %s (empty)\n' "$dir"
    else
      rmdir "$dir" 2>/dev/null || true
    fi
  fi
}

# Remove directories that are now empty, deepest first.
prune_empty_dirs() {
  local dir="$1"
  local entry

  [ -d "$dir" ] || return 0

  for entry in "$dir"/*; do
    [ -e "$entry" ] || continue
    if [ -d "$entry" ]; then
      prune_empty_dirs "$entry"
    fi
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
      printf '  would remove  %s (empty)\n' "$dir"
    fi
  else
    rmdir "$dir" 2>/dev/null || true
  fi
}

print_config_keys() {
  # No "skills" or "plugins" entries are printed here. The skill is installed
  # into <scope>/skills/ and the tools plugin into <scope>/plugins/, and both
  # of those directories are auto-discovery locations in OpenCode V2, so the
  # two are found without any configuration key. A relative path in those
  # arrays would resolve against the user's working directory rather than
  # against the location of their config file.
  cat <<'JSON'
{
  "default_agent": "agentWIPPA",
  "agents": {
    "general": { "disabled": true },
    "explore": { "disabled": true },
    "build": {
      "mode": "subagent",
      "description": "Writes and changes code. The implementation specialist — hands for substantial coding work when the parent agent delegates. Use directly only for a single well-scoped coding task.",
      "permissions": [
        { "action": "subagent", "resource": "*", "effect": "deny" }
      ]
    }
  },
  "mcp": {
    "servers": {
      "github": {
        "type": "remote",
        "url": "https://api.githubcopilot.com/mcp/",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}",
          "X-MCP-Toolsets": "context,repos,issues,pull_requests,actions,code_security,notifications"
        }
      },
      "context7": {
        "type": "remote",
        "url": "https://mcp.context7.com/mcp",
        "oauth": false
      },
      "playwright": {
        "type": "local",
        "command": [
          "npx",
          "--yes",
          "@playwright/mcp@0.0.83",
          "--isolated"
        ]
      }
    }
  }
}
JSON
}

# Parse the target config the way OpenCode does: JSON, plus the comments and
# trailing commas that opencode.json is allowed to contain. Prints nothing on
# success; the merge mode then writes the required keys.
config_script() {
  local mode="$1"

  node --input-type=module - "$CONFIG_FILE" "$mode" <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';

const configPath = process.argv[2];
const mode = process.argv[3];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Strips // and /* */ comments and a trailing comma before a closing brace or
// bracket, while leaving any such sequence inside a string untouched. URLs in
// the config contain //, so a naive strip would corrupt them.
function parseJsonc(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  let out = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        out += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    out += char;
  }

  return out.replace(/,(\s*[}\]])/g, '$1');
}

const added = [];
const kept = [];

let config = {};
if (fs.existsSync(configPath)) {
  const raw = fs.readFileSync(configPath, 'utf8');
  if (raw.trim().length > 0) {
    try {
      config = JSON.parse(parseJsonc(raw));
    } catch (error) {
      console.error(`error: ${configPath} is not valid JSON or JSONC: ${error.message}`);
      process.exit(1);
    }
  }
}

if (!isPlainObject(config)) {
  console.error(`error: ${configPath} does not contain a JSON object`);
  process.exit(1);
}

// A container the merge would write into must already be an object. Silently
// replacing a string or an array would discard whatever the user meant by it.
for (const [key, value] of [
  ['agents', config.agents],
  ['mcp', config.mcp],
  ['mcp.servers', isPlainObject(config.mcp) ? config.mcp.servers : undefined],
]) {
  if (value !== undefined && !isPlainObject(value)) {
    console.error(`error: ${configPath} has a "${key}" value that is not an object`);
    process.exit(1);
  }
}

if (mode === 'validate') {
  process.exit(0);
}

function put(container, key, value, label) {
  if (Object.prototype.hasOwnProperty.call(container, key)) {
    kept.push(label);
    return;
  }
  container[key] = value;
  added.push(label);
}

put(config, 'default_agent', 'agentWIPPA', 'default_agent');

if (!Object.prototype.hasOwnProperty.call(config, 'agents') || config.agents === null) {
  config.agents = {};
}
put(config.agents, 'general', { disabled: true }, 'agents.general');
put(config.agents, 'explore', { disabled: true }, 'agents.explore');
put(config.agents, 'build', {
  mode: 'subagent',
  description: 'Writes and changes code. The implementation specialist — hands for substantial coding work when the parent agent delegates. Use directly only for a single well-scoped coding task.',
  permissions: [
    { action: 'subagent', resource: '*', effect: 'deny' },
  ],
}, 'agents.build');

if (!Object.prototype.hasOwnProperty.call(config, 'mcp') || config.mcp === null) {
  config.mcp = {};
}
if (!Object.prototype.hasOwnProperty.call(config.mcp, 'servers') || config.mcp.servers === null) {
  config.mcp.servers = {};
}
const servers = config.mcp.servers;
put(servers, 'github', {
  type: 'remote',
  url: 'https://api.githubcopilot.com/mcp/',
  oauth: false,
  headers: {
    Authorization: 'Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}',
    'X-MCP-Toolsets': 'context,repos,issues,pull_requests,actions,code_security,notifications',
  },
}, 'mcp.servers.github');
put(servers, 'context7', {
  type: 'remote',
  url: 'https://mcp.context7.com/mcp',
  oauth: false,
}, 'mcp.servers.context7');
put(servers, 'playwright', {
  type: 'local',
  command: ['npx', '--yes', '@playwright/mcp@0.0.83', '--isolated'],
}, 'mcp.servers.playwright');

// Every key is already present, so the file needs no change. Skipping the write
// keeps the user's comments, formatting and trailing commas intact.
if (added.length === 0) {
  for (const label of kept) {
    console.log(`  kept       ${label} (already present)`);
  }
  process.exit(0);
}

// No "skills" or "plugins" key is written here. The skill is installed into
// <scope>/skills/ and the tools plugin into <scope>/plugins/, and both of
// those directories are auto-discovery locations in OpenCode V2, so the two
// are found without any configuration key. A relative path in those arrays
// would resolve against the user's working directory rather than against the
// location of their config file.

// The temp name is unpredictable so it cannot be pre-created as a symlink or
// pointed at a file we do not own, and the 'wx' flag makes an existing file at
// that path an error (EEXIST) rather than something to follow or overwrite.
const payload = `${JSON.stringify(config, null, 2)}\n`;
const newTempPath = () => `${configPath}.tmp-${crypto.randomUUID()}`;

let tempPath = newTempPath();
let wroteTemp = false;
try {
  try {
    fs.writeFileSync(tempPath, payload, { encoding: 'utf8', flag: 'wx' });
    wroteTemp = true;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    // Collision on the random name: one retry with a fresh one, then give up.
    tempPath = newTempPath();
    fs.writeFileSync(tempPath, payload, { encoding: 'utf8', flag: 'wx' });
    wroteTemp = true;
  }
  // Preserve the user's chosen mode across the atomic replace, since rename
  // would otherwise leave the temp file's umask-derived mode in place.
  try {
    fs.chmodSync(tempPath, fs.statSync(configPath).mode);
  } catch {
    // Best effort: no existing target (or a chmod failure) must not break the write.
  }
  fs.renameSync(tempPath, configPath);
} catch (error) {
  if (wroteTemp) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // The temp file may not exist when the write itself failed.
    }
  }
  console.error(`error: could not write ${configPath}: ${error.message}`);
  process.exit(1);
}

for (const label of added) {
  console.log(`  added      ${label}`);
}
for (const label of kept) {
  console.log(`  kept       ${label} (already present)`);
}
NODE
}

# Fail before anything is copied when --apply-config was asked for and the
# target config cannot be parsed or has the wrong shape. A failed merge used to
# leave thirteen agent files behind, so a second run then skipped them.
validate_config() {
  if ! command -v node >/dev/null 2>&1; then
    err "node is required for --apply-config"
    exit 1
  fi
  config_script validate
}

apply_config() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  would merge the required keys into %s\n' "$CONFIG_FILE"
    return 0
  fi

  mkdir -p "$TARGET_DIR"
  config_script merge
}

# --------------------------------------------------------------- uninstall

if [ "$UNINSTALL" -eq 1 ]; then
  say "wippaAGENT installer"
  say "source   : $SCRIPT_DIR"
  say "target   : $TARGET_DIR"
  say "mode     : uninstall"
  [ "$DRY_RUN" -eq 1 ] && say "dry run   : yes, nothing will be written"

  step "Agents"
  if [ -f "$SCRIPT_DIR/$PRIMARY_AGENT_FILE" ]; then
    if files_equal "$SCRIPT_DIR/$PRIMARY_AGENT_FILE" "$AGENTS_DIR/$PRIMARY_AGENT_FILE"; then
      if [ "$DRY_RUN" -eq 1 ]; then
        printf '  would remove  %s\n' "$AGENTS_DIR/$PRIMARY_AGENT_FILE"
      else
        rm -f "$AGENTS_DIR/$PRIMARY_AGENT_FILE"
      fi
      REMOVED_FILES=$((REMOVED_FILES + 1))
    elif [ -e "$AGENTS_DIR/$PRIMARY_AGENT_FILE" ]; then
      KEPT_FILES=$((KEPT_FILES + 1))
      printf '  kept       %s (differs from the installed copy)\n' "$AGENTS_DIR/$PRIMARY_AGENT_FILE"
    fi
  fi

  for src in "$SCRIPT_DIR"/categories/*/*.md; do
    [ -f "$src" ] || continue
    name="${src##*/}"
    if files_equal "$src" "$AGENTS_DIR/$name"; then
      if [ "$DRY_RUN" -eq 1 ]; then
        printf '  would remove  %s\n' "$AGENTS_DIR/$name"
      else
        rm -f "$AGENTS_DIR/$name"
      fi
      REMOVED_FILES=$((REMOVED_FILES + 1))
    elif [ -e "$AGENTS_DIR/$name" ]; then
      KEPT_FILES=$((KEPT_FILES + 1))
      printf '  kept       %s (differs from the installed copy)\n' "$AGENTS_DIR/$name"
    fi
  done

  step "Skill"
  if [ -d "$SCRIPT_DIR/skills/$SKILL_NAME" ]; then
    remove_tree_files "$SCRIPT_DIR/skills/$SKILL_NAME" "$SKILLS_DIR/$SKILL_NAME"
    prune_empty_dirs "$SKILLS_DIR/$SKILL_NAME"
  fi

  step "Tools plugin"
  if [ -d "$SCRIPT_DIR/tools" ]; then
    remove_tree_files "$SCRIPT_DIR/tools" "$PLUGINS_DIR/$PLUGIN_NAME"
    prune_empty_dirs "$PLUGINS_DIR/$PLUGIN_NAME"
  fi

  remove_dir_if_empty "$AGENTS_DIR"
  remove_dir_if_empty "$SKILLS_DIR"
  remove_dir_if_empty "$PLUGINS_DIR"

  step "Summary"
  say "  files removed  : $REMOVED_FILES"
  say "  files kept     : $KEPT_FILES"
  if [ "$DRY_RUN" -eq 1 ]; then
    say "  dry run        : nothing was written"
  fi
  say ""
  say "  The configuration file was left alone: $CONFIG_FILE"
  say "  Remove the wippaAGENT keys from it by hand if you no longer want them."
  exit 0
fi

# ----------------------------------------------------------------- install

AGENT_SOURCE_COUNT=0
for src in "$SCRIPT_DIR"/categories/*/*.md; do
  [ -f "$src" ] || continue
  AGENT_SOURCE_COUNT=$((AGENT_SOURCE_COUNT + 1))
done
AGENT_TOTAL=$((AGENT_SOURCE_COUNT + 1))

say "wippaAGENT installer"
say "source   : $SCRIPT_DIR"
say "target   : $TARGET_DIR"
say "scope    : $SCOPE"
[ "$DRY_RUN" -eq 1 ] && say "dry run  : yes, nothing will be written"

# Validate before step 1 copies anything, so an unparseable config cannot leave
# a half-installed scope behind.
if [ "$APPLY_CONFIG" -eq 1 ]; then
  validate_config
fi

step "1. Agents ($AGENT_TOTAL)"
AGENTS_BEFORE=$INSTALLED_FILES
if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$AGENTS_DIR"
fi
copy_file "$SCRIPT_DIR/$PRIMARY_AGENT_FILE" "$AGENTS_DIR/$PRIMARY_AGENT_FILE"
for src in "$SCRIPT_DIR"/categories/*/*.md; do
  [ -f "$src" ] || continue
  name="${src##*/}"
  copy_file "$src" "$AGENTS_DIR/$name"
done
# Only the agent files that were really written are counted, so a second run
# over an installed scope reports zero rather than the total.
AGENTS_INSTALLED=$((INSTALLED_FILES - AGENTS_BEFORE))

step "2. Skill ($SKILL_NAME)"
if [ -d "$SCRIPT_DIR/skills/$SKILL_NAME" ]; then
  if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$SKILLS_DIR"
  fi
  copy_tree "$SCRIPT_DIR/skills/$SKILL_NAME" "$SKILLS_DIR/$SKILL_NAME"
else
  info "skipped    $SCRIPT_DIR/skills/$SKILL_NAME (not found in this checkout)"
fi

step "3. Tools plugin ($PLUGIN_NAME)"
if [ -d "$SCRIPT_DIR/tools" ]; then
  if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$PLUGINS_DIR"
  fi
  copy_tree "$SCRIPT_DIR/tools" "$PLUGINS_DIR/$PLUGIN_NAME"
else
  info "skipped    $SCRIPT_DIR/tools (not found in this checkout)"
fi

step "4. Configuration keys to merge into $CONFIG_FILE"
print_config_keys

if [ "$APPLY_CONFIG" -eq 1 ]; then
  step "Applying the configuration"
  apply_config
fi

step "Summary"
say "  agents written      : $AGENTS_INSTALLED"
say "  agent files total   : $AGENT_TOTAL"
say "  skill installed    : $SKILL_NAME"
say "  plugin installed   : $PLUGIN_NAME"
say "  files written      : $INSTALLED_FILES"
say "  files skipped      : $SKIPPED_FILES"
if [ "$DRY_RUN" -eq 1 ]; then
  say "  dry run            : nothing was written"
fi
say ""
say "  Next steps:"
say "  1. Restart OpenCode so the new roster is loaded."
say "  2. Set \"default_agent\": \"agentWIPPA\" in $CONFIG_FILE"
say "     (or re-run with --apply-config to merge the keys above)."
say "  3. Export GITHUB_PERSONAL_ACCESS_TOKEN for the github MCP server."
say "  4. Remove it again with: $0 --uninstall${PROJECT_DIR:+ --project $PROJECT_DIR}"
say "  5. Upstream: https://github.com/$REPOSITORY"
