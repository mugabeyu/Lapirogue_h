import { randomInt } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

import { createApiResponse, handleError, validationErrorResponse } from "@/lib/api-response";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendReservationOTPEmail } from "@/lib/mailer";

const requestSchema = z.object({
  guestId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  adults: z.number().int().positive(),
  children: z.number().int().min(0),
  totalAmount: z.number().min(0),
  email: z.string().email(),
  origin: z.enum(["MOBILE_APP", "RECEPTION_DESK", "MANAGER_PORTAL"]).optional(),
});

function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    // Verify guest exists and is eligible
    const { data: guest } = await supabase
      .from("guests")
      .select("id, first_name, last_name, email, account_status")
      .eq("id", body.guestId)
      .maybeSingle();

    if (!guest) {
      return createApiResponse(false, "Guest not found", { status: 404 });
    }

    if (
      guest.account_status === "FROZEN" ||
      guest.account_status === "BANNED" ||
      guest.account_status === "PENDING"
    ) {
      return createApiResponse(
        false,
        "Guest account is not eligible to make reservations right now.",
        { status: 403 },
      );
    }

    // Check room availability
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

    // Create pending reservation using RPC
    const { data: pendingRes, error: pendingError } = await supabase.rpc(
      "create_pending_reservation",
      {
        p_guest_id: body.guestId,
        p_email: body.email,
        p_room_id: body.roomId,
        p_check_in: body.checkIn,
        p_check_out: body.checkOut,
        p_adults: body.adults,
        p_children: body.children,
        p_total_amount: body.totalAmount,
        p_origin: body.origin ?? "MOBILE_APP",
      },
    );

    if (pendingError || !pendingRes) {
      throw pendingError ?? new Error("Failed to create pending reservation");
    }

    // Generate 6-digit OTP, store it, and email it
    const otpCode = generateOtpCode();

    const { error: updateError } = await supabase
      .from("pending_reservations")
      .update({ verification_code: otpCode })
      .eq("verification_token", pendingRes.token);

    if (updateError) {
      await supabase.from("pending_reservations").delete().eq("verification_token", pendingRes.token);
      throw updateError;
    }

    const guestName = `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim();
    await sendReservationOTPEmail({
      to: body.email,
      guestName,
      otpCode,
    });

    return createApiResponse(
      true,
      {
        verificationToken: pendingRes.token,
        expiresInSeconds: pendingRes.expires_in_seconds,
        email: body.email,
        message: "Verification code sent to your email.",
      },
      { status: 201 },
    );
  } catch (error) {
    const validation = validationErrorResponse(error);
    if (validation) return validation;
    return handleError(error, "Failed to initiate reservation verification");
  }
}
