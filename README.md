# yeorot-mcp

[yeorot](https://github.com/waryongc/yeorot) REST API를 Claude(AI)가 직접 호출할 수 있도록 감싼 **MCP(Model Context Protocol) 서버**입니다.

사용자가 말로 yeorot을 조작할 수 있게 해주는 Claude ↔ yeorot 중간 레이어.

---

## 목차

- [MCP란?](#mcp란)
- [등록된 Tool 목록](#등록된-tool-목록)
- [프로젝트 구조](#프로젝트-구조)
- [환경 변수](#환경-변수)
- [로컬 실행](#로컬-실행)
- [Claude Desktop 연결 설정](#claude-desktop-연결-설정)
- [인스톨러 앱](#인스톨러-앱)
- [Tool 추가 방법](#tool-추가-방법)
- [기술 스택](#기술-스택)

---

## MCP란?

**MCP(Model Context Protocol)** 는 Anthropic이 주도하는 오픈 표준으로, AI 애플리케이션이 외부 도구·데이터 소스와 **JSON-RPC 2.0** 기반으로 표준화된 방식으로 소통할 수 있게 합니다. 플러그인처럼 MCP 서버를 연결하면 AI가 직접 API 호출, DB 조회, 파일 조작 등을 수행할 수 있습니다.

### 공식 아키텍처: 3계층 구조

```
┌──────────────────────────────────────────────────────┐
│  MCP Host  (Claude Desktop / Claude Code)            │
│  ┌────────────────────┐                              │
│  │   MCP Client       │──── JSON-RPC 2.0 ──────────▶ │  MCP Server
│  └────────────────────┘                              │  (이 프로젝트)
└──────────────────────────────────────────────────────┘       │
                                                               ▼
                                                     yeorot REST API
```

| 계층 | 역할 | 이 프로젝트에서 |
|---|---|---|
| **MCP Host** | 사용자가 직접 쓰는 AI 앱 | Claude Desktop / Claude Code |
| **MCP Client** | Host 내부의 MCP 프로토콜 처리 | Claude Desktop 내장 클라이언트 |
| **MCP Server** | 도구·데이터를 노출하는 프로세스 | **이 레포 (yeorot-mcp)** |

### MCP 서버의 3가지 프리미티브

| 프리미티브 | 설명 | yeorot-mcp |
|---|---|---|
| **Tools** | AI가 호출하는 함수 | ✅ 사용 (7개 Tool 등록) |
| **Resources** | AI가 읽는 정적 데이터·컨텍스트 | — 미사용 |
| **Prompts** | 재사용 가능한 프롬프트 템플릿 | — 미사용 |

이 서버는 **Tools** 프리미티브만 사용합니다. Claude가 대화 중 필요하다고 판단하면 MCP Client를 통해 Tool을 호출하고, 서버가 yeorot API를 실행한 뒤 결과를 반환합니다.

### 전송 방식: Stdio

이 서버는 **stdio 전송**을 사용합니다. MCP Host가 이 프로세스를 자식 프로세스로 spawn하고, 표준 입출력으로 JSON-RPC 메시지를 주고받습니다.

```
MCP Host (Claude Desktop / Claude Code)
    │  spawn
    ▼
MCP Server: yeorot-mcp (이 프로세스)
    │  stdin  ◀──  JSON-RPC 요청 수신 (tool 호출)
    │  stdout ──▶  JSON-RPC 응답 송신 (tool 결과)
    │  stderr ──▶  로그 출력 (디버깅용, AI 응답에 노출 안 됨)
    │
    ▼
yeorot REST API
```

---

## 등록된 Tool 목록

| Tool | 설명 | 주요 파라미터 |
|---|---|---|
| `getTodayTasks` | 날짜별 태스크 조회 | `date` (선택, YYYY-MM-DD), `scope` (mine/team) |
| `createTask` | 새 태스크 생성 | `title` (필수), `planned_date`, `priority`, `due_time` 등 |
| `updateTaskStatus` | 태스크 상태·진행률·제목·날짜·우선순위 등 변경 | `id` (UUID), `status`, `progress`, `title`, `priority`, `planned_date` 등 |
| `getRackStatus` | 서버 랙 현황 조회 | `rack_id` (선택, UUID) |
| `getProjectStatus` | 프로젝트 현황·진행률·멤버 기여도 조회 | `project_id` (선택, UUID), `include_tasks` |
| `searchTasks` | 키워드로 태스크·프로젝트 검색 | `q` (필수, 검색 키워드 2자 이상) |
| `getStats` | 기간별 생산성 통계 조회 | `period` (day/week/month), `date`, `from`, `to` |

---

## 프로젝트 구조

```
yeorot-mcp/
├── src/
│   ├── index.ts              # MCP 서버 진입점 — 도구 등록 & 서버 시작
│   ├── config.ts             # 환경변수 검증 (Zod)
│   ├── client.ts             # yeorot API HTTP 클라이언트
│   ├── dates.ts              # KST 날짜 유틸
│   ├── update.ts             # 업데이트 체크 (GitHub Releases, 24시간 캐시)
│   ├── version.ts            # 현재 버전 상수
│   └── tools/
│       ├── getTodayTasks.ts      # 날짜별 태스크 조회
│       ├── createTask.ts         # 태스크 생성
│       ├── updateTaskStatus.ts   # 태스크 상태·진행률 변경
│       ├── getRackStatus.ts      # 서버 랙 현황 조회
│       └── getProjectStatus.ts   # 프로젝트 현황 조회
├── installer/                # Electron GUI 설치 프로그램
│   ├── src/
│   └── package.json
├── dist/                     # 빌드 결과물
│   ├── index.js              # tsc 컴파일 결과
│   └── bundle.mjs            # esbuild ESM 번들 (인스톨러용)
├── .github/workflows/
│   └── build-installer.yml   # 태그 푸시 → 자동 빌드 & GitHub Release
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 환경 변수

`.env.example` 파일을 복사해서 사용하세요.

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `YEOROT_API_URL` | ✅ | — | yeorot 서버 주소 (예: `https://yeorot.cloud/api/v1`) |
| `YEOROT_API_KEY` | ✅ | — | API 키 (`yrk_` 접두사 필수) |
| `TZ` | | `Asia/Seoul` | 타임존 |
| `YEOROT_TIMEOUT_MS` | | `10000` | 요청 타임아웃 (ms) |

---

## 로컬 실행

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env에 실제 값 입력

# 2. 의존성 설치
npm install

# 3. 개발 모드 실행 (tsx 직접 실행)
npm run dev

# 또는 빌드 후 실행
npm run build && npm start
```

---

## Claude Desktop 연결 설정

### 사전 준비

- [Node.js 18+](https://nodejs.org) 설치
- [Claude Desktop](https://claude.ai/download) 설치
- yeorot API 키 발급 (`yrk_` 로 시작)

### 1단계: 레포 클론 & 빌드

```bash
git clone https://github.com/waryongc/mcp.git yeorot-mcp
cd yeorot-mcp
npm install
npm run build
# dist/index.js 생성됨
```

### 2단계: 빌드된 파일 경로 확인

```bash
# macOS / Linux
pwd
# 예: /Users/ji.park/yeorot-mcp  →  dist/index.js 경로는 /Users/ji.park/yeorot-mcp/dist/index.js

# Windows (CMD)
cd
# 예: C:\Users\ji.park\yeorot-mcp  →  경로는 C:\\Users\\ji.park\\yeorot-mcp\\dist\\index.js
```

### 3단계: 설정 파일 열기

**macOS**

```bash
open ~/Library/Application\ Support/Claude/
```

**Windows** — `Win+R` → 실행창에 입력:

```
%APPDATA%\Claude
```

`claude_desktop_config.json`을 텍스트 편집기로 엽니다.

### 4단계: 설정 추가

> **파일에 기존 내용이 있는 경우:** 기존 내용을 지우지 말고 `"mcpServers"` 키만 추가합니다.

```json
{
  "mcpServers": {
    "yeorot": {
      "command": "node",
      "args": ["/Users/ji.park/yeorot-mcp/dist/index.js"],
      "env": {
        "YEOROT_API_URL": "https://yeorot.cloud/api/v1",
        "YEOROT_API_KEY": "yrk_발급받은키입력"
      }
    }
  }
}
```

Windows 경로는 역슬래시를 두 개(`\\`)로 작성합니다:

```json
"args": ["C:\\Users\\ji.park\\yeorot-mcp\\dist\\index.js"]
```

### 5단계: Claude Desktop 재시작

설정 파일 저장 후 Claude Desktop을 완전히 종료하고 다시 시작합니다.
채팅창 좌측 하단에 `yeorot` 도구가 표시되면 연결 성공입니다.

---

## 인스톨러 앱

더블클릭 한 번으로 설치를 완료하는 **Electron GUI 설치 프로그램**입니다.
API 키만 입력하면 MCP 서버 파일 복사 + Claude Desktop 설정까지 자동으로 처리합니다.

### 다운로드

[GitHub Releases](https://github.com/waryongc/mcp/releases) 페이지에서 OS별 설치 파일을 받습니다.

| OS | 파일 |
|---|---|
| macOS | `.dmg` |
| Windows | `.exe` |
| Linux | `.AppImage` |

### 릴리즈 방법 (개발자용)

```bash
git tag installer-v0.x.0
git push origin installer-v0.x.0
# GitHub Actions가 자동으로 빌드 & Release 생성
```

---

## Tool 추가 방법

1. `src/tools/새도구.ts` 생성:

```typescript
import { z } from 'zod';
import { yeorotFetch } from '../client.js';

const InputSchema = z.object({ /* ... */ });

export const myTool = {
  name: 'myTool',
  description: 'AI가 이 도구의 용도를 판단하는 기준 설명',
  inputSchema: {
    type: 'object' as const,
    properties: { /* JSON Schema */ },
    required: [],
  },
  async execute(rawInput: unknown) {
    const parsed = InputSchema.safeParse(rawInput);
    if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? '입력값 오류');
    return yeorotFetch('/your-endpoint');
  },
};
```

2. `src/index.ts`에 import 후 `server.tool(...)` 등록
3. `npm run build` 로 컴파일 확인
4. `PROGRESS.md` 업데이트

yeorot 백엔드 API가 이미 있으면 MCP 쪽만 작업하면 됩니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 언어 | TypeScript (ESM) |
| 런타임 | Node.js 18+ |
| MCP SDK | @modelcontextprotocol/sdk |
| 입력 검증 | Zod |
| 환경 변수 | dotenv |
| 번들러 | esbuild |
| 인스톨러 | Electron + electron-builder |
| CI/CD | GitHub Actions |
