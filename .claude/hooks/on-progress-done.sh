#!/usr/bin/env bash
# yeorot-mcp Stop hook
# PROGRESS.md에 새 "- [x]" 완료 행이 생기면:
#   npm run build → git commit → git push
# (yeorot 본체의 on-progress-done.sh를 mcp 프로젝트에 맞게 조정한 버전 —
#  체크박스 형식 트리거, 검증은 npm run build, 도커 이미지 빌드 단계 없음)
set -uo pipefail

REPO=/home/xiilab/dev/mcp
LOG=/tmp/yeorot-mcp-autopush.log

cd "$REPO" || exit 0

# 1) 트리거 조건: 아직 커밋되지 않은(=working tree+staged) 새 "- [x]" 행
NEWROW=$(git diff HEAD -- PROGRESS.md \
  | grep -E '^\+[[:space:]]*- \[x\]' | head -1)
[ -n "$NEWROW" ] || exit 0

# 완료된 작업명("- [x] " 뒤 텍스트, " — " 이전까지)을 커밋 메시지에 사용
# em-dash 리터럴은 셸/sed에서 바이트가 어긋나기 쉬워 python3(— 이스케이프)로 추출
TASK=$(printf '%s' "$NEWROW" | python3 -c '
import re, sys
s = sys.stdin.read()
s = re.sub(r"^\+\s*- \[x\]\s*", "", s)
s = s.split("\u2014")[0]  # em-dash 구분자 이전이 작업명
print(s.replace("`", "").strip())
')
MSG="feat: ${TASK:-PROGRESS 작업} 완료"

# 사용자에게 보여줄 한 줄 알림(JSON)을 stdout으로 출력하는 헬퍼
emit() {
  printf '%s' "$1" | python3 -c \
    'import json,sys; print(json.dumps({"systemMessage": sys.stdin.read()}))'
}

echo "=== $(date "+%F %T") PROGRESS 완료 감지 ===" >> "$LOG" 2>&1

# 2) 검증 — 빌드 실패 시 commit 금지 (CLAUDE.md 규칙)
if ! npm run build >> "$LOG" 2>&1; then
  emit "⚠️ PROGRESS 완료 감지했으나 npm run build 실패 — 커밋 중단 (로그: $LOG)"
  exit 0
fi

# 3) commit + push
git add -A >> "$LOG" 2>&1
if ! git commit -m "$MSG" >> "$LOG" 2>&1; then
  exit 0   # 실제 커밋할 변경 없음
fi
if ! git push origin main >> "$LOG" 2>&1; then
  emit "⚠️ 커밋은 됐으나 push 실패 — 수동 확인 필요 (로그: $LOG)"
  exit 0
fi

emit "✅ PROGRESS 완료 → 빌드·커밋·푸시 완료 ($MSG)"
exit 0
