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

export async function sendGuestWelcomeEmailWithCredentials(input: {
  to: string;
  guestName: string;
  email: string;
  temporaryPassword: string;
  roomNumber: string;
  checkIn?: string;
  checkOut?: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: 'Welcome to La Pirogue Hotel - Your Mobile App Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e; text-align: center;">Welcome to La Pirogue Hotel</h2>
          <p>Dear ${input.guestName},</p>
          <p>Thank you for choosing La Pirogue Hotel. We are delighted to have you with us.</p>
          
          <div style="background: #f0fdf4; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #0f766e; margin-top: 0;">Mobile App Login Credentials</h3>
            <p>You can access our mobile app using the following credentials:</p>
            <table style="margin: 12px 0; border-collapse: collapse; width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Email:</td>
                <td style="padding: 8px 12px; font-weight: bold; color: #0f2742;">${input.email}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Temporary Password:</td>
                <td style="padding: 8px 12px; font-weight: bold; color: #0f2742; font-family: monospace; font-size: 16px;">${input.temporaryPassword}</td>
              </tr>
            </table>
          </div>

          <div style="background: #eff6ff; padding: 16px; margin: 20px 0; border-radius: 4px; border-left: 4px solid #2563eb;">
            <h3 style="color: #2563eb; margin-top: 0;">Your Stay Details</h3>
            <table style="margin: 8px 0; border-collapse: collapse;">
              ${input.roomNumber ? `<tr><td style="padding: 6px 0; color: #6b7280;">Room:</td><td style="padding: 6px 12px; font-weight: bold;">${input.roomNumber}</td></tr>` : ''}
              ${input.checkIn ? `<tr><td style="padding: 6px 0; color: #6b7280;">Check-in:</td><td style="padding: 6px 12px; font-weight: bold;">${input.checkIn}</td></tr>` : ''}
              ${input.checkOut ? `<tr><td style="padding: 6px 0; color: #6b7280;">Check-out:</td><td style="padding: 6px 12px; font-weight: bold;">${input.checkOut}</td></tr>` : ''}
            </table>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #0f2742;">How to Access the Mobile App</h3>
            <ol style="color: #374151; line-height: 1.8;">
              <li>Download the <strong>La Pirogue Hotel</strong> mobile app from your device's app store.</li>
              <li>Open the app and select <strong>"Sign In"</strong>.</li>
              <li>Enter your email address and temporary password.</li>
              <li><strong>On first login, you will be prompted to change your temporary password.</strong></li>
            </ol>
          </div>

          <div style="background: #fef3c7; padding: 14px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #d97706;">
            <p style="margin: 0; color: #92400e;"><strong>Security Note:</strong> For your security, please change your temporary password after your first login. Do not share your credentials with anyone.</p>
          </div>

          <p style="margin-top: 24px; color: #6b7280;">If you have any questions or need assistance, please contact our reception desk at <a href="mailto:reception@lapirogue-hotel.mu" style="color: #0f766e;">reception@lapirogue-hotel.mu</a>.</p>
          <p>We look forward to serving you!</p>
          <p style="color: #6b7280; font-size: 14px;">Warm regards,<br><strong>The La Pirogue Hotel Team</strong></p>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('GUEST WELCOME EMAIL ERROR:', error);
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

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}) {
  try {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject: 'Reset your La Pirogue Hotel password',
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
    console.error('PASSWORD RESET EMAIL ERROR:', error);
    throw error;
  }
}
