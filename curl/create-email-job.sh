#!/usr/bin/env bash
# usage: ./create-email-job.sh [to]
source "$(dirname "$0")/env.sh"

TO="${1:-someone@example.com}"

curl -s -X POST "$BASE_URL/api/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"welcome email\",
    \"queue\": \"emails\",
    \"type\": \"email\",
    \"payload\": {
      \"to\": \"$TO\",
      \"subject\": \"Welcome\",
      \"body\": \"Thanks for signing up\"
    },
    \"attempts\": 3,
    \"backoff\": { \"type\": \"exponential\", \"delay\": 1000 }
  }" | pretty
