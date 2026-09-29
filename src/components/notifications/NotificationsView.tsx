import React, { useEffect, useState } from 'react';
import { Notification, Role } from '../../types';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';
import { Bell, CheckCheck, Clock, CheckCircle2, AlertTriangle, FileText, UserPlus, DollarSign } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface NotificationsViewProps {
  currentRole: Role;
  customerId?: string;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ currentRole, customerId }) => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications({
        role: currentRole,
        customer_id: customerId,
      });
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentRole, customerId]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'PAYMENT': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'MISSED':
      case 'OVERDUE': return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'KYC': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'ACCOUNT': return <UserPlus className="w-4 h-4 text-gold-400" />;
      default: return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans max-w-4xl mx-auto">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('communication center', 'Communication Center')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('notifications & alerts', 'NOTIFICATIONS & ALERTS')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('real-time alerts for payments, doorstep collections, and account updates.', 'Real-time alerts for payments, doorstep collections, and account updates.')}</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="px-3.5 py-2 rounded-xl bg-navy-950 border border-gold-500/30 text-gold-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gold-500/20"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>{t('mark all read', 'Mark All Read')}</span>
        </button>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="glass-card p-10 rounded-2xl text-center text-slate-400 text-xs">
            {t('no notifications recorded yet.', 'No notifications recorded yet.')}
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n.id)}
              className={`glass-card p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3.5 ${
                n.is_read
                  ? 'border-slate-800/60 opacity-80'
                  : 'border-gold-500/40 bg-navy-900/90 shadow-md'
              }`}
            >
              <div className="p-2 rounded-xl bg-navy-950 border border-slate-800 flex-shrink-0 mt-0.5">
                {getIcon(n.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`font-bold text-xs ${n.is_read ? 'text-slate-300' : 'text-gold-300'}`}>
                    {n.title}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed">{n.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
