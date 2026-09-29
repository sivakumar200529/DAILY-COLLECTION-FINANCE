// Utility functions for formatting Indian currency, dates, numbers, and status badges

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN').format(val);
}

export function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  return `${Number(val).toFixed(1)}%`;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function getStatusBadgeClass(status: string | undefined): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'PAID':
    case 'VERIFIED':
    case 'SUCCESS':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    case 'PARTIAL':
    case 'ADVANCE':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400',
      };
    case 'PENDING':
    case 'PENDING VERIFICATION':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
      };
    case 'OVERDUE':
    case 'MISSED':
    case 'REJECTED':
    case 'BLOCKED':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-400',
      };
    case 'COMPLETED':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        dot: 'bg-purple-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-400',
      };
  }
}

// Decimal-safe finance calculations
export function safeRound(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function computePlanRepayment(dailyDue: number, days: number): number {
  return safeRound(dailyDue * days, 2);
}

export function computeFinanceMargin(totalRepayment: number, disbursedAmount: number): number {
  return safeRound(totalRepayment - disbursedAmount, 2);
}

export function computeCompletedDays(amountCollected: number, dailyDue: number): number {
  if (dailyDue <= 0) return 0;
  return Math.floor(amountCollected / dailyDue);
}

export function computeRemainingDays(totalDays: number, completedDays: number): number {
  return Math.max(0, totalDays - completedDays);
}

export function computeRemainingAmount(totalRepayment: number, amountCollected: number): number {
  return Math.max(0, safeRound(totalRepayment - amountCollected, 2));
}

export function computeCollectionPercentage(amountCollected: number, totalRepayment: number): number {
  if (totalRepayment <= 0) return 0;
  return safeRound((amountCollected / totalRepayment) * 100, 1);
}
