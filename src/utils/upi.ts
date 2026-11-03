import type { CompanyProfile } from '../types';

/** UPI payment link for the business's UPI ID (Settings → Business). Null when no UPI ID is set. */
export function upiPayLink(company: CompanyProfile, amount: number, note: string): string | null {
  const upiId = company.upi_id?.trim();
  if (!upiId) return null;
  const name = company.upi_name?.trim() || company.company_name;
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

/** Image of the QR code for a UPI link. */
export function upiQrImage(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(link)}`;
}
