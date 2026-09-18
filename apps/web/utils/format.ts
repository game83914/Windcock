export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateTimeWithYear(value: string): string {
  return new Date(value).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatLocaleDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-TW');
}

export function formatTimeAgo(value: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '剛剛';
  if (diff < hour) return `${Math.floor(diff / minute)} 分鐘前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小時前`;
  const date = new Date(value);
  const nowDate = new Date(now);
  if (date.getFullYear() === nowDate.getFullYear()) return `${date.getMonth() + 1}/${date.getDate()}`;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}
