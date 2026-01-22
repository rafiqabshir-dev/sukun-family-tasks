import AsyncStorage from "@react-native-async-storage/async-storage";

const WEATHER_CACHE_KEY = "sukun_weather_cache";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface WeatherData {
  temperature: number;
  temperatureUnit: "F" | "C";
  condition: string;
  conditionIcon: string;
  windSpeed: number;
  humidity: number;
  isRaining: boolean;
  isSevere: boolean;
  severeType?: string;
  severeMessage?: string;
  safeOutdoorWindow?: string;
  fetchedAt: string;
}

export interface WearSuggestion {
  item: string;
  icon: string;
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
  latitude: number;
  longitude: number;
}

const WEATHER_CODE_MAP: Record<number, { condition: string; icon: string; isSevere: boolean; isRaining: boolean }> = {
  0: { condition: "Clear", icon: "sunny", isSevere: false, isRaining: false },
  1: { condition: "Mostly Clear", icon: "partly-sunny", isSevere: false, isRaining: false },
  2: { condition: "Partly Cloudy", icon: "partly-sunny", isSevere: false, isRaining: false },
  3: { condition: "Overcast", icon: "cloudy", isSevere: false, isRaining: false },
  45: { condition: "Foggy", icon: "cloud", isSevere: false, isRaining: false },
  48: { condition: "Icy Fog", icon: "cloud", isSevere: true, isRaining: false },
  51: { condition: "Light Drizzle", icon: "rainy", isSevere: false, isRaining: true },
  53: { condition: "Moderate Drizzle", icon: "rainy", isSevere: false, isRaining: true },
  55: { condition: "Heavy Drizzle", icon: "rainy", isSevere: false, isRaining: true },
  56: { condition: "Freezing Drizzle", icon: "rainy", isSevere: true, isRaining: true },
  57: { condition: "Heavy Freezing Drizzle", icon: "rainy", isSevere: true, isRaining: true },
  61: { condition: "Light Rain", icon: "rainy", isSevere: false, isRaining: true },
  63: { condition: "Rain", icon: "rainy", isSevere: false, isRaining: true },
  65: { condition: "Heavy Rain", icon: "rainy", isSevere: true, isRaining: true },
  66: { condition: "Freezing Rain", icon: "rainy", isSevere: true, isRaining: true },
  67: { condition: "Heavy Freezing Rain", icon: "rainy", isSevere: true, isRaining: true },
  71: { condition: "Light Snow", icon: "snow", isSevere: false, isRaining: false },
  73: { condition: "Snow", icon: "snow", isSevere: false, isRaining: false },
  75: { condition: "Heavy Snow", icon: "snow", isSevere: true, isRaining: false },
  77: { condition: "Snow Grains", icon: "snow", isSevere: false, isRaining: false },
  80: { condition: "Light Showers", icon: "rainy", isSevere: false, isRaining: true },
  81: { condition: "Showers", icon: "rainy", isSevere: false, isRaining: true },
  82: { condition: "Heavy Showers", icon: "rainy", isSevere: true, isRaining: true },
  85: { condition: "Light Snow Showers", icon: "snow", isSevere: false, isRaining: false },
  86: { condition: "Heavy Snow Showers", icon: "snow", isSevere: true, isRaining: false },
  95: { condition: "Thunderstorm", icon: "thunderstorm", isSevere: true, isRaining: true },
  96: { condition: "Thunderstorm with Hail", icon: "thunderstorm", isSevere: true, isRaining: true },
  99: { condition: "Severe Thunderstorm", icon: "thunderstorm", isSevere: true, isRaining: true },
};

export async function getWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  try {
    // Check cache first - must be same location (within ~1km)
    const cached = await getCachedWeather(latitude, longitude);
    if (cached) {
      return cached;
    }

    // Fetch from Open-Meteo API (free, no key required)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    );

    if (!response.ok) {
      throw new Error("Weather API request failed");
    }

    const data = await response.json();
    const current = data.current;
    
    const weatherCode = current.weather_code || 0;
    const weatherInfo = WEATHER_CODE_MAP[weatherCode] || WEATHER_CODE_MAP[0];
    
    const weather: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      temperatureUnit: "F",
      condition: weatherInfo.condition,
      conditionIcon: weatherInfo.icon,
      windSpeed: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      isRaining: weatherInfo.isRaining,
      isSevere: weatherInfo.isSevere || current.wind_speed_10m > 25,
      fetchedAt: new Date().toISOString(),
    };

    // Add severe weather details
    if (weather.isSevere) {
      if (weatherCode >= 95) {
        weather.severeType = "Thunderstorm Warning";
        weather.severeMessage = "Outdoor play not recommended";
      } else if (weatherCode >= 65 || weatherCode === 56 || weatherCode === 57) {
        weather.severeType = "Heavy Precipitation";
        weather.severeMessage = "Stay indoors if possible";
      } else if (current.wind_speed_10m > 25) {
        weather.severeType = "High Winds";
        weather.severeMessage = "Strong winds expected";
      } else {
        weather.severeType = "Weather Advisory";
        weather.severeMessage = "Outdoor activities may be affected";
      }
    } else if (!weather.isRaining && weather.windSpeed < 15) {
      // Good outdoor conditions
      const hour = new Date().getHours();
      if (hour < 10) {
        weather.safeOutdoorWindow = "Good for outdoor play after 10 AM";
      } else if (hour < 17) {
        weather.safeOutdoorWindow = "Great time for outdoor activities";
      } else {
        weather.safeOutdoorWindow = "Evening outdoor play possible";
      }
    }

    // Cache the result with location
    await cacheWeather(weather, latitude, longitude);
    
    return weather;
  } catch (error) {
    console.error("[Weather] Fetch error:", error);
    // Return cached data if available, even if expired (but must match location)
    return await getCachedWeather(latitude, longitude, true);
  }
}

function isNearLocation(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  // Check if within ~1km (0.01 degrees is roughly 1km)
  return Math.abs(lat1 - lat2) < 0.01 && Math.abs(lng1 - lng2) < 0.01;
}

async function getCachedWeather(latitude: number, longitude: number, ignoreExpiry = false): Promise<WeatherData | null> {
  try {
    const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedWeather = JSON.parse(cached);
    const now = Date.now();
    
    // Check if location matches
    if (!isNearLocation(latitude, longitude, parsed.latitude, parsed.longitude)) {
      console.log("[Weather] Cache location mismatch, fetching fresh data");
      return null;
    }
    
    if (!ignoreExpiry && now - parsed.timestamp > CACHE_DURATION_MS) {
      return null; // Cache expired
    }

    return parsed.data;
  } catch {
    return null;
  }
}

async function cacheWeather(data: WeatherData, latitude: number, longitude: number): Promise<void> {
  try {
    const cached: CachedWeather = {
      data,
      timestamp: Date.now(),
      latitude,
      longitude,
    };
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error("[Weather] Cache error:", error);
  }
}

export function getWearSuggestions(weather: WeatherData): WearSuggestion[] {
  const suggestions: WearSuggestion[] = [];
  
  // Temperature-based suggestions
  if (weather.temperature < 40) {
    suggestions.push({ item: "Warm jacket", icon: "shirt" });
    suggestions.push({ item: "Gloves and hat", icon: "hand-left" });
  } else if (weather.temperature < 55) {
    suggestions.push({ item: "Light jacket", icon: "shirt" });
  } else if (weather.temperature < 70) {
    suggestions.push({ item: "Long sleeves", icon: "shirt" });
  } else {
    suggestions.push({ item: "Light clothing", icon: "shirt" });
  }
  
  // Rain gear
  if (weather.isRaining || weather.condition.toLowerCase().includes("rain")) {
    suggestions.push({ item: "Waterproof jacket", icon: "umbrella" });
    suggestions.push({ item: "Rain boots", icon: "footsteps" });
  } else {
    suggestions.push({ item: "Sneakers", icon: "footsteps" });
  }
  
  // Wind
  if (weather.windSpeed > 15) {
    suggestions.push({ item: "Windbreaker", icon: "shirt" });
  }
  
  // Sun
  if (weather.condition === "Clear" || weather.condition === "Mostly Clear") {
    if (weather.temperature > 75) {
      suggestions.push({ item: "Sunscreen", icon: "sunny" });
      suggestions.push({ item: "Hat", icon: "shirt" });
    }
  }
  
  // Indoor activities suggestion for severe weather
  if (weather.isSevere) {
    suggestions.push({ item: "Toys for inside", icon: "game-controller" });
  }
  
  return suggestions.slice(0, 4);
}

export function canPlayOutside(weather: WeatherData): { canPlay: boolean; reason: string } {
  if (weather.isSevere) {
    return { canPlay: false, reason: "Severe weather conditions" };
  }
  
  if (weather.temperature < 32) {
    return { canPlay: false, reason: "Too cold outside" };
  }
  
  if (weather.temperature > 100) {
    return { canPlay: false, reason: "Extreme heat warning" };
  }
  
  if (weather.windSpeed > 25) {
    return { canPlay: false, reason: "High winds" };
  }
  
  if (weather.isRaining && weather.condition.toLowerCase().includes("heavy")) {
    return { canPlay: false, reason: "Heavy precipitation" };
  }
  
  return { canPlay: true, reason: weather.safeOutdoorWindow || "Good conditions for outdoor play" };
}
