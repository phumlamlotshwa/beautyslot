import { supabase } from './supabase';

export type Suggestion = { placeId: string; text: string };
export type Place = { address: string; lat: number; lng: number };
export type Point = { lat: number; lng: number };
export type TravelTime = { minutes: number; km: number };

async function callMaps<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('maps', { body });

  if (error) {
    let message = 'Maps service is unavailable. Please try again.';
    try {
      const details = await error.context?.json();
      if (details?.error) message = details.error;
    } catch {
      // keep the general message
    }
    throw new Error(message);
  }

  return data as T;
}

export async function searchAddresses(input: string): Promise<Suggestion[]> {
  const result = await callMaps<{ suggestions: Suggestion[] }>({ action: 'autocomplete', input });
  return result.suggestions;
}

export function getPlace(placeId: string): Promise<Place> {
  return callMaps<Place>({ action: 'geocode', placeId });
}

export function getTravelTime(from: Point, to: Point): Promise<TravelTime> {
  return callMaps<TravelTime>({ action: 'travel-time', from, to });
}