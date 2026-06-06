const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // macOS가 아니면 스킵
  if (electronPlatformName !== 'darwin') return

  // BUILD_CERTIFICATE_BASE64 없으면 서명 환경이 아닌 것으로 간주하고 스킵
  if (!process.env.BUILD_CERTIFICATE_BASE64) {
    console.log('[notarize] BUILD_CERTIFICATE_BASE64 없음 — 공증 건너뜀')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[notarize] 공증 시작: ${appPath}`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })

  console.log('[notarize] 공증 완료')
}
