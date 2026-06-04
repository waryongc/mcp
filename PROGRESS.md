# PROGRESS

## 인스톨러 앱 (Electron)

**목표:** 더블클릭으로 실행 → API 키 입력 → Claude Desktop 자동 설정

### 완료

- [x] Electron 앱 기본 구조 (`installer/`)
- [x] UI — API 키 입력, Node.js/Claude Desktop 설치 여부 체크, 설치 완료 화면
- [x] 설치 로직 — MCP 서버를 `~/.yeorot-mcp/index.cjs`에 복사 후 `claude_desktop_config.json` 자동 수정
- [x] macOS / Windows / Linux 빌드 지원
- [x] GitHub Actions CI — 태그(`installer-v*`) 푸시 시 자동 빌드 & GitHub Release 생성
- [x] esbuild 번들 스크립트 추가 (`npm run bundle` → `dist/bundle.cjs`)

### 남은 작업

- [ ] 앱 아이콘 추가 (macOS `.icns`, Windows `.ico`, Linux `.png`)
- [ ] macOS 코드 서명 & 공증 (Notarization) — 미서명 시 보안 경고 뜸
- [ ] Windows 코드 서명 — 미서명 시 SmartScreen 경고 뜸
- [ ] 재설치(업데이트) 시 기존 API 키 불러오기
- [ ] Node.js 미설치 시 다운로드 페이지 자동 열기
- [ ] Claude Desktop 미설치 시 다운로드 페이지 자동 열기

### 릴리즈 방법

```bash
# 태그를 푸시하면 GitHub Actions가 자동으로 빌드 & 릴리즈
git tag installer-v0.1.0
git push origin installer-v0.1.0
```

GitHub Releases 페이지에서 `.dmg` / `.exe` / `.AppImage` 다운로드 가능.
