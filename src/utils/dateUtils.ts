export const parseDateStr = (dateStr: string | undefined | null): string | null => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr === 'undefined' || dateStr === 'null') return null;
  return dateStr;
};

export const addDays = (dateStr: string, days: number): string => {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let d = parseInt(parts[2], 10);
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = (year: number, month: number) => {
    return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  };

  d += days;
  
  while (d > daysInMonth(y, m)) {
    d -= daysInMonth(y, m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  
  while (d <= 0) {
    m--;
    if (m < 1) {
      m = 12;
      y--;
    }
    d += daysInMonth(y, m);
  }
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
};

export const getDaysBetween = (start: string, end: string) => {
  let count = 0;
  let current = start;
  while (current < end) {
    current = addDays(current, 1);
    count++;
  }
  return count + 1;
};

export const compareDates = (date1: string | null | undefined, date2: string | null | undefined): number => {
  if (!date1 && !date2) return 0;
  if (!date1) return -1;
  if (!date2) return 1;
  return date1.localeCompare(date2);
};
