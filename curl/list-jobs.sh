#!/usr/bin/env bash
# usage: ./list-jobs.sh [status] [page] [limit]
# status: waiting | delayed | active | completed | failed | paused | cancelled
source "$(dirname "$0")/env.sh"

QUERY="page=${2:-1}&limit=${3:-20}"
[ -n "$1" ] && QUERY="$QUERY&status=$1"

curl -s "$BASE_URL/api/jobs?$QUERY" \
  -H "Authorization: Bearer $TOKEN" | pretty
