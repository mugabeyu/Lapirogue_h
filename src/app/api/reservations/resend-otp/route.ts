import { randomInt } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

import { createApiResponse, validationErrorResponse } from "@/lib/api-response";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendReservationOTPEmail } from "@/lib/mailer";

const resendSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function POST(request: NextRequest) {
  try {
    const body = resendSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    // Verify pending reservation still exists
    const { data: pendingRes, error: pendingError } = await supabaseAdmin
      .from("pending_reservations")
      .select("id, verified_at, guest_id")
      .eq("verification_token", body.token)
      .eq("email", body.email)
      .maybeSingle();

    if (pendingError || !pendingRes) {
      return createApiResponse(false, "Verification token not found", {
        status: 404,
      });
    }

    if (pendingRes.verified_at) {
      return createApiResponse(
        false,
        "This reservation has already been verified",
        { status: 409 },
      );
    }

    // Generate new OTP, store it, and email it
    const otpCode = generateOtpCode();

    const { error: updateError } = await supabaseAdmin
      .from("pending_reservations")
      .update({ verification_code: otpCode })
      .eq("verification_token", body.token);

    if (updateError) {
      return createApiResponse(false, "Failed to resend verification code", {
        status: 500,
      });
    }

    // Fetch guest name for the email
    const { data: guestRow } = await supabaseAdmin
      .from("guests")
      .select("first_name, last_name")
      .eq("id", pendingRes.guest_id)
      .maybeSingle();

    const guestName =
      `${guestRow?.first_name ?? ""} ${guestRow?.last_name ?? ""}`.trim() ||
      "Valued Guest";

    await sendReservationOTPEmail({
      to: body.email,
      guestName,
      otpCode,
    });

    return createApiResponse(true, {
      message: "Verification code resent to email",
      expiresInSeconds: 900,
    });
  } catch (error) {
    const validation = validationErrorResponse(error);
    if (validation) return validation;
    return createApiResponse(false, "Failed to resend verification code");
  }
}
