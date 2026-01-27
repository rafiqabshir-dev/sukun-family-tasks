import { AppError, generateRequestId, normalizeError, normalizeHttpError, logError } from './errors';

export interface RequestConfig {
  operationName: string;
  timeout?: number;
  retries?: number;
  idempotent?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  parseJson?: boolean;
}

export interface ApiResponse<T> {
  ok: true;
  data: T;
  requestId: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 0;
const RETRY_DELAYS = [1000, 2000, 4000];

function shouldRetry(error: AppError, attempt: number, maxRetries: number, idempotent: boolean): boolean {
  if (attempt >= maxRetries) return false;
  if (!error.retryable) return false;
  if (!idempotent) return false;
  return true;
}

function getRetryDelay(attempt: number): number {
  const baseDelay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
  const jitter = Math.random() * 500;
  return baseDelay + jitter;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit,
  config: RequestConfig
): Promise<T> {
  const {
    operationName,
    timeout = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    idempotent = options.method === 'GET' || options.method === 'HEAD',
    signal: externalSignal,
    headers: extraHeaders = {},
    parseJson = true,
  } = config;

  const requestId = generateRequestId();
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let externalAbortHandler: (() => void) | null = null;
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new AppError({
          operationName,
          requestId,
          code: 'NETWORK_ERROR',
          message: 'Request was cancelled',
          retryable: false,
        });
      }
      externalAbortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', externalAbortHandler);
    }

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (externalSignal && externalAbortHandler) {
        externalSignal.removeEventListener('abort', externalAbortHandler);
      }
    };

    try {
      const startTime = Date.now();

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          ...extraHeaders,
          'X-Request-Id': requestId,
          'X-Operation-Name': operationName,
        },
      });

      cleanup();
      const duration = Date.now() - startTime;

      if (__DEV__) {
        console.log(`[API] ${operationName} ${response.status} (${duration}ms) [${requestId}]`);
      }

      if (!response.ok) {
        let body: unknown;
        try {
          const text = await response.text();
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }

        throw normalizeHttpError(response.status, body, operationName, requestId);
      }

      if (!parseJson) {
        return response as unknown as T;
      }

      const text = await response.text();
      if (!text) {
        return null as unknown as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new AppError({
          operationName,
          requestId,
          code: 'VALIDATION_ERROR',
          message: 'Invalid JSON response',
          retryable: false,
        });
      }
    } catch (error) {
      cleanup();

      if (error instanceof AppError) {
        lastError = error;
      } else {
        lastError = normalizeError(error, operationName, requestId);
      }

      if (shouldRetry(lastError, attempt, retries, idempotent)) {
        const delay = getRetryDelay(attempt);
        if (__DEV__) {
          console.log(`[API] ${operationName} retry ${attempt + 1}/${retries} in ${delay}ms [${requestId}]`);
        }
        await sleep(delay);
        continue;
      }

      logError(lastError);
      throw lastError;
    }
  }

  if (lastError) {
    logError(lastError);
    throw lastError;
  }

  throw new AppError({
    operationName,
    requestId,
    code: 'UNKNOWN_ERROR',
    message: 'Request failed after retries',
    retryable: false,
  });
}

export async function get<T>(url: string, config: RequestConfig): Promise<T> {
  return apiRequest<T>(url, { method: 'GET' }, { ...config, idempotent: true });
}

export async function post<T>(
  url: string,
  body: unknown,
  config: RequestConfig
): Promise<T> {
  return apiRequest<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config
  );
}

export async function postForm<T>(
  url: string,
  body: string,
  config: RequestConfig
): Promise<T> {
  return apiRequest<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    config
  );
}
