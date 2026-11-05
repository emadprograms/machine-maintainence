#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Build frontend..."
cd "$ROOT/frontend"
npm ci
npm run build

echo "🔨 Build backend..."
cd "$ROOT/backend"
npm ci
npm run build

echo "🚀 Démarrage production (port ${PORT:-8080})..."
export NODE_ENV=production
export PORT="${PORT:-8080}"
export MAINTAINX_DB_PATH="${MAINTAINX_DB_PATH:-$ROOT/backend/data/maintainx.db}"
mkdir -p "$(dirname "$MAINTAINX_DB_PATH")"
exec node dist/index.js
