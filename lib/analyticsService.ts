import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let posthogClient: PostHog | null = null;
let isInitialized = false;

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

export interface UserProperties {
  userId?: string;
  email?: string;
  role?: 'guardian' | 'kid';
  familyId?: string;
}

export async function initializeAnalytics(): Promise<void> {
  if (isInitialized) {
    console.log('[Analytics] Already initialized');
    return;
  }

  try {
    if (SENTRY_DSN) {
      Sentry.init({
        dsn: SENTRY_DSN,
        enableAutoSessionTracking: true,
        tracesSampleRate: 1.0,
        debug: __DEV__,
        environment: __DEV__ ? 'development' : 'production',
        release: Constants.expoConfig?.version || '1.0.0',
      });
      console.log('[Analytics] Sentry initialized');
    } else {
      console.log('[Analytics] Sentry DSN not configured - skipping');
    }

    if (POSTHOG_API_KEY) {
      posthogClient = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST,
      });
      console.log('[Analytics] PostHog initialized');
    } else {
      console.log('[Analytics] PostHog API key not configured - skipping');
    }

    isInitialized = true;
    console.log('[Analytics] Initialization complete');
  } catch (error) {
    console.error('[Analytics] Initialization error:', error);
  }
}

export function identifyUser(properties: UserProperties): void {
  try {
    if (properties.userId) {
      if (SENTRY_DSN) {
        Sentry.setUser({
          id: properties.userId,
          email: properties.email,
        });
      }

      if (posthogClient) {
        posthogClient.identify(properties.userId, {
          email: properties.email || null,
          role: properties.role || null,
          familyId: properties.familyId || null,
          platform: Platform.OS,
        });
      }
      console.log('[Analytics] User identified:', properties.userId);
    }
  } catch (error) {
    console.error('[Analytics] Error identifying user:', error);
  }
}

export function resetUser(): void {
  try {
    if (SENTRY_DSN) {
      Sentry.setUser(null);
    }
    if (posthogClient) {
      posthogClient.reset();
    }
    console.log('[Analytics] User reset');
  } catch (error) {
    console.error('[Analytics] Error resetting user:', error);
  }
}

export function trackScreen(screenName: string, params?: Record<string, any>): void {
  try {
    if (posthogClient) {
      posthogClient.screen(screenName, params);
    }
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: 'navigation',
        message: `Screen: ${screenName}`,
        level: 'info',
        data: params,
      });
    }
    if (__DEV__) {
      console.log('[Analytics] Screen:', screenName, params);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking screen:', error);
  }
}

export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  try {
    if (posthogClient) {
      posthogClient.capture(eventName, properties);
    }
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb({
        category: 'event',
        message: eventName,
        level: 'info',
        data: properties,
      });
    }
    if (__DEV__) {
      console.log('[Analytics] Event:', eventName, properties);
    }
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error);
  }
}

export function captureError(error: Error, context?: Record<string, any>): void {
  try {
    console.error('[Analytics] Error captured:', error.message);
    if (SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: context,
      });
    }
    if (posthogClient) {
      posthogClient.capture('error', {
        error_message: error.message,
        error_name: error.name,
        ...context,
      });
    }
  } catch (err) {
    console.error('[Analytics] Error capturing error:', err);
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  try {
    if (SENTRY_DSN) {
      Sentry.captureMessage(message, level);
    }
    if (__DEV__) {
      console.log(`[Analytics] Message (${level}):`, message);
    }
  } catch (error) {
    console.error('[Analytics] Error capturing message:', error);
  }
}

export function setContext(key: string, context: Record<string, any>): void {
  try {
    if (SENTRY_DSN) {
      Sentry.setContext(key, context);
    }
    if (posthogClient) {
      posthogClient.capture('$set', {
        $set: { [key]: context },
      });
    }
  } catch (error) {
    console.error('[Analytics] Error setting context:', error);
  }
}

export async function flushAnalytics(): Promise<void> {
  try {
    if (posthogClient) {
      await posthogClient.flush();
    }
  } catch (error) {
    console.error('[Analytics] Error flushing:', error);
  }
}

export { Sentry };
