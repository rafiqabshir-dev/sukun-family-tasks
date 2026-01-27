# API Conventions

This document describes the standardized API layer for the Sukun app.

## Overview

All API operations go through a centralized API layer located in `/lib/api/`. This provides:

- **Consistent error handling** with typed errors
- **Request tracing** with unique request IDs
- **Retry logic** for transient failures
- **Timeout handling** with configurable limits
- **Logging and diagnostics** for debugging

## File Structure

```
lib/api/
├── index.ts              # Re-exports all modules
├── errors.ts             # Error types and normalization
├── request.ts            # HTTP request wrapper with retry/timeout
├── supabaseOperations.ts # Supabase database operations
├── externalOperations.ts # External API operations (weather, prayer, parks, push)
└── diagnostics.ts        # Health check and diagnostic utilities
```

## Error Types

All API errors are normalized to `AppError` with these codes:

| Code | Description | Retryable |
|------|-------------|-----------|
| `NETWORK_ERROR` | Network connectivity issue | Yes |
| `TIMEOUT_ERROR` | Request timed out | Yes |
| `AUTH_ERROR` | Authentication required | No |
| `RATE_LIMIT_ERROR` | Too many requests | Yes |
| `VALIDATION_ERROR` | Invalid request/response data | No |
| `NOT_FOUND_ERROR` | Resource not found | No |
| `SERVER_ERROR` | Server-side error (5xx) | Sometimes |
| `UNKNOWN_ERROR` | Unexpected error | No |

## Adding a New Operation

### For Supabase Operations

1. Add your operation to the appropriate operations object in `supabaseOperations.ts`:

```typescript
export const myTableOperations = {
  async getById(id: string): Promise<OperationResult<MyType>> {
    return executeSupabaseQuery('myTable.getById', async () =>
      supabase.from('my_table').select('*').eq('id', id).single()
    );
  },

  async create(data: Partial<MyType>): Promise<{ data: MyType | null; requestId: string }> {
    return executeSupabaseMutation('myTable.create', async () =>
      supabase.from('my_table').insert(data).select().single()
    );
  },
};
```

### For External APIs

1. Add types for request/response in `externalOperations.ts`
2. Create operations using the `get`, `post`, or `postForm` helpers:

```typescript
export const myApiOperations = {
  async fetchData(params: MyParams): Promise<MyResponse> {
    return get<MyResponse>(`${MY_API_BASE}/endpoint?param=${params.value}`, {
      operationName: 'myApi.fetchData',
      timeout: 10000,
      retries: 2,
      idempotent: true,
    });
  },
};
```

## Usage in Components

```typescript
import { profileOperations, AppError } from '@/lib/api';

async function loadProfile(userId: string) {
  try {
    const { data } = await profileOperations.getById(userId);
    return data;
  } catch (error) {
    if (error instanceof AppError) {
      // Show user-friendly message
      Alert.alert('Error', error.toUserMessage());
      
      // Log details in dev
      if (__DEV__) {
        console.error(error.toJSON());
      }
    }
    throw error;
  }
}
```

## Retry and Timeout Rules

### Timeouts
- Default: 15 seconds
- External APIs: 10 seconds
- Overpass (parks): 35 seconds (server can be slow)

### Retry Policy
- **GET/HEAD requests**: Automatically retryable (marked as `idempotent` by default)
- **POST/PUT/DELETE**: Never retry unless explicitly marked `idempotent: true`
- **Retryable errors**: Network errors, timeouts, 429, 502, 503, 504
- **Max retries**: 2 by default (configurable per operation)
- **Backoff**: 1s, 2s, 4s with jitter
- **Important**: Non-idempotent operations are never retried, even for network/timeout errors, to prevent duplicate actions

## Request IDs

Every request gets a unique ID in format `req_{timestamp}_{random}`. This ID is:
- Attached to all error objects
- Sent in `X-Request-Id` header
- Logged with operation results

Use request IDs to trace issues across logs.

## Diagnostics

Run API health checks:

```typescript
import { runApiDiagnostics, printDiagnosticsReport } from '@/lib/api';

const report = await runApiDiagnostics();
printDiagnosticsReport(report);
```

Toggle request logging:

```typescript
import { setApiLogging } from '@/lib/api';
setApiLogging(true); // Enable detailed logging
```

## Best Practices

1. **Never use raw fetch** - Always use the API layer
2. **Include operation names** - Use `tableName.action` format
3. **Handle errors at call site** - Don't swallow errors silently
4. **Show user-friendly messages** - Use `error.toUserMessage()`
5. **Log request IDs** - Include in bug reports for tracing
6. **Mark idempotency** - Set `idempotent: true` for safe retries
7. **Set appropriate timeouts** - Shorter for user-facing, longer for background

## Bugs Fixed During Standardization

1. **Inconsistent error wrapping** - All errors now normalized to AppError
2. **Missing timeouts** - All operations now have configurable timeouts
3. **No retry logic** - Added automatic retry for transient failures
4. **Silent failures** - All errors now logged and surfaced
5. **No request tracing** - Added request IDs to all operations
6. **Duplicate error handling code** - Centralized in error normalization
7. **Mixed return types** - Standardized to `{ data, requestId }` pattern
