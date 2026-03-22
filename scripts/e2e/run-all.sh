#!/bin/bash
# Run all E2E test suites sequentially
# Usage: bash scripts/e2e/run-all.sh

set -o pipefail

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_SUITES=""

echo ""
echo "=============================================="
echo "  EMP Billing — Full E2E Test Suite"
echo "=============================================="
echo ""

for test_file in scripts/e2e/*.test.ts; do
  suite=$(basename "$test_file" .test.ts)
  echo "── Running: $suite ──────────────────────────"

  output=$(node --experimental-strip-types "$test_file" 2>&1)
  exit_code=$?

  echo "$output"

  # Extract pass/fail counts from output
  pass=$(echo "$output" | grep -oP '\d+(?= passed)' | tail -1)
  fail=$(echo "$output" | grep -oP '\d+(?= failed)' | tail -1)

  TOTAL_PASS=$((TOTAL_PASS + ${pass:-0}))
  TOTAL_FAIL=$((TOTAL_FAIL + ${fail:-0}))

  if [ "$exit_code" -ne 0 ]; then
    FAILED_SUITES="$FAILED_SUITES $suite"
  fi

  echo ""
done

echo "=============================================="
echo "  TOTAL: $TOTAL_PASS passed, $TOTAL_FAIL failed"
if [ -n "$FAILED_SUITES" ]; then
  echo "  Failed suites:$FAILED_SUITES"
fi
echo "=============================================="

exit $((TOTAL_FAIL > 0 ? 1 : 0))
