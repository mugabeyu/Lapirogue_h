import { NextRequest, NextResponse } from 'next/server';
import { loadGuestProfileData } from '@/lib/guest-profile';

export async function GET(_request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const profile = await loadGuestProfileData(id);

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch guest profile' }, { status: 500 });
  }
}