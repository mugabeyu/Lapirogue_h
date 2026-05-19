import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const guestSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
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

async function generateGuestId() {
  const timestamp = Date.now().toString().slice(-6);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `G-${timestamp}${suffix}`;
}

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || undefined;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('guests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,passport.ilike.%${search}%`,
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const guestRows = (data ?? []) as GuestRow[];
    const guestIds = guestRows.map((row) => row.id);

    let stayByGuest = new Map<string, { checkIn: string; checkOut: string; roomNumber: string | null; roomType: string | null }>();

    if (guestIds.length > 0) {
      const { data: stays } = await supabase
        .from('reservations')
        .select('guest_id,check_in,check_out,status,rooms(room_number,type)')
        .in('guest_id', guestIds)
        .neq('status', 'CANCELLED')
        .order('check_in', { ascending: false });

      for (const stay of stays ?? []) {
        const guestId = stay.guest_id as string;
        if (stayByGuest.has(guestId)) continue;
        const room = stay.rooms as { room_number?: string; type?: string } | null;
        stayByGuest.set(guestId, {
          checkIn: stay.check_in as string,
          checkOut: stay.check_out as string,
          roomNumber: room?.room_number ?? null,
          roomType: room?.type ?? null,
        });
      }
    }

    const guests = guestRows.map((row) => {
      const stay = stayByGuest.get(row.id);
      return {
        ...toGuest(row),
        checkIn: stay?.checkIn,
        checkOut: stay?.checkOut,
        roomNumber: stay?.roomNumber,
        roomType: stay?.roomType,
      };
    });
    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: guests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = guestSchema.parse(body);
    const supabase = getSupabaseAdmin();
    const guestId = await generateGuestId();

    const { data, error } = await supabase
      .from('guests')
      .insert({
        guest_id: guestId,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        email: validatedData.email,
        phone: validatedData.phone,
        nationality: validatedData.nationality,
        passport: validatedData.passport,
        date_of_birth: validatedData.dateOfBirth,
        vip: validatedData.vip ?? false,
        status: validatedData.status ?? 'RESERVED',
        notes: validatedData.notes,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: toGuest(data as GuestRow),
    }, { status: 201 });
  } catch (error) {
    console.error('Guest create failed:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create guest',
        details: error instanceof Error ? error.message : JSON.stringify(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = guestSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('guests')
      .update({
        first_name: updateData.firstName,
        last_name: updateData.lastName,
        email: updateData.email,
        phone: updateData.phone,
        nationality: updateData.nationality,
        passport: updateData.passport,
        date_of_birth: updateData.dateOfBirth,
        vip: updateData.vip,
        status: updateData.status,
        notes: updateData.notes,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: toGuest(data as GuestRow),
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from('guests').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Guest deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete guest' }, { status: 500 });
  }
}
