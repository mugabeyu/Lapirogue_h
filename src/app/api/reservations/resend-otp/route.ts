import { NextRequest } from "next/server";
import { z } from "zod";

import { createApiResponse, validationErrorResponse } from "@/lib/api-response";
import { getSupabaseAdmin } from "@/lib/supabase";

const resendSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = resendSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    // Verify pending reservation still exists
    const { data: pendingRes, error: pendingError } = await supabaseAdmin
      .from("pending_reservations")
      .select("id, verified_at")
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

    // Resend OTP using Supabase Auth signInWithOtp (sends a new OTP)
    const { error: resendError } = await supabaseAdmin.auth.signInWithOtp({
      email: body.email,
    });

    if (resendError) {
      return createApiResponse(false, "Failed to resend verification code", {
        status: 500,
      });
    }

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
