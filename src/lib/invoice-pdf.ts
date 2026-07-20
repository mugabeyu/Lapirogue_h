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

const pageWidth = 600;
const pageHeight = 800;
const margin = 30;
const contentWidth = pageWidth - margin * 2;
const tableLineHeight = 9;

function currency(value: number) {
  return `Rs ${value.toLocaleString()}`;
}

function text(value: string | number | null | undefined, fallback = 'N/A') {
  return String(value ?? '').trim() || fallback;
}

function split(pdf: jsPDF, value: string | number | null | undefined, width: number) {
  return pdf.splitTextToSize(text(value), width);
}

export function buildInvoicePdfBase64(input: InvoicePdfInput) {
  const pdf = new jsPDF({ unit: 'pt', format: [pageWidth, pageHeight] });
  let y = margin;
  let itemsHeaderDrawnOnPage = false;

  const addPageIfNeeded = (required: number) => {
    if (y + required <= pageHeight - margin) return;
    pdf.addPage();
    y = margin;
    itemsHeaderDrawnOnPage = false;
  };

  const drawHorizontalLine = (yy: number) => {
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, yy, margin + contentWidth, yy);
  };

  // Single source of truth for the itemized-charges column layout, shared by
  // the header row and every data row so they can never drift out of sync.
  const descWidth = contentWidth * 0.42;
  const dateWidth = contentWidth * 0.13;
  const qtyWidth = contentWidth * 0.08;
  const rateWidth = contentWidth * 0.17;
  const amountWidth = contentWidth * 0.20;
  const xDate = margin + descWidth;
  const xQty = xDate + dateWidth;
  const xRate = xQty + qtyWidth;
  const xAmount = xRate + rateWidth;

  const write = (
    value: string | number | null | undefined,
    x: number,
    yy: number,
    width: number,
    size = 9,
    style: 'normal' | 'bold' = 'normal',
    align?: 'left' | 'right',
  ) => {
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    const lines = split(pdf, value, width);
    pdf.text(lines, x, yy, { align });
    return yy + lines.length * tableLineHeight * (size / 9);
  };

  const writeBlockTitle = (title: string, yy: number) => {
    pdf.setFillColor(254, 127, 45);
    pdf.rect(margin, yy - 10, contentWidth, 18, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, margin + 8, yy + 3);
    pdf.setTextColor(31, 41, 55);
    return yy + 24;
  };

  const drawTableHeader = (yy: number) => {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, yy - 13, contentWidth, 18, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Description', margin, yy);
    pdf.text('Date', xDate + dateWidth - 3, yy, { align: 'right' });
    pdf.text('Qty', xQty + qtyWidth - 3, yy, { align: 'right' });
    pdf.text('Rate (Rs)', xRate + rateWidth - 3, yy, { align: 'right' });
    pdf.text('Amount (Rs)', xAmount + amountWidth - 3, yy, { align: 'right' });
    pdf.setTextColor(31, 41, 55);
  };

  // Header in the style of the Payment Details receipt.
  pdf.setFillColor(254, 127, 45);
  pdf.rect(0, 0, pageWidth, 110, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('La Pirogue', margin, 34);
  pdf.setFontSize(8);
  pdf.text('Wolmar, Flic en Flac, Mauritius', margin, 52);
  pdf.text('Tel: +230 403 3900 | info@lapirogue.mu', margin, 68);
  pdf.text('VAT No: 12345678', margin, 84);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('INVOICE', margin + contentWidth, 34, { align: 'right' });
  pdf.setFontSize(8);
  pdf.text(`Invoice No: #${input.invoiceReference}`, margin + contentWidth, 58, { align: 'right' });
  pdf.text(`Issue Date: ${new Date(input.generatedAt).toLocaleDateString()}`, margin + contentWidth, 74, { align: 'right' });

  const status = input.invoiceStatus.replace(/_/g, ' ');
  const statusWidth = Math.min(120, Math.max(72, pdf.getTextWidth(status) + 18));
  pdf.setFillColor(243, 244, 246);
  pdf.roundedRect(margin + contentWidth - statusWidth, 86, statusWidth, 18, 4, 4, 'F');
  pdf.setTextColor(31, 41, 55);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.text(status, margin + contentWidth - statusWidth / 2, 98, { align: 'center' });

  pdf.setTextColor(31, 41, 55);
  y = 134;
  y = writeBlockTitle('Bill To', y);

  // Bill To and invoice metadata.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  y = write(input.guestName, margin, y, contentWidth * 0.62, 11, 'bold');
  y += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  y = write(input.guestEmail, margin, y, contentWidth * 0.62, 8);
  y = write(input.guestPhone, margin, y, contentWidth * 0.62, 8);
  y = write(`Passport: ${text(input.guestPassport)}`, margin, y, contentWidth * 0.62, 8);
  y = write(`Nationality: ${text(input.guestNationality)}`, margin, y, contentWidth * 0.62, 8);
  y = write(`Reservation: ${text(input.reservationLabel, 'Walk-in / Guest charge')}`, margin, y, contentWidth * 0.62, 8);
  y += 8;

  const metaRight = margin + contentWidth * 0.66;
  const metaWidth = contentWidth * 0.34;
  y = Math.max(y, 184);
  y = write('Payment method', metaRight, y, metaWidth, 7.5, 'bold');
  y = write(input.paymentMethod, metaRight, y, metaWidth, 7.5);
  y = write('Payment status', metaRight, y, metaWidth, 7.5, 'bold');
  y = write(input.paymentStatus, metaRight, y, metaWidth, 7.5);
  y = write('Payment reference', metaRight, y, metaWidth, 7.5, 'bold');
  y = write(text(input.paymentReference), metaRight, y, metaWidth, 7.5);
  y += 8;

  // Itemized charges table.
  y += 8;
  y = writeBlockTitle('Itemized charges', y);
  drawTableHeader(y);
  y += 8;
  itemsHeaderDrawnOnPage = true;

  if (input.items.length === 0) {
    addPageIfNeeded(42);
    y = write('No itemized charges found.', margin, y, contentWidth, 8);
    y += 12;
  } else {
    input.items.forEach((item, index) => {
      const lineDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';
      const description = `${index + 1}. ${item.label} (${item.category})`;
      const descLines = split(pdf, description, descWidth - 6);
      const dateLines = split(pdf, lineDate, dateWidth - 6);
      const qtyLines = split(pdf, '1', qtyWidth - 6);
      const rateLines = split(pdf, currency(Number(item.amount)), rateWidth - 6);
      const amountLines = split(pdf, currency(Number(item.amount)), amountWidth - 6);
      const maxLines = Math.max(descLines.length, dateLines.length, qtyLines.length, rateLines.length, amountLines.length);
      const rowHeight = maxLines * tableLineHeight + 10;

      addPageIfNeeded(rowHeight + 12);
      if (!itemsHeaderDrawnOnPage) {
        drawTableHeader(y);
        y += 8;
        itemsHeaderDrawnOnPage = true;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(31, 41, 55);
      pdf.text(descLines, margin + 3, y);
      pdf.text(dateLines, xDate + dateWidth - 3, y, { align: 'right' });
      pdf.text(qtyLines, xQty + qtyWidth - 3, y, { align: 'right' });
      pdf.text(rateLines, xRate + rateWidth - 3, y, { align: 'right' });
      pdf.text(amountLines, xAmount + amountWidth - 3, y, { align: 'right' });
      y += rowHeight;
      drawHorizontalLine(y);
      y += 4;
    });
  }

  // Payment history snapshot, compact and wrapped.
  if (input.payments.length > 0) {
    y += 8;
    addPageIfNeeded(44);
    y = writeBlockTitle('Payment history snapshot', y);
    input.payments.slice(0, 12).forEach((payment, index) => {
      addPageIfNeeded(42);
      y = write(`${index + 1}. ${payment.paymentId}`, margin, y, contentWidth * 0.55, 7.5, 'bold');
      y = write(`${payment.method} · ${payment.status}`, margin, y, contentWidth * 0.55, 7.5);
      y = write(currency(Number(payment.amount)), margin + contentWidth * 0.62, y - tableLineHeight, contentWidth * 0.38, 7.5, 'bold', 'right');
      y += 4;
    });
    if (input.payments.length > 12) {
      y = write('Additional payment records are available in the guest account.', margin, y, contentWidth, 7.5);
      y += 8;
    }
  }

  // Footer: notes/reference on left, totals on right.
  addPageIfNeeded(150);
  y += 8;
  y = writeBlockTitle('Payment Notes', y);
  const footerTop = y;
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.38;
  const rightX = margin + contentWidth - rightWidth;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  y = write(text(input.paymentNotes, 'Payment is due upon receipt. We accept major cards, bank transfers, and cash.'), margin, y, leftWidth, 7.5);
  y = write(`Reference: ${text(input.paymentReference)}`, margin, y, leftWidth, 7.5);
  y = write(`Recorded by: ${text(input.paymentNotes, 'Recorded in system')}`, margin, y, leftWidth, 7.5);

  let totalsY = footerTop;
  const totals: Array<[string, number, boolean?]> = [
    ['Subtotal', input.totalCharges],
    ['Total Paid', input.totalPaid],
    ['Balance Due', input.balanceDue, true],
  ];

  totals.forEach(([label, value, bold = false]) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(bold ? 9 : 7.5);
    pdf.text(label, rightX, totalsY, { align: 'left' });
    pdf.text(currency(value), rightX + rightWidth, totalsY, { align: 'right' });
    totalsY += bold ? 22 : 16;
    if (bold) {
      pdf.setDrawColor(229, 231, 235);
      pdf.line(rightX, totalsY - 6, rightX + rightWidth, totalsY - 6);
    }
  });
  y = Math.max(y, totalsY + 8);

  y += 10;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  y = write('Thank you for staying with La Pirogue Hotel. We hope to welcome you back soon.', margin, y, contentWidth, 8);

  const output = pdf.output('arraybuffer');
  return Buffer.from(output).toString('base64');
}
