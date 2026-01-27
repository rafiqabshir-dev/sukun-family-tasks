import { AppError, generateRequestId } from './errors';
import { weatherOperations, prayerOperations } from './externalOperations';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface DiagnosticResult {
  operationName: string;
  ok: boolean;
  status?: number;
  requestId: string;
  durationMs: number;
  error?: string;
}

export interface DiagnosticsReport {
  timestamp: string;
  results: DiagnosticResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

const DEFAULT_TIMEOUT_MS = 10000;

async function testOperation<T>(
  operationName: string,
  operationFn: () => Promise<T>,
  validateFn?: (result: T) => boolean
): Promise<DiagnosticResult> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      operationFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), DEFAULT_TIMEOUT_MS)
      ),
    ]);

    const durationMs = Date.now() - startTime;

    if (validateFn && !validateFn(result)) {
      return {
        operationName,
        ok: false,
        requestId,
        durationMs,
        error: 'Validation failed',
      };
    }

    return {
      operationName,
      ok: true,
      requestId,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof AppError) {
      return {
        operationName,
        ok: false,
        status: error.status,
        requestId: error.requestId,
        durationMs,
        error: `${error.code}: ${error.message}`,
      };
    }

    return {
      operationName,
      ok: false,
      requestId,
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function runApiDiagnostics(options?: {
  includeSupabase?: boolean;
  includeWeather?: boolean;
  includePrayer?: boolean;
  testLocation?: { latitude: number; longitude: number };
}): Promise<DiagnosticsReport> {
  const {
    includeSupabase = true,
    includeWeather = true,
    includePrayer = true,
    testLocation = { latitude: 37.7749, longitude: -122.4194 },
  } = options || {};

  const results: DiagnosticResult[] = [];
  let skipped = 0;

  if (includeSupabase) {
    if (isSupabaseConfigured()) {
      results.push(
        await testOperation(
          'supabase.auth.getSession',
          async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data;
          }
        )
      );

      results.push(
        await testOperation(
          'supabase.healthCheck',
          async () => {
            const client = supabase.client;
            if (!client) throw new Error('Supabase not configured');
            const { data, error } = await client.from('families').select('id').limit(1);
            if (error && error.code !== 'PGRST116') throw error;
            return data;
          }
        )
      );
    } else {
      skipped += 2;
      results.push({
        operationName: 'supabase.auth.getSession',
        ok: false,
        requestId: generateRequestId(),
        durationMs: 0,
        error: 'Supabase not configured (skipped)',
      });
      results.push({
        operationName: 'supabase.healthCheck',
        ok: false,
        requestId: generateRequestId(),
        durationMs: 0,
        error: 'Supabase not configured (skipped)',
      });
    }
  }

  if (includeWeather) {
    results.push(
      await testOperation(
        'weather.getCurrent',
        () => weatherOperations.getCurrent(testLocation.latitude, testLocation.longitude),
        (result) => typeof result.current?.temperature_2m === 'number'
      )
    );
  }

  if (includePrayer) {
    results.push(
      await testOperation(
        'prayer.getTimings',
        () => prayerOperations.getTimings(testLocation.latitude, testLocation.longitude),
        (result) => !!result.data?.timings?.Fajr
      )
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length - skipped;

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
    },
  };
}

export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines: string[] = [
    `API Diagnostics Report`,
    `Timestamp: ${report.timestamp}`,
    `Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped`,
    '',
    'Results:',
    '-'.repeat(80),
  ];

  for (const result of report.results) {
    const status = result.ok ? 'PASS' : 'FAIL';
    const duration = `${result.durationMs}ms`;
    const error = result.error ? ` - ${result.error}` : '';
    lines.push(
      `[${status}] ${result.operationName.padEnd(35)} ${duration.padStart(8)} [${result.requestId}]${error}`
    );
  }

  lines.push('-'.repeat(80));

  return lines.join('\n');
}

export function printDiagnosticsReport(report: DiagnosticsReport): void {
  console.log(formatDiagnosticsReport(report));
}

let loggingEnabled = __DEV__;

export function setApiLogging(enabled: boolean): void {
  loggingEnabled = enabled;
}

export function isApiLoggingEnabled(): boolean {
  return loggingEnabled;
}
