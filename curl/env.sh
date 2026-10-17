BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN_FILE="$(dirname "${BASH_SOURCE[0]}")/.token"

if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then
  TOKEN="$(cat "$TOKEN_FILE")"
fi

pretty() {
  if command -v jq >/dev/null; then jq .; else cat; echo; fi
}
