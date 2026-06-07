# PROGRESS

## MCP 서버 Tools

### 완료

- [x] `getTodayTasks` — 날짜별 태스크 조회, scope(mine/team), /auth/me user.id 추출
- [x] `createTask` — 태스크 생성 (title, planned_date, priority, due_time, project_id, estimated_minutes)
- [x] `updateTaskStatus` — 태스크 상태·진행률·차단 사유 변경
- [x] `getRackStatus` — 서버 랙 현황 조회
- [x] `getProjectStatus` — 프로젝트 요약(진행률·멤버 기여도·마일스톤), project_id + include_tasks 옵션
- [x] 업데이트 체크 — GitHub Releases 비교, 24시간 캐시, 새 버전 있으면 AI 응답에 notice 포함

- [x] `searchTasks` — 키워드 기반 태스크·프로젝트 검색 (`/search?q=`)
- [x] `getStats` — 기간별(day/week/month) 생산성 통계 조회 (`/stats`)
- [x] `updateTaskStatus` 확장 — title·priority·planned_date·due_time·project_id·estimated_minutes·story_points 필드 추가
- [x] Tool description 개선 — 사용 맥락 기반 설명으로 전면 개선

### 추가 예정

- [ ] `deleteTask` — 태스크 삭제
- [ ] `moveTask` — 태스크 날짜 이동

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
- [x] Windows 한글 경로 깨짐 수정 (v0.2.6)
- [x] ESM 번들 Dynamic require 오류 수정 (v0.2.4)
- [x] CI 코드 서명 Secret 없을 때 빌드 실패 수정 (v0.2.3)

### 남은 작업

- [ ] **macOS 코드 서명 & 공증** — 설정 파일 준비 완료, **Apple Developer 가입 + GitHub Secrets 등록만 하면 됨**
  - 상세 절차: [`docs/macos-code-signing.md`](docs/macos-code-signing.md)
  - 필요한 작업: Apple Developer 가입($99/년) → Developer ID Application 인증서 발급 → P12 내보내기 → GitHub Secrets 6개 등록
  - 등록할 Secrets: `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  - Secrets 등록 후 `installer-v0.3.0` 태그 → 자동 서명 + 공증 빌드
- [ ] 앱 아이콘 추가 (macOS `.icns`, Windows `.ico`, Linux `.png`)
- [ ] Windows 코드 서명 — 미서명 시 SmartScreen 경고
- [ ] 재설치 시 기존 API 키 불러오기
- [ ] Node.js 미설치 시 다운로드 페이지 자동 열기

### 릴리즈 방법

```bash
git tag installer-v0.x.0
git push origin installer-v0.x.0
```

GitHub Releases에서 `.dmg` / `.exe` / `.AppImage` 다운로드 가능.

---

## 트러블슈팅 이력 (installer/)

### Bug 1 — bundle.mjs ENOENT (v0.2.0 → v0.2.1)

**증상:** 인스톨러 실행 시 `ENOENT: no such file or directory, copyfile '...\resources\mcp\bundle.mjs'`

**원인:** CI에서 `dist/bundle.mjs`를 `installer/resources/mcp/bundle.mjs`에 복사했는데, `extraResources` 설정이 `resources/` → `mcp/`로 매핑하므로 실제 패키징 경로가 `resources/mcp/mcp/bundle.mjs`로 이중 중첩됨.

**수정:** CI 복사 경로를 `installer/resources/bundle.mjs`로 변경. `installer/resources/`는 로컬에서 항상 비어있고 CI가 빌드 시 채운다.

---

### Bug 2 — CI 코드 서명 실패 (v0.2.1 → v0.2.3)

**증상:** `Env WIN_CSC_LINK is not correct, cannot resolve: build_certificate.p12 doesn't exist` (Windows), `installer not a file` (macOS)

**원인:** `BUILD_CERTIFICATE_BASE64` Secret이 없어도 `CSC_LINK`를 항상 설정. Secret 없으면 인증서 파일이 생성되지 않아 electron-builder가 서명 시도 중 실패. 빈 문자열(`''`)로 설정 시 `path.resolve('')` = cwd가 되어 macOS에서 "not a file" 에러 발생.

**수정:** `$GITHUB_ENV`로 조건부 설정 — Secret이 있을 때만 `CSC_LINK`를 환경변수에 추가하고, 없으면 환경변수 자체가 존재하지 않도록 처리. `CSC_IDENTITY_AUTO_DISCOVERY=false`로 자동 서명 탐색 비활성화.

```yaml
- name: Set CSC_LINK (only when cert secret exists)
  if: env.BUILD_CERTIFICATE_BASE64 != ''
  env:
    BUILD_CERTIFICATE_BASE64: ${{ secrets.BUILD_CERTIFICATE_BASE64 }}
  run: echo "CSC_LINK=$RUNNER_TEMP/build_certificate.p12" >> $GITHUB_ENV
```

**참고:** Secret 없어도 빌드 자체는 성공한다. Windows는 SmartScreen 경고만 표시되고 설치 가능.

---

### Bug 3 — Dynamic require of "fs" is not supported (v0.2.3 → v0.2.4)

**증상:** `node index.mjs` 실행 시 `Error: Dynamic require of "fs" is not supported at index.mjs:11`

**원인:** esbuild ESM 번들(`--format=esm`)에서 `dotenv` 등 CommonJS 라이브러리가 내부적으로 `require('fs')`를 동적 호출. ESM 컨텍스트에서는 `require`가 없어서 esbuild의 shim이 에러를 던짐.

**수정:** `package.json`의 `bundle` 스크립트에 `createRequire` 배너 추가.

```json
"bundle": "esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/bundle.mjs --banner:js=\"import { createRequire } from 'module'; const require = createRequire(import.meta.url);\""
```

번들 첫 줄에 `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`가 주입되어 CJS `require()` 호출을 ESM 환경에서 처리 가능하게 됨.

---

### Bug 4 — Windows 한글 username 경로 깨짐 (v0.2.4 → v0.2.6)

**증상:** `claude_desktop_config.json`의 `args` 경로가 깨진 문자(`뒷뒷빛빛??W`)와 이중 백슬래시(`\\index.mjs`)로 저장되어 Claude Desktop이 MCP 서버를 찾지 못함. 파일 자체는 올바른 위치에 복사됨.

**원인:** Electron 내에서 `os.homedir()`이 Windows 한글 username 경로(`C:\Users\박종인`)를 반환할 때 인코딩 불일치가 발생. `JSON.stringify` 후 `fs.writeFileSync`로 쓴 경로가 터미널에서 깨져 보이고 Claude Desktop도 올바르게 읽지 못함.

**수정:** `process.env.USERPROFILE`(Windows 환경변수, OS가 직접 설정)을 우선 사용하고 `path.normalize()`로 이중 슬래시 방지.

```javascript
function getMcpInstallPath() {
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOMEPATH || os.homedir())
    : os.homedir()
  return path.normalize(path.join(home, '.yeorot-mcp', 'index.mjs'))
}
```

**수동 복구 (재설치 전 임시 조치):**

```powershell
$cfg = "$env:APPDATA\Claude\claude_desktop_config.json"
$mjs = "$env:USERPROFILE\.yeorot-mcp\index.mjs"
$c = Get-Content $cfg -Raw | ConvertFrom-Json
$c.mcpServers.yeorot.args = @($mjs)
$c | ConvertTo-Json -Depth 10 | Set-Content $cfg -Encoding UTF8
```

이후 시스템 트레이에서 Claude Desktop 완전 종료 후 재시작.
