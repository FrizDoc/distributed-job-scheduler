#!/usr/bin/env bash
# usage: ./register.sh [email] [password]
source "$(dirname "$0")/env.sh"

EMAIL="${1:-test@example.com}"
PASSWORD="${2:-secret123}"

curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"testuser\",
    \"email\": \"$EMAIL\",
    \"age\": 25,
    \"password\": \"$PASSWORD\"
  }" | pretty
