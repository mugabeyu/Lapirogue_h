import { NextResponse } from 'next/server';
import { z } from 'zod';

export function createApiResponse(success: boolean, data: unknown, options?: { status?: number; meta?: Record<string, unknown> }) {
  const { status = success ? 200 : 500, meta } = options ?? {};
  return NextResponse.json(
    success ? { success: true, data, ...(meta ?? {}) } : { success: false, error: data },
    { status }
  );
}

export function validationErrorResponse(error: unknown, message = 'Validation error') {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ success: false, error: message, details: error.errors }, { status: 400 });
  }
  return null;
}

export function handleError(error: unknown, fallbackMessage: string) {
  console.error(fallbackMessage, error);
  const message = error instanceof Error ? error.message : fallbackMessage;
  return createApiResponse(false, message, { status: 500 });
}