#!/usr/bin/env bash
# Auto-sync the repo at session start. Output goes back to the model
# as additionalContext so it knows the working tree state before acting.

set -u

REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$REPO" 2>/dev/null || {
  jq -n --arg msg "sync hook: cannot cd to $REPO" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
  exit 0
}

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

OUT="=== Auto git sync (SessionStart) ==="$'\n'

if FETCH_ERR=$(git fetch origin 2>&1); then
  OUT+="✓ git fetch origin"$'\n'
else
  OUT+="✗ git fetch origin FAILED:"$'\n'"$FETCH_ERR"$'\n'
fi

STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  STAMP=$(date +%Y-%m-%d_%H:%M:%S)
  if git stash push -m "auto-stash session-start $STAMP" >/dev/null 2>&1; then
    STASHED=1
    OUT+="✓ Stashed local changes ($STAMP)"$'\n'
  fi
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "origin/main")
if PULL_OUT=$(git pull --rebase origin "${UPSTREAM#origin/}" 2>&1); then
  if echo "$PULL_OUT" | grep -q "Already up to date"; then
    OUT+="✓ Already up to date with $UPSTREAM"$'\n'
  else
    OUT+="✓ Rebased onto $UPSTREAM"$'\n'
    OUT+="$(echo "$PULL_OUT" | tail -3)"$'\n'
  fi
else
  OUT+="✗ git pull --rebase FAILED:"$'\n'"$PULL_OUT"$'\n'
  OUT+="!! Resolve conflicts before continuing."$'\n'
fi

if [ "$STASHED" -eq 1 ]; then
  if POP_OUT=$(git stash pop 2>&1); then
    OUT+="✓ Restored local changes"$'\n'
  else
    OUT+="✗ git stash pop had conflicts:"$'\n'"$POP_OUT"$'\n'
  fi
fi

HEAD=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)
STATUS=$(git status --short)
OUT+=$'\n'"Branch: $BRANCH"$'\n'
OUT+="HEAD:   $SHORT ($HEAD)"$'\n'
if [ -n "$STATUS" ]; then
  OUT+="Working tree:"$'\n'"$STATUS"$'\n'
else
  OUT+="Working tree: clean"$'\n'
fi

jq -n --arg ctx "$OUT" \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx}}'
