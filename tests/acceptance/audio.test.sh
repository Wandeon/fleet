#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "audio acceptance requires jq" >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "audio acceptance requires curl" >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$REPO_ROOT"

REPORT_DIR=${REPORT_DIR:-reports/acceptance}
mkdir -p "$REPORT_DIR"
SUMMARY_FILE="$REPORT_DIR/audio-summary.json"
JUNIT_FILE="$REPORT_DIR/audio-tests.xml"

if [[ -n ${ACCEPTANCE_AUDIO_TARGETS_FILE:-} ]]; then
  TARGETS_FILE="$ACCEPTANCE_AUDIO_TARGETS_FILE"
else
  if [[ -f monitoring/targets-audio.json ]]; then
    TARGETS_FILE="monitoring/targets-audio.json"
  elif [[ -f vps/targets-audio.json ]]; then
    TARGETS_FILE="vps/targets-audio.json"
  else
    echo "Unable to locate targets-audio.json" >&2
    exit 2
  fi
fi

if [[ ! -f "$TARGETS_FILE" ]]; then
  echo "Targets file '$TARGETS_FILE' not found" >&2
  exit 2
fi

mapfile -t SCRAPE_TARGETS < <(jq -r '.[].targets[]' "$TARGETS_FILE") || SCRAPE_TARGETS=()
mapfile -t AUDIO_HOSTS < <(printf '%s\n' "${SCRAPE_TARGETS[@]}" | sed '/^$/d' | sed 's/:.*$//' | sort -u)

xml_escape() {
  local input=$1
  input=${input//&/&amp;}
  input=${input//</&lt;}
  input=${input//>/&gt;}
  input=${input//\"/&quot;}
  input=${input//$'\n'/&#10;}
  echo "$input"
}

TEST_CASES=()
TOTAL_TESTS=0
FAILURE_COUNT=0
ERROR_COUNT=0
WARNING_COUNT=0

add_case() {
  local classname=$1
  local name=$2
  local status=$3
  local message=$4
  ((TOTAL_TESTS++)) || true
  local escaped_name=$(xml_escape "$name")
  local escaped_class=$(xml_escape "$classname")
  local escaped_msg=$(xml_escape "$message")
  local case_xml="  <testcase classname=\"${escaped_class}\" name=\"${escaped_name}\">"
  case "$status" in
    PASS)
      case_xml+="</testcase>"
      ;;
    WARN)
      ((WARNING_COUNT++)) || true
      ((ERROR_COUNT++)) || true
      case_xml+="<error type=\"warning\">${escaped_msg}</error></testcase>"
      ;;
    FAIL)
      ((FAILURE_COUNT++)) || true
      case_xml+="<failure type=\"failure\">${escaped_msg}</failure></testcase>"
      ;;
    *)
      ((ERROR_COUNT++)) || true
      case_xml+="<error type=\"unknown\">${escaped_msg}</error></testcase>"
      ;;
  esac
  TEST_CASES+=("$case_xml")
}

CURL_OPTS=(--fail --silent --show-error --max-time 10)
if [[ ${ACCEPTANCE_INSECURE:-0} == 1 ]]; then
  CURL_OPTS+=(--insecure)
fi

ACCEPTANCE_ARGS=(--json)
if [[ -n ${ACCEPTANCE_AUDIO_ICECAST_URL:-} ]]; then
  ACCEPTANCE_ARGS+=("--icecast=${ACCEPTANCE_AUDIO_ICECAST_URL}")
fi
if [[ -n ${ACCEPTANCE_AUDIO_API:-} ]]; then
  ACCEPTANCE_ARGS+=("--api=${ACCEPTANCE_AUDIO_API}")
fi
if [[ -n ${ACCEPTANCE_AUDIO_UI:-} ]]; then
  ACCEPTANCE_ARGS+=("--ui=${ACCEPTANCE_AUDIO_UI}")
fi

if [[ ${#AUDIO_HOSTS[@]} -eq 0 ]]; then
  add_case "audio" "targets" "WARN" "No audio hosts defined in ${TARGETS_FILE}"
  SUMMARY_PLACEHOLDER='{"status":"warn","counts":{"pass":0,"warn":1,"fail":0},"checks":[{"context":"audio","check":"targets","status":"WARN","message":"No audio hosts defined"}]}'
  echo "$SUMMARY_PLACEHOLDER" >"$SUMMARY_FILE"
  {
    printf '<?xml version="1.0" encoding="UTF-8"?>\n'
    printf '<testsuite name="audio-acceptance" tests="%d" failures="%d" errors="%d">\n' "$TOTAL_TESTS" "$FAILURE_COUNT" "$ERROR_COUNT"
    for case_xml in "${TEST_CASES[@]}"; do
      printf '%s\n' "$case_xml"
    done
    printf '</testsuite>\n'
  } >"$JUNIT_FILE"
  printf 'Audio acceptance summary: warn (pass=0 warn=1 fail=0)\n'
  echo "$SUMMARY_PLACEHOLDER"
  exit 1
fi

TMP_OUT=$(mktemp)
TMP_ERR=$(mktemp)
trap 'rm -f "$TMP_OUT" "$TMP_ERR"' EXIT

set +e
scripts/acceptance.sh "${ACCEPTANCE_ARGS[@]}" "${AUDIO_HOSTS[@]}" >"$TMP_OUT" 2>"$TMP_ERR"
set -e

if [[ -s "$TMP_ERR" ]]; then
  cat "$TMP_ERR" >&2
fi

ACCEPTANCE_JSON=$(cat "$TMP_OUT")

if [[ -z "$ACCEPTANCE_JSON" ]] || ! jq empty <<<"$ACCEPTANCE_JSON" >/dev/null 2>&1; then
  echo "Acceptance script returned invalid JSON" >&2
  echo "$ACCEPTANCE_JSON" >&2
  add_case "acceptance" "execution" "FAIL" "acceptance.sh did not emit valid JSON"
  {
    printf '<?xml version="1.0" encoding="UTF-8"?>\n'
    printf '<testsuite name="audio-acceptance" tests="%d" failures="%d" errors="%d">\n' "$TOTAL_TESTS" "$FAILURE_COUNT" "$ERROR_COUNT"
    for case_xml in "${TEST_CASES[@]}"; do
      printf '%s\n' "$case_xml"
    done
    printf '  <system-err>%s</system-err>\n' "$(xml_escape "$(cat "$TMP_ERR")")"
    printf '</testsuite>\n'
  } >"$JUNIT_FILE"
  echo '{"status":"fail","error":"invalid-json"}' >"$SUMMARY_FILE"
  exit 2
fi

echo "$ACCEPTANCE_JSON" >"$SUMMARY_FILE"

jq -c '.checks[]?' "$SUMMARY_FILE" | while read -r check; do
  context=$(jq -r '.context' <<<"$check")
  name=$(jq -r '.check' <<<"$check")
  status=$(jq -r '.status' <<<"$check")
  message=$(jq -r '.message' <<<"$check")
  if [[ $context == audio:* ]]; then
    host=${context#audio:}
    add_case "audio::${host}" "$name" "$status" "$message"
  elif [[ $context == icecast* ]]; then
    add_case "icecast" "$name" "$status" "$message"
  fi
done

PROM_CHECKS=()
PROM_PASS=0
PROM_FAIL=0
for target in "${SCRAPE_TARGETS[@]}"; do
  [[ -z "$target" ]] && continue
  url=$target
  if [[ $url != http*://* ]]; then
    url="http://${url}"
  fi
  context="prometheus:${target}"
  if curl "${CURL_OPTS[@]}" "$url/metrics" >/dev/null 2>&1; then
    PROM_PASS=$((PROM_PASS + 1))
    PROM_CHECKS+=("$(jq -n --arg context "$context" --arg message "metrics scrape ok" '{context:$context,check:"metrics",status:"PASS",message:$message}')")
    add_case "prometheus" "${target} metrics" "PASS" "metrics scrape ok"
  else
    PROM_FAIL=$((PROM_FAIL + 1))
    PROM_CHECKS+=("$(jq -n --arg context "$context" --arg message "metrics scrape failed" '{context:$context,check:"metrics",status:"FAIL",message:$message}')")
    add_case "prometheus" "${target} metrics" "FAIL" "metrics scrape failed"
  fi
done

PROM_CHECKS_JSON="[]"
if [[ ${#PROM_CHECKS[@]} -gt 0 ]]; then
  PROM_CHECKS_JSON=$(printf '%s\n' "${PROM_CHECKS[@]}" | jq -s '.')
fi

SUMMARY_STATUS=$(jq -r '.status // "fail"' "$SUMMARY_FILE")
PASS_COUNT=$(jq -r '.counts.pass' "$SUMMARY_FILE")
WARN_COUNT=$(jq -r '.counts.warn' "$SUMMARY_FILE")
FAIL_COUNT=$(jq -r '.counts.fail' "$SUMMARY_FILE")

TOTAL_PASS=$((PASS_COUNT + PROM_PASS))
TOTAL_WARN=$((WARN_COUNT))
TOTAL_FAIL=$((FAIL_COUNT + PROM_FAIL))

FINAL_STATUS=$SUMMARY_STATUS
if (( TOTAL_FAIL > 0 )); then
  FINAL_STATUS="fail"
elif (( TOTAL_WARN > 0 )); then
  FINAL_STATUS="warn"
else
  FINAL_STATUS="pass"
fi

UPDATED_SUMMARY=$(jq \
  --arg status "$FINAL_STATUS" \
  --arg pass "$TOTAL_PASS" \
  --arg warn "$TOTAL_WARN" \
  --arg fail "$TOTAL_FAIL" \
  --argjson extras "$PROM_CHECKS_JSON" \
  '.status=$status
   | .counts.pass=($pass|tonumber)
   | .counts.warn=($warn|tonumber)
   | .counts.fail=($fail|tonumber)
   | .checks = (.checks + $extras)' "$SUMMARY_FILE")

echo "$UPDATED_SUMMARY" >"$SUMMARY_FILE"

{
  printf '<?xml version="1.0" encoding="UTF-8"?>\n'
  printf '<testsuite name="audio-acceptance" tests="%d" failures="%d" errors="%d">\n' "$TOTAL_TESTS" "$FAILURE_COUNT" "$ERROR_COUNT"
  for case_xml in "${TEST_CASES[@]}"; do
    printf '%s\n' "$case_xml"
  done
  printf '</testsuite>\n'
} >"$JUNIT_FILE"

printf 'Audio acceptance summary: %s (pass=%d warn=%d fail=%d)\n' "$FINAL_STATUS" "$TOTAL_PASS" "$TOTAL_WARN" "$TOTAL_FAIL"

echo "$UPDATED_SUMMARY"

case "$FINAL_STATUS" in
  pass)
    exit 0
    ;;
  warn)
    exit 1
    ;;
  fail|*)
    exit 2
    ;;
esac
