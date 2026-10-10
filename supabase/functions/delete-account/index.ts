// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKETS = ['customer-photos', 'booking-photos', 'professional-photos'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function filesIn(admin, bucket: string, folder: string): Promise<string[]> {
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  const paths: string[] = [];

  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    if (item.id) {
      paths.push(path);
    } else {
      paths.push(...(await filesIn(admin, bucket, path)));
    }
  }

  return paths;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not logged in.' }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'Not logged in.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { error: cancelError } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`)
    .in('status', ['pending', 'confirmed', 'reschedule_proposed'])
    .gt('starts_at', new Date().toISOString());

  if (cancelError) return json({ error: "Your account wasn't deleted. Try again." }, 500);

  for (const bucket of BUCKETS) {
    const paths = await filesIn(admin, bucket, user.id);
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: "Your account wasn't deleted. Try again." }, 500);

  return json({ deleted: true });
});