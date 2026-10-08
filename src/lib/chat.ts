import { supabase } from './supabase';

export async function getOrCreateConversation(professionalId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be logged in to send a message.');

  const findExisting = () =>
    supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', user.id)
      .eq('professional_id', professionalId)
      .maybeSingle();

  const { data: existing, error: findError } = await findExisting();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ customer_id: user.id, professional_id: professionalId })
    .select('id')
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const { data: retry } = await findExisting();
      if (retry) return retry.id;
    }
    throw createError;
  }

  return created.id;
}
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .neq('sender_id', user.id);

  return count ?? 0;
}