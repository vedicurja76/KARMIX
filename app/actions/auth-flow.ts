"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, extractClientIpFromHeaders } from "@/lib/security/rate-limit";
import type { AuthResult } from "@/lib/types/auth.types";
import {
  validateEmail,
  validateFullName,
  validateLoginPassword,
  validateNewPassword,
} from "@/lib/astrologer/form-validation";
import { sanitizeRedirectPath } from "@/lib/security/safe-redirect";

export type ResolveAuthResult =
  | {
      status: "authenticated";
      role: "customer" | "astrologer" | "super_admin" | "admin" | "consultant_admin";
      userId: string;
      email: string;
      fullName?: string | null;
      redirectUrl: string;
    }
  | {
      status: "otp_sent";
      email: string;
      role: "customer" | "astrologer";
    }
  | {
      status: "new_account";
      email: string;
      role: "customer" | "astrologer";
    };

/**
 * Sends a secure Supabase Magic Link / OTP for email authentication.
 */
export async function sendEmailOtpAction(input: {
  email: string;
  selectedRole: "customer" | "astrologer";
  redirectTo?: string;
}): Promise<AuthResult<{ email: string }>> {
  const { email, selectedRole, redirectTo } = input;
  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  let ip = "unknown";
  try {
    ip = extractClientIpFromHeaders(await headers());
  } catch {}
  const normalizedEmail = email.trim().toLowerCase();
  const broad = checkRateLimit(`auth:otp:ip:${ip}`, 30, 15 * 60_000);
  const narrow = checkRateLimit(`auth:otp:ip-email:${ip}:${normalizedEmail}`, 6, 15 * 60_000);
  if (!broad.allowed || !narrow.allowed) {
    return { success: false, error: "Too many verification requests. Please wait a few minutes." };
  }

  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const callbackUrl = new URL("/auth/callback", siteUrl);
    callbackUrl.searchParams.set("role", selectedRole);
    if (redirectTo) callbackUrl.searchParams.set("next", redirectTo);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl.toString(),
        data: {
          role: selectedRole,
        },
      },
    });

    if (error) {
      console.error("[sendEmailOtpAction Error]", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { email: normalizedEmail } };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send verification email.",
    };
  }
}

/**
 * Verifies email OTP token directly from server action and establishes user session.
 */
export async function verifyEmailOtpAction(input: {
  email: string;
  token: string;
  selectedRole: "customer" | "astrologer";
  redirectTo?: string;
}): Promise<AuthResult<ResolveAuthResult>> {
  const { email, token, selectedRole, redirectTo } = input;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: token.trim(),
      type: "email",
    });

    if (error || !authData.user) {
      return { success: false, error: error?.message || "Invalid or expired verification code." };
    }

    // Inspect user's profile and authoritative role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!profile) {
      // New account requiring completion
      return {
        success: true,
        data: {
          status: "new_account",
          email: normalizedEmail,
          role: selectedRole,
        },
      };
    }

    const authoritativeRole = profile.role;

    if (authoritativeRole === "super_admin" || authoritativeRole === "admin") {
      return {
        success: true,
        data: {
          status: "authenticated",
          role: authoritativeRole,
          userId: authData.user.id,
          email: normalizedEmail,
          fullName: profile.full_name,
          redirectUrl: "/super-admin",
        },
      };
    }

    if (authoritativeRole === "consultant_admin") {
      return {
        success: true,
        data: {
          status: "authenticated",
          role: authoritativeRole,
          userId: authData.user.id,
          email: normalizedEmail,
          fullName: profile.full_name,
          redirectUrl: "/admin",
        },
      };
    }

    // Guard role mismatch
    if (authoritativeRole !== selectedRole) {
      await supabase.auth.signOut().catch(() => {});
      return {
        success: false,
        error: `This account is registered as a ${authoritativeRole}. Please select the correct role to continue.`,
      };
    }

    let destination = selectedRole === "astrologer" ? "/astrologer/dashboard" : "/customer/astrologers";
    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      destination = redirectTo;
    }

    return {
      success: true,
      data: {
        status: "authenticated",
        role: selectedRole,
        userId: authData.user.id,
        email: normalizedEmail,
        fullName: profile.full_name,
        redirectUrl: destination,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Verification error occurred.",
    };
  }
}

/**
 * Server action to authenticate or resolve an existing account.
 */
export async function resolveOrAuthenticateAction(input: {
  email: string;
  password?: string;
  selectedRole: "customer" | "astrologer";
  redirectTo?: string;
}): Promise<AuthResult<ResolveAuthResult>> {
  const { email, password = "", selectedRole, redirectTo } = input;

  const emailError = validateEmail(email);
  if (emailError) return { success: false, error: emailError };

  const passwordError = validateLoginPassword(password);
  if (passwordError) return { success: false, error: passwordError };

  let ip = "unknown";
  try {
    ip = extractClientIpFromHeaders(await headers());
  } catch {}
  const normalizedEmail = email.trim().toLowerCase();
  const broad = checkRateLimit(`auth:resolve:ip:${ip}`, 40, 15 * 60_000);
  const narrow = checkRateLimit(`auth:resolve:ip-email:${ip}:${normalizedEmail}`, 10, 15 * 60_000);
  if (!broad.allowed || !narrow.allowed) {
    return { success: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  try {
    const supabase = await createClient();

    // 1. Check if user is an administrative account in Admin DB (DB2) first
    let signInData: any = null;
    let signInError: any = null;
    let authTarget: "main" | "admin" = "main";

    if (process.env.ADMIN_SUPABASE_URL) {
      try {
        const adminSupabase = await createClient("admin");
        const adminResult = await adminSupabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (!adminResult.error && adminResult.data?.user) {
          const { data: adminProf } = await adminSupabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", adminResult.data.user.id)
            .maybeSingle();

          if (adminProf && (adminProf.role === "super_admin" || adminProf.role === "admin" || adminProf.role === "consultant_admin")) {
            return {
              success: true,
              data: {
                status: "authenticated",
                role: adminProf.role,
                userId: adminResult.data.user.id,
                email: adminResult.data.user.email ?? email,
                fullName: adminProf.full_name,
                redirectUrl: adminProf.role === "consultant_admin" ? "/admin" : "/super-admin",
              },
            };
          }
        }
      } catch (adminErr) {
        console.warn("[Admin DB Login Check Error]", adminErr);
      }
    }

    // 2. Standard sign in with password in primary database (DB1)
    const mainResult = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    signInData = mainResult.data;
    signInError = mainResult.error;

    if (!signInError && signInData?.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return {
          success: false,
          error: "Account profile could not be verified. Please try again or contact support.",
        };
      }

      const authoritativeRole = profile.role;

      if (authoritativeRole === "super_admin" || authoritativeRole === "admin") {
        return {
          success: true,
          data: {
            status: "authenticated",
            role: authoritativeRole,
            userId: signInData.user.id,
            email: signInData.user.email ?? email,
            fullName: profile.full_name,
            redirectUrl: "/super-admin",
          },
        };
      }
      if (authoritativeRole === "consultant_admin") {
        return {
          success: true,
          data: {
            status: "authenticated",
            role: authoritativeRole,
            userId: signInData.user.id,
            email: signInData.user.email ?? email,
            fullName: profile.full_name,
            redirectUrl: "/admin",
          },
        };
      }

      if (authoritativeRole !== selectedRole) {
        await supabase.auth.signOut().catch(() => {});
        return {
          success: false,
          error: `This account is registered as a ${authoritativeRole}. Please select the correct role to continue.`,
        };
      }

      let destination = selectedRole === "astrologer" ? "/astrologer/dashboard" : "/customer/astrologers";
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        destination = redirectTo;
      }

      return {
        success: true,
        data: {
          status: "authenticated",
          role: selectedRole,
          userId: signInData.user.id,
          email: signInData.user.email ?? email,
          fullName: profile.full_name,
          redirectUrl: destination,
        },
      };
    }

    // 2. Sign in failed
    const errMessage = (signInError?.message || "").toLowerCase();
    if (errMessage.includes("email not confirmed")) {
      return {
        success: false,
        error: "Please verify your email address before logging in.",
      };
    }

    // 3. Robust Account Existence Check via admin user list
    let accountExists = false;
    try {
      const adminClient = await createAdminClient("main");
      const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      accountExists = Boolean(usersData?.users?.some(u => u.email?.toLowerCase() === normalizedEmail));
    } catch {
      // Fallback check: query profiles table or inspect error
      accountExists = false;
    }

    if (accountExists) {
      // Existing user entered wrong password or credentials
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    // New user detected! Transition to Step 4 Registration
    return {
      success: true,
      data: {
        status: "new_account",
        email: normalizedEmail,
        role: selectedRole,
      },
    };
  } catch (err: unknown) {
    console.error("[resolveOrAuthenticateAction Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to process authentication request.",
    };
  }
}

/**
 * Server action to register a new Customer account and sign them in.
 */
export async function registerCustomerAction(input: {
  fullName: string;
  email: string;
  password?: string;
  redirectTo?: string;
}): Promise<AuthResult<{ userId: string; email: string; redirectUrl: string }>> {
  const { fullName, email, password = "", redirectTo } = input;

  const nameError = validateFullName(fullName);
  if (nameError) return { success: false, error: nameError };

  const emailError = validateEmail(email);
  if (emailError) return { success: false, error: emailError };

  const passToUse = password && password.length >= 6 ? password : `Karmic@${Date.now()}#2026`;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const adminClient = await createAdminClient("main");

    // 1. Check if user already exists
    const { data: existingList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingList?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (existing) {
      return { success: false, error: "An account with this email address already exists." };
    }

    // 2. Create the user in auth.users with email confirmed
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: passToUse,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: "customer",
      },
    });

    if (createError || !createData?.user) {
      return {
        success: false,
        error: createError?.message || "Failed to create customer account.",
      };
    }

    // Ensure profiles table has customer record
    await adminClient.from("profiles").upsert(
      {
        id: createData.user.id,
        full_name: fullName.trim(),
        role: "customer",
      },
      { onConflict: "id" }
    );

    // 3. Establish public session via sign-in
    const client = await createClient();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password: passToUse,
    });

    if (signInErr) {
      console.warn("[registerCustomerAction signIn warning]", signInErr.message);
    }

    const destination = sanitizeRedirectPath(redirectTo, "/customer/astrologers");

    return {
      success: true,
      data: {
        userId: createData.user.id,
        email: normalizedEmail,
        redirectUrl: destination,
      },
    };
  } catch (err: unknown) {
    console.error("[registerCustomerAction Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Registration failed.",
    };
  }
}

/**
 * Server action to register a new Astrologer account and provision astrologer profile
 * using full fields from the 4-step wizard.
 */
export async function registerAstrologerAction(input: {
  fullName: string;
  email: string;
  password?: string;
  experienceYears?: number | null;
  consultationFee?: number | null;
  voicePricePerMinute?: number | null;
  chatPricePerMinute?: number | null;
  videoPricePerMinute?: number | null;
  voiceEnabled?: boolean;
  chatEnabled?: boolean;
  videoEnabled?: boolean;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  upiVpa?: string | null;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  slug?: string | null;
  specializations?: string[];
  languages?: string[];
  redirectTo?: string;
}): Promise<AuthResult<{ userId: string; email: string; redirectUrl: string }>> {
  const {
    fullName,
    email,
    password = "",
    experienceYears = 3,
    consultationFee = 500,
    voicePricePerMinute = 15,
    chatPricePerMinute = 10,
    videoPricePerMinute = 25,
    voiceEnabled = true,
    chatEnabled = true,
    videoEnabled = true,
    city = "New Delhi",
    state = "Delhi",
    address = null,
    upiVpa = null,
    profilePhotoUrl = null,
    bio = "Vedic Astrologer dedicated to helping seekers find truth and clarity.",
    slug: customSlug,
    specializations = ["Vedic Astrology"],
    languages = ["Hindi", "English"],
    redirectTo,
  } = input;

  const nameError = validateFullName(fullName);
  if (nameError) return { success: false, error: nameError };

  const emailError = validateEmail(email);
  if (emailError) return { success: false, error: emailError };

  const passToUse = password && password.length >= 6 ? password : `Karmic@${Date.now()}#2026`;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const adminClient = await createAdminClient("main");

    // 1. Check if user already exists
    const { data: existingList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingList?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (existing) {
      return { success: false, error: "An account with this email address already exists." };
    }

    // 2. Create the user in auth.users with email confirmed
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: passToUse,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: "astrologer",
      },
    });

    if (createError || !createData?.user) {
      return {
        success: false,
        error: createError?.message || "Failed to create astrologer account.",
      };
    }

    // Ensure profiles table has astrologer record
    await adminClient.from("profiles").upsert(
      {
        id: createData.user.id,
        full_name: fullName.trim(),
        role: "astrologer",
      },
      { onConflict: "id" }
    );

    // 3. Create astrologer_profiles record
    const baseSlug = customSlug && customSlug.trim()
      ? customSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : `${fullName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { error: profileErr } = await adminClient.from("astrologer_profiles").insert({
      user_id: createData.user.id,
      slug: baseSlug,
      display_name: fullName.trim(),
      bio: bio ? bio.trim() : null,
      experience_years: experienceYears,
      consultation_fee: consultationFee,
      voice_price_per_minute: voicePricePerMinute,
      chat_price_per_minute: chatPricePerMinute,
      video_price_per_minute: videoPricePerMinute,
      voice_enabled: voiceEnabled,
      chat_enabled: chatEnabled,
      video_enabled: videoEnabled,
      specializations,
      languages,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      address: address ? address.trim() : null,
      upi_vpa: upiVpa ? upiVpa.trim() : null,
      profile_photo_url: profilePhotoUrl ? profilePhotoUrl.trim() : null,
      approval_status: "pending",
    });

    if (profileErr) {
      console.warn("[registerAstrologerAction profile creation warning]", profileErr.message);
    }

    // 4. Establish public session via sign-in
    const client = await createClient();
    const { error: signInErr } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password: passToUse,
    });

    if (signInErr) {
      console.warn("[registerAstrologerAction signIn warning]", signInErr.message);
    }

    const destination = sanitizeRedirectPath(redirectTo, "/astrologer/dashboard");

    return {
      success: true,
      data: {
        userId: createData.user.id,
        email: normalizedEmail,
        redirectUrl: destination,
      },
    };
  } catch (err: unknown) {
    console.error("[registerAstrologerAction Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Astrologer registration failed.",
    };
  }
}
