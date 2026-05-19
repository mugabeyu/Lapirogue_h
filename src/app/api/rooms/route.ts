import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const roomSchema = z.object({
  roomNumber: z.string().min(1),
  type: z.enum(['STANDARD', 'DELUXE', 'SUITE', 'VILLA']),
  floor: z.string().optional(),
  capacity: z.number().int().positive(),
  price: z.number().positive(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']).optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

type RoomRow = {
  id: string;
  room_number?: string | null;
  type?: string | null;
  floor?: string | null;
  capacity?: number | null;
  price?: number | string | null;
  status?: string | null;
  description?: string | null;
  amenities?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function toRoom(row: RoomRow) {
  return {
    id: row.id,
    roomNumber: row.room_number ?? '',
    type: row.type ?? 'STANDARD',
    floor: row.floor ?? undefined,
    capacity: row.capacity ?? 1,
    price: row.price === undefined || row.price === null ? 0 : Number(row.price),
    status: row.status ?? 'AVAILABLE',
    description: row.description ?? undefined,
    amenities: row.amenities ?? [],
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const checkIn = searchParams.get('checkIn') || undefined;
    const checkOut = searchParams.get('checkOut') || undefined;

    const supabase = getSupabaseAdmin();

    if (checkIn && checkOut) {
      const { data: occupiedRooms, error: occupiedError } = await supabase
        .from('reservations')
        .select('room_id')
        .or(`and(check_in.lte.${checkOut},check_out.gte.${checkIn})`)
        .neq('status', 'CANCELLED');

      if (occupiedError) throw occupiedError;

      const occupiedRoomIds = new Set(((occupiedRooms ?? []) as { room_id?: string }[]).map((r) => r.room_id));

      let query = supabase
        .from('rooms')
        .select('*', { count: 'exact' })
        .order('room_number', { ascending: true });

      if (type) query = query.eq('type', type);

      const { data, error } = await query;

      if (error) throw error;

      const availableRooms = (data ?? []) as RoomRow[];
      const filtered = availableRooms.filter((r) => !occupiedRoomIds.has(r.id));

      return NextResponse.json({
        success: true,
        data: filtered.map((row) => toRoom(row)),
        pagination: {
          total: filtered.length,
          page: 1,
          limit: filtered.length,
          totalPages: 1,
        },
      });
    }

    let query = supabase
      .from('rooms')
      .select('*', { count: 'exact' })
      .order('room_number', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const rooms = (data ?? []) as RoomRow[];
    const mapped = rooms.map((row) => toRoom(row));
    const total = count ?? 0;

    return NextResponse.json({
      success: true,
      data: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = roomSchema.parse(body);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        room_number: validatedData.roomNumber,
        type: validatedData.type,
        floor: validatedData.floor,
        capacity: validatedData.capacity,
        price: validatedData.price,
        status: validatedData.status ?? 'AVAILABLE',
        description: validatedData.description,
        amenities: validatedData.amenities ?? [],
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: toRoom(data),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = roomSchema.extend({ id: z.string().uuid() }).parse(body);
    const { id, ...updateData } = validatedData;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('rooms')
      .update({
        room_number: updateData.roomNumber,
        type: updateData.type,
        floor: updateData.floor,
        capacity: updateData.capacity,
        price: updateData.price,
        status: updateData.status,
        description: updateData.description,
        amenities: updateData.amenities,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: toRoom(data),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update room' },
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
    const { error } = await getSupabaseAdmin().from('rooms').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Room deleted' });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete room' }, { status: 500 });
  }
}
