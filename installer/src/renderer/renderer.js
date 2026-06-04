const installBtn = document.getElementById('installBtn')
const apiKeyInput = document.getElementById('apiKey')
const statusDiv = document.getElementById('status')
const reqNode = document.getElementById('reqNode')
const reqClaude = document.getElementById('reqClaude')
const installView = document.getElementById('installView')
const successView = document.getElementById('successView')

function setStatus(message, type) {
  statusDiv.textContent = message
  statusDiv.className = `status ${type}`
}

function clearStatus() {
  statusDiv.className = 'status'
}

// 요구사항 체크
async function checkRequirements() {
  const { node, claude } = await window.api.checkRequirements()

  reqNode.className = `req ${node ? 'ok' : 'fail'}`
  reqNode.innerHTML = `<span class="dot"></span>${node ? 'Node.js 설치됨' : 'Node.js 미설치 — nodejs.org에서 설치 필요'}`

  reqClaude.className = `req ${claude ? 'ok' : 'fail'}`
  reqClaude.innerHTML = `<span class="dot"></span>${claude ? 'Claude Desktop 설치됨' : 'Claude Desktop 미설치 — claude.ai/download에서 설치 필요'}`

  if (node) installBtn.disabled = false
}

checkRequirements()

// API 키 입력 시 버튼 상태 업데이트
apiKeyInput.addEventListener('input', () => {
  clearStatus()
})

// 설치
installBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim()

  if (!apiKey) {
    setStatus('API 키를 입력해 주세요.', 'error')
    return
  }
  if (!apiKey.startsWith('yrk_')) {
    setStatus('API 키는 yrk_ 로 시작해야 합니다.', 'error')
    return
  }

  installBtn.disabled = true
  installBtn.textContent = '설치 중...'
  setStatus('설치 중입니다...', 'loading')

  const result = await window.api.install(apiKey)

  if (result.ok) {
    installView.style.display = 'none'
    successView.style.display = 'block'
  } else {
    setStatus(result.message, 'error')
    installBtn.disabled = false
    installBtn.textContent = '설치하기'
  }
})

apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') installBtn.click()
})
