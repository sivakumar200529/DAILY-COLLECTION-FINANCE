import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { Area, BusinessDetails, Collector, CustomerAddress, CustomerPersonalDetails } from '../../types';
import { api } from '../../services/api';
import { useConfig } from '../../context/ConfigContext';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton, Sheet } from '../common/ui';
import { PhotoPicker } from '../common/PhotoPicker';
import { LoanFormState, LoanTermsForm, evaluateLoanForm, initialLoanForm, loanIssueText, toIssueLoanPayload } from '../loans/LoanTermsForm';

export interface CustomerFormInitial {
  personal: CustomerPersonalDetails;
  address?: CustomerAddress;
  business?: BusinessDetails;
}

interface CustomerFormProps {
  /** Omitted when adding a new customer. */
  initial?: CustomerFormInitial;
  onSaved: (customerId: string) => void;
  onClose: () => void;
}

const inputClass = 'w-full px-4 py-3 bg-navy-950 border border-slate-700 rounded-2xl text-base text-white focus:border-gold-500 focus:outline-none';

/** Add or edit a customer: the essentials up front, extras folded under "More details". */
export const CustomerForm: React.FC<CustomerFormProps> = ({ initial, onSaved, onClose }) => {
  const { t } = useLanguage();
  const { config } = useConfig();
  const isEdit = !!initial;
  const loc = config.masters.default_location;

  const [name, setName] = useState(initial?.personal.full_name ?? '');
  const [mobile, setMobile] = useState(initial?.personal.mobile_number ?? '');
  const [shopName, setShopName] = useState(initial?.business?.shop_name ?? '');
  const [area, setArea] = useState(initial?.business?.shop_area || initial?.address?.area || loc.area);
  const [address, setAddress] = useState(
    initial?.business?.shop_address || [initial?.address?.door_number, initial?.address?.street].filter(Boolean).join(', ')
  );
  const [landmark, setLandmark] = useState(initial?.business?.landmark || initial?.address?.landmark || '');

  const [showMore, setShowMore] = useState(false);
  const [relative, setRelative] = useState(initial?.personal.father_or_husband_name ?? '');
  const [otherPhone, setOtherPhone] = useState(initial?.personal.alternate_number ?? '');
  const [photo, setPhoto] = useState(initial?.personal.profile_photo ?? '');
  const [shopPhoto, setShopPhoto] = useState(initial?.business?.shop_photo ?? '');
  const [usualMargin, setUsualMargin] = useState<string>(
    initial?.business?.default_margin_percentage !== undefined ? String(initial.business.default_margin_percentage) : ''
  );

  const [areas, setAreas] = useState<Area[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [giveLoan, setGiveLoan] = useState(!isEdit);
  const [loan, setLoan] = useState<LoanFormState | null>(null);
  const [customUsername, setCustomUsername] = useState(initial?.personal.id ?? '');
  const [customPassword, setCustomPassword] = useState('1234');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getAreas(), api.getCollectors()])
      .then(([ars, cols]) => {
        setAreas(ars);
        setCollectors(cols.filter(c => c.status === 'ACTIVE'));
        if (!isEdit) setLoan(initialLoanForm(config, ars, area));
      })
      .catch(() => undefined);
  }, []);

  // The loan follows the customer's area (and that area's collector) until changed in the loan itself.
  const changeArea = (next: string) => {
    setArea(next);
    if (loan && loan.collection_area === area) {
      const collectorId = areas.find(a => a.area_name === next)?.assigned_collector_id;
      setLoan({ ...loan, collection_area: next, ...(collectorId ? { assigned_collector_id: collectorId } : {}) });
    }
  };

  const mobileDigits = mobile.replace(/\D/g, '');

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t('needName', 'Enter the name.'));
    if (mobileDigits.length !== 10) return setError(t('needMobile', 'Enter a 10-digit mobile number.'));
    if (!shopName.trim()) return setError(t('needShop', 'Enter the shop name.'));
    if (!area) return setError(t('needArea', 'Choose the area.'));
    if (!address.trim()) return setError(t('needAddress', 'Enter the address.'));
    if (!isEdit && giveLoan) {
      const issues = loan ? evaluateLoanForm(config, loan).issues : [];
      if (!loan || issues.length > 0) return setError(issues.map(i => loanIssueText(i, t)).join(' '));
    }

    const personal: Partial<CustomerPersonalDetails> = {
      full_name: name.trim(),
      mobile_number: mobileDigits,
      father_or_husband_name: relative.trim(),
      alternate_number: otherPhone.replace(/\D/g, ''),
      profile_photo: photo,
    };
    const business: Partial<BusinessDetails> = {
      shop_name: shopName.trim(),
      shop_area: area,
      shop_address: address.trim(),
      landmark: landmark.trim(),
      shop_photo: shopPhoto,
      ...(usualMargin !== '' ? { default_margin_percentage: Number(usualMargin) } : {}),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await api.updateCustomer(initial!.personal.id, {
          personal,
          address: { area },
          business,
          ...(customUsername.trim() ? { username: customUsername.trim() } : {}),
          ...(customPassword.trim() ? { password: customPassword.trim() } : {}),
        });
        onSaved(initial!.personal.id);
      } else {
        const created = await api.createCustomer({
          personal,
          address: { street: address.trim(), area, landmark: landmark.trim() },
          business,
          ...(giveLoan && loan ? { loan: toIssueLoanPayload(loan) } : {}),
          ...(customUsername.trim() ? { username: customUsername.trim() } : {}),
          ...(customPassword.trim() ? { password: customPassword.trim() } : {}),
        });
        onSaved(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title={isEdit ? t('editCustomer', 'Edit customer') : t('addCustomer', 'Add customer')} onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('name', 'Name')} *</label>
          <input className={inputClass} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('mobile', 'Mobile')} *</label>
          <input className={inputClass} value={mobile} onChange={e => setMobile(e.target.value)} inputMode="tel" maxLength={14} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('shopName', 'Shop name')} *</label>
          <input className={inputClass} value={shopName} onChange={e => setShopName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('area', 'Area')} *</label>
          <select className={inputClass} value={area} onChange={e => changeArea(e.target.value)}>
            <option value="">{t('selectArea', 'Choose area')}</option>
            {areas.map(a => <option key={a.id} value={a.area_name}>{a.area_name}</option>)}
            {area && !areas.some(a => a.area_name === area) && <option value={area}>{area}</option>}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('address', 'Address')} *</label>
          <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('landmark', 'Landmark')}</label>
          <input className={inputClass} value={landmark} onChange={e => setLandmark(e.target.value)} placeholder={t('e.g. Near Temple', 'e.g. Near Temple')} />
        </div>

        <button type="button" onClick={() => setShowMore(!showMore)} className="flex items-center gap-1.5 text-sm font-bold text-gold-400">
          {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {t('moreDetails', 'More details')}
        </button>
        {showMore && (
          <div className="space-y-4 rounded-2xl border border-slate-800 p-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('fatherHusbandName', 'Father / husband name')}</label>
              <input className={inputClass} value={relative} onChange={e => setRelative(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('otherPhone', 'Other phone')}</label>
              <input className={inputClass} value={otherPhone} onChange={e => setOtherPhone(e.target.value)} inputMode="tel" maxLength={14} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhotoPicker label={t('customerPhoto', 'Customer photo')} value={photo} onChange={setPhoto} />
              <PhotoPicker label={t('shopPhoto', 'Shop photo')} value={shopPhoto} onChange={setShopPhoto} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('usualInterest', 'Usual interest % for this shop')}</label>
              <input className={inputClass} type="number" min={0} max={99} step={0.5} value={usualMargin} onChange={e => setUsualMargin(e.target.value)} />
            </div>
          </div>
        )}

        {/* Customer Portal Login Credentials */}
        <div className="p-4 rounded-2xl bg-navy-950/80 border border-slate-800 space-y-3">
          <div className="text-sm font-bold text-gold-400 flex items-center justify-between">
            <span>{t('portalLogin', 'Portal Login (Customer User ID & Password)')}</span>
            <span className="text-xs text-slate-400 font-normal">{t('defaultCredentialsHint', 'Default PIN: 1234')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t('userId', 'User ID / Username')}</label>
              <input
                className={inputClass}
                placeholder={isEdit ? initial.personal.id : t('autoCustomerId', 'Auto Customer ID (e.g. KRS10005)')}
                value={customUsername}
                onChange={e => setCustomUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t('password', 'Password / PIN')}</label>
              <input
                className={inputClass}
                placeholder="1234"
                value={customPassword}
                onChange={e => setCustomPassword(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!isEdit && (
          <div className="rounded-2xl border border-gold-500/30 p-4 space-y-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-base font-bold text-white">
                <Wallet className="w-5 h-5 text-gold-400" />
                {t('giveLoanNow', 'Give a loan now')}
              </span>
              <input type="checkbox" checked={giveLoan} onChange={e => setGiveLoan(e.target.checked)} className="w-6 h-6 accent-amber-500" />
            </label>
            {giveLoan && loan && (
              <LoanTermsForm
                value={loan}
                onChange={setLoan}
                collectors={collectors}
                areas={areas}
                shopDefaultMargin={usualMargin !== '' ? Number(usualMargin) : undefined}
              />
            )}
          </div>
        )}

        {error && <div className="px-4 py-3 rounded-2xl text-sm font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-300">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <BigButton label={t('cancel', 'Cancel')} onClick={onClose} />
          <BigButton tone="gold" icon={Check} label={saving ? t('saving', 'Saving...') : t('save', 'Save')} onClick={save} disabled={saving} />
        </div>
      </div>
    </Sheet>
  );
};
