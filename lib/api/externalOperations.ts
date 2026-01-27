import { get, post, postForm } from './request';
import { AppError, generateRequestId, logError } from './errors';

export interface WeatherApiResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    precipitation: number;
    precipitation_probability?: number;
  };
  hourly?: {
    uv_index?: number[];
    visibility?: number[];
  };
}

export interface PrayerApiResponse {
  data: {
    timings: {
      Fajr: string;
      Sunrise: string;
      Dhuhr: string;
      Asr: string;
      Maghrib: string;
      Isha: string;
    };
    date: {
      gregorian: {
        date: string;
      };
    };
  };
}

export interface OverpassApiResponse {
  elements: Array<{
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>;
}

export interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: {
      error?: string;
    };
  }>;
}

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';
const ALADHAN_BASE = 'https://api.aladhan.com/v1';
const EXPO_PUSH_BASE = 'https://exp.host/--/api/v2/push';

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export const weatherOperations = {
  async getCurrent(latitude: number, longitude: number, signal?: AbortSignal): Promise<WeatherApiResponse> {
    const url = `${OPEN_METEO_BASE}/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,precipitation_probability&hourly=uv_index,visibility&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
    
    return get<WeatherApiResponse>(url, {
      operationName: 'weather.getCurrent',
      timeout: 10000,
      retries: 2,
      idempotent: true,
      signal,
    });
  },
};

export const prayerOperations = {
  async getTimings(latitude: number, longitude: number, signal?: AbortSignal): Promise<PrayerApiResponse> {
    const url = `${ALADHAN_BASE}/timings?latitude=${latitude}&longitude=${longitude}&method=2`;
    
    return get<PrayerApiResponse>(url, {
      operationName: 'prayer.getTimings',
      timeout: 10000,
      retries: 2,
      idempotent: true,
      signal,
    });
  },
};

export const parkOperations = {
  async getNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
    signal?: AbortSignal
  ): Promise<OverpassApiResponse> {
    const query = `
      [out:json][timeout:30];
      (
        way["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
        way["leisure"="playground"](around:${radiusMeters},${latitude},${longitude});
        way["leisure"="garden"]["access"!="private"](around:${radiusMeters},${latitude},${longitude});
        way["leisure"="nature_reserve"](around:${radiusMeters},${latitude},${longitude});
        way["leisure"="recreation_ground"](around:${radiusMeters},${latitude},${longitude});
        node["leisure"="playground"](around:${radiusMeters},${latitude},${longitude});
        node["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
        relation["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
        relation["boundary"="national_park"](around:${radiusMeters},${latitude},${longitude});
      );
      out center tags;
    `;

    let lastError: AppError | null = null;

    for (const server of OVERPASS_SERVERS) {
      try {
        const result = await postForm<OverpassApiResponse>(
          server,
          `data=${encodeURIComponent(query)}`,
          {
            operationName: 'parks.getNearby',
            timeout: 35000,
            retries: 0,
            idempotent: true,
            signal,
          }
        );

        if (!result.elements) {
          throw new AppError({
            operationName: 'parks.getNearby',
            requestId: generateRequestId(),
            code: 'VALIDATION_ERROR',
            message: 'Invalid response format',
            retryable: false,
          });
        }

        return result;
      } catch (error) {
        if (error instanceof AppError) {
          lastError = error;
          if (__DEV__) {
            console.log(`[Parks] Server ${server} failed: ${error.message}, trying next...`);
          }
          continue;
        }
        throw error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new AppError({
      operationName: 'parks.getNearby',
      requestId: generateRequestId(),
      code: 'SERVER_ERROR',
      message: 'All Overpass servers failed',
      retryable: true,
    });
  },
};

export interface PushMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const pushOperations = {
  async send(messages: PushMessage[]): Promise<ExpoPushResponse> {
    if (messages.length === 0) {
      return { data: [] };
    }

    return post<ExpoPushResponse>(
      `${EXPO_PUSH_BASE}/send`,
      messages,
      {
        operationName: 'push.send',
        timeout: 15000,
        retries: 1,
        idempotent: false,
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
        },
      }
    );
  },
};
