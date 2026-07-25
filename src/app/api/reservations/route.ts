import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuditActor, recordAuditLog } from "@/lib/audit";
import { z } from "zod";
import { createApiResponse, validationErrorResponse } from "@/lib/api-response";
import { sendGuestPortalInvitationEmail } from "@/lib/mailer";
import { describeStayPeriod, notifyGuest } from "@/lib/guest-notifications";

const reservationStatusEnum = z.enum([
  "RESERVED",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

const reservationSchema = z.object({
  id: z.string().uuid().optional(),
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.number().int().positive(),
  children: z.number().int().min(0),
  totalAmount: z.number().min(0),
  status: reservationStatusEnum.optional(),
  origin: z.enum(["MOBILE_APP", "RECEPTION_DESK", "MANAGER_PORTAL"]).optional(),
});

/**
 * Updates are partial: anything the caller omits keeps whatever is already
 * stored. The edit forms only know about the fields they render, and an
 * earlier version of this route required every field — so callers padded the
 * gaps with guesses and silently overwrote occupancy on unrelated edits.
 */
const reservationUpdateSchema = z.object({
  id: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  checkIn: z.string().min(1).optional(),
  checkOut: z.string().min(1).optional(),
  adults: z.number().int().positive().optional(),
  children: z.number().int().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  status: reservationStatusEnum.optional(),
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

/**
 * Stays are half-open intervals: a room is occupied from the check-in day up
 * to — but not including — the check-out day. Two stays therefore clash only
 * when `a.check_in < b.check_out && a.check_out > b.check_in`. Using `lte`/`gte`
 * here instead would flag same-day turnovers (one guest leaves, the next
 * arrives) as double bookings, which is normal hotel operation.
 */
function findConflictingReservations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { roomId: string; checkIn: string; checkOut: string; excludeId?: string },
) {
  let query = supabase
    .from("reservations")
    .select("id,reservation_id,check_in,check_out")
    .eq("room_id", params.roomId)
    .lt("check_in", params.checkOut)
    .gt("check_out", params.checkIn)
    .not("status", "in", '("CANCELLED","NO_SHOW","CHECKED_OUT")');

  if (params.excludeId) {
    query = query.neq("id", params.excludeId);
  }

  return query;
}

function toGuestReservationStatus(status: string | undefined) {
  switch (status) {
    case "CHECKED_IN":
      return "CHECKED_IN";
    case "CHECKED_OUT":
      return "CHECKED_OUT";
    case "CANCELLED":
    case "NO_SHOW":
      return "CANCELLED";
    case "RESERVED":
    case "CONFIRMED":
    default:
      return "RESERVED";
  }
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

    // Gate: guest account_status must be ACTIVE to make reservations
    const { data: guestCheck } = await supabase
      .from("guests")
      .select("account_status, auth_id")
      .eq("id", body.guestId)
      .maybeSingle();

    if (!guestCheck) {
      return createApiResponse(false, "Guest not found", { status: 404 });
    }

    if (guestCheck.account_status === "FROZEN") {
      return createApiResponse(
        false,
        "Account is frozen. Contact the hotel to resume bookings.",
        { status: 403 },
      );
    }

    if (guestCheck.account_status === "BANNED") {
      return createApiResponse(
        false,
        "Account is banned. Cannot make reservations.",
        { status: 403 },
      );
    }

    // PENDING guests (created via reception desk / website booking, not yet
    // registered on the guest portal) do not need email/OTP verification to
    // book — they get a set-password invite email with their stay details
    // instead. Only frozen/banned accounts are blocked above.

    if (body.checkOut <= body.checkIn) {
      return createApiResponse(
        false,
        "Check-out date must be after the check-in date",
        { status: 400 },
      );
    }

    const { data: conflicting, error: conflictError } =
      await findConflictingReservations(supabase, {
        roomId: body.roomId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
      });

    if (conflictError) throw conflictError;
    if (conflicting && conflicting.length > 0) {
      const clash = conflicting[0];
      return createApiResponse(
        false,
        `Room is already booked for those dates by reservation ${clash.reservation_id} (${clash.check_in} to ${clash.check_out})`,
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
        origin,
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

    // Guests who haven't set up their portal login yet get a combined
    // set-password + reservation email instead of a plain confirmation,
    // since they still need a way to access the guest portal.
    if (guestRow?.email && roomRow?.room_number && !guestRow.auth_id) {
      try {
        const registerUrl = new URL("/register", request.url);
        registerUrl.searchParams.set("guestId", body.guestId);

        await sendGuestPortalInvitationEmail({
          to: guestRow.email,
          guestName:
            `${guestRow.first_name || ""} ${guestRow.last_name || ""}`.trim(),
          guestId: guestRow.guest_id || body.guestId,
          guestEmail: guestRow.email,
          roomNumber: roomRow.room_number,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          registerUrl: registerUrl.toString(),
        });
      } catch (emailError) {
        console.warn("Guest portal invitation email could not be sent:", emailError);
      }
    } else if (guestRow?.email && roomRow?.room_number) {
      try {
        const { sendReservationConfirmationEmail } =
          await import("@/lib/mailer");
        const taxAmount = Math.round(body.totalAmount * 0.15);
        await sendReservationConfirmationEmail({
          to: guestRow.email,
          guestName:
            `${guestRow.first_name || ""} ${guestRow.last_name || ""}`.trim(),
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
          paymentStatus:
            guestRow.account_status === "ACTIVE" ? "PENDING" : "UNPAID",
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
    const parsed = reservationUpdateSchema.parse(body);
    const { id } = parsed;
    const supabase = getSupabaseAdmin();

    const { data: previousReservation, error: previousReservationError } =
      await supabase
        .from("reservations")
        .select(
          "id,reservation_id,guest_id,room_id,check_in,check_out,adults,children,total_amount,status,guests(first_name,last_name,email),rooms(room_number,type)",
        )
        .eq("id", id)
        .maybeSingle();

    if (previousReservationError) throw previousReservationError;

    if (!previousReservation) {
      return createApiResponse(false, "Reservation not found", { status: 404 });
    }

    // Anything the caller left out keeps its stored value, so a form that only
    // edits the stay dates can't reset occupancy or the room it doesn't render.
    const guestId = parsed.guestId ?? previousReservation.guest_id;
    const roomId = parsed.roomId ?? previousReservation.room_id;
    const checkIn = parsed.checkIn ?? previousReservation.check_in;
    const checkOut = parsed.checkOut ?? previousReservation.check_out;
    const adults = parsed.adults ?? previousReservation.adults;
    const children = parsed.children ?? previousReservation.children;
    const totalAmount = parsed.totalAmount ?? Number(previousReservation.total_amount);
    const status = parsed.status ?? previousReservation.status;

    if (checkOut <= checkIn) {
      return createApiResponse(
        false,
        "Check-out date must be after the check-in date",
        { status: 400 },
      );
    }

    // Only gate the moment a stay *becomes* checked in. Re-saving a stay that
    // is already checked in — to extend or correct its dates — must stay
    // possible even once the original check-out day has passed.
    const isCheckingInNow =
      status === "CHECKED_IN" && previousReservation.status !== "CHECKED_IN";

    if (isCheckingInNow) {
      const today = toDateKey();
      if (today < checkIn || today >= checkOut) {
        return createApiResponse(
          false,
          "Check-in is only allowed on or after check-in and before check-out",
          { status: 400 },
        );
      }
    }

    const { data: conflicting, error: conflictError } =
      await findConflictingReservations(supabase, {
        roomId,
        checkIn,
        checkOut,
        excludeId: id,
      });

    if (conflictError) throw conflictError;

    if (conflicting && conflicting.length > 0) {
      const clash = conflicting[0];
      return createApiResponse(
        false,
        `Room is already booked for those dates by reservation ${clash.reservation_id} (${clash.check_in} to ${clash.check_out})`,
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

    const datesChanged =
      previousReservation.check_in !== checkIn ||
      previousReservation.check_out !== checkOut;
    const roomChanged = previousReservation.room_id !== roomId;

    if (datesChanged || roomChanged) {
      const { data: newRoom } = roomChanged
        ? await supabase
            .from("rooms")
            .select("room_number")
            .eq("id", roomId)
            .maybeSingle()
        : { data: null };

      const details = [
        datesChanged ? `Your stay now runs ${describeStayPeriod(checkIn, checkOut)}.` : null,
        roomChanged && newRoom?.room_number
          ? `You have been moved to room ${newRoom.room_number}.`
          : null,
      ]
        .filter(Boolean)
        .join(' ');

      await notifyGuest({
        guestId,
        title: roomChanged ? 'Your room has changed' : 'Your stay dates have changed',
        message: `${details} Reservation ${previousReservation.reservation_id}.`,
        category: roomChanged ? 'Room' : 'Stay',
      });
    }

    if (parsed.status && previousReservation.status !== status) {
      await notifyGuest({
        guestId,
        title: `Reservation ${status.toLowerCase().replace('_', ' ')}`,
        message: `Reservation ${previousReservation.reservation_id} for ${describeStayPeriod(checkIn, checkOut)} is now ${status.toLowerCase().replace('_', ' ')}.`,
        category: 'Reservation',
      });
    }

    if (status) {
      await supabase
        .from("guests")
        .update({ status: toGuestReservationStatus(status) })
        .eq("id", guestId);
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
          const { sendReservationConfirmationEmail } =
            await import("@/lib/mailer");
          await sendReservationConfirmationEmail({
            to: cancelGuest.email,
            guestName:
              `${cancelGuest.first_name || ""} ${cancelGuest.last_name || ""}`.trim(),
            roomNumber: cancelRoom.room_number,
            roomType: cancelRoom.type,
            checkIn: checkIn,
            checkOut: checkOut,
            totalAmount: totalAmount,
            status: "CANCELLED",
            reservationId: data.reservation_id || id,
            adults: adults,
            children: children,
            paymentStatus: "CANCELLED",
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
    const { data: reservation } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!reservation) {
      return createApiResponse(false, "Reservation not found", { status: 404 });
    }

    if (reservation.status === "CANCELLED") {
      return createApiResponse(true, {
        message: "Reservation already cancelled",
      });
    }

    if (reservation) {
      try {
        await recordAuditLog({
          tableName: "reservations",
          recordId: id,
          action: "UPDATE",
          actorId: actor?.id || "unknown",
          before: reservation as Record<string, unknown>,
          after: {
            ...(reservation as Record<string, unknown>),
            status: "CANCELLED",
          },
        });
      } catch (auditError) {
        console.warn("Reservation audit log skipped", auditError);
      }
    }

    const { data: cancelledReservation, error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .select("id, guest_id")
      .single();

    if (error) {
      return createApiResponse(false, "Failed to cancel reservation", {
        status: 500,
      });
    }

    if (cancelledReservation?.guest_id) {
      const { data: replacementReservation } = await supabase
        .from("reservations")
        .select("status")
        .eq("guest_id", cancelledReservation.guest_id)
        .neq("id", id)
        .in("status", [
          "CHECKED_IN",
          "RESERVED",
          "CONFIRMED",
          "CHECKED_OUT",
          "NO_SHOW",
        ])
        .order("check_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase
        .from("guests")
        .update({
          status: toGuestReservationStatus(
            replacementReservation?.status ?? "CANCELLED",
          ),
        })
        .eq("id", cancelledReservation.guest_id);
    }

    return createApiResponse(true, { message: "Reservation cancelled" });
  } catch {
    return createApiResponse(false, "Failed to cancel reservation");
  }
}
