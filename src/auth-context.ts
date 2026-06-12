import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * 요청별 API 키 컨텍스트.
 *
 * - 원격(HTTP) 모드: 요청 진입 시 `runWithApiKey(key, fn)`으로 감싸면
 *   그 안에서 일어나는 모든 yeorotFetch가 해당 키를 사용한다.
 * - stdio 모드: 이벤트 기반 콜백은 ALS 컨텍스트가 끊길 수 있으므로
 *   `setFallbackApiKey()`로 env 키를 한 번 등록해 두면 store에 키가 없을 때 사용된다.
 */
const apiKeyStorage = new AsyncLocalStorage<string>();

let fallbackApiKey: string | undefined;

/** stdio 모드 전용 — 프로세스 전역 fallback 키 등록 (시작 시 1회) */
export function setFallbackApiKey(key: string): void {
  fallbackApiKey = key;
}

/** 요청 스코프에 키를 바인딩하고 fn 실행 (원격 모드의 요청 핸들러가 사용) */
export function runWithApiKey<T>(key: string, fn: () => T): T {
  return apiKeyStorage.run(key, fn);
}

/** 현재 컨텍스트의 API 키 — request-scoped 키 우선, 없으면 stdio fallback */
export function getApiKey(): string | undefined {
  return apiKeyStorage.getStore() ?? fallbackApiKey;
}
