#!/usr/bin/env bash
# usage: ./login.sh [email] [password]
# saves the access token to curl/.token for the other scripts
source "$(dirname "$0")/env.sh"

EMAIL="${1:-test@example.com}"
PASSWORD="${2:-secret123}"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

echo "$RESPONSE" | pretty

ACCESS_TOKEN=$(echo "$RESPONSE" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [ -n "$ACCESS_TOKEN" ]; then
  echo "$ACCESS_TOKEN" > "$TOKEN_FILE"
  echo "token saved to $TOKEN_FILE"
fi
