import { jsPDF } from 'jspdf';
import { Ad, planLabel } from '@/services/adsApi';

export const billNumber = (ad: Pick<Ad, 'billNumber'>) => `TRI-AD-${String(ad.billNumber).padStart(4, '0')}`;

/** "2026-10-18" → "18 Oct 2026" (the date as booked, no timezone shifting). */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date} ${months[month - 1]} ${year}`;
}

const PAYMENT = { cash: 'Cash', upi: 'UPI', other: 'Other', pending: 'Not paid yet' };

// The PDF's built-in fonts have no ₹ sign, so amounts read "Rs. 100".
const money = (amount: number) => `Rs. ${amount.toLocaleString('en-IN')}`;

/** Builds the ad's bill as an A5 PDF and downloads it. */
export function downloadAdBill(ad: Ad): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const width = doc.internal.pageSize.getWidth();
  const left = 12;
  const right = width - 12;

  // Brand band.
  doc.setFillColor(0, 85, 211);
  doc.rect(0, 0, width, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Triolo', left, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Local services & shops near you', left, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AD BOOKING BILL', right, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(billNumber(ad), right, 22, { align: 'right' });

  doc.setTextColor(12, 15, 20);
  let y = 42;
  const pair = (label: string, value: string, x: number, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(91, 100, 114);
    doc.text(label, x, y, { align });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(12, 15, 20);
    doc.text(value, x, y + 5, { align });
  };
  pair('Billed to', ad.advertiserName, left);
  pair('Bill date', dayLabel(ad.createdAt.slice(0, 10)), right, 'right');
  y += 12;
  pair('Phone', ad.advertiserPhone || '—', left);
  pair('Payment', PAYMENT[ad.paymentMethod], right, 'right');

  // Line item.
  y += 16;
  doc.setFillColor(238, 244, 253);
  doc.rect(left, y - 5, right - left, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', left + 3, y);
  doc.text('Amount', right - 3, y, { align: 'right' });

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const title = doc.splitTextToSize(`Ad: ${ad.title}`, right - left - 40);
  doc.text(title, left + 3, y);
  doc.text(money(ad.amount), right - 3, y, { align: 'right' });
  y += title.length * 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(91, 100, 114);
  doc.text(`${planLabel(ad.planDays)} plan · ${dayLabel(ad.startDate)} to ${dayLabel(ad.endDate)}`, left + 3, y);
  doc.text('Shown in the Triolo customer and partner apps', left + 3, y + 5);

  y += 13;
  doc.setDrawColor(220, 226, 236);
  doc.line(left, y, right, y);
  y += 8;
  doc.setTextColor(12, 15, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', left + 3, y);
  doc.text(money(ad.amount), right - 3, y, { align: 'right' });

  // Paid stamp.
  y += 12;
  doc.setDrawColor(22, 163, 74);
  doc.setTextColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.roundedRect(left, y - 6, 26, 9, 2, 2, 'S');
  doc.setFontSize(11);
  doc.text('PAID', left + 13, y, { align: 'center' });

  if (ad.status === 'deleted') {
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(9);
    doc.text('This ad was stopped (deleted) by Triolo.', left + 32, y);
  }

  // Footer.
  const bottom = doc.internal.pageSize.getHeight() - 12;
  doc.setTextColor(91, 100, 114);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for advertising with Triolo.', width / 2, bottom - 5, { align: 'center' });
  doc.text('This is a computer-generated bill.', width / 2, bottom, { align: 'center' });

  doc.save(`${billNumber(ad)}.pdf`);
}
