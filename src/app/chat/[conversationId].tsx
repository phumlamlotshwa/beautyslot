import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { fonts, radius, spacing } from '../../lib/theme';
import { makeStyles, useTheme } from '../../lib/theme-context';
import { useUi } from '../../lib/ui';

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
  const ui = useUi();
  const styles = useStyles();
  const { colors } = useTheme();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [myId, setMyId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [iAmCustomer, setIAmCustomer] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChat() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setMyId(user.id);

      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('customer_id, professional_id, customers(first_name, last_name), professionals(first_name, last_name)')
        .eq('id', conversationId)
        .single();

      if (conversationError || !conversation) {
        setError("This chat isn't available any more.");
        setLoading(false);
        return;
      }

      const isCustomer = conversation.customer_id === user.id;
      setIAmCustomer(isCustomer);
      const other = (isCustomer ? conversation.professionals : conversation.customers) as unknown as Person;
      if (other) setOtherName(`${other.first_name} ${other.last_name}`);

      const { data: open } = await supabase.rpc('chat_is_open', {
        p_customer_id: conversation.customer_id,
        p_professional_id: conversation.professional_id,
      });
      if (!cancelled) setIsOpen(open === true);

      const { data: messageData, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (messagesError) {
        setError("Messages didn't load. Check your connection and try again.");
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
          setMessages((current) => (current.some((m) => m.id === newMessage.id) ? current : [...current, newMessage]));
        },
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

    if (sendError?.code === 'P0001') {
      setIsOpen(false);
      return;
    }
    if (sendError || !data) {
      setError("Your message didn't send. Check your connection and try again.");
      return;
    }

    setText('');
    setMessages((current) => (current.some((m) => m.id === data.id) ? current : [...current, data]));
  }

  const canSend = !!text.trim() && !sending;

  return (
    <KeyboardAvoidingView style={ui.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{ title: otherName }} />

      {loading ? (
        <View style={ui.centered}>
          <ActivityIndicator size="large" color={colors.accentDark} />
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textFaint} />
              <Text style={styles.emptyText}>No messages yet. Ask a question or just say hi.</Text>
            </View>
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

      {error && <Text style={[ui.error, { paddingHorizontal: spacing.lg }]}>{error}</Text>}

      {!loading && !isOpen ? (
        <View style={styles.closedRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={styles.closedText}>
            {iAmCustomer ? 'Chat opens again when you have a confirmed booking' : 'Chat opens again when you confirm a booking with them'}
          </Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Ionicons name="send" size={18} color={colors.onAccent} />
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { padding: spacing.lg, flexGrow: 1 },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl, transform: [{ scaleY: -1 }] },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    marginVertical: 3,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accentDark, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.text },
  mineText: { color: colors.onAccent },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint, marginTop: 2, alignSelf: 'flex-end' },
  mineTime: { color: colors.onAccent, opacity: 0.6 },
  closedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  closedText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
}));