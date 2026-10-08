import { colors } from './theme';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'reschedule_proposed';

type StatusStyle = { label: string; color: string; background: string };

const shared: Record<Exclude<BookingStatus, 'reschedule_proposed'>, StatusStyle> = {
  pending: { label: 'Pending', color: colors.warning, background: colors.warningSoft },
  confirmed: { label: 'Confirmed', color: colors.accentDark, background: colors.accentSoft },
  cancelled: { label: 'Cancelled', color: colors.textMuted, background: '#EFECE6' },
  completed: { label: 'Completed', color: colors.completed, background: colors.completedSoft },
};

export function statusStyle(status: BookingStatus, viewer: 'customer' | 'professional'): StatusStyle {
  if (status === 'reschedule_proposed') {
    return {
      label: viewer === 'customer' ? 'New time suggested' : 'New time sent',
      color: colors.info,
      background: colors.infoSoft,
    };
  }
  return shared[status] ?? shared.pending;
}