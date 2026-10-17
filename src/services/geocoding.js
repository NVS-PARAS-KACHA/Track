/**
 * Reverse Geocoding Service
 * Resolves GPS coordinates (lat, lon) to a formatted address
 * Uses OpenStreetMap Nominatim with caching and robust fallback
 */

const geocodeCache = new Map();

export async function reverseGeocode(latitude, longitude) {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'MonkeyOnki-GeoApp/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || 'Local Area';
      const state = addr.state || '';
      const country = addr.country || '';

      const parts = [city, state, country].filter(Boolean);
      const formatted = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(',') || 'Resolved Location';

      geocodeCache.set(cacheKey, formatted);
      return formatted;
    }
  } catch (error) {
    console.warn('Reverse geocoding network notice:', error.message);
  }

  // Graceful fallback if offline or rate-limited
  const fallback = `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  geocodeCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Detect client device and browser information
 */
export function getClientDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // OS detection
  if (/android/i.test(ua)) {
    device = 'Mobile';
    os = 'Android';
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    device = 'Mobile';
    os = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  } else if (/Windows/i.test(ua)) {
    device = 'Desktop';
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = 'Desktop';
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    device = 'Desktop';
    os = 'Linux';
  }

  // Browser detection
  if (/Edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox';
  }

  return {
    device,
    os,
    browser,
    formattedDevice: `${os} (${browser})`,
    deviceType: device,
  };
}
