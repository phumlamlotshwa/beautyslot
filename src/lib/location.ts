import * as Location from 'expo-location';
import { supabase } from './supabase';

export type CustomerLocation = {
  label: string;
  lat: number;
  lng: number;
  source: 'current' | 'saved' | 'search';
};

export type SavedAddress = {
  id: number;
  label: string | null;
  address: string;
  lat: number;
  lng: number;
};

// "12 Ferreira Street, Sonheuwel, Mbombela, 1201, South Africa"
// becomes "12 Ferreira Street, Sonheuwel", short enough for one line.
export function shortAddress(address: string) {
  return address.split(',').map((part) => part.trim()).filter(Boolean).slice(0, 2).join(', ');
}

// Works out the suburb and town from a map position, using the phone's own
// map service, so it's free and doesn't use your Google key.
async function areaName(lat: number, lng: number) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!place) return null;
    const parts = [place.district ?? place.subregion, place.city].filter(
      (p, i, all): p is string => !!p && all.indexOf(p) === i
    );
    return parts.length > 0 ? parts.join(', ') : null;
  } catch {
    return null;
  }
}

export async function getCurrentLocation(): Promise<CustomerLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    return {
      label: (await areaName(lat, lng)) ?? 'where you are now',
      lat,
      lng,
      source: 'current',
    };
  } catch {
    return null;
  }
}

// All of this customer's saved addresses, the most recently used first
export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('customer_addresses')
    .select('id, label, address, lat, lng')
    .eq('customer_id', user.id)
    .order('last_used_at', { ascending: false });

  return (data ?? []) as SavedAddress[];
}

export function savedToLocation(saved: SavedAddress): CustomerLocation {
  return { label: shortAddress(saved.address), lat: saved.lat, lng: saved.lng, source: 'saved' };
}

// The most recently used saved address, or null if there are none
export async function getSavedLocation(): Promise<CustomerLocation | null> {
  const [latest] = await getSavedAddresses();
  return latest ? savedToLocation(latest) : null;
}

// Saves an address, or moves it to the top of the list if it's already saved.
// Returns an error message if it didn't save, or null if it did.
export async function saveAddress(place: { address: string; lat: number; lng: number }, label?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Log in again to save addresses.';

  const { error } = await supabase.from('customer_addresses').upsert(
    {
      customer_id: user.id,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      last_used_at: new Date().toISOString(),
      ...(label ? { label } : {}),
    },
    { onConflict: 'customer_id,address' }
  );

  return error ? error.message : null;
}

// Moves a saved address to the top of the list when it's used
export async function markAddressUsed(id: number) {
  await supabase.from('customer_addresses').update({ last_used_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteAddress(id: number) {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  return error ? error.message : null;
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