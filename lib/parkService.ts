import { getCurrentLocation } from './locationService';

export interface Park {
  id: string;
  name: string;
  type: 'park' | 'playground' | 'garden';
  distance: number; // in meters
  lat: number;
  lon: number;
  amenities: string[];
}

export interface ParkData {
  parks: Park[];
  fetchedAt: Date;
  location: { lat: number; lon: number };
}

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

// Format distance in miles for US users
export function formatDistanceMiles(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(miles)} mi`;
}

// Map OSM amenity tags to readable names
function parseAmenities(tags: Record<string, string>): string[] {
  const amenities: string[] = [];
  
  if (tags.playground === 'yes' || tags.leisure === 'playground') {
    amenities.push('Playground');
  }
  if (tags.sport) {
    const sports = tags.sport.split(';').map(s => s.trim());
    sports.forEach(sport => {
      const sportName = sport.charAt(0).toUpperCase() + sport.slice(1).replace(/_/g, ' ');
      amenities.push(sportName);
    });
  }
  if (tags.amenity === 'toilets' || tags.toilets === 'yes') {
    amenities.push('Restrooms');
  }
  if (tags.drinking_water === 'yes' || tags.amenity === 'drinking_water') {
    amenities.push('Water fountain');
  }
  if (tags.bench === 'yes' || tags.amenity === 'bench') {
    amenities.push('Benches');
  }
  if (tags.picnic_table === 'yes' || tags.leisure === 'picnic_table') {
    amenities.push('Picnic area');
  }
  if (tags.dog === 'yes' || tags.dogs === 'yes') {
    amenities.push('Dog friendly');
  }
  if (tags.lit === 'yes') {
    amenities.push('Lit at night');
  }
  if (tags.access === 'private') {
    amenities.push('Private');
  }
  
  return amenities;
}

// Determine park type from OSM tags
function getParkType(tags: Record<string, string>): 'park' | 'playground' | 'garden' {
  if (tags.leisure === 'playground') return 'playground';
  if (tags.leisure === 'garden' || tags.garden === 'yes') return 'garden';
  return 'park';
}

// Get park name from OSM tags
function getParkName(tags: Record<string, string>, type: 'park' | 'playground' | 'garden'): string {
  if (tags.name) return tags.name;
  if (tags['name:en']) return tags['name:en'];
  
  // Generate a generic name based on type
  switch (type) {
    case 'playground': return 'Local Playground';
    case 'garden': return 'Community Garden';
    default: return 'Local Park';
  }
}

// Fetch nearby parks using Overpass API (OpenStreetMap)
export async function getNearbyParks(radiusMeters: number = 5000): Promise<ParkData> {
  const location = await getCurrentLocation();
  
  console.log('[Parks] Location for search:', {
    lat: location?.latitude,
    lon: location?.longitude,
    city: location?.city,
    isDefault: location?.isDefault,
    permissionDenied: location?.permissionDenied,
  });
  
  if (!location || !location.latitude || !location.longitude) {
    throw new Error('Location not available');
  }
  
  const { latitude: lat, longitude: lon } = location;
  
  // Overpass QL query to find parks, playgrounds, and gardens
  // Using a larger timeout and including more leisure types
  const query = `
    [out:json][timeout:30];
    (
      way["leisure"="park"](around:${radiusMeters},${lat},${lon});
      way["leisure"="playground"](around:${radiusMeters},${lat},${lon});
      way["leisure"="garden"]["access"!="private"](around:${radiusMeters},${lat},${lon});
      way["leisure"="nature_reserve"](around:${radiusMeters},${lat},${lon});
      way["leisure"="recreation_ground"](around:${radiusMeters},${lat},${lon});
      node["leisure"="playground"](around:${radiusMeters},${lat},${lon});
      node["leisure"="park"](around:${radiusMeters},${lat},${lon});
      relation["leisure"="park"](around:${radiusMeters},${lat},${lon});
      relation["boundary"="national_park"](around:${radiusMeters},${lat},${lon});
    );
    out center tags;
  `;
  
  console.log('[Parks] Searching within', radiusMeters, 'meters of', lat, lon);
  
  // Multiple Overpass API servers for fallback
  const overpassServers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  
  let lastError: Error | null = null;
  
  for (const server of overpassServers) {
    try {
      console.log('[Parks] Trying server:', server);
      
      const response = await fetch(server, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      
      if (!response.ok) {
        console.error('[Parks] Server error:', server, response.status);
        lastError = new Error(`Failed to fetch parks: ${response.status}`);
        continue;
      }
      
      const text = await response.text();
      
      // Check if response is HTML error page
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        console.error('[Parks] Server returned HTML error:', server);
        lastError = new Error('Server busy, returned error page');
        continue;
      }
      
      const data = JSON.parse(text);
      console.log('[Parks] API returned', data.elements?.length || 0, 'elements from', server);
      
      // Success - continue with this data
      const parks: Park[] = [];
      const seenIds = new Set<string>();
      
      for (const element of data.elements) {
        let parkLat: number;
        let parkLon: number;
        
        if (element.center) {
          parkLat = element.center.lat;
          parkLon = element.center.lon;
        } else if (element.lat && element.lon) {
          parkLat = element.lat;
          parkLon = element.lon;
        } else {
          continue;
        }
        
        const tags = element.tags || {};
        const type = getParkType(tags);
        const name = getParkName(tags, type);
        const id = `${element.type}-${element.id}`;
        
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        
        if (tags.access === 'private') continue;
        
        const distance = calculateDistance(lat, lon, parkLat, parkLon);
        const amenities = parseAmenities(tags);
        
        parks.push({
          id,
          name,
          type,
          distance,
          lat: parkLat,
          lon: parkLon,
          amenities,
        });
      }
      
      parks.sort((a, b) => a.distance - b.distance);
      const nearestParks = parks.slice(0, 10);
      
      console.log('[Parks] Found', nearestParks.length, 'parks:', 
        nearestParks.map(p => `${p.name} (${Math.round(p.distance)}m)`).join(', '));
      
      return {
        parks: nearestParks,
        fetchedAt: new Date(),
        location: { lat, lon },
      };
      
    } catch (error) {
      console.error('[Parks] Server failed:', server, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }
  
  // All servers failed
  throw lastError || new Error('All Overpass servers failed');
}

// Get outdoor play recommendation based on weather
export interface OutdoorRecommendation {
  suitable: boolean;
  rating: 'perfect' | 'good' | 'caution' | 'not_recommended';
  message: string;
  tips: string[];
}

export function getOutdoorRecommendation(weather: {
  temperature: number;
  conditions: string;
  humidity?: number;
  windSpeed?: number;
  uvIndex?: number;
}): OutdoorRecommendation {
  const { temperature, conditions, humidity = 50, windSpeed = 0, uvIndex = 5 } = weather;
  const tips: string[] = [];
  
  // Check for severe conditions first
  const severeConditions = ['thunderstorm', 'tornado', 'hurricane', 'blizzard'];
  if (severeConditions.some(c => conditions.toLowerCase().includes(c))) {
    return {
      suitable: false,
      rating: 'not_recommended',
      message: 'Stay indoors - severe weather conditions',
      tips: ['Wait for conditions to improve'],
    };
  }
  
  // Check rain/snow
  if (conditions.toLowerCase().includes('rain') || conditions.toLowerCase().includes('shower')) {
    return {
      suitable: false,
      rating: 'not_recommended',
      message: 'Rainy conditions - not ideal for outdoor play',
      tips: ['Check back when rain stops', 'Playground equipment may be slippery'],
    };
  }
  
  if (conditions.toLowerCase().includes('snow')) {
    return {
      suitable: true,
      rating: 'caution',
      message: 'Snowy conditions - dress warmly for snow play',
      tips: ['Wear waterproof clothing', 'Watch for icy spots'],
    };
  }
  
  // Temperature checks (in Fahrenheit)
  if (temperature < 32) {
    tips.push('Dress in warm layers');
    tips.push('Limit outdoor time');
    return {
      suitable: true,
      rating: 'caution',
      message: 'Cold weather - bundle up for outdoor play',
      tips,
    };
  }
  
  if (temperature > 95) {
    return {
      suitable: false,
      rating: 'not_recommended',
      message: 'Too hot for safe outdoor play',
      tips: ['Stay hydrated indoors', 'Try again in cooler evening hours'],
    };
  }
  
  if (temperature > 85) {
    tips.push('Bring water bottles');
    tips.push('Take shade breaks');
    tips.push('Avoid metal playground equipment');
    
    if (humidity > 70) {
      return {
        suitable: true,
        rating: 'caution',
        message: 'Hot and humid - take extra precautions',
        tips,
      };
    }
    
    return {
      suitable: true,
      rating: 'good',
      message: 'Warm weather - stay hydrated',
      tips,
    };
  }
  
  // Wind checks
  if (windSpeed > 25) {
    tips.push('Be aware of flying debris');
    return {
      suitable: true,
      rating: 'caution',
      message: 'Windy conditions - use caution outdoors',
      tips,
    };
  }
  
  // UV index checks
  if (uvIndex >= 8) {
    tips.push('Apply sunscreen');
    tips.push('Seek shade during peak hours');
    tips.push('Wear hats and sunglasses');
  } else if (uvIndex >= 6) {
    tips.push('Apply sunscreen');
  }
  
  // Perfect conditions
  if (temperature >= 60 && temperature <= 80 && windSpeed < 15) {
    return {
      suitable: true,
      rating: 'perfect',
      message: 'Perfect weather for outdoor play',
      tips: tips.length > 0 ? tips : ['Enjoy the great outdoors!'],
    };
  }
  
  // Good conditions
  return {
    suitable: true,
    rating: 'good',
    message: 'Good conditions for outdoor activities',
    tips: tips.length > 0 ? tips : ['Have fun outside!'],
  };
}

// Get icon name for park type (Ionicons)
export function getParkIcon(type: 'park' | 'playground' | 'garden'): string {
  switch (type) {
    case 'playground': return 'football-outline';
    case 'garden': return 'flower-outline';
    default: return 'leaf-outline';
  }
}
