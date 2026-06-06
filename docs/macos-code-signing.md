# macOS 코드 서명 & 공증 가이드

yeorot-mcp 인스톨러(.dmg)를 macOS에서 경고 없이 배포하기 위한 Apple 코드 서명 + 공증(Notarization) 전체 절차.

---

## 왜 미서명 앱이 macOS에서 죽는가?

### 증상

인터넷에서 다운로드한 미서명 앱 실행 시:
- "개발자를 확인할 수 없음" 경고 → 열기 불가
- 열어도 즉시 강제 종료 (특히 Apple Silicon)
- **macOS 15.1(Sequoia) 이후: Privacy & Security에서 수동 허용 UI 자체가 사라짐 — 사실상 미서명 앱 완전 차단**

### 근본 원인

macOS는 인터넷에서 받은 파일에 `com.apple.quarantine` 속성을 붙이고, 실행 시 Gatekeeper가 서명 + 공증 여부를 검사한다.

Electron 앱은 내부에 V8 JIT 컴파일러가 있는데, **Hardened Runtime** 환경에서는 JIT 실행 메모리(RWX 페이지)에 대한 명시적 엔타이틀먼트가 없으면 커널이 `SIGKILL`로 즉시 종료한다. 이것이 "예기치 못한 오류로 종료"의 실제 원인이다.

### macOS 버전별 강화 추이

| 버전 | 미서명 앱 처리 |
|---|---|
| Mojave 이전 | 경고만, 실행 가능 |
| Catalina (10.15) | 공증 사실상 필수 |
| Big Sur ~ Ventura | 수동 허용 가능하나 절차 복잡 |
| Sonoma (14) | System Settings에서만 허용 가능 |
| Sequoia 15.0 | Control+클릭으로 열기 제거 |
| **Sequoia 15.1+** | Privacy & Security 허용 UI 미표시 — 완전 차단 |

### Apple Silicon에서 더 심각한 이유

- **PAC(Pointer Authentication)**: 코드 포인터 위변조 방지가 하드웨어 내장
- **JIT 제한**: `com.apple.security.cs.allow-jit` 엔타이틀먼트 없이 RWX 페이지 불가 → V8 크래시
- **M2+ SPTM/TXM**: 커널 외부에서 페이지 보호를 감시하는 보안 계층 추가

---

## 전체 해결 절차 개요

```
Apple Developer 가입 ($99/년)
        ↓
Developer ID Application 인증서 발급
        ↓
P12 내보내기 → base64 인코딩 → GitHub Secrets 등록
        ↓
appleid.apple.com → App-specific password 생성 → Secret 등록
        ↓
installer/package.json: hardenedRuntime + afterSign 설정
installer/build/entitlements.mac.plist: JIT 엔타이틀먼트 추가
installer/scripts/notarize.js: 공증 스크립트 작성
        ↓
.github/workflows/build-installer.yml: 인증서 import + 서명 + 공증
        ↓
서명 + 공증 완료 DMG 배포 → 사용자: 경고 없이 설치
```

---

## 1단계: Apple Developer Program 가입

### 비용 및 소요 시간

- **$99 USD / 연** (VAT 별도, 한국에서 원화 결제 가능)
- 개인(Individual): 결제 즉시 ~ 수 시간 내 활성화
- 조직(Organization): D-U-N-S Number 확인 포함 최대 2~7 영업일

### 개인 vs 조직

| 항목 | 개인 | 조직 |
|---|---|---|
| D-U-N-S Number | 불필요 | 필수 (무료 발급, 최대 14일) |
| 비용 | $99 | $99 |
| 앱 서명 명의 | 개인 이름 | 법인명 |
| 권장 | 개인 프로젝트 | 서비스 운영 |

### 등록 절차

1. [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/) 접속
2. Apple ID 로그인 (이중 인증 2FA 필수 활성화)
3. 개인/조직 선택 → 법적 성명, 주소 입력
4. Apple Developer Program License Agreement 동의
5. $99 결제 (신용카드/직불카드)
6. 결제 완료 후 [https://developer.apple.com/account](https://developer.apple.com/account) 접근 가능

---

## 2단계: Developer ID Application 인증서 발급

### 인증서 종류 선택

- **Developer ID Application** — App Store 외 배포용 macOS 앱 서명 ← 우리가 필요한 것
- Developer ID Installer — `.pkg` 설치 프로그램용 (불필요)
- Apple Distribution — App Store 배포용 (불필요)

### 발급 절차

**2-1. CSR(Certificate Signing Request) 생성**

```
Mac에서:
Keychain Access 앱 열기
→ 메뉴: Certificate Assistant → Request a Certificate from a Certificate Authority
→ User Email: Apple ID 이메일 입력
→ Common Name: 본인 이름
→ CA Email: 비워두기
→ "Saved to disk" 선택
→ CertificateSigningRequest.certSigningRequest 저장
```

**2-2. Apple Developer 포털에서 인증서 생성**

1. [https://developer.apple.com/account/resources/certificates/add](https://developer.apple.com/account/resources/certificates/add) 접속
2. "Developer ID Application" 선택 → Continue
3. CSR 파일 업로드
4. `developerID_application.cer` 다운로드
5. 파일 더블클릭 → Keychain에 자동 등록

**2-3. Team ID 확인**

- [https://developer.apple.com/account](https://developer.apple.com/account) 접속
- 우상단 이름 클릭 → Membership Details
- **Team ID**: 영문+숫자 10자리 (예: `ABCDE12345`)

---

## 3단계: P12 파일 내보내기 (CI용)

GitHub Actions에서 사용하려면 인증서를 P12 파일로 내보내야 한다.

```
Keychain Access 앱
→ "My Certificates" 카테고리 클릭
→ "Developer ID Application: ..." 인증서 찾기
→ 인증서 + 그 아래 Private Key 모두 선택 (Cmd+클릭)
→ 우클릭 → "Export 2 items..."
→ 파일명: Developer-ID-Application.p12
→ 강력한 패스워드 설정 (나중에 GitHub Secret으로 등록)
→ 저장
```

**base64로 인코딩 (GitHub Secrets에 넣을 값):**

```bash
base64 -i Developer-ID-Application.p12 | pbcopy
# 클립보드에 복사됨 → GitHub Secret에 붙여넣기
```

---

## 4단계: App-specific Password 생성

Apple ID + 2FA를 사용하는 계정에서 CI용 비밀번호를 별도로 생성한다.

1. [https://appleid.apple.com](https://appleid.apple.com) 접속 → 로그인
2. Sign-In and Security → App-Specific Passwords → **Generate**
3. 이름 입력 (예: "yeorot-mcp-ci")
4. 생성된 비밀번호 복사 (형식: `xxxx-xxxx-xxxx-xxxx`)

---

## 5단계: GitHub Secrets 등록

[https://github.com/waryongc/mcp/settings/secrets/actions](https://github.com/waryongc/mcp/settings/secrets/actions) 에서 아래 Secrets 등록:

| Secret 이름 | 값 | 설명 |
|---|---|---|
| `BUILD_CERTIFICATE_BASE64` | P12 base64 인코딩 값 | 3단계에서 생성 |
| `P12_PASSWORD` | P12 내보낼 때 설정한 패스워드 | 3단계에서 설정 |
| `KEYCHAIN_PASSWORD` | 임의의 강력한 문자열 | CI 임시 Keychain용 (아무 값이나 가능) |
| `APPLE_ID` | Apple Developer 계정 이메일 | 예: `jip95@naver.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | `xxxx-xxxx-xxxx-xxxx` | 4단계에서 생성 |
| `APPLE_TEAM_ID` | 10자리 Team ID | 2단계에서 확인 |

---

## 6단계: 인스톨러 설정 파일 추가

아래 파일들은 이 레포에 이미 준비되어 있다.
Secrets만 등록하면 다음 릴리즈부터 자동으로 서명 + 공증이 적용된다.

### installer/build/entitlements.mac.plist

Electron V8 JIT가 Hardened Runtime에서 동작하기 위한 엔타이틀먼트.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <!-- V8 JIT 컴파일러 실행 허용 (Electron 필수) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <!-- JIT 메모리 실행 허용 (Electron 필수) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <!-- 네트워크 클라이언트 허용 (yeorot API 호출) -->
    <key>com.apple.security.network.client</key>
    <true/>
    <!-- DYLD 환경 변수 허용 (Electron DevTools) -->
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <!-- 네이티브 모듈 라이브러리 검증 완화 -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

### installer/scripts/notarize.js

공증 스크립트. `npm install --save-dev @electron/notarize` 후 사용.

환경 변수 `BUILD_CERTIFICATE_BASE64`가 없으면(로컬 빌드, Windows/Linux CI) 자동으로 건너뛴다.

### installer/package.json 변경 사항

- `hardenedRuntime: true` — 공증 필수 조건
- `entitlements` / `entitlementsInherit` — JIT 허용 plist 지정
- `afterSign` — 서명 후 공증 스크립트 호출
- `notarize: false` — electron-builder 내장 공증 비활성화 (스크립트로 제어)

### .github/workflows/build-installer.yml 변경 사항

macOS 빌드 step에:
1. **인증서 import**: base64 → P12 복원 → 임시 Keychain 생성 → import
2. **CSC_LINK 환경 변수**: electron-builder가 인증서 위치 참조
3. **공증 환경 변수**: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
4. **Keychain 정리**: 항상 실행 (`if: always()`)

Secrets가 없는 환경(fork, 외부 PR)에서는 서명 없이 빌드만 진행한다.

---

## 임시 우회 방법 (Apple Developer 등록 전 로컬 테스트)

### 방법 1: quarantine 속성 제거 (권장)

```bash
xattr -r -d com.apple.quarantine /Applications/yeorot\ MCP\ 설치.app
```

macOS 15.1에서도 동작한다. 직접 다운로드가 아닌 방법으로 받은 파일(USB, AirDrop 등)은 quarantine이 없어 이 과정 불필요.

### 방법 2: ad-hoc 로컬 서명

```bash
xattr -cr /path/to/YourApp.app
codesign --force --deep --sign - /path/to/YourApp.app
```

배포용이 아닌 로컬 테스트 전용. `--deep`은 공식 권장 아님.

### 방법 3: Gatekeeper 비활성화 (비권장)

```bash
sudo spctl --master-disable
# 테스트 후 반드시 재활성화
sudo spctl --master-enable
```

macOS 15+에서는 동작이 변경되었으므로 사용 지양.

---

## 공증 완료 후 검증

```bash
# 서명 정보 확인
codesign -dv --verbose=4 /path/to/yeorot\ MCP\ 설치.app

# 공증 티켓(staple) 확인
xcrun stapler validate /path/to/yeorot\ MCP\ 설치.dmg

# Gatekeeper 통과 여부 확인
spctl -a -v /path/to/yeorot\ MCP\ 설치.app
# 출력: "accepted" 이면 성공
```

---

## 작업 이력

| 날짜 | 내용 |
|---|---|
| 2026-06-04 | M4 Mac V8 JIT 크래시 → `--no-opt` 플래그로 임시 우회, Electron 33 복구 |
| 2026-06-06 | 코드 서명 + 공증 설정 파일 추가 (entitlements.plist, notarize.js, workflow 수정) |
| — | Apple Developer 가입 + Secrets 등록 후 `installer-v0.3.0` 태그 → 자동 서명 배포 예정 |

---

## 참고 링크

- [Electron 공식: Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Apple: Hardened Runtime Entitlements](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple Developer Program 등록](https://developer.apple.com/programs/enroll/)
- [GitHub: Installing an Apple certificate on macOS runners](https://docs.github.com/actions/use-cases-and-examples/deploying/installing-an-apple-certificate-on-macos-runners-for-xcode-development)
- [@electron/notarize](https://github.com/electron/notarize)
- [macOS 15.1 미서명 앱 완전 차단 관련 (MacRumors)](https://forums.macrumors.com/threads/macos-15-1-completely-removes-ability-to-launch-unsigned-applications.2441792/)
