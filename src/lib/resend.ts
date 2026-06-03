import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY?.trim();
if (!resendApiKey) {
  console.warn('RESEND_API_KEY is not configured. Email sending will fail.');
}

export const resend = new Resend(resendApiKey ?? '');

export const FROM_EMAIL = 'Lapirogue Hotel <no-reply@send.lapirogue-hotel.yunusu.me>';
