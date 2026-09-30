/**
 * Calendar Scheduling & Continuous Month-to-Month Carryover Utility
 * 
 * Accurately implements 100-day (or N-day) daily collection schedules
 * that cross months and years using real calendar dates.
 */

export interface ScheduledDay {
  dayNumber: number; // 1, 2, 3... N
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. '25-Sep-2026'
  dailyDue: number;
}

export interface MonthlyBreakdown {
  monthKey: string; // e.g. '2026-09'
  monthName: string; // e.g. 'September 2026'
  startDayNumber: number; // e.g. 1
  endDayNumber: number; // e.g. 6
  daysCount: number; // e.g. 6
  expectedAmount: number; // e.g. 600
}

/**
 * Calculates the exact final calendar end date given a start date and collection days.
 * Day 1 is the start date. Day N is start date + (N - 1) calendar days.
 * Uses UTC date math to avoid daylight saving or timezone shifts.
 */
export function calculateEndDate(startDateStr: string, collectionDays: number): string {
  if (!startDateStr || collectionDays <= 0) return startDateStr || '';
  
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  
  // Day 1 is start date, so add (collectionDays - 1) days
  date.setUTCDate(date.getUTCDate() + (collectionDays - 1));
  
  const endYear = date.getUTCFullYear();
  const endMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const endDay = String(date.getUTCDate()).padStart(2, '0');
  
  return `${endYear}-${endMonth}-${endDay}`;
}

/**
 * Generates the full day-by-day collection schedule from Day 1 to Day N.
 */
export function generateFullSchedule(
  startDateStr: string,
  collectionDays: number,
  dailyDue: number
): ScheduledDay[] {
  if (!startDateStr || collectionDays <= 0) return [];
  
  const schedule: ScheduledDay[] = [];
  const [y, m, d] = startDateStr.split('-').map(Number);
  const current = new Date(Date.UTC(y, m - 1, d));
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let dayNum = 1; dayNum <= collectionDays; dayNum++) {
    const curYear = current.getUTCFullYear();
    const curMonth = current.getUTCMonth();
    const curDay = current.getUTCDate();
    
    const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`;
    const displayDate = `${String(curDay).padStart(2, '0')}-${monthNames[curMonth]}-${curYear}`;
    
    schedule.push({
      dayNumber: dayNum,
      date: dateStr,
      displayDate,
      dailyDue,
    });
    
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return schedule;
}

/**
 * Calculates how the collection days and expected amounts are distributed
 * across calendar months (e.g. Sep: 6 days ₹600, Oct: 31 days ₹3,100, etc.)
 */
export function calculateMonthlyBreakdown(
  startDateStr: string,
  collectionDays: number,
  dailyDue: number
): MonthlyBreakdown[] {
  const schedule = generateFullSchedule(startDateStr, collectionDays, dailyDue);
  if (schedule.length === 0) return [];
  
  const monthMap = new Map<string, { startDay: number; endDay: number; count: number; total: number }>();
  const monthNamesFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  schedule.forEach(item => {
    const key = item.date.slice(0, 7); // 'YYYY-MM'
    const existing = monthMap.get(key);
    if (!existing) {
      monthMap.set(key, {
        startDay: item.dayNumber,
        endDay: item.dayNumber,
        count: 1,
        total: item.dailyDue,
      });
    } else {
      existing.endDay = item.dayNumber;
      existing.count += 1;
      existing.total += item.dailyDue;
    }
  });
  
  const result: MonthlyBreakdown[] = [];
  monthMap.forEach((val, key) => {
    const [yearStr, monthStr] = key.split('-');
    const mIdx = parseInt(monthStr, 10) - 1;
    result.push({
      monthKey: key,
      monthName: `${monthNamesFull[mIdx]} ${yearStr}`,
      startDayNumber: val.startDay,
      endDayNumber: val.endDay,
      daysCount: val.count,
      expectedAmount: Math.round(val.total * 100) / 100,
    });
  });
  
  return result;
}
