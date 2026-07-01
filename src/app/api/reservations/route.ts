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
    .enum(["RESERVED", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
    .optional(),
  origin: z.enum(["MOBILE_APP", "RECEPTION_DESK", "MANAGER_PORTAL"]).optional(),
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
    image_path?: string | null;
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
    const search = request.nextUrl.searchParams.get("search") || "";
    const guestId = request.nextUrl.searchParams.get("guestId") || "";
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("reservations")
      .select(
        "id,reservation_id,guest_id,room_id,check_in,check_out,adults,children,status,total_amount,guests(first_name,last_name,image_path,email),rooms(room_number,type)",
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
      reservationId: reservation.reservation_id,
      guestId: (reservation as ReservationRow & { guest_id?: string }).guest_id,
      roomId: (reservation as ReservationRow & { room_id?: string }).room_id,
      guest: reservation.guests
        ? `${reservation.guests.first_name || ""} ${reservation.guests.last_name || ""}`.trim()
        : null,
      guestImagePath: reservation.guests?.image_path ?? null,
      room: reservation.rooms?.room_number,
      roomType: reservation.rooms?.type,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
      adults: reservation.adults,
      children: reservation.children,
      status: reservation.status,
      totalAmount: Number(reservation.total_amount),
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

    // Gate: guest account_status must be ACTIVE to make reservations
    const { data: guestCheck } = await supabase
      .from("guests")
      .select("account_status, auth_id")
      .eq("id", body.guestId)
      .maybeSingle();

    if (!guestCheck) {
      return createApiResponse(false, "Guest not found", { status: 404 });
    }

    if (guestCheck.account_status === 'FROZEN') {
      return createApiResponse(
        false,
        "Account is frozen. Contact the hotel to resume bookings.",
        { status: 403 },
      );
    }

    if (guestCheck.account_status === 'BANNED') {
      return createApiResponse(
        false,
        "Account is banned. Cannot make reservations.",
        { status: 403 },
      );
    }

    if (guestCheck.account_status === 'PENDING') {
      return createApiResponse(
        false,
        "Account is pending activation. Please verify your email first.",
        { status: 403 },
      );
    }

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

    // Determine initial status based on origin
    let initialStatus = body.status || "CONFIRMED";
    const origin = body.origin || "RECEPTION_DESK";

    // Mobile app reservations start as RESERVED (not yet checked in)
    if (origin === "MOBILE_APP" && !body.status) {
      initialStatus = "RESERVED";
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
        status: initialStatus,
      })
      .select("*")
      .single();

    if (error) throw error;

    const [{ data: guestRow }, { data: roomRow }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name,last_name,email,auth_id,guest_id,account_status")
        .eq("id", body.guestId)
        .maybeSingle(),
      supabase
        .from("rooms")
        .select("room_number,type")
        .eq("id", body.roomId)
        .maybeSingle(),
    ]);

    // Send confirmation email with full details
    if (guestRow?.email && roomRow?.room_number) {
      try {
        const { sendReservationConfirmationEmail } = await import('@/lib/mailer');
        const taxAmount = Math.round(body.totalAmount * 0.15);
        await sendReservationConfirmationEmail({
          to: guestRow.email,
          guestName: `${guestRow.first_name || ""} ${guestRow.last_name || ""}`.trim(),
          roomNumber: roomRow.room_number,
          roomType: roomRow.type,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          totalAmount: body.totalAmount,
          status: initialStatus,
          reservationId: data.reservation_id,
          adults: body.adults,
          children: body.children,
          taxAmount: taxAmount,
          paymentStatus: guestRow.account_status === 'ACTIVE' ? 'PENDING' : 'UNPAID',
        });
      } catch (emailError) {
        console.warn("Confirmation email could not be sent:", emailError);
      }
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
    const actorId = actor?.id;

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

    // Send cancellation email if status changed to CANCELLED
    if (status === "CANCELLED" && previousReservation?.status !== "CANCELLED") {
      const { data: cancelGuest } = await supabase
        .from("guests")
        .select("first_name,last_name,email")
        .eq("id", guestId)
        .maybeSingle();

      const { data: cancelRoom } = await supabase
        .from("rooms")
        .select("room_number,type")
        .eq("id", roomId)
        .maybeSingle();

      if (cancelGuest?.email && cancelRoom?.room_number) {
        try {
          const { sendReservationConfirmationEmail } = await import('@/lib/mailer');
          await sendReservationConfirmationEmail({
            to: cancelGuest.email,
            guestName: `${cancelGuest.first_name || ""} ${cancelGuest.last_name || ""}`.trim(),
            roomNumber: cancelRoom.room_number,
            roomType: cancelRoom.type,
            checkIn: checkIn,
            checkOut: checkOut,
            totalAmount: totalAmount,
            status: 'CANCELLED',
            reservationId: data.reservation_id || id,
            adults: adults,
            children: children,
            paymentStatus: 'CANCELLED',
          });
        } catch (emailError) {
          console.warn("Cancellation email could not be sent:", emailError);
        }
      }
    }

    const [{ data: guestRow }, { data: roomRow }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name,last_name,email,auth_id,guest_id")
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

    if (shouldSendGuestEmail && guestRow?.email && roomRow?.room_number) {
      try {
        const registerUrl = new URL("/register", request.url);
        registerUrl.searchParams.set("guestId", guestId);

        await sendGuestPortalInvitationEmail({
          to: guestRow.email,
          guestName:
            `${guestRow.first_name || ""} ${guestRow.last_name || ""}`.trim(),
          guestId: guestRow.guest_id || guestId,
          guestEmail: guestRow.email,
          roomNumber: roomRow.room_number,
          checkIn: checkIn,
          checkOut: checkOut,
          registerUrl: registerUrl.toString(),
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
    const actorId = actor?.id;
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
          actorId: actor?.id || "unknown",
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
