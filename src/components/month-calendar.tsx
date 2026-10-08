import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DROPDOWN_MONTHS_AHEAD = 12;

type Props = {
  month: Date;
  minMonth: Date;
  selectedDate: Date | null;
  isAvailable: (date: Date) => boolean;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (month: Date) => void;
};

export function MonthCalendar({ month, minMonth, selectedDate, isAvailable, onSelectDate, onChangeMonth }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthsFromMin = (year - minMonth.getFullYear()) * 12 + (monthIndex - minMonth.getMonth());
  const canGoBack = monthsFromMin > 0;

  const dropdownMonths = Array.from(
    { length: monthsFromMin + DROPDOWN_MONTHS_AHEAD + 1 },
    (_, i) => new Date(minMonth.getFullYear(), minMonth.getMonth() + i, 1)
  );

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          style={styles.arrowButton}
          onPress={() => onChangeMonth(new Date(year, monthIndex - 1, 1))}
          disabled={!canGoBack}
        >
          <Text style={[styles.arrow, !canGoBack && styles.faded]}>‹</Text>
        </Pressable>

        <Pressable style={styles.monthButton} onPress={() => setPickerOpen(true)}>
          <Text style={styles.monthText}>
            {monthNames[monthIndex]} {year}
          </Text>
          <Text style={styles.dropdownArrow}>▾</Text>
        </Pressable>

        <Pressable style={styles.arrowButton} onPress={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {weekDays.map((d) => (
          <View key={d} style={styles.cell}>
            <Text style={styles.weekDay}>{d}</Text>
          </View>
        ))}

        {cells.map((date, i) => {
          if (!date) return <View key={`empty-${i}`} style={styles.cell} />;

          const available = isAvailable(date);
          const selected = selectedDate?.toDateString() === date.toDateString();

          return (
            <Pressable
              key={date.toDateString()}
              style={styles.cell}
              onPress={() => onSelectDate(date)}
              disabled={!available}
            >
              <View style={[styles.dayCircle, selected && styles.daySelected]}>
                <Text style={[styles.dayText, !available && styles.dayUnavailable, selected && styles.dayTextSelected]}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Choose a month</Text>
          <ScrollView style={styles.sheetList}>
            {dropdownMonths.map((m) => {
              const isCurrent = m.getFullYear() === year && m.getMonth() === monthIndex;
              return (
                <Pressable
                  key={`${m.getFullYear()}-${m.getMonth()}`}
                  style={[styles.option, isCurrent && styles.optionSelected]}
                  onPress={() => {
                    onChangeMonth(m);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, isCurrent && styles.optionTextSelected]}>
                    {monthNames[m.getMonth()]} {m.getFullYear()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 28, color: '#000000' },
  faded: { opacity: 0.2 },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  monthText: { fontSize: 18, fontWeight: '700', color: '#000000' },
  dropdownArrow: { fontSize: 14, color: '#666666' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekDay: { fontSize: 13, color: '#666666', fontWeight: '600' },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#000000' },
  dayText: { fontSize: 16, color: '#000000', fontWeight: '500' },
  dayUnavailable: { color: '#cccccc', fontWeight: '400' },
  dayTextSelected: { color: '#ffffff', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#000000', textAlign: 'center', marginBottom: 8 },
  sheetList: { maxHeight: 360 },
  option: { paddingVertical: 14, alignItems: 'center' },
  optionSelected: { backgroundColor: '#000000' },
  optionText: { fontSize: 18, color: '#000000' },
  optionTextSelected: { color: '#ffffff', fontWeight: '600' },
});