/**
 * Utility functions for Philippine Standard Time (Asia/Manila, UTC+8)
 */

export const TIMEZONE = 'Asia/Manila';

export function getManilaDate(date: Date = new Date()): string {
  // Returns YYYY-MM-DD in Asia/Manila
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getManilaTime(date: Date = new Date()): string {
  // Returns HH:mm:ss in 24h format in Asia/Manila
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTimeDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return '--:--';
  // If timeStr is already in HH:mm:ss format:
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${paddedMinutes} ${ampm}`;
  }
  return timeStr;
}

export function formatManilaDateTimeDisplay(date: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  dayStr: string;
} {
  const formatterDate = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formatterDay = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
  });

  const formatterTime = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return {
    dayStr: formatterDay.format(date),
    dateStr: formatterDate.format(date),
    timeStr: formatterTime.format(date),
  };
}

export function calculateHours(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0;
  const parseSeconds = (t: string): number => {
    const [h, m, s] = t.split(':').map((num) => parseInt(num || '0', 10));
    return h * 3600 + m * 60 + (s || 0);
  };

  let inSec = parseSeconds(timeIn);
  let outSec = parseSeconds(timeOut);

  if (outSec < inSec) {
    // If shift spans past midnight
    outSec += 24 * 3600;
  }

  const diffHours = (outSec - inSec) / 3600;
  return Math.round(diffHours * 100) / 100;
}
