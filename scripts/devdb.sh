#!/usr/bin/env bash
# 啟動/停止本機開發用的 PostgreSQL 與 Redis
# 用法: ./scripts/devdb.sh start|stop|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="$ROOT/.local/pg16/bin"
PGDATA="$ROOT/.local/pgdata"
REDIS_BIN="$ROOT/.local/redis"
REDISDATA="$ROOT/.local/redisdata"
export PATH="$PG_BIN:$PATH"

resolve_command() {
  local bundled="$1"
  local name="$2"
  if [[ -x "$bundled" ]]; then
    printf '%s' "$bundled"
  else
    command -v "$name" 2>/dev/null || true
  fi
}

tcp_open() {
  (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

PG_ISREADY="$(resolve_command "$PG_BIN/pg_isready" pg_isready)"
PG_CTL="$(resolve_command "$PG_BIN/pg_ctl" pg_ctl)"
REDIS_CLI="$(resolve_command "$REDIS_BIN/redis-cli" redis-cli)"
REDIS_SERVER="$(resolve_command "$REDIS_BIN/redis-server" redis-server)"

case "${1:-}" in
  start)
    if [[ -n "$PG_ISREADY" ]] && "$PG_ISREADY" -h localhost -p 5432 >/dev/null 2>&1; then
      echo "PostgreSQL already available on port 5432"
    elif tcp_open 5432; then
      echo "PostgreSQL already available on port 5432"
    elif [[ -n "$PG_CTL" && -d "$PGDATA" ]]; then
      "$PG_CTL" -D "$PGDATA" -l "$PGDATA/server.log" -o "-p 5432" start
    else
      echo "PostgreSQL is unavailable; start Docker/Homebrew PostgreSQL or install the bundled local database." >&2
      exit 1
    fi
    if [[ -n "$REDIS_CLI" ]] && "$REDIS_CLI" -h localhost -p 6379 ping >/dev/null 2>&1; then
      echo "Redis already available on port 6379"
    elif tcp_open 6379; then
      echo "Redis already available on port 6379"
    elif [[ -n "$REDIS_SERVER" ]]; then
      mkdir -p "$REDISDATA"
      "$REDIS_SERVER" --port 6379 --daemonize yes \
        --dir "$REDISDATA" --logfile "$REDISDATA/redis.log"
    else
      echo "Redis is unavailable; start Docker/Homebrew Redis or install the bundled local service." >&2
      exit 1
    fi
    echo "PostgreSQL & Redis ready"
    ;;
  stop)
    [[ -z "$REDIS_CLI" ]] || "$REDIS_CLI" -p 6379 shutdown nosave 2>/dev/null || true
    [[ -z "$PG_CTL" || ! -d "$PGDATA" ]] || "$PG_CTL" -D "$PGDATA" stop || true
    echo "PostgreSQL & Redis stopped"
    ;;
  status)
    echo "--- PostgreSQL ---"
    if [[ -n "$PG_ISREADY" ]]; then "$PG_ISREADY" -h localhost -p 5432; elif tcp_open 5432; then echo "accepting connections"; else echo "Not running"; fi
    echo "--- Redis ---"
    if [[ -n "$REDIS_CLI" ]]; then "$REDIS_CLI" -p 6379 ping || echo "Not running"; elif tcp_open 6379; then echo "PONG"; else echo "Not running"; fi
    ;;
  *)
    echo "Usage: $0 start|stop|status"
    exit 1
    ;;
esac
