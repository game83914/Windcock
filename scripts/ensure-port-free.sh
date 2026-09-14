#!/usr/bin/env bash
# 開發前檢查：若目標埠已被占用，則跳過啟動，避免重複啟動造成 EADDRINUSE。
# 用法: ./scripts/ensure-port-free.sh <port> <service-name> [health-url] [response-marker]
set -euo pipefail

PORT="${1:?需要指定 port}"
NAME="${2:-service}"
HEALTH_URL="${3:-}"
RESPONSE_MARKER="${4:-}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if [[ -n "$HEALTH_URL" ]]; then
    for _ in 1 2 3 4 5; do
      RESPONSE="$(curl --fail --silent --show-error --max-time 2 "$HEALTH_URL" 2>/dev/null || true)"
      if [[ -n "$RESPONSE" && ( -z "$RESPONSE_MARKER" || "$RESPONSE" == *"$RESPONSE_MARKER"* ) ]]; then
        echo "${NAME} 已在 port ${PORT} 正常執行，跳過重複啟動。"
        exit 3
      fi
      sleep 1
    done
  fi
  echo "錯誤：port ${PORT} 已被其他或異常程序占用，${NAME} 未啟動。" >&2
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2 || true
  exit 1
fi

exit 0
