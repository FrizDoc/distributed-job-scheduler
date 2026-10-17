#!/usr/bin/env bash
# usage: ./update-job.sh <jobId> [json body]
# payload can only be changed while the job is still waiting
source "$(dirname "$0")/env.sh"

if [ -z "$1" ]; then
  echo "usage: $0 <jobId> [json body]"
  exit 1
fi

DEFAULT_BODY='{"name": "updated job", "payload": {"to": "updated@example.com"}}'
BODY="${2:-$DEFAULT_BODY}"

curl -s -X PATCH "$BASE_URL/api/jobs/$1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" | pretty
