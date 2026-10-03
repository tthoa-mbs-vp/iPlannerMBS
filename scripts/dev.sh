#!/bin/sh
# scripts/dev.sh — Khởi động đồng bộ Backend (PocketBase) + Frontend (Vite).
#
# Dùng làm preview command của Freebuff (`freebuff-preview set "sh scripts/dev.sh" 5173`)
# và cho dev local (`npm run dev:all` trong web/). Đảm bảo mỗi lần app khởi chạy,
# PocketBase (migrations + hooks + dữ liệu backend/pb_data) luôn chạy trước Vite.
#
# Idempotent: nếu PocketBase đã healthy thì không khởi động lại.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PB_PORT="${PB_PORT:-8090}"
VITE_PORT="${PORT:-5173}"

# ---------- 1. Đảm bảo binary PocketBase ----------
PB_BIN="${PB_BIN:-}"
if [ -z "$PB_BIN" ]; then
  for cand in "$ROOT/backend/pocketbase" "$ROOT/backend/bin/pocketbase" /tmp/pb-exp/pocketbase; do
    if [ -x "$cand" ]; then PB_BIN="$cand"; break; fi
  done
fi
if [ -z "$PB_BIN" ] || [ ! -x "$PB_BIN" ]; then
  echo "[dev.sh] Không tìm thấy binary PocketBase — tải v0.39.10 (linux_amd64) về backend/bin/ ..."
  mkdir -p "$ROOT/backend/bin"
  PB_BIN="$ROOT/backend/bin/pocketbase"
  curl -fsSL -o /tmp/pb-download.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v0.39.10/pocketbase_0.39.10_linux_amd64.zip"
  unzip -o -q /tmp/pb-download.zip -d "$ROOT/backend/bin"
  chmod +x "$PB_BIN"
  rm -f /tmp/pb-download.zip
fi

# ---------- 2. Khởi động PocketBase nếu chưa healthy ----------
PB_DATA="$ROOT/backend/pb_data"
mkdir -p "$PB_DATA"

health() {
  curl -fsS --max-time 2 "http://127.0.0.1:$PB_PORT/api/health" >/dev/null 2>&1
}

if ! health; then
  echo "[dev.sh] Khởi động PocketBase trên 127.0.0.1:$PB_PORT ..."
  nohup "$PB_BIN" serve \
    --http="127.0.0.1:$PB_PORT" \
    --hooksDir="$ROOT/backend/pb_hooks" \
    --migrationsDir="$ROOT/backend/pb_migrations" \
    --publicDir="$ROOT/backend/pb_public" \
    --dir="$PB_DATA" \
    > "$PB_DATA/pb.log" 2>&1 &

  i=0
  until health; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "[dev.sh] LỖI: PocketBase không healthy sau 30s — log:"
      tail -20 "$PB_DATA/pb.log" 2>/dev/null || true
      exit 1
    fi
    sleep 0.5
  done
  echo "[dev.sh] PocketBase healthy."
fi

# ---------- 3. Chạy Vite dev server (foreground) ----------
echo "[dev.sh] Khởi động Vite trên port $VITE_PORT ..."
cd "$ROOT/web"
exec npm run dev
