import { resend, FROM_EMAIL } from "./resend";

export async function sendGuestPortalInvitationEmail(input: {
  to: string;
  guestName: string;
  guestId: string;
  guestEmail: string;
  roomNumber?: string;
  checkIn?: string;
  checkOut?: string;
  registerUrl: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject:
        "Welcome to La Pirogue Hotel - Complete Your Guest Portal Registration",
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <h2 style="margin:0 0 12px;color:#0f766e">Guest Portal Invitation</h2>
          <p style="color:#FF0000">Hello <strong>${input.guestName}</strong>,</p>
          <p>You have been invited to access the La Pirogue Hotel guest portal. Your reservation details are below:</p>
          <table style="margin:16px 0;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#6b7280">Guest ID:</td><td style="padding:4px 0;font-weight:bold">${input.guestId}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Email:</td><td style="padding:4px 0;font-weight:bold">${input.guestEmail}</td></tr>
            ${input.roomNumber ? `<tr><td style="padding:4px 0;color:#6b7280">Room Number:</td><td style="padding:4px 0;font-weight:bold">${input.roomNumber}</td></tr>` : ""}
            ${input.checkIn ? `<tr><td style="padding:4px 0;color:#6b7280">Check-in Date:</td><td style="padding:4px 0;font-weight:bold">${input.checkIn}</td></tr>` : ""}
            ${input.checkOut ? `<tr><td style="padding:4px 0;color:#6b7280">Check-out Date:</td><td style="padding:4px 0;font-weight:bold">${input.checkOut}</td></tr>` : ""}
          </table>
          <p><a href="${input.registerUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none">Complete Registration</a></p>
          
          <p style="font-size:13px;color:#FF0000">This link expires in 48 hours. If you did not expect this invitation, disregard this email.</p>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error("GUEST PORTAL INVITATION EMAIL ERROR:", error);
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
      subject: "Welcome to La Pirogue Hotel - Complete Your Staff Registration",
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
    console.error("STAFF INVITE EMAIL ERROR:", error);
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
      subject: "Payment Confirmation - La Pirogue Hotel",
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
    console.error("PAYMENT CONFIRMATION EMAIL ERROR:", error);
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
          contentType: "application/pdf",
        },
      ],
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("INVOICE EMAIL ERROR:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: "Reset your La Pirogue Hotel password",
      html: `
        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;padding:16px;">
          <h2 style="margin:0 0 10px;color:#0f766e">Password Reset</h2>
          <p>We received a request to reset your La Pirogue Hotel account password.</p>
          <p><a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none">Reset Password</a></p>
          <p style="font-size:13px;color:#6b7280">If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("PASSWORD RESET EMAIL ERROR:", error);
    throw error;
  }
}
