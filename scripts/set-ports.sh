#!/bin/bash

set -euo pipefail

BASE_POSTGRES_PORT=5432
BASE_SERVER_PORT=10020
BASE_SERVER_DEBUG_PORT=9229
BASE_WORKER_PORT=10030
BASE_CLIENT_PORT=3000
BASE_CLIENT_HMR_PORT=3010

check_port() {
  local port=$1
  if lsof -i :"$port" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

check_all_ports() {
  local offset=$1
  local postgres_port=$((BASE_POSTGRES_PORT + offset))
  local server_port=$((BASE_SERVER_PORT + offset))
  local server_debug_port=$((BASE_SERVER_DEBUG_PORT + offset))
  local worker_port=$((BASE_WORKER_PORT + offset))
  local client_port=$((BASE_CLIENT_PORT + offset))
  local client_hmr_port=$((BASE_CLIENT_HMR_PORT + offset))

  check_port "$postgres_port" && \
  check_port "$server_port" && \
  check_port "$server_debug_port" && \
  check_port "$worker_port" && \
  check_port "$client_port" && \
  check_port "$client_hmr_port"
}

find_available_ports() {
  local offset=0
  local max_attempts=10

  for ((i=0; i<max_attempts; i++)); do
    if check_all_ports "$offset"; then
      echo "$offset"
      return 0
    fi
    offset=$((offset + 100))
  done

  echo "Error: Could not find available ports after $max_attempts attempts" >&2
  exit 1
}

update_env_var() {
  local file=$1
  local var=$2
  local value=$3

  if grep -q "^${var}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${var}=.*|${var}=${value}|" "$file"
  else
    echo "${var}=${value}" >> "$file"
  fi
}

offset=$(find_available_ports)

POSTGRES_PORT=$((BASE_POSTGRES_PORT + offset))
SERVER_PORT=$((BASE_SERVER_PORT + offset))
SERVER_DEBUG_PORT=$((BASE_SERVER_DEBUG_PORT + offset))
WORKER_PORT=$((BASE_WORKER_PORT + offset))
CLIENT_PORT=$((BASE_CLIENT_PORT + offset))
CLIENT_HMR_PORT=$((BASE_CLIENT_HMR_PORT + offset))

# Update root .env for docker-compose
touch .env
update_env_var ".env" "POSTGRES_PORT" "$POSTGRES_PORT"
update_env_var ".env" "SERVER_PORT" "$SERVER_PORT"
update_env_var ".env" "SERVER_DEBUG_PORT" "$SERVER_DEBUG_PORT"
update_env_var ".env" "WORKER_PORT" "$WORKER_PORT"
update_env_var ".env" "CLIENT_PORT" "$CLIENT_PORT"
update_env_var ".env" "CLIENT_HMR_PORT" "$CLIENT_HMR_PORT"

# Update server/.env
update_env_var "server/.env" "PORT" "$SERVER_PORT"

# Update client/.env
update_env_var "client/.env" "VITE_CLIENT_BASE_URL" "http://localhost:$CLIENT_PORT"
update_env_var "client/.env" "VITE_SERVER_BASE_URL" "http://localhost:$SERVER_PORT"
update_env_var "client/.env" "VITE_HMR_PORT" "$CLIENT_HMR_PORT"

if [ "$offset" -eq 0 ]; then
  echo "Using default ports"
else
  echo "Default ports occupied, using offset +$offset"
fi

echo "  PostgreSQL: $POSTGRES_PORT"
echo "  Server:     $SERVER_PORT (debug: $SERVER_DEBUG_PORT)"
echo "  Worker:     $WORKER_PORT"
echo "  Client:     $CLIENT_PORT (HMR: $CLIENT_HMR_PORT)"
