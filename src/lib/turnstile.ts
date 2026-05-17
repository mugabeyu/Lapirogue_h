import 'server-only';

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstileToken(token?: string): Promise<{ success: boolean }> {
  if (!TURNSTILE_SECRET_KEY) {
    return { success: true };
  }

  if (!token) {
    return { success: false };
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  if (!response.ok) {
    return { success: false };
  }

  const data = (await response.json()) as { success?: boolean };

  return { success: Boolean(data.success) };
}