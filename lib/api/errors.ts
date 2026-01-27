export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppErrorDetails {
  operationName: string;
  requestId: string;
  code: ErrorCode;
  status?: number;
  message: string;
  details?: unknown;
  retryable: boolean;
  originalError?: unknown;
}

export class AppError extends Error {
  readonly operationName: string;
  readonly requestId: string;
  readonly code: ErrorCode;
  readonly status?: number;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly originalError?: unknown;

  constructor(errorDetails: AppErrorDetails) {
    super(errorDetails.message);
    this.name = 'AppError';
    this.operationName = errorDetails.operationName;
    this.requestId = errorDetails.requestId;
    this.code = errorDetails.code;
    this.status = errorDetails.status;
    this.details = errorDetails.details;
    this.retryable = errorDetails.retryable;
    this.originalError = errorDetails.originalError;
  }

  toJSON(): AppErrorDetails {
    return {
      operationName: this.operationName,
      requestId: this.requestId,
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }

  toUserMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'Connection issue. Please check your internet and try again.';
      case 'TIMEOUT_ERROR':
        return 'Request timed out. Please try again.';
      case 'AUTH_ERROR':
        return 'Please sign in again.';
      case 'RATE_LIMIT_ERROR':
        return 'Too many requests. Please wait a moment and try again.';
      case 'VALIDATION_ERROR':
        return 'Invalid data provided.';
      case 'NOT_FOUND_ERROR':
        return 'The requested item was not found.';
      case 'SERVER_ERROR':
        return 'Something went wrong. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeError(
  error: unknown,
  operationName: string,
  requestId: string
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError({
      operationName,
      requestId,
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      retryable: true,
      originalError: error,
    });
  }

  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return new AppError({
        operationName,
        requestId,
        code: 'TIMEOUT_ERROR',
        message: 'Request timed out',
        retryable: true,
        originalError: error,
      });
    }

    if (error.message.includes('abort') || error.name === 'AbortError') {
      return new AppError({
        operationName,
        requestId,
        code: 'NETWORK_ERROR',
        message: 'Request was cancelled',
        retryable: false,
        originalError: error,
      });
    }

    return new AppError({
      operationName,
      requestId,
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      retryable: false,
      originalError: error,
    });
  }

  return new AppError({
    operationName,
    requestId,
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    retryable: false,
    originalError: error,
  });
}

export function normalizeSupabaseError(
  error: { code?: string; message: string; details?: string; hint?: string },
  operationName: string,
  requestId: string,
  status?: number
): AppError {
  const code = error.code || '';

  if (code === 'PGRST301' || code === '42501' || status === 401 || status === 403) {
    return new AppError({
      operationName,
      requestId,
      code: 'AUTH_ERROR',
      status,
      message: 'Authentication required',
      details: error.details || error.hint,
      retryable: false,
      originalError: error,
    });
  }

  if (code === 'PGRST116' || status === 404) {
    return new AppError({
      operationName,
      requestId,
      code: 'NOT_FOUND_ERROR',
      status: 404,
      message: 'Resource not found',
      details: error.details,
      retryable: false,
      originalError: error,
    });
  }

  if (code === '23505') {
    return new AppError({
      operationName,
      requestId,
      code: 'VALIDATION_ERROR',
      message: 'Duplicate entry',
      details: error.details,
      retryable: false,
      originalError: error,
    });
  }

  if (code === '23503') {
    return new AppError({
      operationName,
      requestId,
      code: 'VALIDATION_ERROR',
      message: 'Referenced record not found',
      details: error.details,
      retryable: false,
      originalError: error,
    });
  }

  if (status === 429) {
    return new AppError({
      operationName,
      requestId,
      code: 'RATE_LIMIT_ERROR',
      status: 429,
      message: 'Rate limit exceeded',
      retryable: true,
      originalError: error,
    });
  }

  if (status && status >= 500) {
    return new AppError({
      operationName,
      requestId,
      code: 'SERVER_ERROR',
      status,
      message: 'Server error',
      details: error.details,
      retryable: true,
      originalError: error,
    });
  }

  return new AppError({
    operationName,
    requestId,
    code: 'UNKNOWN_ERROR',
    status,
    message: error.message || 'Unknown database error',
    details: error.details,
    retryable: false,
    originalError: error,
  });
}

export function normalizeHttpError(
  status: number,
  body: unknown,
  operationName: string,
  requestId: string
): AppError {
  if (status === 401 || status === 403) {
    return new AppError({
      operationName,
      requestId,
      code: 'AUTH_ERROR',
      status,
      message: 'Authentication required',
      details: body,
      retryable: false,
    });
  }

  if (status === 404) {
    return new AppError({
      operationName,
      requestId,
      code: 'NOT_FOUND_ERROR',
      status,
      message: 'Resource not found',
      details: body,
      retryable: false,
    });
  }

  if (status === 429) {
    return new AppError({
      operationName,
      requestId,
      code: 'RATE_LIMIT_ERROR',
      status,
      message: 'Rate limit exceeded',
      details: body,
      retryable: true,
    });
  }

  if (status >= 500) {
    return new AppError({
      operationName,
      requestId,
      code: 'SERVER_ERROR',
      status,
      message: 'Server error',
      details: body,
      retryable: status === 502 || status === 503 || status === 504,
    });
  }

  return new AppError({
    operationName,
    requestId,
    code: 'UNKNOWN_ERROR',
    status,
    message: 'Request failed',
    details: body,
    retryable: false,
  });
}

export function logError(error: AppError, isDev: boolean = __DEV__): void {
  if (isDev) {
    console.error(`[API Error] ${error.operationName}`, {
      requestId: error.requestId,
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details,
      retryable: error.retryable,
    });
  } else {
    console.error(`[API Error] ${error.operationName} - ${error.requestId}: ${error.message}`);
  }
}
