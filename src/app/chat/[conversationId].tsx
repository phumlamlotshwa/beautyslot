import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type Message = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

type Person = { first_name: string; last_name: string } | null;

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Chat() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [myId, setMyId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChat() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setMyId(user.id);

      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('customer_id, customers(first_name, last_name), professionals(first_name, last_name)')
        .eq('id', conversationId)
        .single();

      if (conversationError || !conversation) {
        setError(conversationError?.message ?? 'Chat not found.');
        setLoading(false);
        return;
      }

      const isCustomer = conversation.customer_id === user.id;
      const other = (isCustomer ? conversation.professionals : conversation.customers) as unknown as Person;
      if (other) setOtherName(`${other.first_name} ${other.last_name}`);

      const { data: messageData, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (messagesError) {
        setError(messagesError.message);
      } else {
        setMessages(messageData ?? []);
      }

      setLoading(false);

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);
    }

    loadChat();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((current) =>
            current.some((m) => m.id === newMessage.id) ? current : [...current, newMessage]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function handleSend() {
    const body = text.trim();
    if (!body || !myId) return;

    setSending(true);
    setError(null);

    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({ conversation_id: Number(conversationId), sender_id: myId, body })
      .select('id, sender_id, body, created_at')
      .single();

    setSending(false);

    if (sendError || !data) {
      setError(sendError?.message ?? 'Message not sent. Please try again.');
      return;
    }

    setText('');
    setMessages((current) => (current.some((m) => m.id === data.id) ? current : [...current, data]));
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: otherName }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No messages yet. Say hello!</Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
                <Text style={[styles.time, mine && styles.mineTime]}>{formatMessageTime(item.created_at)}</Text>
              </View>
            );
          }}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor="#999999"
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, flexGrow: 1 },
  empty: { fontSize: 15, color: '#666666', textAlign: 'center', marginTop: 24, transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#000000', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0', borderBottomLeftRadius: 4 },
  body: { fontSize: 16, color: '#000000' },
  mineText: { color: '#ffffff' },
  time: { fontSize: 11, color: '#888888', marginTop: 4, alignSelf: 'flex-end' },
  mineTime: { color: '#bbbbbb' },
  error: { color: '#c62828', paddingHorizontal: 16, paddingBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#eeeeee' },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#cccccc', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#000000' },
  sendButton: { backgroundColor: '#000000', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});