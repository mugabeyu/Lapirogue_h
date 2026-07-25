import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRouteHandlerSupabaseClient } from "@/lib/supabase-server";
import { getAuditActor, recordAuditLog } from "@/lib/audit";
import { z } from "zod";
import { validationErrorResponse } from "@/lib/api-response";
import { toGuest, type GuestRow } from "@/lib/guests";
import { notifyGuest } from "@/lib/guest-notifications";

const guestUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
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
  accountStatus: z.enum(["PENDING", "ACTIVE", "FROZEN", "BANNED"]).optional(),
  notes: z.string().optional(),
  imagePath: z.string().optional().nullable(),
});

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toReservationStatus(
  guestStatus: "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED",
) {
  return guestStatus === "RESERVED" ? "RESERVED" : guestStatus;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const { data: guest, error } = await getSupabaseAdmin()
      .from("guests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !guest) {
      return NextResponse.json(
        { success: false, error: "Guest not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: toGuest(guest as GuestRow),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch guest" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const validatedData = guestUpdateSchema.parse(body);
    await getAuditActor(request);
    const supabase = getSupabaseAdmin();

    const authClient = getRouteHandlerSupabaseClient(request);
    const {
      data: { user },
    } = await authClient.auth.getUser();
    let userRole: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_id", user.id)
        .maybeSingle();
      userRole = profile?.role ?? null;
    }

    if (validatedData.status === "CHECKED_IN") {
      const today = toDateKey();
      const { data: activeStay, error: activeStayError } = await supabase
        .from("reservations")
        .select("id")
        .eq("guest_id", id)
        .neq("status", "CANCELLED")
        .lte("check_in", today)
        .gt("check_out", today)
        .limit(1)
        .maybeSingle();

      if (activeStayError) {
        throw activeStayError;
      }

      if (!activeStay) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Guest can only be checked in on or after the reservation check-in date and before check-out date",
          },
          { status: 400 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (validatedData.firstName !== undefined)
      updatePayload.first_name = validatedData.firstName;
    if (validatedData.lastName !== undefined)
      updatePayload.last_name = validatedData.lastName;
    if (validatedData.phone !== undefined)
      updatePayload.phone = validatedData.phone;
    if (validatedData.nationality !== undefined)
      updatePayload.nationality = validatedData.nationality;
    if (validatedData.passport !== undefined)
      updatePayload.passport = validatedData.passport;
    if (validatedData.dateOfBirth !== undefined)
      updatePayload.date_of_birth = validatedData.dateOfBirth;
    if (validatedData.notes !== undefined)
      updatePayload.notes = validatedData.notes;
    if (validatedData.imagePath !== undefined)
      updatePayload.image_path = validatedData.imagePath;

    const isManager = userRole === "MANAGER";
    if (isManager) {
      if (validatedData.vip !== undefined)
        updatePayload.vip = validatedData.vip;
      if (validatedData.status !== undefined)
        updatePayload.status = validatedData.status;
      if (validatedData.accountStatus !== undefined)
        updatePayload.account_status = validatedData.accountStatus;
    }

    const { data: guest, error } = await supabase
      .from("guests")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !guest) {
      console.error("Guest update failed:", error);
      throw error;
    }

    if (isManager && validatedData.status !== undefined) {
      const reservationStatus = toReservationStatus(validatedData.status);

      if (reservationStatus === "CANCELLED") {
        await supabase
          .from("reservations")
          .update({ status: "CANCELLED" })
          .eq("guest_id", id)
          .in("status", ["RESERVED", "CONFIRMED", "CHECKED_IN"]);
      } else {
        let targetReservationQuery = supabase
          .from("reservations")
          .select("id")
          .eq("guest_id", id)
          .neq("status", "CANCELLED")
          .order("check_in", { ascending: false })
          .limit(1);

        if (reservationStatus === "CHECKED_IN") {
          targetReservationQuery = targetReservationQuery
            .in("status", ["RESERVED", "CONFIRMED", "CHECKED_IN"])
            .lte("check_in", toDateKey())
            .gt("check_out", toDateKey());
        } else if (reservationStatus === "CHECKED_OUT") {
          targetReservationQuery = targetReservationQuery.in("status", [
            "CHECKED_IN",
            "CHECKED_OUT",
          ]);
        } else {
          targetReservationQuery = targetReservationQuery.in("status", [
            "RESERVED",
            "CONFIRMED",
            "CHECKED_IN",
          ]);
        }

        const { data: targetReservation } =
          await targetReservationQuery.maybeSingle();

        if (targetReservation?.id) {
          await supabase
            .from("reservations")
            .update({ status: reservationStatus })
            .eq("id", targetReservation.id);
        }
      }
    }

    if (isManager && validatedData.status !== undefined) {
      const guestFacingMessage: Record<string, string> = {
        CHECKED_IN: 'You are checked in. Enjoy your stay with us.',
        CHECKED_OUT: 'You have been checked out. Thank you for staying with us.',
        RESERVED: 'Your booking is confirmed and waiting for you.',
        CANCELLED: 'Your booking has been cancelled. Contact reception if this is unexpected.',
      };

      const message = guestFacingMessage[validatedData.status];
      if (message) {
        await notifyGuest({
          guestId: id,
          title: 'Stay status updated',
          message,
          category: 'Stay',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: toGuest(guest as GuestRow),
    });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update guest",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : error instanceof Error
              ? error.message
              : JSON.stringify(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    const { id } = (await context.params) as { id: string };
    const actor = await getAuditActor(_request);
    const actorId = actor?.id ?? null;
    const supabase = getSupabaseAdmin();
    const { data: guest } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (guest) {
      try {
        await recordAuditLog({
          tableName: "guests",
          recordId: id,
          action: "DELETE",
          actorId,
          before: guest as Record<string, unknown>,
        });
      } catch (auditError) {
        console.warn("Guest audit log skipped", auditError);
      }
    }

    const { error } = await supabase.from("guests").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Guest deleted successfully",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete guest" },
      { status: 500 },
    );
  }
}
