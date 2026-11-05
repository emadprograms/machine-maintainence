#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""

cleanup() {
  echo ""
  echo "Arrêt du serveur..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Arrêté"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "MaintainX Pro — Démarrage..."

echo "Installation des dépendances..."
cd "$PROJECT_DIR/frontend" && npm install --silent
cd "$PROJECT_DIR/backend" && npm install --silent

echo "Build du frontend..."
cd "$PROJECT_DIR/frontend" && npx vite build --logLevel warn

echo "Démarrage du backend (port 3001)..."
cd "$PROJECT_DIR/backend"
npx tsx src/index.ts &
BACKEND_PID=$!

echo ""
echo "Projet lancé sur http://localhost:3001"
echo "Ctrl+C pour arrêter"
echo ""

wait
