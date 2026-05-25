'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Download, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/PageHeader';

type PaymentDetailResponse = {
  payment: {
    id: string;
    paymentId: string;
    guestId?: string | null;
    reservationId?: string | null;
    amount: number;
    method: string;
    status: string;
    reference?: string | null;
    notes?: string | null;
    createdAt: string;
  };
  guest: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    passport?: string | null;
  } | null;
  reservation: { reservationId?: string | null; checkIn?: string | null; checkOut?: string | null; totalAmount: number; roomNumber?: string | null; roomType?: string | null } | null;
  billingSummary: {
    items: Array<{ category: string; label: string; amount: number; sourceId?: string; createdAt?: string | null }>;
    totals: Record<string, number>;
    totalCharges: number;
    totalPaid: number;
    balanceDue: number;
    status: string;
  };
  charges: Array<{ category: string; label: string; amount: number; sourceId?: string; createdAt?: string | null }>;
  payments: Array<{ id: string; paymentId: string; amount: number; method: string; status: string; reference?: string | null; createdAt: string }>;
  generatedAt: string;
  invoiceReference: string;
};

export function PaymentDetailsPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useApi<PaymentDetailResponse>(`/api/payments/${params.id}`);

  const detail = data;

  const guestLabel = useMemo(() => {
    if (!detail?.guest) return 'Guest';
    return `${detail.guest.firstName} ${detail.guest.lastName}`.trim();
  }, [detail?.guest]);

  const paymentStateLabel = detail?.billingSummary.status.replace('_', ' ') ?? 'PENDING';

  const invoiceMeta = useMemo(() => {
    if (!detail) return null;

    return {
      generatedAt: new Date(detail.generatedAt).toLocaleString(),
      reference: detail.invoiceReference,
      hotelName: 'La Pirogue Hotel',
      reservation: detail.reservation?.reservationId ?? 'Walk-in / Guest charge',
    };
  }, [detail]);

  function downloadInvoicePdf() {
    if (!detail) return;

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 42;
    let y = 48;
    const rightX = 553;
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
    pdf.text(`Invoice reference: ${detail.invoiceReference}`, margin, 68);
    pdf.text(`Generated: ${new Date(detail.generatedAt).toLocaleString()}`, margin, 84);

    pdf.setTextColor(25, 31, 36);
    y = 118;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('Guest and reservation details', margin, y);
    y += 18;
    writeLine('Guest', guestLabel);
    writeLine('Email', detail.guest?.email ?? 'N/A');
    writeLine('Phone', detail.guest?.phone ?? 'N/A');
    writeLine('Reservation', invoiceMeta?.reservation ?? 'N/A');
    writeLine('Payment method', detail.payment.method);
    writeLine('Payment status', detail.payment.status);
    writeLine('Ledger status', paymentStateLabel);

    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Itemized charges', margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');

    detail.charges.forEach((item) => {
      ensureSpace(20);
      pdf.text(item.label, margin, y);
      pdf.text(`Rs ${item.amount.toLocaleString()}`, rightX, y, { align: 'right' });
      y += 15;
    });

    y += 8;
    ensureSpace(80);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Totals', margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');
    writeLine('Room charges', `Rs ${detail.billingSummary.totals['Room charges'].toLocaleString()}`);
    writeLine('Food & Beverage orders', `Rs ${detail.billingSummary.totals['Food & Beverage orders'].toLocaleString()}`);
    writeLine('Tours and activities', `Rs ${detail.billingSummary.totals['Tours and activities'].toLocaleString()}`);
    writeLine('Transport services', `Rs ${detail.billingSummary.totals['Transport services'].toLocaleString()}`);
    writeLine('Laundry/services', `Rs ${detail.billingSummary.totals['Laundry/services'].toLocaleString()}`);
    writeLine('Additional hotel purchases', `Rs ${detail.billingSummary.totals['Additional hotel purchases'].toLocaleString()}`);
    writeLine('Taxes and service charges', `Rs ${detail.billingSummary.totals['Taxes and service charges'].toLocaleString()}`);
    pdf.setFont('helvetica', 'bold');
    writeLine('Total charges', `Rs ${detail.billingSummary.totalCharges.toLocaleString()}`);
    writeLine('Total paid', `Rs ${detail.billingSummary.totalPaid.toLocaleString()}`);
    writeLine('Balance due', `Rs ${detail.billingSummary.balanceDue.toLocaleString()}`);

    y += 8;
    ensureSpace(90);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Payment history snapshot', margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');
    detail.payments.slice(0, 6).forEach((payment) => {
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
    pdf.text(detail.invoiceReference, margin, y);
    y += 18;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Recorded by: ${detail.payment.notes ?? 'Recorded in system'}`, margin, y, { maxWidth: 512 });

    pdf.save(`invoice-${detail.invoiceReference}.pdf`);
  }

  if (isLoading) {
    return <div className="rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm">Loading payment details...</div>;
  }

  if (!detail) {
    return <div className="rounded-[24px] border border-sand-200 bg-white p-6 shadow-sm">Payment not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="invoice-print-hide">
        <PageHeader
          title="Payment Details"
          subtitle={`Detailed billing view for ${detail.invoiceReference}`}
          action={(
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadInvoicePdf} className="btn-primary inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                Generate Invoice PDF
              </button>
              <button type="button" onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          )}
        />
      </div>

      <InvoiceList detail={detail} />

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible !important;
          }

          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }

          .invoice-print-hide {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function InvoiceList({
  detail,
}: {
  detail: PaymentDetailResponse;
}) {
  const guestLabel = `${detail.guest?.firstName ?? ''} ${detail.guest?.lastName ?? ''}`.trim() || 'Guest';

  return (
    <div className="space-y-5">
      <article id="invoice-print-area" className="rounded-[24px] border border-sand-200 bg-white p-6 md:p-8">
        <header className="grid gap-6 border-b border-sand-200 pb-6 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <img src="/lapiroguelogo.jpg" alt="La Pirogue logo" className="h-12 w-12 rounded-full object-cover ring-1 ring-sand-300" />
              <div>
                <h3 className="font-display text-3xl text-ink-900">La Pirogue</h3>
                <p className="text-sm text-ink-600">Wolmar, Flic en Flac, Mauritius</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm text-ink-600">
              <p>Tel: +230 403 3900</p>
              <p>Email: info@lapirogue.mu</p>
              <p>VAT No: 12345678</p>
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="text-3xl font-semibold text-ink-900">INVOICE</div>
            <div className="mt-3 space-y-1 text-sm text-ink-700">
              <p>
                <span className="text-ink-500">Invoice No:</span> <strong>#{detail.invoiceReference}</strong>
              </p>
              <p>
                <span className="text-ink-500">Issue Date:</span> <strong>{new Date(detail.generatedAt).toLocaleDateString()}</strong>
              </p>
              <p>
                <span className="text-ink-500">Status:</span>{' '}
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {detail.billingSummary.status.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 border-b border-sand-200 pb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Bill To</div>
          <h4 className="mt-3 text-2xl font-semibold text-ink-900">{guestLabel}</h4>
          <div className="mt-2 space-y-1 text-sm text-ink-600">
            <p>{detail.guest?.email ?? 'Email not available'}</p>
            <p>{detail.guest?.phone ?? 'Phone not available'}</p>
            <p>Passport: {detail.guest?.passport ?? 'N/A'}</p>
            <p>Nationality: {detail.guest?.nationality ?? 'N/A'}</p>
            <p>Reservation: {detail.reservation?.reservationId ?? 'Walk-in / Guest charge'}</p>
          </div>
        </section>

        <section className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-sand-200 text-xs uppercase tracking-[0.14em] text-ink-500">
                <th className="pb-3 pr-3">Description</th>
                <th className="pb-3 pr-3">Date</th>
                <th className="pb-3 pr-3 text-right">Qty</th>
                <th className="pb-3 pr-3 text-right">Rate (Rs)</th>
                <th className="pb-3 text-right">Amount (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {detail.charges.map((item, index) => {
                const lineDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';
                const quantity = 1;
                const rate = item.amount;
                return (
                  <tr key={`${item.label}-${index}`} className="border-b border-sand-100 text-sm text-ink-800">
                    <td className="py-4 pr-3">
                      <div className="font-medium text-ink-900">{item.label}</div>
                      <div className="text-xs text-ink-500">{item.category}</div>
                    </td>
                    <td className="py-4 pr-3">{lineDate}</td>
                    <td className="py-4 pr-3 text-right">{quantity}</td>
                    <td className="py-4 pr-3 text-right">{rate.toLocaleString()}</td>
                    <td className="py-4 text-right font-semibold">{item.amount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <footer className="mt-7 grid gap-6 md:grid-cols-2">
          <div className="space-y-2 text-sm text-ink-600">
            <div className="font-semibold text-ink-900">Payment Notes</div>
            <p>{detail.payment.notes ?? 'Payment is due upon receipt. We accept major cards, bank transfers, and cash.'}</p>
            <p>Reference: {detail.payment.reference ?? 'N/A'}</p>
          </div>

          <div className="ml-auto w-full max-w-sm space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-600">Subtotal</span>
              <span className="font-medium text-ink-900">Rs {detail.billingSummary.totalCharges.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-600">Total Paid</span>
              <span className="font-medium text-ink-900">Rs {detail.billingSummary.totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-sand-300 pt-3 text-lg">
              <span className="font-semibold text-ink-900">Total Due</span>
              <span className="font-display text-4xl text-ink-900">Rs {detail.billingSummary.balanceDue.toLocaleString()}</span>
            </div>
          </div>
        </footer>

        <div className="mt-8 border-t border-sand-200 pt-6 text-center">
          <p className="font-display text-3xl italic text-ink-900">Thank you for staying with us</p>
          <p className="mt-2 text-sm text-ink-600">We hope to welcome you back to La Pirogue soon.</p>
        </div>
      </article>
    </div>
  );
}

