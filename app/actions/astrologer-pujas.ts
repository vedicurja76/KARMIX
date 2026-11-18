"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export interface AstrologerAssignedPujaItem {
  id: string;
  puja_id: string;
  customer_id: string;
  preferred_date: string;
  time_slot: string;
  sankalp_name: string;
  gotra: string | null;
  special_instructions: string | null;
  status: string;
  fulfilment_status: string;
  darshan_room_name: string | null;
  evidence_photos: string[];
  evidence_video_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  created_at: string;
  venue_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  landmark?: string | null;
  puja?: {
    id: string;
    title: string;
    category: string;
    duration_minutes?: number | null;
    image_url: string | null;
    samagri_details: string | null;
    preparation_instructions: string | null;
  };
}

/**
 * Resolves the astrologer profile ID corresponding to the authenticated astrologer in the main DB
 * (handling dual DB setups where astrologer may authenticate via admin DB or main DB).
 */
async function resolveCurrentAstrologerProfileId(user: { id: string; email?: string }): Promise<string | null> {
  const mainAdmin = await createAdminClient("main");

  // 1. Direct user_id check in main DB
  const { data: directProfile } = await mainAdmin
    .from("astrologer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (directProfile?.id) {
    return directProfile.id;
  }

  // 2. Check if user is authenticated via admin DB (DB2) and resolve by matching display_name/email
  try {
    const adminDbClient = await createAdminClient("admin");
    const { data: adminDbProfile } = await adminDbClient
      .from("astrologer_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminDbProfile?.display_name) {
      const { data: matchedMainProfile } = await mainAdmin
        .from("astrologer_profiles")
        .select("id")
        .eq("display_name", adminDbProfile.display_name)
        .maybeSingle();

      if (matchedMainProfile?.id) {
        return matchedMainProfile.id;
      }
    }
  } catch {
    // Admin DB check fallback
  }

  return null;
}

/**
 * Loads all Puja rituals assigned to the authenticated astrologer/pandit.
 * Accepts optional profileHint (profile ID or display name) from server layout guard.
 */
export async function getAstrologerAssignedPujas(profileHint?: string): Promise<{
  success: boolean;
  data: AstrologerAssignedPujaItem[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, data: [], error: "Authentication required" };

    const admin = await createAdminClient("main");
    let astrologerProfileId: string | null = null;

    if (profileHint) {
      // 1. Try if profileHint is already a profile UUID in main DB
      const { data: byId } = await admin
        .from("astrologer_profiles")
        .select("id")
        .eq("id", profileHint)
        .maybeSingle();

      if (byId?.id) {
        astrologerProfileId = byId.id;
      } else {
        // 2. Try if profileHint is display_name
        const { data: byName } = await admin
          .from("astrologer_profiles")
          .select("id")
          .eq("display_name", profileHint)
          .maybeSingle();

        if (byName?.id) {
          astrologerProfileId = byName.id;
        }
      }
    }

    if (!astrologerProfileId) {
      astrologerProfileId = await resolveCurrentAstrologerProfileId(user);
    }

    if (!astrologerProfileId) {
      return { success: false, data: [], error: "Astrologer profile not found" };
    }

    // Query strictly all rituals assigned to this authenticated astrologer
    // Defensive select: if venue columns have not yet been migrated, fallback safely
    let bookingsData: any[] = [];
    const fullSelect = `
      id,
      puja_id,
      customer_id,
      preferred_date,
      time_slot,
      sankalp_name,
      gotra,
      special_instructions,
      status,
      fulfilment_status,
      darshan_room_name,
      evidence_photos,
      evidence_video_url,
      completion_notes,
      completed_at,
      created_at,
      venue_address,
      latitude,
      longitude,
      landmark,
      puja:puja_catalog(id, title, category, duration_minutes, image_url, samagri_details, preparation_instructions)
    `;

    const { data: fullBookings, error: fullError } = await admin
      .from("puja_bookings")
      .select(fullSelect)
      .eq("astrologer_id", astrologerProfileId)
      .not("status", "in", '("cancelled")')
      .order("preferred_date", { ascending: true });

    if (!fullError && fullBookings) {
      bookingsData = fullBookings;
    } else {
      // Fallback query without new columns if 053 migration has not been executed yet in DB1
      const baseSelect = `
        id,
        puja_id,
        customer_id,
        preferred_date,
        time_slot,
        sankalp_name,
        gotra,
        special_instructions,
        status,
        fulfilment_status,
        darshan_room_name,
        evidence_photos,
        evidence_video_url,
        completion_notes,
        completed_at,
        created_at,
        puja:puja_catalog(id, title, category, duration_minutes, image_url, samagri_details, preparation_instructions)
      `;
      const { data: baseBookings, error: baseError } = await admin
        .from("puja_bookings")
        .select(baseSelect)
        .eq("astrologer_id", astrologerProfileId)
        .not("status", "in", '("cancelled")')
        .order("preferred_date", { ascending: true });

      if (baseError) {
        return { success: false, data: [], error: baseError.message };
      }
      bookingsData = baseBookings || [];
    }

    return {
      success: true,
      data: bookingsData,
    };
  } catch (err: any) {
    return { success: false, data: [], error: err.message || "Failed to load assigned Pujas" };
  }
}

/**
 * Astrologer accepts or rejects an assigned Puja booking.
 */
export async function respondToPujaAssignment(params: {
  bookingId: string;
  action: "accept" | "reject";
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required" };

    const admin = await createAdminClient("main");
    const astrologerProfileId = await resolveCurrentAstrologerProfileId(user);
    if (!astrologerProfileId) return { success: false, error: "Astrologer profile not found" };

    const { data: booking } = await admin
      .from("puja_bookings")
      .select("id, astrologer_id, status, fulfilment_status")
      .eq("id", params.bookingId)
      .maybeSingle();

    if (!booking) return { success: false, error: "Booking not found" };

    // If the booking was open/unassigned, the accepting astrologer claims duty
    if (booking.astrologer_id && booking.astrologer_id !== astrologerProfileId) {
      return { success: false, error: "This booking has already been claimed by another astrologer." };
    }

    if (params.action === "accept") {
      await admin
        .from("puja_bookings")
        .update({
          astrologer_id: astrologerProfileId,
          fulfilment_status: "assignment_accepted",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.bookingId);
    } else {
      // Rejection: Find next available approved astrologer and auto-transfer duty,
      // or set to awaiting_assignment for Super Admin if no other pandit is available
      const { data: eligibleAstros } = await admin
        .from("astrologer_profiles")
        .select("id, display_name")
        .eq("approval_status", "approved")
        .neq("id", astrologerProfileId)
        .order("created_at", { ascending: true });

      const nextPandit = eligibleAstros && eligibleAstros.length > 0 ? eligibleAstros[0] : null;

      if (nextPandit) {
        // Automatically transfer duty to the next available consecrated Pandit
        await admin
          .from("puja_bookings")
          .update({
            astrologer_id: nextPandit.id,
            fulfilment_status: "scheduled",
            admin_notes: `Previous priest declined (${params.reason || "unavailable"}). Auto-transferred to ${nextPandit.display_name}.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.bookingId);
      } else {
        // Rejection clears astrologer_id so Super Admin can reassign
        await admin
          .from("puja_bookings")
          .update({
            astrologer_id: null,
            fulfilment_status: "awaiting_assignment",
            admin_notes: `Pandit declined: ${params.reason || "Declined without specified reason"}. Awaiting Super Admin reassignment.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.bookingId);
      }
    }

    revalidatePath("/astrologer/pujas");
    revalidatePath("/customer/puja");
    revalidatePath("/super-admin/puja-bookings");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to respond to assignment" };
  }
}

/**
 * Updates fulfilment progress (preparation, in_progress, completed) and uploads completion evidence.
 */
export async function updatePujaFulfilmentProgress(params: {
  bookingId: string;
  stage: "preparation" | "in_progress" | "completed";
  evidencePhotos?: string[];
  evidenceVideoUrl?: string;
  completionNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required" };

    const admin = await createAdminClient("main");
    const astrologerProfileId = await resolveCurrentAstrologerProfileId(user);
    if (!astrologerProfileId) return { success: false, error: "Astrologer profile not found" };

    const { data: booking } = await admin
      .from("puja_bookings")
      .select("id, astrologer_id, fulfilment_status")
      .eq("id", params.bookingId)
      .maybeSingle();

    if (!booking) return { success: false, error: "Booking not found" };
    if (booking.astrologer_id !== astrologerProfileId) {
      return { success: false, error: "Unauthorized: You are not assigned to this booking" };
    }

    const updates: Record<string, any> = {
      fulfilment_status: params.stage,
      updated_at: new Date().toISOString(),
    };

    if (params.stage === "completed") {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();
      if (params.completionNotes) updates.completion_notes = params.completionNotes.trim();
      if (params.evidencePhotos && params.evidencePhotos.length > 0) {
        updates.evidence_photos = params.evidencePhotos;
      }
      if (params.evidenceVideoUrl) {
        updates.evidence_video_url = params.evidenceVideoUrl.trim();
      }
    }

    await admin.from("puja_bookings").update(updates).eq("id", params.bookingId);

    // Mandatory Rule 9 & 10: For offline/online Puja bookings under Pay at Drop, the pandit collects directly from the customer.
    // In accordance with Phase 5 & 11 financial integrity rules:
    // Service completion and payment verification are strictly independent states.
    // Commission is NEVER accrued automatically on status 'completed', nor calculated using catalogue base price or fallback amounts.
    // Commission accrues solely when actual collection is declared by the pandit and verified.
    if (params.stage === "completed") {
      // Service marked as completed. Verification and commission accrual occur via dedicated declaration & verification workflow.
    }

    revalidatePath("/astrologer/pujas");
    revalidatePath("/customer/puja");
    revalidatePath("/super-admin/puja-bookings");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update fulfilment progress" };
  }
}

