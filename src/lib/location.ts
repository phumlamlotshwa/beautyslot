import * as Location from 'expo-location';
import { supabase } from './supabase';

export type CustomerLocation = {
  label: string;
  lat: number;
  lng: number;
  source: 'current' | 'saved' | 'search';
};

export async function getCurrentLocation(): Promise<CustomerLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      label: 'Current location',
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      source: 'current',
    };
  } catch {
    return null;
  }
}

export async function getSavedLocation(): Promise<CustomerLocation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('customer_private')
    .select('home_lat, home_lng')
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!data) return null;

  return { label: 'My saved address', lat: data.home_lat, lng: data.home_lng, source: 'saved' };
}

export async function getStartingLocation(): Promise<CustomerLocation | null> {
  return (await getCurrentLocation()) ?? (await getSavedLocation());
}
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number) {
  if (km < 1) return 'less than 1 km away';
  return `about ${Math.round(km)} km away`;
}
