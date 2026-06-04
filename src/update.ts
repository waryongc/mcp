import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VERSION } from './version.js';

const CACHE_FILE = path.join(os.homedir(), '.yeorot-mcp', '.update-cache.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간에 1번만 체크

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<string | null> {
  try {
    // 캐시된 결과가 있으면 API 호출 생략
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as {
        checkedAt: number;
        latestVersion: string;
      };
      if (Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
        return compareVersions(cache.latestVersion, VERSION) > 0 ? cache.latestVersion : null;
      }
    }

    const res = await fetch('https://api.github.com/repos/waryongc/mcp/releases/latest', {
      headers: { 'User-Agent': 'yeorot-mcp' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { tag_name: string };
    const latestVersion = data.tag_name.replace('installer-v', '');

    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ checkedAt: Date.now(), latestVersion }));

    return compareVersions(latestVersion, VERSION) > 0 ? latestVersion : null;
  } catch {
    return null;
  }
}
