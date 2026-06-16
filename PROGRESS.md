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

- [x] `deleteTask` — 태스크 삭제 (소프트 삭제, `DELETE /tasks/:id`)
- [x] `moveTask` — 태스크 날짜 이동 (`PATCH /tasks/:id/move`)

---

## 문서 (README / docs)

### 완료

- [x] 한글 경로 MCP 설치 문제 포스트모템 정리 ([`docs/postmortem-한글경로-mcp-설치.md`](docs/postmortem-한글경로-mcp-설치.md))
- [x] MCP 아키텍처 섹션 — [공식 문서](https://modelcontextprotocol.io/docs/learn/architecture) 기준으로 보강 (Host·Client·Server, 2계층 구조, 프리미티브, 라이프사이클)
- [x] 공통 유틸리티 프리미티브(Notifications·Tasks(실험적)) 설명 추가 — 공식 문서 최신본 반영
- [x] 아키텍처·시퀀스 다이어그램을 PNG/SVG로 렌더링해 `docs/img/`에 저장 + README 본문에 이미지 임베드 (Mermaid 소스는 `<details>`로 보존 — GitHub Mermaid 렌더 실패 대응)
- [x] 기술 스택 각 항목(`@modelcontextprotocol/sdk`·Zod·dotenv·esbuild) 상세 설명 추가
- [x] README 원격 서버 연결 사용법 문서화 — 원클릭 OAuth(claude.ai/Desktop/모바일)·Claude Code·API 키 방식 안내 추가, 전송 섹션/환경 변수 표/프로젝트 구조 현행화 ("미착수" 문구 제거)

---

## 원격(웹) MCP 서버 전환

**목표:** 로컬 stdio 서버를 웹에 띄워 여러 사용자가 원격 접속 (GitHub·Linear 등의 Remote MCP Server 형태)

전체 설계: [`docs/remote-server-plan.md`](docs/remote-server-plan.md)

**핵심 과제:** 전송 방식 교체(`StdioServerTransport` → `StreamableHTTPServerTransport`)보다 **멀티테넌트 인증**이 진짜 난이도. 현재 전역 단일 `YEOROT_API_KEY`를, 요청을 보낸 사용자별 키로 분리해 `yeorotFetch`까지 전달해야 함 (AsyncLocalStorage 채택 예정).

### Phase 0 — 리팩토링 (동작 변화 없음) ✅
- [x] Phase 0 리팩토링 — AsyncLocalStorage 인증 컨텍스트 도입 (auth-context·client·registerTools·config)
- [x] `auth-context.ts` (AsyncLocalStorage) 추가 — `runWithApiKey`(요청 스코프) + `setFallbackApiKey`(stdio 호환)
- [x] `client.ts`를 request-scoped 키 조회로 변경 — 키 없으면 401 의미의 에러
- [x] tool 등록을 `registerTools(server)`로 추출 (stdio·http 공유)
- [x] `config.ts`에서 `YEOROT_API_KEY` 선택값化 — stdio 엔트리(`index.ts`)에서 필수 검증 유지
- [x] 기존 stdio 동작 회귀 테스트 — 키 누락/잘못된 접두사 거부, tools/list 7개, tools/call fallback 키 경로, 번들 빌드 확인

### Phase 1 — Streamable HTTP + Bearer 키 (MVP)
- [x] Phase 1 원격 HTTP 서버 구현 — server-http.ts·Bearer 인증·보안·Dockerfile (배포·커넥터 검증 제외)
- [x] `server-http.ts` (Express + StreamableHTTPServerTransport, `/mcp`·`/healthz`) — stateful 세션, `npm run start:http`
- [x] `Authorization: Bearer yrk_...` 헤더 → 요청별 키 — `runWithApiKey`로 격리, 세션-키 바인딩(다른 키로 세션 재사용 시 401). mock API로 3-사용자 키 격리 검증 완료
- [x] CORS(`Mcp-Session-Id` 노출)·DNS rebinding 보호(`MCP_ALLOWED_HOSTS/ORIGINS`) + Dockerfile(멀티스테이지, healthcheck — 이미지 빌드·기동 확인)
- [x] TLS 배포 — `https://mcp.yeorot.cloud` 운영 개시. yeorot 인프라(`/home/xiilab/svc/docker-compose.yml`)에 `mcp` 서비스 추가, nginx 서버 블록(SSE 대응) + Let's Encrypt 인증서(yeorot.cloud와 통합, webroot 방식 자동 갱신 전환). 엔드투엔드 검증: healthz·401·세션·tools/list·백엔드 도달 확인
- [ ] Claude 커스텀 커넥터로 연결 검증 (사용자가 본인 키로: `claude mcp add --transport http yeorot https://mcp.yeorot.cloud/mcp --header "Authorization: Bearer yrk_..."`)
- [x] (운영 개선) nginx 설정을 디렉터리 마운트로 전환 — 단일 파일 마운트의 inode 교체 문제 해소, 이제 `nginx -s reload`만으로 설정 반영

### Phase 2 — OAuth 2.1 (원클릭 연결 UX)
- [x] Phase 2 설계 + MCP 리소스 서버 구현 — 기존 SSO(onl1d)를 인가 서버로 재활용, RFC 9728 PRM + WWW-Authenticate + OAuth 토큰 패스스루 (상세: [`docs/remote-server-plan.md`](docs/remote-server-plan.md) Phase 2)
- [x] Phase 2 운영 배포 + 서버 측 E2E 검증 — onl1d(DCR·public client·resource indicator, 테스트 67/67)와 MCP 컨테이너(PRM 포함) 재배포, svc compose에 `ALLOWED_RESOURCES`·`OIDC_EXTRA_AUDIENCES` 추가, yeorot backend `verifyOidcToken` audience 목록 검증(eac11f6). 운영 확인: discovery `registration_endpoint`, PRM 200, 401 `WWW-Authenticate`+resource_metadata, DCR 등록, resource 검증(`invalid_target`+state 보존), public client 토큰 인증
- [x] yeorot backend 컨테이너 재기동 — eac11f6 빌드 이미지(937450c6)로 recreate, healthy·`OIDC_EXTRA_AUDIENCES` 주입·nginx 경유 응답(401) 확인
- [ ] Claude "원격 MCP 추가" 원클릭 로그인 검증 (사용자 인터랙티브 로그인 필요)
  - **2026-06-16 진단**: claude.ai 커넥터 연결 시 "Couldn't reach the MCP server"(ofid_…). nginx 로그상 커넥터는 `POST /mcp`(401)·PRM(200)까지 오지만, PRM의 `authorization_servers`가 가리키는 **비표준 포트 `:44000`(onl1d)에는 도달하지 못함**(onl1d 로그 0건). 대신 MCP origin `mcp.yeorot.cloud`에 `POST /register`(DCR)→404로 폴백하다 끊김. Anthropic 문서상 cross-host 인가서버는 지원하나 비표준 포트는 미보장(SSRF 포트 제한 추정).
  - **해결 방향**: onl1d 인가서버를 **`https://sso.yeorot.cloud`(443)** 로 이전(issuer 단일화). RFC 8414 라우트는 이미 추가됨(onl1d ab630f9)이나 단독으론 미해결. 사용자가 DNS A레코드·Google 리디렉트 URI 추가 완료. **남은 단계 상세 체크리스트: onl1d `docs/features/18-mcp-oauth.md` "sso.yeorot.cloud 443 이전" 절 참조.**
  - **2026-06-16 서버측 이전 완료**: ① LE 인증서 SAN에 `sso.yeorot.cloud` 추가(webroot expand) ② nginx에 `sso.yeorot.cloud` 443 서버 블록(`proxy_pass http://onl1d:3000`) + 80블록 server_name에 sso 추가 ③ svc `.env`의 `SSO_ISSUER`/`SSO_AUTHORIZE_URL`/`GOOGLE_REDIRECT_URI`를 sso 443으로 변경 ④ onl1d·backend·mcp 재배포. 검증: onl1d issuer·openid-config·registration_endpoint 전부 `https://sso.yeorot.cloud`(443), MCP PRM `authorization_servers=["https://sso.yeorot.cloud"]`, 401+WWW-Authenticate 정상. `:44000` 디스커버리 체인에서 제거됨(포트 4000 블록은 롤백 안전망으로 유지). **남은 것: 사용자의 claude.ai 커넥터 재연결 테스트뿐.**

### Phase 3 — 하드닝 & 확장
- [ ] 키별 레이트 리밋, 수평 확장(stateless/Redis), 관측성
- [x] 루트(`/`) 안내 페이지 — `GET /` → README 원격 연결 섹션으로 302 리다이렉트 (임시; yeorot.cloud/docs/mcp 페이지 생기면 Location URL만 교체). mcp.linear.app→linear.app/docs/mcp 방식. 운영 배포 반영 확인 완료

### 미결정
- 호스팅 대상(yeorot.cloud VM vs PaaS), Phase 2 OAuth 범위(yeorot 백엔드 작업 수반), 세션 모드

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

---

### Bug 5 — 깨진 config가 재설치로 자가 복구 안 됨 (v0.2.6 → v0.2.7)

**증상:** Bug 4 수정(v0.2.6) 이후에도 한글 username PC에서 MCP가 안 붙음. 새 Claude Desktop 설정 → 개발자 → "로컬 MCP 서버"에 "추가된 서버가 없습니다"로 뜨고, `%APPDATA%\Claude\logs\` 폴더조차 생성 안 됨. 디스크의 `claude_desktop_config.json`을 직접 확인하니 `args` 경로가 `C:\\Users\\諛뺤쥌??\.yeorot-mcp\\index.mjs`로 깨져 있음 — 한글 mojibake + `\.` 잘못된 이스케이프 시퀀스. 앱이 JSON 파싱 실패로 config 전체를 조용히 무시.

**원인:** 설치 시 기존 config를 병합하려고 `JSON.parse(fs.readFileSync(configPath))`를 호출하는데, **기존 파일이 이미 깨져 있으면 여기서 예외가 터져 설치 전체가 catch로 빠짐**. 결과적으로 한 번 깨진 config는 재설치로도 절대 덮어써지지 않아 자가 복구가 불가능했음.

**수정:** 기존 config 읽기/파싱을 `try-catch`로 감싸 파싱 실패 시 빈 객체로 새로 시작하도록 변경. 깨진 파일도 재설치하면 정상 config로 덮어써짐.

```javascript
let config = {}
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (e) {
    process.stderr.write(`[installer] 기존 config 파싱 실패 — 새로 작성합니다: ${e.message}\n`)
    config = {}
  }
}
```

**수동 복구 (재설치 전 임시 조치):** PowerShell에서 `$env:USERPROFILE`로 경로를 만들고 UTF-8(BOM 없이)로 config를 새로 작성.

```powershell
$cfg = "$env:APPDATA\Claude\claude_desktop_config.json"
$mjs = "$env:USERPROFILE\.yeorot-mcp\index.mjs"
$json = @"
{
  "mcpServers": {
    "yeorot": {
      "command": "node",
      "args": ["$($mjs.Replace('\','\\'))"],
      "env": {
        "YEOROT_API_URL": "https://yeorot.cloud/api/v1",
        "YEOROT_API_KEY": "<발급받은 키>"
      }
    }
  }
}
"@
[System.IO.File]::WriteAllText($cfg, $json, (New-Object System.Text.UTF8Encoding($false)))
```

이후 Claude Desktop 완전 종료 후 재시작.

---

### Bug 6 — MSIX(스토어) 패키지 앱이 config를 다른 경로에서 읽음 (v0.2.7 → v0.2.8)

**증상:** 모든 수정(Bug 4·5) 이후에도 새 Claude Desktop에서 yeorot MCP가 안 붙음. 설정 → 개발자 → "로컬 MCP 서버"가 계속 비어 있음. config를 직접 정상 작성해도 앱이 인식 못 함.

**원인:** 새 Claude Desktop은 **MSIX(Microsoft Store) 패키지 앱**이라 `%APPDATA%`가 **가상화**된다. 앱은 클래식 경로(`%APPDATA%\Claude\claude_desktop_config.json`)가 아니라 다음 경로에서만 config를 읽는다:

```
%LOCALAPPDATA%\Packages\Claude_<해시>\LocalCache\Roaming\Claude\claude_desktop_config.json
```

인스톨러는 클래식 경로에만 써서, 패키지 앱은 그 파일을 영영 보지 못했다. 그동안의 "config가 깨졌다/안 읽힌다"는 증상 전부 이 경로 불일치가 근본 원인.

**수정:** `getClaudeConfigPath()`(단수)를 `getClaudeConfigPaths()`(복수)로 바꿔, Windows에서 `%LOCALAPPDATA%\Packages\` 아래 `Claude*` 패키지 폴더를 스캔해 그 `LocalCache\Roaming\Claude\claude_desktop_config.json` 경로들을 모두 포함. 설치 시 클래식 + 패키지 경로 **전부에** config를 써서 어느 앱이든 인식되게 함.

```javascript
if (process.env.LOCALAPPDATA) {
  const pkgRoot = path.join(process.env.LOCALAPPDATA, 'Packages')
  try {
    for (const name of fs.readdirSync(pkgRoot)) {
      if (name.startsWith('Claude')) {
        paths.push(path.join(pkgRoot, name, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'))
      }
    }
  } catch { /* Packages 폴더 없음 */ }
}
```

**수동 복구:** 패키지 경로에 직접 config 작성 (PowerShell, UTF-8 BOM 없이).

```powershell
$pkg = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory | Where-Object Name -like "Claude*" | Select-Object -First 1
$cfg = Join-Path $pkg.FullName "LocalCache\Roaming\Claude\claude_desktop_config.json"
# 이하 Bug 5의 작성 로직과 동일
```
