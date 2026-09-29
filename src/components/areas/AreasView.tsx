import React, { useState, useEffect } from 'react';
import { Area, Collector } from '../../types';
import { api } from '../../services/api';
import { MapPin, PlusCircle, Users, UserCheck, X, Edit3, Trash2, Save, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const AreasView: React.FC = () => {
  const { t } = useLanguage();
  const [areas, setAreas] = useState<Area[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Admin Edit Area Modal State
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editAreaData, setEditAreaData] = useState<Partial<Area>>({});
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    area_name: '',
    city: 'Salem',
    district: 'Salem',
    pincode: '636001',
    assigned_collector_id: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ars, cols] = await Promise.all([
        api.getAreas(),
        api.getCollectors(),
      ]);
      setAreas(ars);
      setCollectors(cols);
      if (cols.length > 0) {
        setFormData(prev => ({ ...prev, assigned_collector_id: cols[0].id }));
      }
    } catch (err) {
      console.error('Failed to load areas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const col = collectors.find(c => c.id === formData.assigned_collector_id);
    try {
      await api.createArea({
        area_name: formData.area_name,
        city: formData.city,
        district: formData.district,
        pincode: formData.pincode,
        assigned_collector_id: formData.assigned_collector_id,
        assigned_collector_name: col?.name || 'Assigned Collector',
      });
      setShowAddModal(false);
      setFormData({
        area_name: '',
        city: 'Salem',
        district: 'Salem',
        pincode: '636001',
        assigned_collector_id: collectors[0]?.id || '',
      });
      await loadData();
    } catch (err) {
      console.error('Failed to create area:', err);
    }
  };

  const handleStartEdit = (area: Area) => {
    setEditingArea(area);
    setEditAreaData({
      area_name: area.area_name,
      city: area.city,
      district: area.district,
      pincode: area.pincode,
      assigned_collector_id: area.assigned_collector_id,
      assigned_collector_name: area.assigned_collector_name,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const col = collectors.find(c => c.id === editAreaData.assigned_collector_id);
      await api.updateArea(editingArea.id, {
        ...editAreaData,
        assigned_collector_name: col?.name || editAreaData.assigned_collector_name,
      });
      setEditingArea(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update area');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingArea) return;
    if (!window.confirm(`Are you sure you want to delete area ${editingArea.area_name} (${editingArea.id})?`)) return;
    setEditSubmitting(true);
    try {
      await api.deleteArea(editingArea.id);
      setEditingArea(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to delete area');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('territoryManagement', 'Territory Management')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('areasTitle', 'COLLECTION AREAS')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">{t('Configure collection routes, postal zones, and map designated collectors.', 'Configure collection routes, postal zones, and map designated collectors.')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-bold text-xs shadow-md shadow-gold-500/20 flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('addArea', 'Add New Area')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {areas.map(a => (
          <div key={a.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gold-400 font-bold">{a.id}</span>
              <span className="text-[10px] font-mono text-slate-400">{a.pincode}</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gold-400" />
                {a.area_name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{a.city}, {a.district}</p>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <UserCheck className="w-3.5 h-3.5 text-gold-400" />
                  {t('assignedCollector', 'Assigned Collector')}:
                </span>
                <strong className="text-white">{a.assigned_collector_name}</strong>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  {t('totalCustomers', 'Customer Count')}:
                </span>
                <span className="font-mono font-bold text-gold-400">{a.customer_count} {t('shops', 'Shops')}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => handleStartEdit(a)}
                className="px-2.5 py-1 rounded-lg bg-navy-950 hover:bg-gold-500/20 border border-gold-500/30 text-gold-300 font-semibold text-xs flex items-center gap-1 transition-all"
                title={t('edit', 'Edit Area')}
              >
                <Edit3 className="w-3 h-3" />
                <span>{t('edit', 'Edit Area')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/40 p-6 max-w-md w-full bg-navy-900 shadow-2xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{t('add new area', 'Add Collection Area')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Area Name', 'Area Name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('e.g. Shevapet Market', 'e.g. Shevapet Market')}
                  value={formData.area_name}
                  onChange={e => setFormData({ ...formData, area_name: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('City', 'City')}</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('Pincode', 'Pincode')}</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('assigned collector', 'Assigned Collector')}</label>
                <select
                  value={formData.assigned_collector_id}
                  onChange={e => setFormData({ ...formData, assigned_collector_id: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="submit" className="flex-1 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold">{t('Save Area', 'Save Area')}</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300">{t('cancel', 'Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT AREA MODAL */}
      {editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md">
          <div className="glass-card rounded-2xl border border-gold-500/50 p-6 max-w-md w-full bg-navy-900 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t('Admin Edit Territory / Area', 'Admin Edit Territory / Area')}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {editingArea.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingArea(null)} className="text-slate-400 hover:text-white p-1">
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
                <label className="block text-slate-300 font-semibold mb-1">{t('Area / Locality Name', 'Area / Locality Name')}</label>
                <input
                  type="text"
                  required
                  value={editAreaData.area_name ?? ''}
                  onChange={e => setEditAreaData({ ...editAreaData, area_name: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('City', 'City')}</label>
                  <input
                    type="text"
                    value={editAreaData.city ?? ''}
                    onChange={e => setEditAreaData({ ...editAreaData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('District', 'District')}</label>
                  <input
                    type="text"
                    value={editAreaData.district ?? ''}
                    onChange={e => setEditAreaData({ ...editAreaData, district: e.target.value })}
                    className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('Pincode', 'Pincode')}</label>
                <input
                  type="text"
                  value={editAreaData.pincode ?? ''}
                  onChange={e => setEditAreaData({ ...editAreaData, pincode: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('assigned field collector', 'Assigned Field Collector')}</label>
                <select
                  value={editAreaData.assigned_collector_id ?? ''}
                  onChange={e => setEditAreaData({ ...editAreaData, assigned_collector_id: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-white"
                >
                  {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                  <span>{t('Delete Area', 'Delete Area')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingArea(null)}
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
