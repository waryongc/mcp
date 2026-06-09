# 포스트모템 — 한글 경로 PC에서 MCP가 안 붙던 문제

> **요약:** "한글 username PC(`C:\Users\박종인`)에서 yeorot MCP가 Claude Desktop에 안 붙는다"는 한 줄짜리 증상이, 실제로는 **서로 다른 3개의 버그 + 1개의 경로 위치 발견**이 얽힌 문제였다. 인스톨러 버전을 0.2.4 → 0.2.8까지 올리며 해결했다.

- **기간:** 2026-06-07 ~ 2026-06-09
- **영향 버전:** installer v0.2.4 이하 (전 버전 Windows + 새 Claude Desktop 조합)
- **최종 수정:** installer v0.2.8 (`65e34f0`)
- **관련 Bug 번호:** [PROGRESS.md](../PROGRESS.md) Bug 4 / 5 / 6

---

## 1. 증상

- 한글 username Windows PC에서 인스톨러로 설치해도 Claude Desktop이 yeorot MCP 서버를 인식하지 못함.
- 설정 → 개발자 → "로컬 MCP 서버"에 **"추가된 서버가 없습니다"**.
- `%APPDATA%\Claude\logs\` 폴더조차 생성되지 않음.
- Chat 탭에서 도구는 동작하지만(예: "도구 2개 사용함") yeorot은 목록에 없음.
- Code 탭에서도 안 됨 (단, 이건 정상 — 아래 참고).

## 2. 디버깅 여정 — "고쳤는데 왜 안 되지"의 반복

겉으로는 하나의 증상이지만, 고칠 때마다 **다음 층의 다른 원인**이 드러났다.

| 단계 | 그때 의심한 것 | 실제 원인 |
|---|---|---|
| 1 | 경로 retrieval 인코딩 (`os.homedir()`) | 맞았지만 그게 전부가 아니었음 → **Bug 4** |
| 2 | config 파일 내용이 깨짐 | 깨진 파일을 **재설치로 못 고치는** 구조 → **Bug 5** |
| 3 | 앱이 config를 안 읽음 | 애초에 **다른 경로**에서 읽고 있었음 → **Bug 6** |

핵심 교훈: **로컬에서 서버가 정상 기동(`[yeorot-mcp] 시작됨`)하는데도 앱에 안 붙으면, 문제는 서버가 아니라 "앱이 어느 config를 읽느냐"다.**

## 3. 근본 원인 (3개 체인)

### 원인 A — 한글 username 경로 깨짐 (Bug 4)
Electron에서 `os.homedir()`이 한글 username 경로를 반환할 때 인코딩 불일치로 config의 `args` 경로가 깨짐(`박종인` → `諛뺤쥌??`) + 잘못된 이스케이프(`\.`).
→ **수정:** `process.env.USERPROFILE` 우선 사용 + `path.normalize()`. (v0.2.6)

### 원인 B — 깨진 config가 재설치로 자가 복구 안 됨 (Bug 5)
설치 시 기존 config를 `JSON.parse`로 읽는데, 이미 깨진 파일이면 **여기서 예외가 터져 설치 전체가 실패**. 결과적으로 한 번 깨진 config는 재설치로도 절대 덮어써지지 않았다 → "고쳐도 그대로"의 정체.
→ **수정:** `JSON.parse`를 `try-catch`로 감싸 파싱 실패 시 새 config로 덮어쓰기. (v0.2.7)

### 원인 C — MSIX 패키지 앱이 다른 경로에서 config를 읽음 (Bug 6, **진짜 근본 원인**)
새 Claude Desktop은 **MSIX(Microsoft Store) 패키지 앱**이라 `%APPDATA%`가 가상화된다. 앱은 클래식 경로가 아니라 다음에서만 config를 읽는다:

```
%LOCALAPPDATA%\Packages\Claude_<해시>\LocalCache\Roaming\Claude\claude_desktop_config.json
```

인스톨러는 클래식 경로(`%APPDATA%\Claude\...`)에만 써서, 패키지 앱은 그 파일을 **영영 못 봤다.** 위 모든 증상의 최종 원인.

> **참고 — 해시는 머신 고유값이 아님:** `Claude_pzs8sxrjxfjjc`의 해시는 게시자 신원에서 나온 값이라 **모든 PC에서 동일**하다. 그래도 하드코딩하지 않고 `Packages\` 아래 `Claude`로 시작하는 폴더를 스캔(glob)해 변형(베타 채널 등)까지 대비했다.

→ **수정:** `getClaudeConfigPaths()`(복수)로 클래식 + 모든 패키지 경로를 찾아 **전부에** config 작성. (v0.2.8)

```javascript
function getClaudeConfigPaths() {
  // ... darwin / linux 생략
  if (process.platform === 'win32') {
    const paths = []
    if (process.env.APPDATA) {
      paths.push(path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json'))
    }
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
    return paths
  }
}
```

## 4. 부수적으로 같이 처리한 것

- **버전 표기 불일치:** 태그는 `installer-v0.2.6`인데 빌드 산출물 파일명이 `0.2.5`로 나오던 문제. `package.json` 버전을 태그와 맞추고 릴리즈 재생성. (이후 태그=파일명 일치 규칙 유지)
- **GitHub Actions Node 20 deprecation:** `actions/{checkout,setup-node,upload-artifact,download-artifact}` v4 → v5(Node 24), 남는 JS 액션은 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`로 강제.

## 5. Chat / Code 탭 구분 (혼동 주의)

- **Chat 탭:** `claude_desktop_config.json`(위 패키지 경로) 기반 MCP가 적용됨 → yeorot은 여기서 떠야 정상.
- **Code 탭:** 이 config를 **읽지 않음**. Claude Code 엔진의 별도 MCP 설정을 쓰므로, Code 탭에서 yeorot이 없는 건 정상이며 별도로 등록해야 함.

## 6. 최종 검증 방법

설치(또는 수동 복구) 후:

```powershell
# 앱이 실제로 읽는 패키지 경로의 config가 정상 JSON인지 확인
$pkg = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory | Where-Object Name -like "Claude*" | Select-Object -First 1
$cfg = Join-Path $pkg.FullName "LocalCache\Roaming\Claude\claude_desktop_config.json"
Get-Content $cfg -Raw | ConvertFrom-Json   # 에러 없이 yeorot 출력되면 OK
```

→ Claude Desktop **완전 종료(트레이 → Quit) 후 재시작** → 설정 → 개발자에 `yeorot` 표시 → Chat 탭에서 도구 호출 확인.

## 7. 교훈

1. **"한 줄 증상 ≠ 한 개 버그"** — 고칠 때마다 다음 층이 드러나면, 같은 증상이라도 원인이 바뀌고 있는 것.
2. **로컬 기동 성공 ≠ 앱 인식** — stdio 서버가 터미널에서 잘 뜨는데 앱에 안 붙으면, 의심은 "서버"가 아니라 "앱이 읽는 config 위치"로 가야 한다.
3. **MSIX/Store 앱은 `%APPDATA%`가 가상화된다** — 패키지 앱 설정을 다룰 땐 `%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming\` 경로를 항상 함께 고려.
4. **AI 채팅에 "네 설정 파일 어디야" 묻지 말 것** — 채팅 모델은 자기 코드 샌드박스(`/mnt/...`)만 볼 뿐 데스크탑 앱의 MCP config를 못 본다. 답은 앱의 설정 UI(`구성 편집`) 또는 파일시스템에 있다.
5. **자가 복구를 막는 코드를 경계** — 기존 상태를 읽다 던지는 예외(`JSON.parse`)가 복구 경로 자체를 차단할 수 있다. 복구성 작업의 읽기 단계는 방어적으로.
