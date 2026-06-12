# CLAUDE.md

이 파일은 Claude Code가 이 레포지토리에서 작업할 때 참조하는 컨텍스트 문서입니다.

---

## 프로젝트 개요

**yeorot-mcp** — Claude(AI)가 [yeorot](https://github.com/waryongc/yeorot) REST API를 직접 호출할 수 있도록 감싼 MCP(Model Context Protocol) 서버.
사용자가 말로 yeorot을 조작할 수 있게 해주는 Claude ↔ yeorot 중간 레이어.

- **전송**: stdio (Claude Desktop / Claude Code가 자식 프로세스로 spawn)
- **인증**: yeorot API 키 (`yrk_` 접두사, yeorot `api_keys` 테이블)
- **스택**: TypeScript + Node.js (ESM) + @modelcontextprotocol/sdk + Zod
- **연관 프로젝트**: yeorot 메인 서비스 (`/home/xiilab/dev/yeorot`, github.com/waryongc/yeorot)

---

## 로컬 개발

```bash
cp .env.example .env
# .env에 실제 값 입력

npm install
npm run dev        # tsx 직접 실행 (개발용)
npm run build      # dist/index.js 생성
npm start          # 빌드 결과 실행
```

빌드 후 `dist/bundle.mjs` 생성:

```bash
npm run bundle     # esbuild ESM 번들 (installer용)
```

---

## 코딩 규칙

### 절대 하지 말 것

- `any` 타입 사용 금지
- API 키 / 토큰 / 자격 증명을 stdout 또는 AI 응답에 노출 금지 — 내부 URL/에러는 `process.stderr`에만 출력
- `ok()` / `fail()` 래퍼를 우회하여 `content` 배열을 직접 구성 금지

### Tool 구현 패턴

모든 Tool은 동일한 구조를 따른다:

```typescript
export const myTool = {
  name: 'myTool',
  description: '...',
  inputSchema: { type: 'object', properties: { ... }, required: [] },
  async execute(rawInput: unknown): Promise<ResultType> {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    // ... API 호출
  },
};
```

`index.ts`에서 `server.tool(name, description, zodSchema, handler)` 로 등록.

### Tool 추가 방법

1. `src/tools/새도구.ts` 생성 (위 패턴 준수)
2. `src/index.ts`에 import 후 `server.tool(...)` 등록
3. `npm run build` 로 컴파일 확인
4. `PROGRESS.md` 업데이트

yeorot 백엔드 API가 이미 있으면 MCP 쪽만 작업하면 됨 — yeorot 백엔드 수정 불필요.

### 날짜 처리

- KST 기준 오늘 날짜: `src/dates.ts`의 `getTodayKST()` 사용
- 모든 날짜 파라미터는 `YYYY-MM-DD` 문자열 + Zod regex 검증 필수

### 에러 처리

- 네트워크 오류 → `process.stderr.write(...)` 후 사용자 친화적 메시지 throw
- HTTP 401/403/404 → 구체적 한국어 메시지로 변환 (`src/client.ts` 참고)
- Tool 핸들러: `try { return ok(...) } catch(e) { return fail(e) }` 패턴 유지

---

## Git 규칙

- 커밋 단위: 기능 하나 완료될 때마다
- 커밋 메시지 형식:
  - `feat: [기능명]`
  - `fix: [수정내용]`
  - `docs: [문서]`
  - `refactor: [리팩토링 내용]`
- commit 전 반드시 `npm run build` 통과 확인 (빌드 실패 시 commit 금지)
- 커밋 후 반드시 push: `git push origin main`

### Stop hook 자동화 (.claude/hooks/on-progress-done.sh)

`PROGRESS.md`에 새 `- [x]` 완료 행이 추가된 채 턴이 끝나면 Stop hook이 자동으로
**`npm run build` → `git commit` → `git push`** 를 수행한다 (yeorot 본체와 동일한 워크플로우).

- 빌드 실패 시 커밋하지 않고 경고만 표시 (로그: `/tmp/yeorot-mcp-autopush.log`)
- 커밋 메시지: `feat: [작업명] 완료` — 작업명은 `- [x]` 행의 em-dash(` — `) 이전 텍스트
- 따라서 **작업 완료 시 PROGRESS.md에 `- [x]` 행만 추가하면 빌드 검증·커밋·푸시는 hook이 처리** —
  단, hook을 신뢰하지 말고 커밋 누락 여부는 확인할 것. PROGRESS.md를 건드리지 않는 변경은 기존처럼 수동 커밋.

---

## 인스톨러 앱 (installer/)

Electron 기반 GUI 설치 프로그램. 더블클릭 → API 키 입력 → Claude Desktop 자동 설정.

- `npm run bundle` → `dist/bundle.mjs` 생성 (인스톨러가 `~/.yeorot-mcp/index.mjs`에 복사)
- 릴리즈: `git tag installer-v0.x.0 && git push origin installer-v0.x.0`
- GitHub Actions가 태그 푸시 시 자동 빌드 & Release 생성

### CI 빌드 흐름

```
npm run bundle          → dist/bundle.mjs 생성
cp → installer/resources/bundle.mjs  (extraResources가 resources/mcp/에 패키징)
electron-builder        → .exe / .dmg 생성
```

`installer/resources/` 는 로컬에서 항상 비어있어야 정상 — CI가 빌드 시점에 채운다.

### GitHub Actions Secrets (코드 서명용)

| Secret | 역할 | 없으면 |
|---|---|---|
| `BUILD_CERTIFICATE_BASE64` | Apple Developer P12 인증서 base64 인코딩값 | 서명 없이 빌드 (macOS 경고) |
| `P12_PASSWORD` | P12 파일 비밀번호 | (위와 동일) |
| `KEYCHAIN_PASSWORD` | CI 임시 Keychain 비밀번호 (임의 값 가능) | (위와 동일) |
| `APPLE_ID` | 공증용 Apple 계정 이메일 | 공증 생략 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 공증용 앱 전용 비밀번호 | (위와 동일) |
| `APPLE_TEAM_ID` | Apple Developer Team ID 10자리 | (위와 동일) |

**Secrets가 없어도 빌드는 성공한다.** Secret 없으면 `CSC_IDENTITY_AUTO_DISCOVERY=false`로 설정되어 서명 단계를 건너뜀.

- **Windows**: SmartScreen 경고 표시되지만 "추가 정보 → 실행"으로 설치 가능. 기능 영향 없음.
- **macOS**: 15.1 미만은 우클릭 → 열기로 가능. 15.1 이상은 서명 없이 배포 불가 (Apple Developer 가입 필요 — `docs/macos-code-signing.md` 참고).

Secrets 등록 위치: GitHub → Settings → Secrets and variables → Actions

---

## 환경 변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `YEOROT_API_URL` | ✅ | — | yeorot 서버 주소 (예: `https://yeorot.cloud/api/v1`) |
| `YEOROT_API_KEY` | ✅ | — | API 키 (`yrk_` 접두사 필수) |
| `TZ` | | `Asia/Seoul` | 타임존 |
| `YEOROT_TIMEOUT_MS` | | `10000` | 요청 타임아웃 (ms) |

---

## 현재 등록된 Tool 목록

| Tool | 설명 |
|---|---|
| `getTodayTasks` | 날짜별 태스크 조회 (scope: mine/team) |
| `createTask` | 새 태스크 생성 |
| `updateTaskStatus` | 태스크 상태·진행률 변경 |
| `getRackStatus` | 서버 랙 현황 조회 |
| `getProjectStatus` | 프로젝트 현황·진행률·멤버 기여도 조회 |

---

## AI 작업 공통 원칙

- 기존 구현을 존중하고, 불필요한 대규모 재작성은 하지 않는다.
- 작업 전 `CLAUDE.md`, `README.md`, `PROGRESS.md`를 먼저 읽는다.
- Tool 추가 시 `index.ts`의 `ok()` / `fail()` 패턴을 반드시 준수한다.
- secret, token, API key는 코드/로그/AI 응답에 노출하지 않는다.
- 작업 완료 후 `PROGRESS.md` 업데이트 — 새 `- [x]` 행이 추가되면 Stop hook이 빌드·커밋·푸시를 자동 수행한다 (위 "Git 규칙 > Stop hook 자동화" 참고).
