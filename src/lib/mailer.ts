import { resend, FROM_EMAIL } from './resend';

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}

const LOGO_URL = 'https://lapirogue-hotel.yunusu.me/lapiroguelogo.jpg';

function logoImgTag() {
  return `<img src="${LOGO_URL}" alt="La Pirogue Hotel" style="max-width: 200px; height: auto; display: block;" />`;
}

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
      subject: "Welcome to La Pirogue Hotel - Complete Your Guest Portal Registration",
      html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <tr><td style="padding:16px;">
            <div style="margin-bottom: 20px;">
              ${logoImgTag()}
            </div>

            <h2 style="margin:0 0 12px;color:#0f766e;font-size:24px;">Guest Portal Invitation</h2>

            <p style="color:#dc2626;font-size:16px;">Hello <strong>${escapeHtml(input.guestName)}</strong>,</p>

            <p style="font-size:16px;">You have been invited to access the La Pirogue Hotel guest portal. Your reservation details are below:</p>

            <table role="presentation" style="margin:16px 0;border-collapse:collapse;font-size:16px;width:100%;">
              <tr><td style="padding:4px 0;color:#6b7280;width:140px;">Guest ID:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.guestId)}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Email:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.guestEmail)}</td></tr>
              ${input.roomNumber ? `<tr><td style="padding:4px 0;color:#6b7280">Room Number:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.roomNumber)}</td></tr>` : ""}
              ${input.checkIn ? `<tr><td style="padding:4px 0;color:#6b7280">Check-in Date:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.checkIn)}</td></tr>` : ""}
              ${input.checkOut ? `<tr><td style="padding:4px 0;color:#6b7280">Check-out Date:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.checkOut)}</td></tr>` : ""}
            </table>

            <p style="margin:20px 0;"><a href="${input.registerUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">Complete Registration</a></p>

            <p style="font-size:16px;margin-top:24px;">Thank you for choosing La Pirogue Hotel. We are thrilled to host you and our entire team is fully ready to serve you to ensure you have an unforgettable stay.</p>

            <p style="font-size:14px;color:#dc2626;margin-top:20px;">This link expires in 48 hours. If you did not expect this invitation, disregard this email.</p>
          </td></tr>
        </table>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <tr><td style="padding:16px;">
            <div style="margin-bottom: 20px;">
              ${logoImgTag()}
            </div>

            <h2 style="margin:0 0 12px;color:#0f766e;font-size:24px;">Staff Invitation</h2>

            <p style="font-size:16px;">Hello <strong>${escapeHtml(input.staffName)}</strong>,</p>

            <p style="font-size:16px;">You have been invited to join La Pirogue Hotel. Your staff profile setup details are below:</p>

            <table role="presentation" style="margin:16px 0;border-collapse:collapse;font-size:16px;width:100%;">
              <tr><td style="padding:4px 0;color:#6b7280;width:140px;">Employee Code:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.employeeCode)}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Role:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.role)}</td></tr>
            </table>

            <p style="margin:20px 0;"><a href="${input.registerUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">Complete Registration</a></p>

            <p style="font-size:16px;margin-top:24px;">Thank you for choosing to build your career with La Pirogue Hotel. We are thrilled to welcome you to the family, and our team is ready to support you as we work together to serve our guests with excellence.</p>

            <p style="font-size:14px;color:#6b7280;margin-top:20px;">This link expires in 48 hours. If you did not expect this invitation, disregard this email.</p>
          </td></tr>
        </table>
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <tr><td style="padding:16px;">
            <div style="margin-bottom: 20px;">
              ${logoImgTag()}
            </div>

            <h2 style="margin:0 0 12px;color:#0f766e;font-size:24px;">Payment Confirmation</h2>

            <p style="font-size:16px;">Hello <strong>${escapeHtml(input.guestName)}</strong>,</p>

            <p style="font-size:16px;">Your payment has been successfully received. Your transaction details are outlined below:</p>

            <table role="presentation" style="margin:16px 0;border-collapse:collapse;font-size:16px;width:100%;">
              <tr><td style="padding:4px 0;color:#6b7280;width:140px;">Amount:</td><td style="padding:4px 0;font-weight:bold">MUR ${input.amount.toFixed(2)}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Method:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.paymentMethod)}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280">Reference:</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(input.reference)}</td></tr>
            </table>

            <p style="font-size:16px;margin-top:24px;">Thank you for choosing La Pirogue Hotel. We are thrilled to host you and our entire team is fully ready to serve you to ensure you have an unforgettable stay.</p>
          </td></tr>
        </table>
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
  summaryHtml?: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: `Invoice ${input.invoiceReference} - La Pirogue Hotel`,
      html: input.summaryHtml ?? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <tr><td style="padding:16px;">
            <div style="margin-bottom: 20px;">
              ${logoImgTag()}
            </div>

            <h2 style="margin:0 0 12px;color:#0f766e;font-size:24px;">Your Invoice Is Attached</h2>

            <p style="font-size:16px;">Hello <strong>${escapeHtml(input.guestName)}</strong>,</p>

            <p style="font-size:16px;">Your invoice <strong>#${escapeHtml(input.invoiceReference)}</strong> is attached as a PDF receipt.</p>

            <p style="font-size:16px;">You can download and keep it for your records.</p>

            <p style="font-size:16px;margin-top:24px;">Thank you for choosing La Pirogue Hotel. We are thrilled to host you and our entire team is fully ready to serve you to ensure you have an unforgettable stay.</p>
          </td></tr>
        </table>
      `,
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

export async function sendOtpEmail(to: string, otp: string, name: string) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your La Pirogue verification code',
      html: `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;background:#f9fafb;">
            <div style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px;text-align:center;">
              ${logoImgTag()}

              <h2 style="margin:20px 0 8px;color:#0f766e;font-size:24px;">Verify your email</h2>

              <p style="font-size:16px;color:#374151;">Hi ${escapeHtml(name)},</p>

              <p style="font-size:16px;color:#374151;">Use the code below to complete your registration:</p>

              <div style="margin:24px 0;padding:16px;background:#f3f4f6;border-radius:12px;font-size:36px;font-weight:bold;letter-spacing:8px;color:#0f766e;font-family:monospace;">
                ${otp}
              </div>

              <p style="font-size:14px;color:#6b7280;">This code expires in 10 minutes.</p>

              <p style="font-size:14px;color:#6b7280;margin-top:20px;">If you did not request this, please ignore this email.</p>
            </div>
          </td></tr>
        </table>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('OTP EMAIL ERROR:', error);
    throw error;
  }
}

export async function sendReservationConfirmationEmail(input: {
  to: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  status: string;
  reservationId: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: `Reservation ${input.status === 'RESERVED' ? 'Request' : 'Confirmed'} - La Pirogue Hotel`,
      html: `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;background:#f9fafb;">
            <div style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px;">
              ${logoImgTag()}

              <h2 style="margin:20px 0 8px;color:#0f766e;font-size:24px;">
                ${input.status === 'RESERVED' ? 'Reservation Request Received' : 'Reservation Confirmed'}
              </h2>

              <p style="font-size:16px;color:#374151;">Dear ${escapeHtml(input.guestName)},</p>

              <p style="font-size:16px;color:#374151;">
                ${input.status === 'RESERVED' ? 'Your reservation request has been received and will be confirmed at check-in.' : 'Your reservation has been confirmed.'}
              </p>

              <div style="margin:20px 0;padding:16px;background:#f3f4f6;border-radius:12px;">
                <p style="margin:4px 0;"><strong>Room:</strong> ${escapeHtml(input.roomNumber)}</p>
                <p style="margin:4px 0;"><strong>Check-in:</strong> ${input.checkIn}</p>
                <p style="margin:4px 0;"><strong>Check-out:</strong> ${input.checkOut}</p>
                <p style="margin:4px 0;"><strong>Total:</strong> Rs ${input.totalAmount.toLocaleString()}</p>
                <p style="margin:4px 0;"><strong>Reference:</strong> ${escapeHtml(input.reservationId)}</p>
              </div>

              ${input.status === 'RESERVED' ? `
              <p style="font-size:14px;color:#6b7280;">Please proceed to the front desk at check-in to complete your reservation. Your room service and activity booking features will unlock upon check-in.</p>
              ` : ''}

              <p style="font-size:14px;color:#6b7280;margin-top:20px;">Thank you for choosing La Pirogue Hotel.</p>
            </div>
          </td></tr>
        </table>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('RESERVATION CONFIRMATION EMAIL ERROR:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: "Reset your La Pirogue Hotel password",
      html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
          <tr><td style="padding:16px;">
            <div style="margin-bottom: 20px;">
              ${logoImgTag()}
            </div>

            <h2 style="margin:0 0 12px;color:#0f766e;font-size:24px;">Password Reset</h2>

            <p style="font-size:16px;">We received a request to reset your La Pirogue Hotel account password.</p>

            <p style="margin:20px 0;"><a href="${input.resetUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">Reset Password</a></p>

            <p style="font-size:14px;color:#6b7280;margin-top:20px;">If you did not request this, you can safely ignore this email.</p>
          </td></tr>
        </table>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("PASSWORD RESET EMAIL ERROR:", error);
    throw error;
  }
}