import React from 'react';
import { MapPin, Navigation, Phone } from 'lucide-react';
import { DailyCollectionRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useConfig } from '../../context/ConfigContext';
import { Sheet } from '../common/ui';
import { mapsDirections } from '../../utils/maps';

/** Opened by tapping a customer's name: where the shop is (Google Maps) and how to call them. */
export const CustomerInfoSheet: React.FC<{ record: DailyCollectionRecord; onClose: () => void }> = ({ record, onClose }) => {
  const { t } = useLanguage();
  const { default_location } = useConfig().config.masters;
  const address = record.shop_address || record.street;
  const phones = Array.from(new Set([record.mobile_number, record.whatsapp_number].filter(Boolean) as string[]));

  // The business's town (Settings) narrows the search to the right place.
  const mapsLink = mapsDirections([record.shop_name, address, record.collection_area, default_location.city, default_location.state]);

  const row = (label: string, value?: string) =>
    value ? (
      <div className="flex justify-between gap-3 px-4 py-2.5 text-sm">
        <dt className="text-slate-400">{label}</dt>
        <dd className="text-white font-semibold text-right">{value}</dd>
      </div>
    ) : null;

  return (
    <Sheet title={record.customer_name} onClose={onClose}>
      <div className="space-y-4">
        <dl className="rounded-2xl bg-navy-950 border border-slate-800 divide-y divide-slate-800">
          {row(t('shopName', 'Shop name'), record.shop_name)}
          {row(t('address', 'Address'), address)}
          {row(t('landmark', 'Landmark'), record.landmark)}
          {row(t('area', 'Area'), record.collection_area)}
          {row(t('balance', 'Balance'), formatCurrency(record.balance_remaining))}
        </dl>

        <a
          href={mapsLink}
          target="_blank"
          rel="noreferrer"
          className="w-full px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-2"
        >
          <Navigation className="w-5 h-5" />
          {t('openGoogleMaps', 'Open in Google Maps')}
        </a>

        {phones.map(phone => (
          <a
            key={phone}
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
            className="w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            {t('call', 'Call')} {phone}
          </a>
        ))}

        {!address && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            {t('noAddressSaved', 'No address saved. Ask the office to add it.')}
          </p>
        )}
      </div>
    </Sheet>
  );
};
