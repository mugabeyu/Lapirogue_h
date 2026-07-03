import { resend, FROM_EMAIL } from "./resend";

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] ?? char,
  );
}

const LOGO_URL = "https://lapirogue-hotel.yunusu.me/lapiroguelogo.jpg";

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
      subject:
        "Welcome to La Pirogue Hotel - Complete Your Guest Portal Registration",
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
      html:
        input.summaryHtml ??
        `
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

export async function sendReservationConfirmationEmail(input: {
  to: string;
  guestName: string;
  roomNumber: string;
  roomType?: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  status: string;
  reservationId: string;
  adults?: number;
  children?: number;
  hotelName?: string;
  hotelAddress?: string;
  cancellationPolicy?: string;
  paymentStatus?: string;
  taxAmount?: number;
}) {
  const hotelName = input.hotelName || "La Pirogue Hotel Mauritius";
  const hotelAddress =
    input.hotelAddress || "La Pirogue, Belle Mare, Mauritius";
  const cancelPolicy =
    input.cancellationPolicy ||
    "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours may incur a one-night charge.";
  const paymentStatus = input.paymentStatus || "UNPAID";
  const guests =
    `${input.adults || 1} Adult(s)` +
    (input.children ? `, ${input.children} Child(ren)` : "");
  const taxAmount = input.taxAmount || Math.round(input.totalAmount * 0.15);

  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: `Reservation ${input.status === "RESERVED" ? "Confirmed for Arrival" : input.status === "CANCELLED" ? "Cancelled" : "Confirmed"} - ${hotelName}`,
      html: `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;background:#f9fafb;">
            <div style="max-width:560px;background:#ffffff;border-radius:16px;padding:40px;">
              ${logoImgTag()}

              <h2 style="margin:20px 0 8px;${input.status === "CANCELLED" ? "color:#dc2626;" : "color:#0f766e;"}font-size:24px;">
                ${input.status === "RESERVED" ? "Reservation Confirmed for Arrival" : input.status === "CANCELLED" ? "Reservation Cancelled" : "Reservation Confirmed"}
              </h2>

              <p style="font-size:16px;color:#374151;">Dear ${escapeHtml(input.guestName)},</p>

              <p style="font-size:16px;color:#374151;">
                ${input.status === "CANCELLED" ? "Your reservation has been cancelled as requested. Details of the cancelled reservation are below." : `Thank you for choosing ${escapeHtml(hotelName)}. Your reservation details are below.`}
              </p>

              <div style="margin:24px 0;padding:24px;background:#f3f4f6;border-radius:12px;">
                <h3 style="margin:0 0 16px;${input.status === "CANCELLED" ? "color:#dc2626;" : "color:#0f766e;"}font-size:18px;">${input.status === "CANCELLED" ? "Cancelled Reservation Details" : "Reservation Details"}</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Reservation #</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(input.reservationId)}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Guest Name</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(input.guestName)}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Hotel</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(hotelName)}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(hotelAddress)}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Room</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(input.roomNumber)}${input.roomType ? ` (${escapeHtml(input.roomType)})` : ""}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Check-in</td><td style="padding:6px 0;font-weight:600;">${input.checkIn}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Check-out</td><td style="padding:6px 0;font-weight:600;">${input.checkOut}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Guests</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(guests)}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Subtotal</td><td style="padding:6px 0;font-weight:600;">Rs ${input.totalAmount.toLocaleString()}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Tax (15%)</td><td style="padding:6px 0;font-weight:600;">Rs ${taxAmount.toLocaleString()}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;border-top:1px solid #d1d5db;">Total</td><td style="padding:6px 0;font-weight:700;font-size:16px;border-top:1px solid #d1d5db;color:#0f766e;">Rs ${(input.totalAmount + taxAmount).toLocaleString()}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Payment Status</td><td style="padding:6px 0;font-weight:600;color:${paymentStatus === "PAID" ? "#059669" : paymentStatus === "CANCELLED" ? "#dc2626" : "#d97706"};">${escapeHtml(paymentStatus)}</td></tr>
                </table>
              </div>

              <div style="margin:20px 0;padding:16px;background:#fef3c7;border-radius:12px;border:1px solid #f59e0b;">
                <p style="margin:0;font-size:13px;color:#92400e;"><strong>Cancellation Policy:</strong><br>${escapeHtml(cancelPolicy)}</p>
              </div>

              ${
                input.status === "RESERVED"
                  ? `
              <p style="font-size:14px;color:#6b7280;">Your reservation is verified. You will be checked in inside the guest app upon arrival at the hotel. You can pre-book activities, spa sessions, and restaurant reservations before arrival, while room service and in-stay hotel services unlock after check-in.</p>
              `
                  : input.status === "CANCELLED"
                    ? `
              <p style="font-size:14px;color:#6b7280;">If you have any questions regarding your cancellation, please contact our front desk.</p>
              `
                    : ""
              }

              <p style="font-size:14px;color:#6b7280;margin-top:24px;">${input.status === "CANCELLED" ? "We hope to welcome you again in the future." : "We look forward to welcoming you!"}</p>
              <p style="font-size:14px;color:#6b7280;">Warm regards,<br>The ${escapeHtml(hotelName)} Team</p>
            </div>
          </td></tr>
        </table>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("RESERVATION CONFIRMATION EMAIL ERROR:", error);
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

export async function sendReservationOTPEmail(input: {
  to: string;
  guestName: string;
  otpCode: string;
  hotelName?: string;
}) {
  const hotelName = input.hotelName || "La Pirogue Hotel Mauritius";

  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: `Your Verification Code - ${hotelName}`,
      html: `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:40px 20px;background:#f9fafb;">
            <div style="max-width:480px;background:#ffffff;border-radius:16px;padding:40px;text-align:center;">
              ${logoImgTag()}
              <h2 style="margin-top:24px;color:#1e293b;">Reservation Verification</h2>
              <p style="color:#475569;font-size:15px;line-height:1.6;">
                Hi ${escapeHtml(input.guestName)},<br/><br/>
                Use the code below to confirm your room reservation.
              </p>
              <div style="background:#f1f5f9;border-radius:12px;padding:16px 32px;margin:24px 0;letter-spacing:8px;font-size:36px;font-weight:700;color:#0f172a;">
                ${escapeHtml(input.otpCode)}
              </div>
              <p style="color:#94a3b8;font-size:13px;">
                This code expires in 30 minutes.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
              <p style="color:#94a3b8;font-size:12px;">
                ${escapeHtml(hotelName)}<br/>
                If you did not request this code, please ignore this email.
              </p>
            </div>
          </td></tr>
        </table>
      `,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("OTP EMAIL ERROR:", error);
    throw error;
  }
}
