import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseISO, differenceInMinutes, format, isAfter, isBefore, addDays } from "date-fns";

const PRAYER_CACHE_KEY = "sukun_prayer_cache";
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  date: string;
  fetchedAt: string;
}

export interface CurrentPrayer {
  name: string;
  displayName: string;
  startTime: string;
  endTime: string;
  minutesRemaining: number;
  isUrgent: boolean; // less than 10 minutes
  icon: string;
}

interface CachedPrayer {
  data: PrayerTimes;
  timestamp: number;
}

const PRAYER_ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

const PRAYER_DISPLAY_NAMES: Record<string, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const PRAYER_ICONS: Record<string, string> = {
  fajr: "moon",
  sunrise: "sunny",
  dhuhr: "sunny",
  asr: "partly-sunny",
  maghrib: "sunset",
  isha: "moon",
};

export async function getPrayerTimes(latitude: number, longitude: number): Promise<PrayerTimes | null> {
  try {
    // Check cache first
    const cached = await getCachedPrayer();
    if (cached) {
      const cachedDate = cached.date;
      const today = format(new Date(), "dd-MM-yyyy");
      if (cachedDate === today) {
        return cached;
      }
    }

    // Fetch from AlAdhan API (free, no key required)
    const response = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`
    );

    if (!response.ok) {
      throw new Error("Prayer API request failed");
    }

    const data = await response.json();
    const timings = data.data.timings;
    const dateInfo = data.data.date;
    
    const prayerTimes: PrayerTimes = {
      fajr: timings.Fajr,
      sunrise: timings.Sunrise,
      dhuhr: timings.Dhuhr,
      asr: timings.Asr,
      maghrib: timings.Maghrib,
      isha: timings.Isha,
      date: dateInfo.gregorian.date, // dd-MM-yyyy format
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    await cachePrayer(prayerTimes);
    
    return prayerTimes;
  } catch (error) {
    console.error("[Prayer] Fetch error:", error);
    // Return cached data if available, even if expired
    return await getCachedPrayer(true);
  }
}

async function getCachedPrayer(ignoreExpiry = false): Promise<PrayerTimes | null> {
  try {
    const cached = await AsyncStorage.getItem(PRAYER_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedPrayer = JSON.parse(cached);
    const now = Date.now();
    
    if (!ignoreExpiry && now - parsed.timestamp > CACHE_DURATION_MS) {
      return null; // Cache expired
    }

    return parsed.data;
  } catch {
    return null;
  }
}

async function cachePrayer(data: PrayerTimes): Promise<void> {
  try {
    const cached: CachedPrayer = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error("[Prayer] Cache error:", error);
  }
}

function parseTimeToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function getCurrentPrayer(prayerTimes: PrayerTimes): CurrentPrayer | null {
  const now = new Date();
  
  const prayers = [
    { name: "fajr", time: prayerTimes.fajr },
    { name: "dhuhr", time: prayerTimes.dhuhr },
    { name: "asr", time: prayerTimes.asr },
    { name: "maghrib", time: prayerTimes.maghrib },
    { name: "isha", time: prayerTimes.isha },
  ];
  
  // Find the current or next prayer
  for (let i = 0; i < prayers.length; i++) {
    const current = prayers[i];
    const next = prayers[i + 1];
    
    const currentTime = parseTimeToDate(current.time);
    const nextTime = next ? parseTimeToDate(next.time) : addDays(parseTimeToDate(prayers[0].time), 1);
    
    // Check if we're between this prayer and the next
    if (isAfter(now, currentTime) && isBefore(now, nextTime)) {
      const minutesRemaining = differenceInMinutes(nextTime, now);
      
      return {
        name: current.name,
        displayName: PRAYER_DISPLAY_NAMES[current.name],
        startTime: current.time,
        endTime: next ? next.time : prayers[0].time,
        minutesRemaining,
        isUrgent: minutesRemaining < 10,
        icon: PRAYER_ICONS[current.name],
      };
    }
  }
  
  // Before Fajr - show Fajr as upcoming
  const fajrTime = parseTimeToDate(prayerTimes.fajr);
  if (isBefore(now, fajrTime)) {
    const minutesRemaining = differenceInMinutes(fajrTime, now);
    return {
      name: "isha",
      displayName: "Isha",
      startTime: prayerTimes.isha,
      endTime: prayerTimes.fajr,
      minutesRemaining,
      isUrgent: minutesRemaining < 10,
      icon: PRAYER_ICONS.isha,
    };
  }
  
  // After Isha - show until next Fajr
  const ishaTime = parseTimeToDate(prayerTimes.isha);
  if (isAfter(now, ishaTime)) {
    const nextFajr = addDays(fajrTime, 1);
    const minutesRemaining = differenceInMinutes(nextFajr, now);
    return {
      name: "isha",
      displayName: "Isha",
      startTime: prayerTimes.isha,
      endTime: prayerTimes.fajr,
      minutesRemaining,
      isUrgent: false,
      icon: PRAYER_ICONS.isha,
    };
  }
  
  return null;
}

export function formatPrayerTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function formatMinutesRemaining(minutes: number): string {
  if (minutes < 60) {
    return `Ends in ${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `Ends in ${hours}h`;
  }
  return `Ends in ${hours}h ${mins}m`;
}
