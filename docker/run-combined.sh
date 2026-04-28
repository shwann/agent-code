#!/usr/bin/env bash
set -euo pipefail

server_host="${SERVER_HOST:-0.0.0.0}"
server_port="${SERVER_PORT:-3456}"
enable_adapters="${AGENT_CODE_ENABLE_ADAPTERS:-1}"

export ADAPTER_SERVER_URL="${ADAPTER_SERVER_URL:-ws://127.0.0.1:${server_port}}"

pids=()

shutdown() {
  trap - TERM INT EXIT
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait "${pids[@]}" 2>/dev/null || true
}

trap shutdown TERM INT EXIT

bun run src/server/index.ts --host "$server_host" --port "$server_port" &
server_pid="$!"
pids+=("$server_pid")

server_ready=0
for _ in $(seq 1 60); do
  if (echo > "/dev/tcp/127.0.0.1/${server_port}") >/dev/null 2>&1; then
    server_ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid"
    exit $?
  fi
  sleep 1
done

if [[ "$server_ready" != "1" ]]; then
  echo "[Combined] server did not become ready on 127.0.0.1:${server_port}" >&2
  exit 1
fi

if [[ "$enable_adapters" == "1" ]]; then
  bun run desktop/sidecars/claude-sidecar.ts adapters --feishu &
  pids+=("$!")
else
  echo "[Combined] adapters disabled by AGENT_CODE_ENABLE_ADAPTERS=${enable_adapters}"
fi

set +e
wait -n "${pids[@]}"
exit_code="$?"
set -e
shutdown
exit "$exit_code"
