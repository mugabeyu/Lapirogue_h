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

type PdfHtmlOptions = {
  margin: [number, number, number, number];
  autoPaging: 'text';
  html2canvas: {
    scale: number;
    useCORS: boolean;
    backgroundColor: string;
  };
};

type HtmlCapablePdf = jsPDF & {
  html: (element: HTMLElement, options: PdfHtmlOptions) => Promise<jsPDF>;
};

export function PaymentDetailsPage() {
  const params = useParams<{ id: string }>();
  const { data} = useApi<PaymentDetailResponse>(`/api/payments/${params.id}`);

  const detail = data;

  const guestLabel = useMemo(() => {
    if (!detail?.guest) return 'Guest';
    return `${detail.guest.firstName} ${detail.guest.lastName}`.trim();
  }, [detail?.guest]);

  async function emailInvoice() {
    if (!detail) return;

    try {
      const invoiceElement = document.getElementById('invoice-print-area');
      if (!invoiceElement) {
        throw new Error('Invoice layout not found');
      }

      // Generate PDF from the exact visible invoice layout so email attachment matches UI.
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      await (pdf as unknown as HtmlCapablePdf).html(invoiceElement, {
        margin: [16, 16, 16, 16],
        autoPaging: 'text',
        html2canvas: {
          scale: 1,
          useCORS: true,
          backgroundColor: '#ffffff',
        },
      });

      const pdfBase64 = pdf.output('datauristring').split(',')[1] ?? '';

      const resp = await fetch(`/api/payments/${detail.payment.id}/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      });
      if (!resp.ok) throw new Error('Failed to send invoice');
      alert('Invoice PDF emailed to guest');
    } catch (err) {
      console.error('Send invoice via API failed', err);
      alert('Failed to email invoice');
    }
  }

  

  if (!detail) {
    return <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm">Payment not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="invoice-print-hide">
        <PageHeader
          title="Payment Details"
          subtitle={`Detailed billing view for ${detail.invoiceReference}`}
          action={(
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={emailInvoice} className="btn-primary inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                Email Invoice
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
      <article id="invoice-print-area" className="rounded-[24px] border border-border bg-surface p-6 md:p-8">
        <header className="grid gap-6 border-b border-border pb-6 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <img src="/lapiroguelogo.jpg" alt="La Pirogue logo" className="h-12 w-12 rounded-full object-cover ring-1 ring-border" />
              <div>
                <h3 className="font-display text-3xl text-[var(--color-text-primary)]">La Pirogue</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Wolmar, Flic en Flac, Mauritius</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--color-text-secondary)]">
              <p>Tel: +230 403 3900</p>
              <p>Email: info@lapirogue.mu</p>
              <p>VAT No: 12345678</p>
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="text-3xl font-semibold text-[var(--color-text-primary)]">INVOICE</div>
              <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                <p>
                  <span className="text-[var(--color-text-secondary)]">Invoice No:</span> <strong>#{detail.invoiceReference}</strong>
                </p>
                <p>
                  <span className="text-[var(--color-text-secondary)]">Issue Date:</span> <strong>{new Date(detail.generatedAt).toLocaleDateString()}</strong>
                </p>
              <p>
                  <span className="text-[var(--color-text-secondary)]">Status:</span>{' '}
                <span className="rounded-xl border border-border bg-surface-secondary px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                  {detail.billingSummary.status.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 border-b border-sand-200 pb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Bill To</div>
            <h4 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">{guestLabel}</h4>
            <div className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
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
              <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
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
                  <tr key={`${item.label}-${index}`} className="border-b border-border text-sm text-[var(--color-text-primary)]">
                    <td className="py-4 pr-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{item.label}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">{item.category}</div>
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
          <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <div className="font-semibold text-[var(--color-text-primary)]">Payment Notes</div>
            <p className="text-[var(--color-text-secondary)]">{detail.payment.notes ?? 'Payment is due upon receipt. We accept major cards, bank transfers, and cash.'}</p>
            <p className="text-[var(--color-text-secondary)]">Reference: {detail.payment.reference ?? 'N/A'}</p>
          </div>

          <div className="ml-auto w-full max-w-sm space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Subtotal</span>
              <span className="font-medium text-[var(--color-text-primary)]">Rs {detail.billingSummary.totalCharges.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Total Paid</span>
              <span className="font-medium text-[var(--color-text-primary)]">Rs {detail.billingSummary.totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-lg">
              <span className="font-semibold text-[var(--color-text-primary)]">Total Due</span>
              <span className="font-display text-4xl text-[var(--color-text-primary)]">Rs {detail.billingSummary.balanceDue.toLocaleString()}</span>
            </div>
          </div>
        </footer>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="font-display text-3xl italic text-[var(--color-text-primary)]">Thank you for staying with us</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">We hope to welcome you back to La Pirogue soon.</p>
        </div>
      </article>
    </div>
  );
}

