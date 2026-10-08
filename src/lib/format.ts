export const professionLabels: Record<string, string> = {
  barber: 'Barber',
  hairdresser: 'Hairdresser',
  makeup_artist: 'Makeup artist',
  nail_artist: 'Nail artist',
};

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

export function formatPrice(price: number) {
  return `R${Number(price).toFixed(2)}`;
}