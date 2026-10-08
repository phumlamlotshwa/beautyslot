
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;

type Point = { lat: number; lng: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isPoint(p: unknown): p is Point {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Point).lat === 'number' &&
    typeof (p as Point).lng === 'number'
  );
}

Deno.serve(async (req) => {
  // Only logged-in BeautySlot users may use this function
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not logged in.' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not logged in.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  try {
    // 1. Address suggestions while typing
    if (body.action === 'autocomplete') {
      const input = typeof body.input === 'string' ? body.input.trim() : '';
      if (input.length < 3 || input.length > 200) return json({ suggestions: [] });

      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY },
        body: JSON.stringify({ input, includedRegionCodes: ['za'] }),
      });
      const data = await res.json();
      if (!res.ok) return json({ error: data.error?.message ?? 'Address search failed.' }, 502);

      const suggestions = (data.suggestions ?? [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text.text,
        }));

      return json({ suggestions });
    }

    // 2. Full address and coordinates for a chosen suggestion
    if (body.action === 'geocode') {
      const placeId = typeof body.placeId === 'string' ? body.placeId : '';
      if (!placeId) return json({ error: 'Missing address.' }, 400);

      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?place_id=${encodeURIComponent(placeId)}&key=${GOOGLE_KEY}`;
      const data = await (await fetch(url)).json();
      if (data.status !== 'OK' || !data.results?.length) return json({ error: 'Address not found.' }, 404);

      const result = data.results[0];
      return json({
        address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      });
    }

    // 3. Driving time between two points
    if (body.action === 'travel-time') {
      if (!isPoint(body.from) || !isPoint(body.to)) return json({ error: 'Missing locations.' }, 400);

      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: body.from.lat, longitude: body.from.lng } } },
          destination: { location: { latLng: { latitude: body.to.lat, longitude: body.to.lng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.routes?.length) return json({ error: 'No driving route found.' }, 404);

      const seconds = parseInt(data.routes[0].duration, 10);
      return json({
        minutes: Math.ceil(seconds / 60),
        km: Math.round(data.routes[0].distanceMeters / 100) / 10,
      });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch {
    return json({ error: 'Maps service is unavailable. Please try again.' }, 502);
  }
});