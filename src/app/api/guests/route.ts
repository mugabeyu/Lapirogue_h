import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuditActor, recordAuditLog } from "@/lib/audit";
import { z } from "zod";
import { validationErrorResponse, createApiResponse } from "@/lib/api-response";
import { toGuest, type GuestRow } from "@/lib/guests";

const guestSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  nationality: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().optional(),
  ),
  passport: z.string().optional(),
  dateOfBirth: z.string().optional(),
  vip: z.boolean().optional(),
  status: z
    .enum(["RESERVED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"])
    .optional(),
  accountStatus: z
    .enum(["PENDING", "ACTIVE", "FROZEN", "BANNED"])
    .optional(),
  notes: z.string().optional(),
});

async function generateGuestId() {
  const timestamp = Date.now().toString().slice(-6);
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `G-${timestamp}${suffix}`;
}

function generateTempPassword(firstName: string, roomNumber?: string): string {
  const base = `${firstName}${roomNumber || ""}@lapirogue`;
  return base.toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || undefined;
    const accountStatus = searchParams.get("accountStatus") || undefined;

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("guests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,passport.ilike.%${search}%`,
      );
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (accountStatus) {
      query = query.eq("account_status", accountStatus);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const guestRows = (data ?? []) as GuestRow[];
    const guestIds = guestRows.map((row) => row.id);

    const stayByGuest = new Map<
      string,
      {
        checkIn: string;
        checkOut: string;
        roomNumber: string | null;
        roomType: string | null;
      }
    >();

    if (guestIds.length > 0) {
      const { data: stays } = await supabase
        .from("reservations")
        .select("guest_id,check_in,check_out,status,rooms(room_number,type)")
        .in("guest_id", guestIds)
        .neq("status", "CANCELLED")
        .order("check_in", { ascending: false });

      for (const stay of stays ?? []) {
        const guestId = stay.guest_id as string;
        if (stayByGuest.has(guestId)) continue;
        const room = stay.rooms as {
          room_number?: string;
          type?: string;
        } | null;
        stayByGuest.set(guestId, {
          checkIn: stay.check_in as string,
          checkOut: stay.check_out as string,
          roomNumber: room?.room_number ?? null,
          roomType: room?.type ?? null,
        });
      }
    }

    let guests = guestRows.map((row) => {
      const stay = stayByGuest.get(row.id);
      return {
        ...toGuest(row),
        checkIn: stay?.checkIn,
        checkOut: stay?.checkOut,
        roomNumber: stay?.roomNumber,
        roomType: stay?.roomType,
      };
    });

    if (search) {
      const query = search.toLowerCase();
      guests = guests.filter((guest) => {
        const name = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        const room = guest.roomNumber?.toLowerCase() ?? "";
        const guestCode = guest.guestId.toLowerCase();
        return (
          name.includes(query) ||
          room.includes(query) ||
          guestCode.includes(query) ||
          guest.email?.toLowerCase().includes(query)
        );
      });
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createApiResponse(
      false,
      process.env.NODE_ENV === "production"
        ? "Failed to fetch guests"
        : `Failed to fetch guests: ${message}`,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const validatedData = guestSchema.parse(body);
    const guestId = await generateGuestId();

    const { data, error } = await supabase
      .from("guests")
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
        status: validatedData.status ?? "RESERVED",
        account_status: "PENDING",
        notes: validatedData.notes,
      })
      .select("*")
      .single();

    if (error || !data) throw error;
    return createApiResponse(true, toGuest(data as GuestRow), { status: 201 });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return createApiResponse(false, "Failed to create guest", { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = guestSchema.parse(body);
    const supabase = getSupabaseAdmin();
    await getAuditActor(request); // actor not currently used but reserved for future audit

    const updatePayload: Record<string, unknown> = {
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
    };

    // Only MANAGER role can update account_status
    if (updateData.accountStatus) {
      updatePayload.account_status = updateData.accountStatus;
    }

    const { data, error } = await supabase
      .from("guests")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) throw error;
    return createApiResponse(true, toGuest(data as GuestRow));
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    return createApiResponse(false, "Failed to update guest", { status: 500 });
  }
}

export async function DELETE() {
  // Guests are never deleted from the system per financial audit policy
  return createApiResponse(
    false,
    "Guests cannot be deleted. To restrict access, freeze or ban the guest account instead.",
    { status: 403 },
  );
}
