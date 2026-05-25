import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { awardEcoPoints, removeEcoPointsBySource } from '@/lib/eco-points';

const awardSchema = z.object({
  sourceType: z.enum(['ACTIVITY_BOOKING', 'SERVICE_REQUEST', 'MANUAL']),
  sourceRecordId: z.string().uuid(),
  guestId: z.string().uuid(),
  activityName: z.string().optional().nullable(),
  activityCategory: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  points: z.number().int().positive().optional().nullable(),
  carbonOffsetKg: z.number().min(0).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const revokeSchema = z.object({
  sourceType: z.enum(['ACTIVITY_BOOKING', 'SERVICE_REQUEST', 'MANUAL']),
  sourceRecordId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = awardSchema.parse(await request.json());
    const result = await awardEcoPoints({
      sourceType: body.sourceType,
      sourceRecordId: body.sourceRecordId,
      guestId: body.guestId,
      activityName: body.activityName,
      activityCategory: body.activityCategory,
      label: body.label,
      points: body.points ?? undefined,
      carbonOffsetKg: body.carbonOffsetKg ?? undefined,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to award eco points' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = revokeSchema.parse(await request.json());
    await removeEcoPointsBySource(body.sourceType, body.sourceRecordId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Failed to revoke eco points' }, { status: 500 });
  }
}
