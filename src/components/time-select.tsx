import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const ROW_HEIGHT = 48;

const times = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function TimeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.fieldText}>{value}</Text>
        <Text style={styles.arrow}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <FlatList
            data={times}
            keyExtractor={(t) => t}
            initialScrollIndex={Math.max(times.indexOf(value), 0)}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item === value && styles.optionSelected]}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, item === value && styles.optionTextSelected]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 10 },
  fieldText: { fontSize: 16, color: '#000000' },
  arrow: { fontSize: 14, color: '#666666' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: { height: 320, backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8 },
  option: { height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  optionSelected: { backgroundColor: '#000000' },
  optionText: { fontSize: 18, color: '#000000' },
  optionTextSelected: { color: '#ffffff', fontWeight: '600' },
});