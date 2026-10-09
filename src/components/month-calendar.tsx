import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { fonts, radius, spacing } from '../lib/theme';
import { makeStyles, useTheme } from '../lib/theme-context';

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
  const styles = useStyles();
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const todayString = new Date().toDateString();

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.arrowButton}
          onPress={() => onChangeMonth(new Date(year, monthIndex - 1, 1))}
          disabled={!canGoBack}
        >
          <Ionicons name="chevron-back" size={22} color={canGoBack ? colors.text : colors.border} />
        </Pressable>

        <Pressable style={styles.monthButton} onPress={() => setPickerOpen(true)}>
          <Text style={styles.monthText}>
            {monthNames[monthIndex]} {year}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.arrowButton} onPress={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
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
          const isToday = date.toDateString() === todayString;

          return (
            <Pressable
              key={date.toDateString()}
              style={styles.cell}
              onPress={() => onSelectDate(date)}
              disabled={!available}
            >
              <View
                style={[
                  styles.dayCircle,
                  available && styles.dayAvailable,
                  isToday && !selected && styles.dayToday,
                  selected && styles.daySelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !available && styles.dayUnavailable,
                    selected && styles.dayTextSelected,
                  ]}
                >
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
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Jump to a month</Text>
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

const useStyles = makeStyles((colors) => ({
  container: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  arrowButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  monthText: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekDay: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayAvailable: { backgroundColor: colors.accentSoft },
  dayToday: { borderWidth: 1.5, borderColor: colors.accentDark },
  daySelected: { backgroundColor: colors.accentDark },
  dayText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.text },
  dayUnavailable: { fontFamily: fonts.regular, color: colors.textFaint, opacity: 0.6 },
  dayTextSelected: { fontFamily: fonts.bold, color: colors.onAccent },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.lg },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  sheetList: { maxHeight: 360 },
  option: { paddingVertical: 14, alignItems: 'center' },
  optionSelected: { backgroundColor: colors.accentSoft },
  optionText: { fontFamily: fonts.regular, fontSize: 17, color: colors.text },
  optionTextSelected: { fontFamily: fonts.bold, color: colors.text },
}));