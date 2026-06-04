#!/bin/bash
set -e

echo ""
echo "  DealIQ — Deploying both projects"
echo "  ================================"
echo ""

# ── BACKEND ──────────────────────────────────────────────────
echo "  → Backend..."
vercel --prod
echo "  ✓ Backend deployed"
echo ""

# ── FRONTEND ─────────────────────────────────────────────────
# Swap root .vercel config to the frontend project, deploy, restore
echo "  → Frontend..."
cp .vercel/project.json /tmp/dealiq-backend-config.json
cp frontend/.vercel/project.json .vercel/project.json
vercel --prod
cp /tmp/dealiq-backend-config.json .vercel/project.json
echo "  ✓ Frontend deployed"

echo ""
echo "  Done! Both live."
echo ""
