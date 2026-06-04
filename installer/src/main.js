const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execSync } = require('child_process')

function getClaudeConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
  } else {
    return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json')
  }
}

function getMcpInstallPath() {
  return path.join(os.homedir(), '.yeorot-mcp', 'index.mjs')
}

function getBundledMcpPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'mcp', 'bundle.mjs')
  }
  return path.join(__dirname, '..', '..', 'dist', 'bundle.mjs')
}

function checkNodeInstalled() {
  try {
    execSync('node --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function checkClaudeInstalled() {
  const configPath = getClaudeConfigPath()
  return fs.existsSync(path.dirname(configPath))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 580,
    resizable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

ipcMain.handle('check-requirements', () => {
  return {
    node: checkNodeInstalled(),
    claude: checkClaudeInstalled(),
  }
})

ipcMain.handle('install', async (_event, apiKey) => {
  try {
    if (!checkNodeInstalled()) {
      return { ok: false, message: 'Node.js가 설치되어 있지 않습니다.\nhttps://nodejs.org 에서 먼저 설치해 주세요.' }
    }

    // MCP 서버 파일 복사
    const installPath = getMcpInstallPath()
    fs.mkdirSync(path.dirname(installPath), { recursive: true })
    fs.copyFileSync(getBundledMcpPath(), installPath)

    // Claude Desktop 설정 업데이트
    const configPath = getClaudeConfigPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })

    let config = {}
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }

    config.mcpServers = config.mcpServers ?? {}
    config.mcpServers.yeorot = {
      command: 'node',
      args: [installPath],
      env: {
        YEOROT_API_URL: 'https://yeorot.cloud/api/v1',
        YEOROT_API_KEY: apiKey,
      },
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    return { ok: true }
  } catch (err) {
    return { ok: false, message: `오류가 발생했습니다: ${err.message}` }
  }
})

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 알림',
    message: '새 버전의 yeorot MCP 설치 프로그램이 있습니다.',
    detail: '지금 다운로드하시겠습니까?',
    buttons: ['다운로드', '나중에'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.downloadUpdate()
  })
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: '다운로드가 완료되었습니다.',
    detail: '지금 재시작하면 업데이트가 적용됩니다.',
    buttons: ['지금 재시작', '나중에'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

app.whenReady().then(() => {
  createWindow()
  // 패키징된 앱에서만 업데이트 체크 (개발 중엔 스킵)
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {})
  }
})

app.on('window-all-closed', () => app.quit())
