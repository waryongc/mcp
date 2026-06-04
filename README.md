# yeorot-mcp

yeorot REST API를 Claude(AI)가 직접 호출할 수 있도록 감싼 **MCP(Model Context Protocol) 서버**입니다.

---

## MCP란 무엇인가?

### 핵심 개념

**MCP(Model Context Protocol)** 는 AI 모델(Claude, GPT 등)이 외부 도구·데이터 소스와 표준화된 방식으로 소통하기 위한 오픈 프로토콜입니다. Anthropic이 설계했으며 2024년 공개됐습니다.

```
사용자 ──▶ AI(Claude) ──▶ MCP 서버 ──▶ 외부 시스템(DB, API, 파일...)
                 ◀─────────────────────────────────────
```

AI가 "이 도구를 쓰고 싶다"고 요청하면 MCP 서버가 실제 작업을 실행하고 결과를 돌려줍니다.

### 기존 방식과의 차이

| | 기존 Function Calling | MCP |
|---|---|---|
| 표준화 | 모델마다 다름 | 단일 프로토콜 |
| 배포 | AI 코드에 함께 | 별도 프로세스 |
| 재사용 | 불가 | 어느 MCP 클라이언트든 연결 가능 |
| 보안 | AI가 직접 접근 | 서버가 격리·제어 |

### 3가지 핵심 기능 유형

- **Tool** — AI가 실행할 수 있는 함수 (이 프로젝트가 구현하는 것)
- **Resource** — AI가 읽을 수 있는 데이터 소스 (파일, DB 행 등)
- **Prompt** — 재사용 가능한 프롬프트 템플릿

---

## 이 프로젝트의 구조

```
yeorot-mcp/
├── src/
│   ├── index.ts          # MCP 서버 진입점 — 도구 등록 & 서버 시작
│   ├── config.ts         # 환경변수 검증 (Zod)
│   ├── client.ts         # yeorot API HTTP 클라이언트
│   ├── dates.ts          # KST 날짜 유틸
│   └── tools/
│       ├── getTodayTasks.ts     # 오늘 태스크 조회
│       ├── createTask.ts        # 태스크 생성
│       ├── updateTaskStatus.ts  # 태스크 상태 변경
│       └── getRackStatus.ts     # 서버 랙 현황 조회
└── package.json
```

### 전송 방식: Stdio

이 서버는 **stdio 전송**을 사용합니다. MCP 클라이언트(Claude Desktop 등)가 이 프로세스를 자식 프로세스로 실행하고, 표준 입출력(stdin/stdout)으로 JSON-RPC 메시지를 주고받습니다.

```
Claude Desktop
    │  spawn
    ▼
yeorot-mcp (이 프로세스)
    │  stdin  ──▶  JSON-RPC 요청 수신
    │  stdout ──▶  JSON-RPC 응답 송신
    │  stderr ──▶  로그 출력
```

---

## 등록된 Tool 목록

| Tool | 설명 | 주요 파라미터 |
|---|---|---|
| `getTodayTasks` | 날짜별 태스크 조회 | `date` (선택, YYYY-MM-DD) |
| `createTask` | 새 태스크 생성 | `title` (필수), `planned_date`, `priority`, `due_time` 등 |
| `updateTaskStatus` | 태스크 상태·진행률 변경 | `id` (UUID), `status`, `progress` |
| `getRackStatus` | 서버 랙 현황 조회 | `rack_id` (선택, UUID) |

---

## Tool 구현 패턴

모든 Tool은 동일한 구조를 따릅니다:

```typescript
export const myTool = {
  name: 'myTool',           // AI가 호출할 이름
  description: '...',       // AI가 이 도구의 용도를 판단하는 기준
  inputSchema: { ... },     // JSON Schema — AI에게 전달되는 파라미터 명세
  async execute(input) {    // 실제 실행 로직
    const parsed = InputSchema.safeParse(input);  // Zod 검증
    // ... API 호출
  }
};
```

`index.ts`에서 `server.tool(name, description, zodSchema, handler)` 로 등록합니다.

---

## 환경 변수

`.env.example` 참고:

```env
YEOROT_API_URL=http://localhost:3000/api/v1   # yeorot 서버 주소
YEOROT_API_KEY=yrk_여기에_발급받은_키_입력    # API 키 (yrk_ 접두사 필수)
TZ=Asia/Seoul                                  # 타임존 (기본값)
YEOROT_TIMEOUT_MS=10000                        # 요청 타임아웃(ms)
```

---

## 로컬 실행

```bash
cp .env.example .env
# .env에 실제 값 입력

npm install
npm run dev        # tsx로 바로 실행 (개발용)
# 또는
npm run build && npm start   # 빌드 후 실행
```

### Claude Desktop 연결 설정

#### 1단계: 프로젝트 빌드

```bash
npm install
npm run build
# dist/index.js 가 생성됩니다
```

#### 2단계: 설정 파일 열기

**macOS**

```bash
open ~/Library/Application\ Support/Claude/
# claude_desktop_config.json 파일을 텍스트 편집기로 엽니다 (없으면 새로 만드세요)
```

**Windows**

파일 탐색기 주소창에 아래 경로를 입력하거나 `Win+R` → 실행창에 붙여넣기:

```
%APPDATA%\Claude
```

`claude_desktop_config.json` 파일을 메모장 등으로 엽니다 (없으면 새로 만드세요).

#### 3단계: 설정 내용 입력

**macOS** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yeorot": {
      "command": "node",
      "args": ["/Users/사용자이름/프로젝트경로/yeorot-mcp/dist/index.js"],
      "env": {
        "YEOROT_API_URL": "http://localhost:3000/api/v1",
        "YEOROT_API_KEY": "yrk_발급받은키입력"
      }
    }
  }
}
```

> 실제 경로 확인: 프로젝트 폴더에서 `pwd` 명령어를 실행하면 현재 경로가 나옵니다.  
> 예) `/Users/홍길동/dev/yeorot-mcp` → args에 `/Users/홍길동/dev/yeorot-mcp/dist/index.js` 입력

**Windows** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yeorot": {
      "command": "node",
      "args": ["C:\\Users\\사용자이름\\프로젝트경로\\yeorot-mcp\\dist\\index.js"],
      "env": {
        "YEOROT_API_URL": "http://localhost:3000/api/v1",
        "YEOROT_API_KEY": "yrk_발급받은키입력"
      }
    }
  }
}
```

> Windows 경로는 역슬래시(`\`)를 두 개(`\\`)로 써야 합니다.  
> 실제 경로 확인: 프로젝트 폴더에서 `cd` 명령어를 실행하면 현재 경로가 나옵니다.

#### 4단계: Claude Desktop 재시작

설정 파일 저장 후 Claude Desktop을 완전히 종료하고 다시 시작합니다.  
채팅창 좌측 하단에 `yeorot` 도구가 표시되면 연결 성공입니다.

---

## 기술 스택

- **TypeScript** + **Node.js** (ESM)
- **@modelcontextprotocol/sdk** — MCP 서버 구현체
- **Zod** — 런타임 입력 검증 및 환경변수 검증
- **dotenv** — 환경변수 로딩
