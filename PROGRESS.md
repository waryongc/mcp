# PROGRESS

## MCP 서버 Tools

### 완료

- [x] `getTodayTasks` — 날짜별 태스크 조회, scope(mine/team), /auth/me user.id 추출
- [x] `createTask` — 태스크 생성 (title, planned_date, priority, due_time, project_id, estimated_minutes)
- [x] `updateTaskStatus` — 태스크 상태·진행률·차단 사유 변경
- [x] `getRackStatus` — 서버 랙 현황 조회
- [x] `getProjectStatus` — 프로젝트 요약(진행률·멤버 기여도·마일스톤), project_id + include_tasks 옵션
- [x] 업데이트 체크 — GitHub Releases 비교, 24시간 캐시, 새 버전 있으면 AI 응답에 notice 포함

### 추가 예정

- [ ] `getWeeklyReview` — 주간 태스크 완료율·통계 조회
- [ ] `searchTasks` — 키워드 기반 태스크 검색

---

## 인스톨러 앱 (installer/)

**목표:** 더블클릭 → API 키 입력 → Claude Desktop 자동 설정

### 완료

- [x] Electron 앱 기본 구조 (`installer/`)
- [x] UI — API 키 입력, Node.js/Claude Desktop 설치 여부 체크, 설치 완료 화면
- [x] 설치 로직 — MCP 서버를 `~/.yeorot-mcp/index.mjs`에 복사 후 `claude_desktop_config.json` 자동 수정
- [x] macOS / Windows / Linux 빌드 지원
- [x] GitHub Actions CI — `installer-v*` 태그 푸시 시 자동 빌드 & GitHub Release 생성
- [x] esbuild ESM 번들 (`npm run bundle` → `dist/bundle.mjs`)
- [x] 빌드 오류 수정 (top-level await → ESM, repository/author 필드 추가)
- [x] M4 Mac V8 JIT 크래시 우회 — `--no-opt` 플래그 내장 + Electron 33 복구

### 남은 작업

- [ ] 앱 아이콘 추가 (macOS `.icns`, Windows `.ico`, Linux `.png`)
- [ ] macOS 코드 서명 & 공증 — 미서명 시 "개발자를 확인할 수 없음" 경고
- [ ] Windows 코드 서명 — 미서명 시 SmartScreen 경고
- [ ] 재설치 시 기존 API 키 불러오기
- [ ] Node.js 미설치 시 다운로드 페이지 자동 열기

### 릴리즈 방법

```bash
git tag installer-v0.x.0
git push origin installer-v0.x.0
```

GitHub Releases에서 `.dmg` / `.exe` / `.AppImage` 다운로드 가능.
