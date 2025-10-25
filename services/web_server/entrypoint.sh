#!/usr/bin/env bash
set -euo pipefail

APP_PUBLIC_DIR="${APP_PUBLIC_DIR:-/app/public}"
TPL="${APP_PUBLIC_DIR}/index.html.tpl"
OUT="${APP_PUBLIC_DIR}/index.html"

ENVIRONMENT="${ENVIRONMENT:-}"
CANONICAL_URL="${CANONICAL_URL:-}"
GA_TAG_ID="${GA_TAG_ID:-}"
ROBOTS_TAG_CONTENT="${ROBOTS_TAG_CONTENT:-}"

if [[ -n "$ROBOTS_TAG_CONTENT" ]]; then
  ROBOTS_TAG="<meta name=\"robots\" content=\"${ROBOTS_TAG_CONTENT}\">"
else
  ROBOTS_TAG=""
fi

if [[ -n "${CANONICAL_URL}" ]]; then
  CANONICAL_TAG="<link rel=\"canonical\" href=\"${CANONICAL_URL}\"/>"
else
  CANONICAL_TAG=""
fi

if [[ "${ENVIRONMENT}" == "prod" && -n "${GA_TAG_ID}" ]]; then
  read -r -d '' GA_TAG_SCRIPT <<EOF || true
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_TAG_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_TAG_ID}');
</script>
EOF
else
  GA_TAG_SCRIPT=""
fi


esc() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'; }
ROBOTS_TAG_ESCAPED="$(esc "${ROBOTS_TAG}")"
CANONICAL_TAG_ESCAPED="$(esc "${CANONICAL_TAG}")"
GA_TAG_SCRIPT_ESCAPED="$(esc "${GA_TAG_SCRIPT}")"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

sed -e "s|<!-- __ROBOTS_TAG__ -->|${ROBOTS_TAG_ESCAPED}|g" \
    -e "s|<!-- __GA_TAG_SCRIPT__ -->|${GA_TAG_SCRIPT_ESCAPED}|g" \
    -e "s|<!-- __CANONICAL_URL__ -->|${CANONICAL_TAG_ESCAPED}|g" \
    "${TPL}" > "${tmp}"

mv "${tmp}" "${OUT}"

exec "$@"
