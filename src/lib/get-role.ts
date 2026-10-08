import { supabase } from './supabase';

export type Role = 'customer' | 'professional';

export async function getRole(userId: string): Promise<Role | null> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (customer) return 'customer';

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (professional) return 'professional';

  return null;
}