import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuditActor, recordAuditLog } from "@/lib/audit";
import { z } from "zod";
import { createApiResponse, validationErrorResponse } from "@/lib/api-response";
import { sendGuestPortalInvitationEmail } from "@/lib/mailer";

const reservationSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.number().int().positive(),
  children: z.number().int().min(0),
  totalAmount: z.number().min(0),
  status: z
    .enum(["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
    .optional(),
});

type ReservationRow = {
  id: string;
  reservation_id?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  adults?: number | null;
  children?: number | null;
  status?: string | null;
  total_amount?: number | string | null;
  guests?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    auth_id?: string | null;
  } | null;
  rooms?: { room_number?: string | null; type?: string | null } | null;
};

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const guestId = request.nextUrl.searchParams.get("guestId") ?? "";
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("reservations")
      .select(
        "id,reservation_id,guest_id,room_id,check_in,check_out,adults,children,status,total_amount,guests(first_name,last_name,email),rooms(room_number,type)",
      )
      .order("created_at", { ascending: false });

    if (guestId) {
      query = query.eq("guest_id", guestId);
    }

    if (search) {
      query = query.or(`reservation_id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ReservationRow[];
    const mapped = rows.map((reservation) => ({
      id: reservation.id,
      reservationId: reservation.reservation_id ?? null,
      guestId:
        (reservation as ReservationRow & { guest_id?: string }).guest_id ??
        null,
      roomId:
        (reservation as ReservationRow & { room_id?: string }).room_id ?? null,
      guest: reservation.guests
        ? `${reservation.guests.first_name ?? ""} ${reservation.guests.last_name ?? ""}`.trim() ||
          null
        : null,
      room: reservation.rooms?.room_number ?? null,
      roomType: reservation.rooms?.type ?? null,
      checkIn: reservation.check_in ?? null,
      checkOut: reservation.check_out ?? null,
      adults: reservation.adults ?? 0,
      children: reservation.children ?? 0,
      status: reservation.status ?? null,
      totalAmount:
        reservation.total_amount === undefined ||
        reservation.total_amount === null
          ? 0
          : Number(reservation.total_amount),
    }));

    return createApiResponse(true, mapped);
  } catch {
    return createApiResponse(false, "Failed to fetch reservations");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = reservationSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    await getAuditActor(request);

    const { data: conflicting, error: conflictError } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", body.roomId)
      .or(`and(check_in.lte.${body.checkOut},check_out.gte.${body.checkIn})`)
      .neq("status", "CANCELLED");

    if (conflictError) throw conflictError;
    if (conflicting && conflicting.length > 0) {
      return createApiResponse(
        false,
        "Room is not available for the selected dates",
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        guest_id: body.guestId,
        room_id: body.roomId,
        check_in: body.checkIn,
        check_out: body.checkOut,
        adults: body.adults,
        children: body.children,
        total_amount: body.totalAmount,
        status: body.status ?? "CONFIRMED",
      })
      .select("*")
      .single();

    if (error) throw error;

    const [{ data: guestRow }, { data: roomRow }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name,last_name,email,auth_id")
        .eq("id", body.guestId)
        .maybeSingle(),
      supabase
        .from("rooms")
        .select("room_number,type")
        .eq("id", body.roomId)
        .maybeSingle(),
    ]);

    if (guestRow?.email && roomRow?.room_number) {
      const baseUrl = request.nextUrl.origin;
      const registerUrl = `${baseUrl}/register?guestId=${guestRow.auth_id ?? body.guestId}`;

      await sendGuestPortalInvitationEmail({
        to: guestRow.email,
        guestName:
          `${guestRow.first_name ?? ""} ${guestRow.last_name ?? "Guest"}`.trim(),
        guestId: guestRow.auth_id ?? "TBA",
        guestEmail: guestRow.email,
        roomNumber: roomRow.room_number,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        registerUrl: registerUrl,
      }).catch((emailError) => {
        console.warn(
          "Guest portal invitation email could not be sent on POST:",
          emailError,
        );
      });
    }

    return createApiResponse(true, data, { status: 201 });
  } catch (error) {
    const validationResponse = validationErrorResponse(
      error,
      "Validation error",
    );

    if (validationResponse) return validationResponse;
    return createApiResponse(false, "Failed to create reservation");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reservationSchema
      .extend({ id: z.string().uuid() })
      .parse(body);
    const {
      id,
      guestId,
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      totalAmount,
      status,
    } = parsed;
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;

    if (status === "CHECKED_IN") {
      const today = toDateKey();
      if (today < checkIn || today >= checkOut) {
        return createApiResponse(
          false,
          "Check-in is only allowed on or after check-in and before check-out",
          { status: 400 },
        );
      }
    }

    const { data: previousReservation, error: previousReservationError } =
      await supabase
        .from("reservations")
        .select(
          "id,reservation_id,guest_id,room_id,check_in,check_out,status,guests(first_name,last_name,email),rooms(room_number,type)",
        )
        .eq("id", id)
        .maybeSingle();

    if (previousReservationError) throw previousReservationError;

    const { data: conflicting, error: conflictError } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", roomId)
      .or(`and(check_in.lte.${checkOut},check_out.gte.${checkIn})`)
      .neq("status", "CANCELLED")
      .neq("id", id);

    if (conflictError) throw conflictError;

    if (conflicting && conflicting.length > 0) {
      return createApiResponse(
        false,
        "Room is not available for the selected dates",
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("reservations")
      .update({
        guest_id: guestId,
        room_id: roomId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        total_amount: totalAmount,
        status,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
      await supabase.from("guests").update({ status }).eq("id", guestId);
    }

    const [{ data: guestRow }, { data: roomRow }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name,last_name,email,auth_id")
        .eq("id", guestId)
        .maybeSingle(),
      supabase
        .from("rooms")
        .select("room_number,type")
        .eq("id", roomId)
        .maybeSingle(),
    ]);

    const shouldSendGuestEmail = Boolean(
      previousReservation &&
      roomRow?.room_number &&
      (previousReservation.room_id !== roomId ||
        (status === "CHECKED_IN" &&
          previousReservation.status !== "CHECKED_IN")),
    );

    if (shouldSendGuestEmail && guestRow?.email) {
      try {
        const baseUrl = request.nextUrl.origin;
        const registerUrl = `${baseUrl}/register?guestId=${guestRow.auth_id ?? guestId}`;

        await sendGuestPortalInvitationEmail({
          to: guestRow.email,
          guestName:
            `${guestRow.first_name ?? ""} ${guestRow.last_name ?? "Guest"}`.trim(),
          guestId: guestRow.auth_id ?? "TBA",
          guestEmail: guestRow.email,
          roomNumber: roomRow?.room_number ?? "TBA",
          checkIn: checkIn,
          checkOut: checkOut,
          registerUrl: registerUrl,
        });
      } catch (emailError) {
        console.warn("Guest room email could not be sent on PUT:", emailError);
      }
    }

    return createApiResponse(true, data);
  } catch (error) {
    const validationResponse = validationErrorResponse(
      error,
      "Validation error",
    );
    if (validationResponse) return validationResponse;
    return createApiResponse(false, "Failed to update reservation");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    if (!id) return createApiResponse(false, "ID required", { status: 400 });
    const supabase = getSupabaseAdmin();
    const actor = await getAuditActor(request);
    const actorId = actor?.id ?? null;
    const { data: reservation } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (reservation) {
      try {
        await recordAuditLog({
          tableName: "reservations",
          recordId: id,
          action: "DELETE",
          actorId,
          before: reservation as Record<string, unknown>,
        });
      } catch (auditError) {
        console.warn("Reservation audit log skipped", auditError);
      }
    }

    const [{ count: paymentCount }] = await Promise.all([
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("reservation_id", id),
    ]);

    const blockers: string[] = [];
    if (paymentCount && paymentCount > 0)
      blockers.push(`${paymentCount} payment/invoice record(s)`);

    if (blockers.length > 0) {
      return createApiResponse(
        false,
        `Cannot delete reservation: referenced by ${blockers.join(", ")}. Settle or cancel those records first.`,
        { status: 409 },
      );
    }

    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error)
      return createApiResponse(false, "Failed to delete reservation", {
        status: 500,
      });
    return createApiResponse(true, { message: "Reservation deleted" });
  } catch {
    return createApiResponse(false, "Failed to delete reservation");
  }
}
