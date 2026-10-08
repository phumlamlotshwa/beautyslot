import { router } from 'expo-router';
import { ServiceForm, ServiceValues } from '../../components/service-form';
import { supabase } from '../../lib/supabase';

export default function AddService() {
  async function handleAdd(values: ServiceValues) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You need to be logged in to add a service.');

    const { error } = await supabase.from('services').insert({
      professional_id: user.id,
      name: values.name,
      category: values.category,
      offered_at: values.offeredAt,
      price: values.price,
      duration_minutes: values.durationMinutes,
    });

    if (error) throw new Error(error.message);

    router.back();
  }

  return <ServiceForm submitLabel="Save service" onSubmit={handleAdd} />;
}