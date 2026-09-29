import React, { useState, useEffect } from 'react';
import { CustomerDocument, CustomerPersonalDetails } from '../../types';
import { api } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { FileCheck, CheckCircle2, XCircle, ExternalLink, Filter, Upload, Trash2, Eye } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const KYCDocumentsView: React.FC = () => {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocument | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getDocuments({ status: statusFilter });
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleVerify = async (docId: string, status: 'Verified' | 'Rejected') => {
    try {
      await api.verifyDocument(docId, status, `Official verification by Admin`);
      await loadData();
    } catch (err) {
      console.error('Failed to verify document:', err);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document record?')) return;
    try {
      await api.deleteDocument(docId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      <div className="glass-card p-5 rounded-2xl border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">
            {t('compliance', 'Compliance & Verification')}
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white">{t('kycDocumentsTitle', 'KYC DOCUMENT MANAGEMENT')}</h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {t('kycDesc', 'Audit customer proof of identity, business trade licences, bank passbooks, and approve/reject verification.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gold-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-navy-950 border border-slate-700 rounded-xl text-xs text-white"
          >
            <option value="ALL">{t('allDocuments', 'All Documents')}</option>
            <option value="Pending Verification">{t('pending', 'Pending Verification')}</option>
            <option value="Verified">{t('verified', 'Verified')}</option>
            <option value="Rejected">{t('rejected', 'Rejected')}</option>
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(d => (
          <div key={d.id} className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gold-400 font-bold">{d.customer_id}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  d.verification_status === 'Verified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  d.verification_status === 'Rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {t(d.verification_status, d.verification_status)}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-gold-400" />
                {t(d.document_type, d.document_type)}
              </h3>

              <div className="text-xs text-slate-400 space-y-1 pt-1">
                <div>{t('documentNumber', 'Document #')}: <strong className="text-slate-200 font-mono">{d.document_number}</strong></div>
                <div>{t('uploadedOn', 'Uploaded on')}: <span className="text-slate-300 font-mono">{formatDate(d.upload_date)}</span></div>
                <div>{t('by', 'By')}: <span className="text-slate-300">{d.uploaded_by}</span></div>
                {d.remarks && <div className="text-[11px] text-slate-500 italic">"{d.remarks}"</div>}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <a
                href={d.file_url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-navy-950 border border-slate-700 hover:border-gold-500 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-gold-400" />
                <span>{t('preview', 'Preview')}</span>
              </a>

              {d.verification_status === 'Pending Verification' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleVerify(d.id, 'Verified')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                  >
                    <span>{t('approve', 'Approve')}</span>
                  </button>
                  <button
                    onClick={() => handleVerify(d.id, 'Rejected')}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                  >
                    <span>{t('reject', 'Reject')}</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => handleDelete(d.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                title={t('Delete document', 'Delete document')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
