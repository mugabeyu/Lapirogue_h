import { NextRequest } from "next/server";
import { z } from "zod";

import { createApiResponse, validationErrorResponse } from "@/lib/api-response";
import { sendReservationConfirmationEmail } from "@/lib/mailer";
import { getSupabaseAdmin } from "@/lib/supabase";

const verifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  code: z.string().length(6).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = verifySchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    // Get pending reservation details
    const { data: pendingRes, error: pendingError } = await supabaseAdmin
      .from("pending_reservations")
      .select(
        "id, guest_id, room_id, check_in, check_out, adults, children, total_amount, origin",
      )
      .eq("verification_token", body.token)
      .eq("email", body.email)
      .maybeSingle();

    if (pendingError || !pendingRes) {
      return createApiResponse(
        false,
        "Verification token not found or expired",
        {
          status: 404,
        },
      );
    }

    // OTP verification now happens client-side via Supabase reauthentication.
    // The mobile app calls supabase.auth.verifyOTP(type: reauthentication)
    // before hitting this endpoint, so we skip server-side OTP verification here.

    // Call RPC to verify pending reservation and create actual reservation
    const { data: reservationResult, error: rpcError } =
      await supabaseAdmin.rpc("verify_pending_reservation", {
        p_token: body.token,
        p_auth_id: null,
      });

    if (rpcError || !reservationResult?.success) {
      return createApiResponse(
        false,
        reservationResult?.error ||
          "Failed to complete reservation verification",
        { status: 400 },
      );
    }

    // Fetch guest and room details for confirmation email
    const [{ data: guestRow }, { data: roomRow }] = await Promise.all([
      supabaseAdmin
        .from("guests")
        .select("first_name, last_name, email, account_status")
        .eq("id", pendingRes.guest_id)
        .maybeSingle(),
      supabaseAdmin
        .from("rooms")
        .select("room_number, type")
        .eq("id", pendingRes.room_id)
        .maybeSingle(),
    ]);

    // Send confirmation email
    if (guestRow?.email && roomRow?.room_number) {
      const taxAmount = Math.round(Number(pendingRes.total_amount ?? 0) * 0.15);
      await sendReservationConfirmationEmail({
        to: guestRow.email,
        guestName:
          `${guestRow.first_name ?? ""} ${guestRow.last_name ?? ""}`.trim(),
        roomNumber: roomRow.room_number,
        roomType: roomRow.type,
        checkIn: pendingRes.check_in,
        checkOut: pendingRes.check_out,
        totalAmount: Number(pendingRes.total_amount ?? 0),
        status: "RESERVED",
        reservationId: reservationResult.reservation_id,
        adults: pendingRes.adults,
        children: pendingRes.children,
        taxAmount,
        paymentStatus:
          guestRow.account_status === "ACTIVE" ? "PENDING" : "UNPAID",
      });
    }

    return createApiResponse(true, {
      reservationId: reservationResult.reservation_id,
      checkIn: pendingRes.check_in,
      checkOut: pendingRes.check_out,
      message: "Reservation confirmed successfully",
    });
  } catch (error) {
    const validation = validationErrorResponse(error);
    if (validation) return validation;
    return createApiResponse(false, "Failed to verify reservation");
  }
}
