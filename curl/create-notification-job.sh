#!/usr/bin/env bash
# usage: ./create-notification-job.sh [title]
source "$(dirname "$0")/env.sh"

TITLE="${1:-Hello}"

curl -s -X POST "$BASE_URL/api/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"push notification\",
    \"queue\": \"pushNotifications\",
    \"type\": \"notification\",
    \"payload\": {
      \"title\": \"$TITLE\",
      \"body\": \"You have a new message\"
    }
  }" | pretty
