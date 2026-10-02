import React from 'react';
import { Phone, X } from 'lucide-react';

/**
 * Small set of building blocks shared by the simplified screens: large buttons with an
 * icon and a short word, bottom sheets, Yes/No confirmation, tabs and tiles.
 */

type Icon = React.ComponentType<{ className?: string }>;
export type Tone = 'gold' | 'green' | 'red' | 'plain';

const toneClass: Record<Tone, string> = {
  gold: 'bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 shadow-md shadow-gold-500/20',
  green: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20',
  red: 'bg-rose-600 hover:bg-rose-500 text-white',
  plain: 'bg-navy-950 border border-slate-700 text-slate-200 hover:border-gold-500/60',
};

export const BigButton: React.FC<{
  label: string;
  icon?: Icon;
  tone?: Tone;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  small?: boolean;
}> = ({ label, icon: IconCmp, tone = 'plain', onClick, type = 'button', disabled, className = '', small }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${toneClass[tone]} ${small ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'} rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
  >
    {IconCmp && <IconCmp className={small ? 'w-4 h-4' : 'w-5 h-5'} />}
    <span>{label}</span>
  </button>
);

/** Slides up from the bottom on phones, centred dialog on larger screens. */
export const Sheet: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ title, onClose, children, wide }) => (
  <div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-950/85 backdrop-blur-sm sm:p-4"
    onClick={onClose}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => e.stopPropagation()}
      className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} bg-navy-900 border border-gold-500/40 rounded-t-3xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-black text-white leading-tight">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
          <X className="w-6 h-6" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/** Clear Yes / No question before anything that cannot be taken back easily. */
export const ConfirmSheet: React.FC<{
  title: string;
  message?: string;
  yesLabel: string;
  noLabel: string;
  danger?: boolean;
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
}> = ({ title, message, yesLabel, noLabel, danger, busy, onYes, onNo }) => (
  <Sheet title={title} onClose={onNo}>
    {message && <p className="text-sm text-slate-300 mb-5 leading-relaxed">{message}</p>}
    <div className="grid grid-cols-2 gap-3">
      <BigButton label={noLabel} onClick={onNo} />
      <BigButton label={yesLabel} tone={danger ? 'red' : 'gold'} onClick={onYes} disabled={busy} />
    </div>
  </Sheet>
);

export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              active ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/20' : 'glass-card text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && <span className={`ml-2 ${active ? 'opacity-80' : 'text-slate-500'}`}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const tileTone: Record<'gold' | 'green' | 'red' | 'blue', string> = {
  gold: 'text-gold-300',
  green: 'text-emerald-400',
  red: 'text-rose-400',
  blue: 'text-sky-300',
};

export const StatTile: React.FC<{
  label: string;
  value: string;
  icon: Icon;
  tone?: keyof typeof tileTone;
  hint?: string;
  onClick?: () => void;
}> = ({ label, value, icon: IconCmp, tone = 'gold', hint, onClick }) => {
  const body = (
    <>
      <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
        <IconCmp className={`w-5 h-5 ${tileTone[tone]}`} />
        <span>{label}</span>
      </div>
      <div className={`text-2xl md:text-3xl font-black mt-2 ${tileTone[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="glass-card glass-card-hover rounded-2xl p-4 text-left w-full cursor-pointer">
      {body}
    </button>
  ) : (
    <div className="glass-card rounded-2xl p-4">{body}</div>
  );
};

export const EmptyState: React.FC<{ icon: Icon; text: string }> = ({ icon: IconCmp, text }) => (
  <div className="glass-card rounded-2xl p-10 text-center text-slate-400 flex flex-col items-center gap-3">
    <IconCmp className="w-10 h-10 text-slate-500" />
    <p className="text-sm font-semibold">{text}</p>
  </div>
);

export const Spinner: React.FC = () => (
  <div className="flex justify-center py-12">
    <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export const PageTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex items-end justify-between gap-3 flex-wrap">
    <div>
      <h1 className="text-2xl font-black text-white tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const ProgressBar: React.FC<{ percent: number; tone?: 'green' | 'gold' | 'red' }> = ({ percent, tone = 'green' }) => {
  const color = tone === 'green' ? 'bg-emerald-500' : tone === 'red' ? 'bg-rose-500' : 'bg-gold-500';
  return (
    <div className="h-3 rounded-full bg-navy-950 border border-slate-800 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
};

/** Opens the phone dialler. Shown as a round button next to names. */
export const CallButton: React.FC<{ phone?: string; label: string }> = ({ phone, label }) => {
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
      onClick={e => e.stopPropagation()}
      aria-label={label}
      title={label}
      className="w-11 h-11 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center flex-shrink-0 hover:bg-emerald-600/30"
    >
      <Phone className="w-5 h-5" />
    </a>
  );
};
