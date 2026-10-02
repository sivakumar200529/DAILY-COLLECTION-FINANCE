import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PageTitle, PillTabs } from '../common/ui';
import { CollectorsView } from '../collectors/CollectorsView';
import { AreasView } from '../areas/AreasView';

type FieldTab = 'collectors' | 'areas';

/** One menu item for the field team: collectors and the areas they cover. */
export const StaffAndAreasView: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<FieldTab>('collectors');
  return (
    <div className="space-y-4 pb-8">
      <PageTitle title={t('navStaffAreas', 'Staff & areas')} />
      <PillTabs<FieldTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'collectors', label: t('collectors', 'Collectors') },
          { id: 'areas', label: t('areas', 'Areas') },
        ]}
      />
      {tab === 'collectors' ? <CollectorsView /> : <AreasView />}
    </div>
  );
};
