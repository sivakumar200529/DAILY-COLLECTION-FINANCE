import React, { useEffect, useState } from 'react';
import { Collector, Area } from '../../types';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { UserCheck, UserPlus, Phone, Mail, MapPin, Target, DollarSign, X, CheckCircle2, Edit3, Trash2, Save, AlertCircle } from 'lucide-react';

export const CollectorsView: React.FC = () => {
  const { t } = useLanguage();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Admin Edit Collector Modal State
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);
  const [editColData, setEditColData] = useState<Partial<Collector>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    assigned_area: 'Bazaar Main Road',
    target_amount: 25000,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cols, ars] = await Promise.all([
        api.getCollectors(),
        api.getAreas(),
      ]);
      setCollectors(cols);
      setAreas(ars);
    } catch (err) {
      console.error('Failed to load collectors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCollector({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        address: formData.address,
        assigned_area: formData.assigned_area,
        target_amount: Number(formData.target_amount),
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        assigned_area: 'Bazaar Main Road',
        target_amount: 25000,
      });
      await loadData();
    } catch (err) {
      console.error('Failed to create collector:', err);
    }
  };

  const handleStartEdit = (col: Collector) => {
    setEditingCollector(col);
    setEditColData({
      name: col.name,
      mobile: col.mobile,
      email: col.email,
      address: col.address,
      assigned_area: col.assigned_area,
      target_amount: col.target_amount,
      status: col.status,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollector) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.updateCollector(editingCollector.id, {
        ...editColData,
        target_amount: Number(editColData.target_amount),
      });
      setEditingCollector(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update collector');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingCollector) return;
    if (!window.confirm(`Are you sure you want to delete collector ${editingCollector.name} (${editingCollector.id})?`)) return;
    setEditSubmitting(true);
    try {
      await api.deleteCollector(editingCollector.id);
      setEditingCollector(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to delete collector');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('fieldForce', 'Field Force')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('collectorsTitle', 'COLLECTOR MANAGEMENT')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('Manage field collection agents, assigned routes, and daily targets.', 'Manage field collection agents, assigned routes, and daily targets.')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('addCollector', 'Add New Collector')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {collectors.map(c => (
          <div key={c.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={c.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                alt={c.name}
                className="w-12 h-12 rounded-xl object-cover border border-gold-500/40"
              />
              <div>
                <span className="text-[10px] font-mono text-gold-400 font-bold">{c.id}</span>
                <h3 className="text-sm font-bold text-white">{c.name}</h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gold-400" />
                  {c.assigned_area}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-300 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-gold-400" />
                <a href={`tel:${c.mobile}`} className="hover:underline">{c.mobile}</a>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{c.email}</span>
              </div>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
              <div className="p-2 rounded-lg bg-navy-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] block">{t('target', 'Target')}</span>
                <strong className="text-white font-mono">{formatCurrency(c.target_amount)}</strong>
              </div>
              <div className="p-2 rounded-lg bg-navy-950 border border-emerald-500/30">
                <span className="text-emerald-400 text-[10px] block font-semibold">{t('todayCollected', 'Today Collected')}</span>
                <strong className="text-emerald-300 font-mono">{formatCurrency(c.today_collected_amount || 0)}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                {t(c.status, c.status)}
              </span>
              <button
                onClick={() => handleStartEdit(c)}
                className="px-2.5 py-1 rounded-lg bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 font-semibold text-xs flex items-center gap-1 transition-all"
                title={t('edit', 'Edit')}
              >
                <Edit3 className="w-3 h-3" />
                <span>{t('edit', 'Edit')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-md w-full bg-navy-900 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{t('add new collector', 'Add New Collector')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Full Name', 'Full Name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('e.g. Murugan S.', 'e.g. Murugan S.')}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Mobile Number', 'Mobile Number')}</label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Assigned Area', 'Assigned Area')}</label>
                <select
                  value={formData.assigned_area}
                  onChange={e => setFormData({ ...formData, assigned_area: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Target Amount (₹)', 'Target Amount (₹)')}</label>
                <input
                  type="number"
                  value={formData.target_amount}
                  onChange={e => setFormData({ ...formData, target_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold">{t('Save Collector', 'Save Collector')}</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300">{t('cancel', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT COLLECTOR MODAL */}
      {editingCollector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-md w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('Admin Edit Field Collector', 'Admin Edit Field Collector')}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {editingCollector.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingCollector(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Full Legal Name', 'Full Legal Name')}</label>
                <input
                  type="text"
                  required
                  value={editColData.name ?? ''}
                  onChange={e => setEditColData({ ...editColData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Mobile Contact', 'Mobile Contact')}</label>
                <input
                  type="tel"
                  required
                  value={editColData.mobile ?? ''}
                  onChange={e => setEditColData({ ...editColData, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('email', 'Email')}</label>
                <input
                  type="email"
                  value={editColData.email ?? ''}
                  onChange={e => setEditColData({ ...editColData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Assigned Route / Area', 'Assigned Route / Area')}</label>
                <select
                  value={editColData.assigned_area ?? ''}
                  onChange={e => setEditColData({ ...editColData, assigned_area: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Daily Target Collection (₹)', 'Daily Target Collection (₹)')}</label>
                <input
                  type="number"
                  value={editColData.target_amount ?? ''}
                  onChange={e => setEditColData({ ...editColData, target_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Collector Status', 'Collector Status')}</label>
                <select
                  value={editColData.status ?? 'ACTIVE'}
                  onChange={e => setEditColData({ ...editColData, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="ACTIVE">{t('active', 'ACTIVE')}</option>
                  <option value="INACTIVE">{t('INACTIVE', 'INACTIVE')}</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={editSubmitting}
                  className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 font-semibold flex items-center gap-1.5 transition-all text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('delete', 'Delete')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCollector(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold shadow-md shadow-gold-500/20 flex items-center gap-1.5 text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editSubmitting ? t('Saving...', 'Saving...') : t('save changes', 'Save Changes')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
