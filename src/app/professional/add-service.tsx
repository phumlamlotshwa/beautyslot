import { router } from 'expo-router';
import { ServiceForm, ServiceValues } from '../../components/service-form';
import { supabase } from '../../lib/supabase';

export default function AddService() {
  async function handleAdd(values: ServiceValues) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Log in again to add a service.');

    const { error } = await supabase.from('services').insert({
      professional_id: user.id,
      name: values.name,
      category: values.category,
      offered_at: values.offeredAt,
      price: values.price,
      duration_minutes: values.durationMinutes,
    });

    if (error) throw new Error("Couldn't add the service. Check your connection and try again.");

    router.back();
  }

  return <ServiceForm submitLabel="Add service" onSubmit={handleAdd} />;
}