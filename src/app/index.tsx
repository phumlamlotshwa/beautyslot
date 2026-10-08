import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [status, setStatus] = useState('Checking connection...');

  useEffect(() => {
    supabase
      .from('services')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        setStatus(error ? `Error: ${error.message}` : 'Connected to Supabase');
      });
  }, []);

    return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <Text style={{ fontSize: 24, color: '#000000' }}>Hello BeautySlot</Text>
      <Text style={{ marginTop: 12, color: '#000000' }}>{status}</Text>
      <Link href="/sign-up" style={{ marginTop: 24, color: '#000000', textDecorationLine: 'underline' }}>Go to sign up</Link>
    </View>
  );
}