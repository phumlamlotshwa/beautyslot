import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { fonts, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

export function DeleteAccount() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);

    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });

    if (error) {
      setDeleting(false);
      Alert.alert("Your account wasn't deleted", 'Check your connection and try again.');
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/');
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      "Your profile, photos and messages will be deleted, and any upcoming bookings cancelled. You can't undo this.",
      [
        { text: 'Keep my account', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteAccount },
      ]
    );
  }

  return (
    <Pressable style={styles.button} onPress={confirmDelete} disabled={deleting} hitSlop={8}>
      {deleting ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.text}>Delete account</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  button: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.xl },
  text: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.danger },
}));