import React from 'react';
import { Customer360Profile } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { AccountSettingsSheet } from '../common/AccountSettingsSheet';

/** The customer's ⚙️ sheet: their details, language, screen, sign out. */
export const CustomerSettingsSheet: React.FC<{
  profile: Customer360Profile | null;
  onLogout: () => void;
  onClose: () => void;
}> = ({ profile, onLogout, onClose }) => {
  const { t } = useLanguage();
  const address = profile?.business?.shop_address
    || [profile?.address?.door_number, profile?.address?.street, profile?.address?.city].filter(Boolean).join(', ');

  const details: [string, string | undefined][] = profile
    ? [
        [t('name', 'Name'), profile.personal.full_name],
        [t('customerId', 'Customer ID'), profile.personal.id],
        [t('mobile', 'Mobile'), profile.personal.mobile_number],
        [t('shopName', 'Shop name'), profile.business?.shop_name],
        [t('address', 'Address'), address],
        [t('area', 'Area'), profile.business?.shop_area || profile.address?.area],
      ]
    : [];

  return <AccountSettingsSheet details={details} onLogout={onLogout} onClose={onClose} />;
};
