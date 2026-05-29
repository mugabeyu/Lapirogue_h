import type { NextRequest } from 'next/server';

export function buildRegisterRedirect(request: NextRequest, token: string) {
  return new URL(`/register?token=${token}`, request.url).toString();
}