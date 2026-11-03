import { useLanguage } from '../../context/LanguageContext';
import type { PersonField, PersonIssue } from '../../utils/peopleImport';

export function usePersonFieldLabel() {
  const { t } = useLanguage();
  return (field: PersonField): string =>
    ({
      name: t('name', 'Name'),
      mobile: t('mobile', 'Mobile'),
      alternate: t('alternateNumber', 'Other number'),
      shop: t('shopName', 'Shop name'),
      area: t('area', 'Area'),
      address: t('address', 'Address'),
      landmark: t('landmark', 'Landmark'),
      relative: t('relativeName', 'Father / husband'),
      email: t('email', 'Email'),
    })[field];
}

export function usePersonIssueText() {
  const { t } = useLanguage();
  return (issue: PersonIssue): string =>
    ({
      'need-name': t('issueNeedName', 'Enter the name'),
      'need-mobile': t('issueNeedMobile', 'Enter the mobile number'),
      'bad-mobile': t('issueBadMobile', 'Not a 10-digit mobile number'),
      'already-added': t('issueAlreadyAdded', 'This mobile number is already added'),
      'repeated-in-list': t('issueRepeated', 'Same mobile number as a row above'),
    })[issue];
}
