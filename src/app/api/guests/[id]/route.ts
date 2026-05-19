import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const guestUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  passport: z.string().optional(),
  dateOfBirth: z.string().optional(),
  vip: z.boolean().optional(),
  status: z.enum(['RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

type GuestRow = {
  id: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  passport: string | null;
  date_of_birth: string | null;
  vip: boolean;
  status: string;
  notes: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

function toGuest(row: GuestRow) {
  return {
    id: row.id,
    guestId: row.guest_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    nationality: row.nationality ?? undefined,
    passport: row.passport ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    vip: row.vip,
    status: row.status,
    notes: row.notes ?? undefined,
    imagePath: row.image_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: guest, error } = await getSupabaseAdmin()
      .from('guests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !guest) {
      return NextResponse.json(
        { success: false, error: 'Guest not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toGuest(guest as GuestRow),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guest' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = guestUpdateSchema.parse(body);

    const updatePayload: Record<string, unknown> = {};
    if (validatedData.firstName !== undefined) updatePayload.first_name = validatedData.firstName;
    if (validatedData.lastName !== undefined) updatePayload.last_name = validatedData.lastName;
    if (validatedData.email !== undefined) updatePayload.email = validatedData.email;
    if (validatedData.phone !== undefined) updatePayload.phone = validatedData.phone;
    if (validatedData.nationality !== undefined) updatePayload.nationality = validatedData.nationality;
    if (validatedData.passport !== undefined) updatePayload.passport = validatedData.passport;
    if (validatedData.dateOfBirth !== undefined) updatePayload.date_of_birth = validatedData.dateOfBirth;
    if (validatedData.vip !== undefined) updatePayload.vip = validatedData.vip;
    if (validatedData.status !== undefined) updatePayload.status = validatedData.status;
    if (validatedData.notes !== undefined) updatePayload.notes = validatedData.notes;

    const { data: guest, error } = await getSupabaseAdmin()
      .from('guests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !guest) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: toGuest(guest as GuestRow),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update guest' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from('guests').delete().eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Guest deleted successfully',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete guest' },
      { status: 500 }
    );
  }
}
