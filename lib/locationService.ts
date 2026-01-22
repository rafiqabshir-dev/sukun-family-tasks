import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'sukun_user_location';
const LOCATION_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export interface UserLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  city?: string;
}

const DEFAULT_LOCATION: UserLocation = {
  latitude: 37.7749,
  longitude: -122.4194,
  timestamp: 0,
  city: 'San Francisco',
};

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.log('[Location] Permission request failed:', error);
    return false;
  }
}

export async function checkLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.log('[Location] Permission check failed:', error);
    return false;
  }
}

export async function getCurrentLocation(): Promise<UserLocation> {
  try {
    const cached = await getCachedLocation();
    if (cached && Date.now() - cached.timestamp < LOCATION_CACHE_DURATION) {
      console.log('[Location] Using cached location:', cached.city || 'Unknown');
      return cached;
    }

    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        console.log('[Location] Permission denied, using default');
        return DEFAULT_LOCATION;
      }
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const userLocation: UserLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now(),
    };

    try {
      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (reverseGeocode?.city) {
        userLocation.city = reverseGeocode.city;
      } else if (reverseGeocode?.region) {
        userLocation.city = reverseGeocode.region;
      }
    } catch (geocodeError) {
      console.log('[Location] Reverse geocode failed:', geocodeError);
    }

    await cacheLocation(userLocation);
    console.log('[Location] Got current location:', userLocation.city || 'Unknown');
    return userLocation;
  } catch (error) {
    console.log('[Location] Failed to get location:', error);
    const cached = await getCachedLocation();
    if (cached) {
      return cached;
    }
    return DEFAULT_LOCATION;
  }
}

async function getCachedLocation(): Promise<UserLocation | null> {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.log('[Location] Cache read failed:', error);
  }
  return null;
}

async function cacheLocation(location: UserLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
  } catch (error) {
    console.log('[Location] Cache write failed:', error);
  }
}

export function getDefaultLocation(): UserLocation {
  return DEFAULT_LOCATION;
}
