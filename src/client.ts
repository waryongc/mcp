import { config } from './config.js';

interface FetchOptions {
  method?: string;
  body?: unknown;
}

interface ErrorBody {
  error?: string;
}

export async function yeorotFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${config.YEOROT_API_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.YEOROT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Authorization': `Bearer ${config.YEOROT_API_KEY}`,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    // Log internal URL to stderr only; omit from user-facing message to avoid topology leakage
    process.stderr.write(`[yeorot-mcp] connection error to ${config.YEOROT_API_URL}: ${message}\n`);
    throw new Error('yeorot 서버에 연결할 수 없습니다');
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    let errorMessage: string;
    try {
      const body = (await response.json()) as ErrorBody;
      errorMessage = body.error ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }

    if (response.status === 404) {
      throw new Error('리소스를 찾을 수 없습니다');
    }
    if (response.status === 403) {
      throw new Error('권한이 없습니다');
    }
    if (response.status === 401) {
      throw new Error('인증이 필요합니다 — API 키를 확인하세요');
    }
    throw new Error(`요청 실패 (${response.status}): ${errorMessage}`);
  }

  return response.json() as Promise<T>;
}
