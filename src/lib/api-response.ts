import { NextResponse } from 'next/server';
import { z } from 'zod';

export function validationErrorResponse(error: unknown, message = 'Validation error') {
  if (!(error instanceof z.ZodError)) return null;
  return NextResponse.json({ success: false, error: message, details: error.errors }, { status: 400 });
}