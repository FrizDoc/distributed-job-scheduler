#!/usr/bin/env bash
# usage: ./get-job.sh <jobId> [emails|notifications]
source "$(dirname "$0")/env.sh"

if [ -z "$1" ]; then
  echo "usage: $0 <jobId> [emails|notifications]"
  exit 1
fi

curl -s "$BASE_URL/api/jobs/$1?queueName=${2:-emails}" \
  -H "Authorization: Bearer $TOKEN" | pretty
