import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PageTitle } from '../common/ui';
import { CollectorsView } from '../collectors/CollectorsView';
import { AreasView } from '../areas/AreasView';

/** The field team: collectors and areas side by side, in two equal halves (one above the other on a phone). */
export const StaffAndAreasView: React.FC<{ onOpenCustomer: (customerId: string) => void }> = ({ onOpenCustomer }) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('navStaffAreas', 'Staff & areas')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <CollectorsView />
        <AreasView onOpenCustomer={onOpenCustomer} />
      </div>
    </div>
  );
};
