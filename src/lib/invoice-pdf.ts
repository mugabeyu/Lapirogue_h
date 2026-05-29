import { jsPDF } from 'jspdf';

export type InvoicePdfInput = {
  invoiceReference: string;
  generatedAt: string;
  invoiceStatus: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestPassport?: string | null;
  guestNationality?: string | null;
  reservationLabel?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference?: string | null;
  paymentNotes?: string | null;
  items: Array<{ category: string; label: string; amount: number; createdAt?: string | null }>;
  totals: Record<string, number>;
  totalCharges: number;
  totalPaid: number;
  balanceDue: number;
  payments: Array<{ paymentId: string; amount: number; method: string; status: string }>;
};

export function buildInvoicePdfBase64(input: InvoicePdfInput) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 42;
  const rightX = 553;
  let y = 48;

  const writeLine = (label: string, value: string, nextGap = 16) => {
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, margin, y);
    pdf.text(value, rightX, y, { align: 'right' });
    y += nextGap;
  };

  const ensureSpace = (required = 28) => {
    if (y + required <= 760) return;
    pdf.addPage();
    y = 48;
  };

  pdf.setFillColor(29, 58, 50);
  pdf.rect(0, 0, 595, 96, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.text('La Pirogue Hotel', margin, 32);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Guest invoice and billing summary', margin, 50);
  pdf.text(`Invoice reference: ${input.invoiceReference}`, margin, 68);
  pdf.text(`Generated: ${new Date(input.generatedAt).toLocaleString()}`, margin, 84);

  pdf.setTextColor(25, 31, 36);
  y = 118;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Guest and reservation details', margin, y);
  y += 18;
  writeLine('Guest', input.guestName);
  writeLine('Email', input.guestEmail ?? 'N/A');
  writeLine('Phone', input.guestPhone ?? 'N/A');
  writeLine('Passport', input.guestPassport ?? 'N/A');
  writeLine('Nationality', input.guestNationality ?? 'N/A');
  writeLine('Reservation', input.reservationLabel ?? 'Walk-in / Guest charge');
  writeLine('Payment method', input.paymentMethod);
  writeLine('Payment status', input.paymentStatus);
  writeLine('Ledger status', input.invoiceStatus.replace('_', ' '));

  y += 8;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Itemized charges', margin, y);
  y += 18;
  pdf.setFont('helvetica', 'normal');

  input.items.forEach((item) => {
    ensureSpace(24);
    const lineDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';
    pdf.text(`${item.label} (${item.category})`, margin, y);
    pdf.text(lineDate, 340, y, { align: 'right' });
    pdf.text(`Rs ${item.amount.toLocaleString()}`, rightX, y, { align: 'right' });
    y += 15;
  });

  y += 8;
  ensureSpace(100);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Totals', margin, y);
  y += 18;
  pdf.setFont('helvetica', 'normal');
  writeLine('Room charges', `Rs ${(input.totals['Room charges'] ?? 0).toLocaleString()}`);
  writeLine('Food & Beverage orders', `Rs ${(input.totals['Food & Beverage orders'] ?? 0).toLocaleString()}`);
  writeLine('Tours and activities', `Rs ${(input.totals['Tours and activities'] ?? 0).toLocaleString()}`);
  writeLine('Transport services', `Rs ${(input.totals['Transport services'] ?? 0).toLocaleString()}`);
  writeLine('Laundry/services', `Rs ${(input.totals['Laundry/services'] ?? 0).toLocaleString()}`);
  writeLine('Additional hotel purchases', `Rs ${(input.totals['Additional hotel purchases'] ?? 0).toLocaleString()}`);
  writeLine('Taxes and service charges', `Rs ${(input.totals['Taxes and service charges'] ?? 0).toLocaleString()}`);
  pdf.setFont('helvetica', 'bold');
  writeLine('Total charges', `Rs ${input.totalCharges.toLocaleString()}`);
  writeLine('Total paid', `Rs ${input.totalPaid.toLocaleString()}`);
  writeLine('Balance due', `Rs ${input.balanceDue.toLocaleString()}`);

  y += 8;
  ensureSpace(90);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Payment history snapshot', margin, y);
  y += 18;
  pdf.setFont('helvetica', 'normal');
  input.payments.slice(0, 6).forEach((payment) => {
    ensureSpace(18);
    pdf.text(`${payment.paymentId} · ${payment.method} · ${payment.status}`, margin, y);
    pdf.text(`Rs ${payment.amount.toLocaleString()}`, rightX, y, { align: 'right' });
    y += 15;
  });

  y += 8;
  ensureSpace(72);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference', margin, y);
  y += 16;
  pdf.setFont('courier', 'normal');
  pdf.text(input.invoiceReference, margin, y);
  y += 18;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Payment reference: ${input.paymentReference ?? 'N/A'}`, margin, y, { maxWidth: 512 });
  y += 16;
  pdf.text(`Recorded by: ${input.paymentNotes ?? 'Recorded in system'}`, margin, y, { maxWidth: 512 });

  const output = pdf.output('arraybuffer');
  return Buffer.from(output).toString('base64');
}
