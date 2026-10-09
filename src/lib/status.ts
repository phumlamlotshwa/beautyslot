import { Colors, lightColors } from './theme';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'reschedule_proposed';

type StatusStyle = { label: string; color: string; background: string };

export function statusStyle(
  status: BookingStatus,
  viewer: 'customer' | 'professional',
  colors: Colors = lightColors
): StatusStyle {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', color: colors.onAccent, background: colors.accentDark };
    case 'cancelled':
      return { label: 'Cancelled', color: colors.textMuted, background: colors.accentSoft };
    case 'completed':
      return { label: 'Completed', color: colors.completed, background: colors.completedSoft };
    case 'reschedule_proposed':
      return {
        label: viewer === 'customer' ? 'New time suggested' : 'New time sent',
        color: colors.info,
        background: colors.infoSoft,
      };
    default:
      return { label: 'Pending', color: colors.warning, background: colors.warningSoft };
  }
}