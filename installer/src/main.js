const { app, BrowserWindow, ipcMain } = require('electron')

// M4 Mac에서 V8 JIT 컴파일러 버그 우회
app.commandLine.appendSwitch('js-flags', '--no-opt')
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
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOMEPATH || os.homedir())
    : os.homedir()
  return path.normalize(path.join(home, '.yeorot-mcp', 'index.mjs'))
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

    const installPath = getMcpInstallPath()
    fs.mkdirSync(path.dirname(installPath), { recursive: true })
    fs.copyFileSync(getBundledMcpPath(), installPath)

    const configPath = getClaudeConfigPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })

    let config = {}
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      } catch (e) {
        // 기존 config가 깨져 있으면(과거 한글 경로 인코딩 버그 등) JSON.parse가
        // 예외를 던져 설치 전체가 중단됐다. 파싱 실패 시 무시하고 새 config로
        // 덮어써서, 한 번 깨진 파일도 재설치로 자가 복구되게 한다.
        process.stderr.write(`[installer] 기존 config 파싱 실패 — 새로 작성합니다: ${e.message}\n`)
        config = {}
      }
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

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => app.quit())
