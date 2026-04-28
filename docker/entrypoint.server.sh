#!/usr/bin/env bash
set -euo pipefail

run_user="${AGENT_CODE_RUN_USER:-agentcode}"
run_uid="${AGENT_CODE_UID:-1000}"
run_gid="${AGENT_CODE_GID:-1000}"
home_dir="${AGENT_CODE_HOME:-/home/agentcode}"
config_dir="${CLAUDE_CONFIG_DIR:-${home_dir}/.claude}"
workspace_dir="${AGENT_CODE_WORKSPACE_DIR:-/workspace}"
cache_dir="${XDG_CACHE_HOME:-${home_dir}/.cache}"

export HOME="$home_dir"
export CLAUDE_CONFIG_DIR="$config_dir"
export AGENT_CODE_WORKSPACE_DIR="$workspace_dir"
export XDG_CACHE_HOME="$cache_dir"

if [[ "$(id -u)" != "0" ]]; then
  exec "$@"
fi

if ! [[ "$run_uid" =~ ^[0-9]+$ && "$run_gid" =~ ^[0-9]+$ ]]; then
  echo "AGENT_CODE_UID and AGENT_CODE_GID must be numeric" >&2
  exit 1
fi

if [[ "$run_uid" == "0" || "$run_gid" == "0" ]]; then
  echo "AGENT_CODE_UID and AGENT_CODE_GID must not be 0" >&2
  exit 1
fi

if ! getent group "$run_gid" >/dev/null; then
  groupadd --gid "$run_gid" "$run_user"
fi
run_group="$(getent group "$run_gid" | cut -d: -f1)"

if getent passwd "$run_uid" >/dev/null; then
  run_user="$(getent passwd "$run_uid" | cut -d: -f1)"
elif id "$run_user" >/dev/null 2>&1; then
  usermod --uid "$run_uid" --gid "$run_group" --home "$home_dir" "$run_user"
else
  useradd --create-home --home-dir "$home_dir" --uid "$run_uid" --gid "$run_group" --shell /bin/bash "$run_user"
fi

mkdir -p "$home_dir" "$config_dir" "$cache_dir" "$workspace_dir"
chown -R "$run_uid:$run_gid" "$home_dir" "$config_dir" "$cache_dir"

case "${AGENT_CODE_CHOWN_WORKSPACE:-auto}" in
  1|true|TRUE|yes|YES)
    chown -R "$run_uid:$run_gid" "$workspace_dir"
    ;;
  auto)
    owner="$(stat -c '%u:%g' "$workspace_dir" 2>/dev/null || true)"
    first_entry="$(find "$workspace_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)"
    if [[ "$owner" == "0:0" && -z "$first_entry" ]]; then
      chown "$run_uid:$run_gid" "$workspace_dir"
    fi
    ;;
esac

if command -v runuser >/dev/null 2>&1; then
  exec runuser --user "$run_user" -- "$@"
fi

exec su --shell /bin/bash "$run_user" --command "$(printf '%q ' "$@")"
