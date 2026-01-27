import AsyncStorage from "@react-native-async-storage/async-storage";
import { weather } from "./api";

const WEATHER_CACHE_KEY = "sukun_weather_cache";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface WeatherAlert {
  event: string;
  headline: string;
  description: string;
  severity: "minor" | "moderate" | "severe" | "extreme";
  urgency: "immediate" | "expected" | "future";
  start: string;
  end: string;
}

export interface WeatherData {
  temperature: number;
  temperatureUnit: "F" | "C";
  feelsLike: number;
  condition: string;
  conditionCode: number;
  conditionIcon: string;
  windSpeed: number;
  windGust: number;
  humidity: number;
  uvIndex: number;
  visibility: number;
  precipitationProbability: number;
  isRaining: boolean;
  isSnowing: boolean;
  isSevere: boolean;
  alerts: WeatherAlert[];
  severeType?: string;
  severeMessage?: string;
  safeOutdoorWindow?: string;
  fetchedAt: string;
}

export interface ClothingItem {
  name: string;
  icon: string;
  category: "top" | "bottom" | "footwear" | "accessory" | "protection";
  priority: number;
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
  latitude: number;
  longitude: number;
}

const WEATHER_CODE_MAP: Record<number, { condition: string; icon: string; isSevere: boolean; isRaining: boolean; isSnowing: boolean }> = {
  0: { condition: "Clear", icon: "sunny", isSevere: false, isRaining: false, isSnowing: false },
  1: { condition: "Mostly Clear", icon: "partly-sunny", isSevere: false, isRaining: false, isSnowing: false },
  2: { condition: "Partly Cloudy", icon: "partly-sunny", isSevere: false, isRaining: false, isSnowing: false },
  3: { condition: "Overcast", icon: "cloudy", isSevere: false, isRaining: false, isSnowing: false },
  45: { condition: "Foggy", icon: "cloud", isSevere: false, isRaining: false, isSnowing: false },
  48: { condition: "Icy Fog", icon: "cloud", isSevere: true, isRaining: false, isSnowing: false },
  51: { condition: "Light Drizzle", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  53: { condition: "Moderate Drizzle", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  55: { condition: "Heavy Drizzle", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  56: { condition: "Freezing Drizzle", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  57: { condition: "Heavy Freezing Drizzle", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  61: { condition: "Light Rain", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  63: { condition: "Rain", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  65: { condition: "Heavy Rain", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  66: { condition: "Freezing Rain", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  67: { condition: "Heavy Freezing Rain", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  71: { condition: "Light Snow", icon: "snow", isSevere: false, isRaining: false, isSnowing: true },
  73: { condition: "Snow", icon: "snow", isSevere: false, isRaining: false, isSnowing: true },
  75: { condition: "Heavy Snow", icon: "snow", isSevere: true, isRaining: false, isSnowing: true },
  77: { condition: "Snow Grains", icon: "snow", isSevere: false, isRaining: false, isSnowing: true },
  80: { condition: "Light Showers", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  81: { condition: "Showers", icon: "rainy", isSevere: false, isRaining: true, isSnowing: false },
  82: { condition: "Heavy Showers", icon: "rainy", isSevere: true, isRaining: true, isSnowing: false },
  85: { condition: "Light Snow Showers", icon: "snow", isSevere: false, isRaining: false, isSnowing: true },
  86: { condition: "Heavy Snow Showers", icon: "snow", isSevere: true, isRaining: false, isSnowing: true },
  95: { condition: "Thunderstorm", icon: "thunderstorm", isSevere: true, isRaining: true, isSnowing: false },
  96: { condition: "Thunderstorm with Hail", icon: "thunderstorm", isSevere: true, isRaining: true, isSnowing: false },
  99: { condition: "Severe Thunderstorm", icon: "thunderstorm", isSevere: true, isRaining: true, isSnowing: false },
};

export async function getWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  try {
    const cached = await getCachedWeather(latitude, longitude);
    if (cached) {
      return cached;
    }

    const data = await weather.getCurrent(latitude, longitude);
    const current = data.current;
    const hourly = data.hourly;
    
    const weatherCode = current.weather_code || 0;
    const weatherInfo = WEATHER_CODE_MAP[weatherCode] || WEATHER_CODE_MAP[0];
    
    const temp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const windSpeed = Math.round(current.wind_speed_10m);
    const windGust = Math.round(current.wind_gusts_10m || 0);
    const precipProb = current.precipitation_probability || 0;
    
    const currentHour = new Date().getHours();
    const uvIndex = hourly?.uv_index?.[currentHour] || 0;
    const visibility = hourly?.visibility?.[currentHour] || 10000;
    
    const isExtremeCold = feelsLike <= 10;
    const isVeryCold = feelsLike <= 32;
    const isCold = feelsLike <= 45;
    const isExtremeHeat = feelsLike >= 100;
    const isHot = feelsLike >= 90;
    const isHighWind = windSpeed >= 25 || windGust >= 35;
    const isLowVisibility = visibility < 1000;
    const hasWeatherSevere = weatherInfo.isSevere;
    
    const isSevere = hasWeatherSevere || isHighWind || isExtremeCold || isExtremeHeat || isLowVisibility;
    
    const alerts: WeatherAlert[] = [];
    
    if (weatherCode >= 95) {
      alerts.push({
        event: "Thunderstorm Warning",
        headline: "Thunderstorm Warning in Effect",
        description: `Active ${weatherInfo.condition.toLowerCase()} in your area. Lightning, heavy rain, and ${windGust > 40 ? "damaging winds up to " + windGust + " mph" : "gusty winds"} expected.`,
        severity: weatherCode >= 99 ? "extreme" : "severe",
        urgency: "immediate",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (isExtremeCold) {
      const frostbiteTime = feelsLike <= 0 ? "10-15 minutes" : feelsLike <= 10 ? "15-30 minutes" : "30+ minutes";
      alerts.push({
        event: "Extreme Cold Warning",
        headline: `Dangerously Cold: Feels like ${feelsLike}°F`,
        description: `Frostbite can occur on exposed skin in ${frostbiteTime}. Limit outdoor exposure and cover all exposed skin.`,
        severity: feelsLike <= 0 ? "extreme" : "severe",
        urgency: "immediate",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    } else if (isVeryCold) {
      alerts.push({
        event: "Cold Weather Advisory",
        headline: `Cold Advisory: Feels like ${feelsLike}°F`,
        description: `Near or below freezing temperatures. Dress in warm layers and limit time outdoors for children.`,
        severity: "moderate",
        urgency: "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (isExtremeHeat) {
      alerts.push({
        event: "Excessive Heat Warning",
        headline: `Dangerous Heat: Feels like ${feelsLike}°F`,
        description: `Heat illness possible with prolonged exposure. Stay hydrated, take breaks in shade/AC, and avoid strenuous outdoor activity during peak hours.`,
        severity: feelsLike >= 110 ? "extreme" : "severe",
        urgency: "immediate",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    } else if (isHot) {
      alerts.push({
        event: "Heat Advisory",
        headline: `Heat Advisory: Feels like ${feelsLike}°F`,
        description: `Hot conditions expected. Drink plenty of water and take frequent breaks in the shade.`,
        severity: "moderate",
        urgency: "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (isHighWind) {
      const windDesc = windGust >= 50 ? "damaging" : windGust >= 40 ? "strong" : "gusty";
      alerts.push({
        event: "High Wind Advisory",
        headline: `High Winds: ${windSpeed} mph, gusts to ${windGust} mph`,
        description: `${windDesc.charAt(0).toUpperCase() + windDesc.slice(1)} winds may make outdoor activities difficult. Secure loose outdoor items.`,
        severity: windGust >= 50 ? "severe" : "moderate",
        urgency: windGust >= 50 ? "immediate" : "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (weatherCode >= 65 && weatherCode <= 67 || weatherCode >= 75) {
      const precipType = weatherInfo.isSnowing ? "Heavy Snow" : "Heavy Rain";
      alerts.push({
        event: `${precipType} Warning`,
        headline: `${precipType} in Your Area`,
        description: `${precipType.toLowerCase()} may reduce visibility and make travel hazardous. Plan indoor activities.`,
        severity: "severe",
        urgency: "immediate",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (weatherCode >= 71 && weatherCode <= 77 && !alerts.find(a => a.event.includes("Snow"))) {
      alerts.push({
        event: "Snow Advisory",
        headline: `Snow: ${weatherInfo.condition}`,
        description: `Snowy conditions in your area. Roads and sidewalks may be slippery. Dress warmly for outdoor play.`,
        severity: "minor",
        urgency: "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (isLowVisibility && !alerts.length) {
      alerts.push({
        event: "Dense Fog Advisory",
        headline: `Low Visibility: ${Math.round(visibility / 1000 * 0.621)} miles`,
        description: `Fog reducing visibility. Use caution when outside and be visible to vehicles.`,
        severity: visibility < 500 ? "severe" : "moderate",
        urgency: "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    if (uvIndex >= 8) {
      alerts.push({
        event: uvIndex >= 11 ? "Extreme UV Alert" : "High UV Index",
        headline: `UV Index: ${Math.round(uvIndex)} (${uvIndex >= 11 ? "Extreme" : "Very High"})`,
        description: `Strong sun exposure. ${uvIndex >= 11 ? "Avoid sun during midday hours." : "Apply sunscreen SPF 30+, wear hats and sunglasses."}`,
        severity: uvIndex >= 11 ? "severe" : "moderate",
        urgency: "expected",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
    }

    const weather: WeatherData = {
      temperature: temp,
      temperatureUnit: "F",
      feelsLike: feelsLike,
      condition: weatherInfo.condition,
      conditionCode: weatherCode,
      conditionIcon: weatherInfo.icon,
      windSpeed: windSpeed,
      windGust: windGust,
      humidity: current.relative_humidity_2m,
      uvIndex: uvIndex,
      visibility: visibility,
      precipitationProbability: precipProb,
      isRaining: weatherInfo.isRaining,
      isSnowing: weatherInfo.isSnowing,
      isSevere: isSevere,
      alerts: alerts,
      fetchedAt: new Date().toISOString(),
    };

    if (alerts.length > 0) {
      const topAlert = alerts.sort((a, b) => {
        const sevOrder = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
        return sevOrder[a.severity] - sevOrder[b.severity];
      })[0];
      weather.severeType = topAlert.event;
      weather.severeMessage = topAlert.headline;
    } else if (!weather.isRaining && !weather.isSnowing && weather.windSpeed < 15 && !isCold && !isHot) {
      const hour = new Date().getHours();
      if (hour < 10) {
        weather.safeOutdoorWindow = "Good for outdoor play after 10 AM";
      } else if (hour < 17) {
        weather.safeOutdoorWindow = "Great time for outdoor activities";
      } else {
        weather.safeOutdoorWindow = "Evening outdoor play possible";
      }
    }

    await cacheWeather(weather, latitude, longitude);
    
    return weather;
  } catch (error) {
    console.error("[Weather] Fetch error:", error);
    return await getCachedWeather(latitude, longitude, true);
  }
}

function isNearLocation(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return Math.abs(lat1 - lat2) < 0.01 && Math.abs(lng1 - lng2) < 0.01;
}

async function getCachedWeather(latitude: number, longitude: number, ignoreExpiry = false): Promise<WeatherData | null> {
  try {
    const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedWeather = JSON.parse(cached);
    const now = Date.now();
    
    if (!isNearLocation(latitude, longitude, parsed.latitude, parsed.longitude)) {
      console.log("[Weather] Cache location mismatch, fetching fresh data");
      return null;
    }
    
    if (!ignoreExpiry && now - parsed.timestamp > CACHE_DURATION_MS) {
      return null;
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

// Fresh fetch - never uses cache, throws on error instead of returning stale data
export async function getWeatherFresh(latitude: number, longitude: number): Promise<WeatherData> {
  const data = await weather.getCurrent(latitude, longitude);
  const current = data.current;
  const hourly = data.hourly;
  
  const weatherCode = current.weather_code || 0;
  const weatherInfo = WEATHER_CODE_MAP[weatherCode] || WEATHER_CODE_MAP[0];
  
  const temp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const windSpeed = Math.round(current.wind_speed_10m);
  const windGust = Math.round(current.wind_gusts_10m || 0);
  const precipProb = current.precipitation_probability || 0;
  
  const currentHour = new Date().getHours();
  const uvIndex = hourly?.uv_index?.[currentHour] || 0;
  const visibility = hourly?.visibility?.[currentHour] || 10000;
  
  const isExtremeCold = feelsLike <= 10;
  const isVeryCold = feelsLike <= 32;
  const isCold = feelsLike <= 45;
  const isExtremeHeat = feelsLike >= 100;
  const isHot = feelsLike >= 90;
  const isHighWind = windSpeed >= 25 || windGust >= 35;
  const isLowVisibility = visibility < 1000;
  const hasWeatherSevere = weatherInfo.isSevere;
  
  const isSevere = hasWeatherSevere || isHighWind || isExtremeCold || isExtremeHeat || isLowVisibility;
  
  const alerts: WeatherAlert[] = [];
  
  if (weatherCode >= 95) {
    alerts.push({
      event: "Thunderstorm Warning",
      headline: "Thunderstorm Warning in Effect",
      description: `Active ${weatherInfo.condition.toLowerCase()} in your area. Lightning, heavy rain, and ${windGust > 40 ? "damaging winds up to " + windGust + " mph" : "gusty winds"} expected.`,
      severity: weatherCode >= 99 ? "extreme" : "severe",
      urgency: "immediate",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (isExtremeCold) {
    const frostbiteTime = feelsLike <= 0 ? "10-15 minutes" : feelsLike <= 10 ? "15-30 minutes" : "30+ minutes";
    alerts.push({
      event: "Extreme Cold Warning",
      headline: `Dangerously Cold: Feels like ${feelsLike}°F`,
      description: `Frostbite can occur on exposed skin in ${frostbiteTime}. Limit outdoor exposure and cover all exposed skin.`,
      severity: feelsLike <= 0 ? "extreme" : "severe",
      urgency: "immediate",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (isExtremeHeat) {
    alerts.push({
      event: "Extreme Heat Warning",
      headline: `Dangerously Hot: Feels like ${feelsLike}°F`,
      description: `Heat exhaustion and heat stroke are possible. Stay hydrated, avoid direct sun, and limit outdoor activities.`,
      severity: feelsLike >= 110 ? "extreme" : "severe",
      urgency: "immediate",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (isHighWind) {
    alerts.push({
      event: "High Wind Warning",
      headline: `High Winds: ${windSpeed} mph, gusts to ${windGust} mph`,
      description: `Strong winds may make outdoor play difficult and potentially dangerous. Watch for flying debris.`,
      severity: windGust >= 50 ? "severe" : "moderate",
      urgency: "expected",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if ((weatherCode >= 65 || weatherCode >= 82) && !alerts.find(a => a.event.includes("Thunderstorm"))) {
    const precipType = weatherInfo.isSnowing ? "Heavy Snow" : "Heavy Rain";
    alerts.push({
      event: `${precipType} Warning`,
      headline: `${precipType} in Your Area`,
      description: `${precipType.toLowerCase()} may reduce visibility and make travel hazardous. Plan indoor activities.`,
      severity: "severe",
      urgency: "immediate",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });
  }
  
  if (uvIndex >= 8) {
    alerts.push({
      event: uvIndex >= 11 ? "Extreme UV Alert" : "High UV Index",
      headline: `UV Index: ${Math.round(uvIndex)} (${uvIndex >= 11 ? "Extreme" : "Very High"})`,
      description: `Strong sun exposure. ${uvIndex >= 11 ? "Avoid sun during midday hours." : "Apply sunscreen SPF 30+, wear hats and sunglasses."}`,
      severity: uvIndex >= 11 ? "severe" : "moderate",
      urgency: "expected",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    });
  }

  const weather: WeatherData = {
    temperature: temp,
    temperatureUnit: "F",
    feelsLike: feelsLike,
    condition: weatherInfo.condition,
    conditionCode: weatherCode,
    conditionIcon: weatherInfo.icon,
    windSpeed: windSpeed,
    windGust: windGust,
    humidity: current.relative_humidity_2m,
    uvIndex: uvIndex,
    visibility: visibility,
    precipitationProbability: precipProb,
    isRaining: weatherInfo.isRaining,
    isSnowing: weatherInfo.isSnowing,
    isSevere: isSevere,
    alerts: alerts,
    fetchedAt: new Date().toISOString(),
  };

  if (alerts.length > 0) {
    const topAlert = alerts.sort((a, b) => {
      const sevOrder = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    })[0];
    weather.severeType = topAlert.event;
    weather.severeMessage = topAlert.headline;
  } else if (!weather.isRaining && !weather.isSnowing && weather.windSpeed < 15 && !isCold && !isHot) {
    const hour = new Date().getHours();
    if (hour < 10) {
      weather.safeOutdoorWindow = "Good for outdoor play after 10 AM";
    } else if (hour < 17) {
      weather.safeOutdoorWindow = "Great time for outdoor activities";
    } else {
      weather.safeOutdoorWindow = "Evening outdoor play possible";
    }
  }

  return weather;
}

export function getClothingSuggestions(weather: WeatherData): ClothingItem[] {
  const items: ClothingItem[] = [];
  const temp = weather.feelsLike;
  
  if (temp <= 20) {
    items.push({ name: "Heavy winter coat", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Snow pants", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Thermal underwear", icon: "body", category: "top", priority: 3 });
    items.push({ name: "Insulated boots", icon: "footsteps", category: "footwear", priority: 4 });
    items.push({ name: "Warm hat", icon: "help-circle", category: "accessory", priority: 5 });
    items.push({ name: "Thick gloves", icon: "hand-left", category: "accessory", priority: 6 });
    items.push({ name: "Scarf", icon: "ribbon", category: "accessory", priority: 7 });
  } else if (temp <= 32) {
    items.push({ name: "Winter jacket", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Long pants", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Winter boots", icon: "footsteps", category: "footwear", priority: 3 });
    items.push({ name: "Warm hat", icon: "help-circle", category: "accessory", priority: 4 });
    items.push({ name: "Gloves", icon: "hand-left", category: "accessory", priority: 5 });
  } else if (temp <= 45) {
    items.push({ name: "Warm jacket", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Long pants", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Closed-toe shoes", icon: "footsteps", category: "footwear", priority: 3 });
    items.push({ name: "Light gloves", icon: "hand-left", category: "accessory", priority: 4 });
  } else if (temp <= 55) {
    items.push({ name: "Light jacket", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Long pants", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Sneakers", icon: "footsteps", category: "footwear", priority: 3 });
  } else if (temp <= 65) {
    items.push({ name: "Long sleeves", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Pants or jeans", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Sneakers", icon: "footsteps", category: "footwear", priority: 3 });
  } else if (temp <= 75) {
    items.push({ name: "T-shirt", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Pants or shorts", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Comfortable shoes", icon: "footsteps", category: "footwear", priority: 3 });
  } else if (temp <= 85) {
    items.push({ name: "Light t-shirt", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Shorts", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Sandals or sneakers", icon: "footsteps", category: "footwear", priority: 3 });
  } else {
    items.push({ name: "Light, breathable clothes", icon: "body", category: "top", priority: 1 });
    items.push({ name: "Shorts", icon: "body", category: "bottom", priority: 2 });
    items.push({ name: "Sandals", icon: "footsteps", category: "footwear", priority: 3 });
    items.push({ name: "Light-colored clothing", icon: "sunny", category: "top", priority: 4 });
  }
  
  if (weather.isRaining || weather.precipitationProbability >= 50) {
    items.push({ name: "Rain jacket", icon: "umbrella", category: "protection", priority: 1 });
    items.push({ name: "Rain boots", icon: "water", category: "footwear", priority: 2 });
    
    const sneakersIndex = items.findIndex(i => i.name.toLowerCase().includes("sneaker") || i.name.toLowerCase().includes("sandal"));
    if (sneakersIndex > -1) {
      items.splice(sneakersIndex, 1);
    }
  }
  
  if (weather.isSnowing) {
    if (!items.find(i => i.name.toLowerCase().includes("boot"))) {
      items.push({ name: "Snow boots", icon: "snow", category: "footwear", priority: 1 });
    }
    items.push({ name: "Waterproof pants", icon: "water", category: "bottom", priority: 2 });
  }
  
  if (weather.windSpeed >= 15 || weather.windGust >= 25) {
    items.push({ name: "Windbreaker", icon: "navigate", category: "protection", priority: 1 });
    if (temp <= 50 && !items.find(i => i.name.toLowerCase().includes("hat"))) {
      items.push({ name: "Warm hat", icon: "help-circle", category: "accessory", priority: 2 });
    }
  }
  
  if (weather.uvIndex >= 6 && temp >= 65) {
    items.push({ name: "Sunscreen", icon: "sunny", category: "protection", priority: 1 });
    items.push({ name: "Sunglasses", icon: "glasses", category: "accessory", priority: 2 });
    items.push({ name: "Sun hat", icon: "help-circle", category: "accessory", priority: 3 });
  } else if (weather.uvIndex >= 3 && temp >= 65) {
    items.push({ name: "Sunscreen", icon: "sunny", category: "protection", priority: 2 });
  }
  
  if (weather.isSevere && !weather.isRaining && !weather.isSnowing) {
    items.push({ name: "Toys for indoors", icon: "game-controller", category: "accessory", priority: 10 });
  }
  
  const seen = new Set<string>();
  const unique = items.filter(item => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
  
  return unique.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

export function canPlayOutside(weather: WeatherData): { canPlay: boolean; reason: string; safetyTips?: string[] } {
  const tips: string[] = [];
  
  if (weather.isSevere) {
    const topAlert = weather.alerts?.[0];
    if (topAlert) {
      return { 
        canPlay: false, 
        reason: topAlert.headline,
        safetyTips: [topAlert.description]
      };
    }
    return { canPlay: false, reason: "Severe weather conditions" };
  }
  
  if (weather.feelsLike < 32) {
    tips.push("Limit outdoor time to 30 minutes");
    tips.push("Take breaks to warm up inside");
    return { canPlay: false, reason: `Too cold (feels like ${weather.feelsLike}°F)`, safetyTips: tips };
  }
  
  if (weather.feelsLike > 95) {
    tips.push("Stay hydrated with water");
    tips.push("Take frequent shade breaks");
    return { canPlay: false, reason: `Too hot (feels like ${weather.feelsLike}°F)`, safetyTips: tips };
  }
  
  if (weather.windSpeed > 25 || weather.windGust > 35) {
    return { canPlay: false, reason: `High winds (${weather.windSpeed} mph, gusts ${weather.windGust} mph)` };
  }
  
  if (weather.isRaining && weather.conditionCode >= 65) {
    return { canPlay: false, reason: "Heavy precipitation" };
  }
  
  if (weather.feelsLike < 45) {
    tips.push("Bundle up warmly");
    tips.push("Come inside if fingers get cold");
    return { canPlay: true, reason: `Cool weather (${weather.feelsLike}°F) - dress warmly`, safetyTips: tips };
  }
  
  if (weather.feelsLike > 85) {
    tips.push("Drink water every 20 minutes");
    tips.push("Play in the shade when possible");
    return { canPlay: true, reason: `Warm weather (${weather.feelsLike}°F) - stay hydrated`, safetyTips: tips };
  }
  
  if (weather.uvIndex >= 8) {
    tips.push("Apply sunscreen before going out");
    tips.push("Wear a hat and sunglasses");
    return { canPlay: true, reason: `High UV index (${Math.round(weather.uvIndex)}) - use sun protection`, safetyTips: tips };
  }
  
  return { canPlay: true, reason: weather.safeOutdoorWindow || "Good conditions for outdoor play" };
}

export interface WearSuggestion {
  item: string;
  icon: string;
}

export function getWearSuggestions(weather: WeatherData): WearSuggestion[] {
  return getClothingSuggestions(weather).map(item => ({
    item: item.name,
    icon: item.icon
  }));
}
