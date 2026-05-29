import { resend, FROM_EMAIL } from './resend';

export async function sendGuestRoomEmail(input: {
  to: string;
  roomNumber: string;
  lastName: string;
  checkIn?: string;
  checkOut?: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: 'Welcome to La Pirogue Hotel - Your Room Information',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1f2937;">
          <h2 style="color: #0f766e;">La Pirogue Hotel</h2>
          <p>Welcome! Here are your room details:</p>
          <table style="margin: 16px 0; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #6b7280;">Last Name:</td><td style="padding: 4px 0; font-weight: bold;">${input.lastName}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Room Number:</td><td style="padding: 4px 0; font-weight: bold;">${input.roomNumber}</td></tr>
            ${input.checkIn ? `<tr><td style="padding: 4px 0; color: #6b7280;">Check-in:</td><td style="padding: 4px 0; font-weight: bold;">${input.checkIn}</td></tr>` : ''}
            ${input.checkOut ? `<tr><td style="padding: 4px 0; color: #6b7280;">Check-out:</td><td style="padding: 4px 0; font-weight: bold;">${input.checkOut}</td></tr>` : ''}
          </table>
          <p>Please keep this information safe. Enjoy your stay!</p>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('GUEST EMAIL ERROR:', error);
    throw error;
  }
}

export async function sendStaffInvitationEmail(input: {
  to: string;
  staffName: string;
  employeeCode: string;
  role: string;
  registerUrl: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: 'Welcome to La Pirogue Hotel - Complete Your Staff Registration',
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <h2 style="margin:0 0 12px;color:#0f766e">Staff Invitation</h2>
          <p>Hello <strong>${input.staffName}</strong>,</p>
          <p>You have been invited to join La Pirogue Hotel.</p>
          <table style="margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#6b7280">Employee Code:</td><td style="padding:4px 0;font-weight:bold">${input.employeeCode}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Role:</td><td style="padding:4px 0;font-weight:bold">${input.role}</td></tr>
          </table>
          <p><a href="${input.registerUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none">Complete Registration</a></p>
          <p style="font-size:13px;color:#6b7280">This link expires in 48 hours. If you did not expect this invitation, disregard this email.</p>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('STAFF INVITE EMAIL ERROR:', error);
    throw error;
  }
}

export async function sendPaymentConfirmationEmail(input: {
  to: string;
  guestName: string;
  amount: number;
  paymentMethod: string;
  reference: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: 'Payment Confirmation - La Pirogue Hotel',
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <h2 style="margin:0 0 12px;color:#0f766e">Payment Confirmation</h2>
          <p>Hello <strong>${input.guestName}</strong>,</p>
          <p>Your payment has been received.</p>
          <table style="margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#6b7280">Amount:</td><td style="padding:4px 0;font-weight:bold">MUR ${input.amount.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Method:</td><td style="padding:4px 0;font-weight:bold">${input.paymentMethod}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Reference:</td><td style="padding:4px 0;font-weight:bold">${input.reference}</td></tr>
          </table>
          <p>Thank you for your stay.</p>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('PAYMENT CONFIRMATION EMAIL ERROR:', error);
    throw error;
  }
}

export async function sendInvoiceEmail(input: {
  to: string;
  guestName: string;
  invoiceReference: string;
  pdfBase64: string;
}) {
  try {
    const summaryHtml = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;padding:16px;">
        <h2 style="margin:0 0 10px;color:#0f766e">Your Invoice Is Attached</h2>
        <p>Hello <strong>${input.guestName}</strong>,</p>
        <p>Your invoice <strong>#${input.invoiceReference}</strong> is attached as a PDF receipt.</p>
        <p>You can download and keep it for your records.</p>
      </div>
    `;

    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: `Invoice ${input.invoiceReference} - La Pirogue Hotel`,
      html: summaryHtml,
      attachments: [
        {
          filename: `invoice-${input.invoiceReference}.pdf`,
          content: input.pdfBase64,
          contentType: 'application/pdf',
        },
      ],
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('INVOICE EMAIL ERROR:', error);
    throw error;
  }
}