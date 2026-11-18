"use server";

// =====================================================
// ADMIN CUSTOMER MANAGEMENT SERVER ACTIONS
// =====================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/admin-guard";
import type { AuthResult } from "@/lib/types/auth.types";
import type { CustomerBooking, CustomerFullProfile, Lead, Profile } from "@/lib/types/database.types";
import { isValidUUID } from "@/lib/validations/lead";
import { logAdminAction } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";

export interface AdminCustomerSummary extends Profile {
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  birthplace?: string | null;
  gender?: string | null;
  total_bookings?: number;
  total_enquiries?: number;
}

export interface AdminCustomersFilter {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminCustomersResultData {
  customers: AdminCustomerSummary[];
  totalCount: number;
}

export interface AdminCustomerDetailedView {
  profile: Profile;
  fullProfile: CustomerFullProfile | null;
  bookings: CustomerBooking[];
  leads: Lead[];
}

// In-memory 60-second memoized auth email map for high-speed admin customer browsing
let cachedAuthEmailMap: { map: Map<string, string>; expiresAt: number } | null = null;

/**
 * Fetch registered customer seekers with search and pagination (Admin only).
 */
export async function getAdminCustomers(
  filter: AdminCustomersFilter = {}
): Promise<AuthResult<AdminCustomersResultData>> {
  try {
    // Customer PII is Owner-only; consultant admins are scoped to assigned leads.
    await requireSuperAdmin();

    const supabase = await createAdminClient("main");
    const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("role", "customer")
      .neq("full_name", "[Deleted Customer]")
      .neq("full_name", "[Deleted User]");

    if (filter.search && filter.search.trim()) {
      const term = `%${filter.search.trim()}%`;
      query = query.ilike("full_name", term);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: profiles, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const customerProfiles = (profiles as Profile[]) ?? [];
    const customerIds = customerProfiles.map((p) => p.id);

    // Resolve emails from auth.admin (with 60-second in-memory memoization)
    let emailMap = new Map<string, string>();
    if (cachedAuthEmailMap && Date.now() < cachedAuthEmailMap.expiresAt) {
      emailMap = cachedAuthEmailMap.map;
    } else {
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authUsers?.users) {
          for (const u of authUsers.users) {
            if (u.id && u.email) {
              emailMap.set(u.id, u.email);
            }
          }
          cachedAuthEmailMap = { map: emailMap, expiresAt: Date.now() + 60_000 };
        }
      } catch {
        // Graceful fallback if auth listing is restricted
      }
    }

    // Fetch booking counts
    const bookingCountsMap = new Map<string, number>();
    if (customerIds.length > 0) {
      try {
        const { data: bookings } = await supabase
          .from("customer_bookings")
          .select("customer_id")
          .in("customer_id", customerIds);

        if (bookings) {
          for (const b of bookings) {
            bookingCountsMap.set(b.customer_id, (bookingCountsMap.get(b.customer_id) ?? 0) + 1);
          }
        }
      } catch {
        // customer_bookings may not exist
      }
    }

    // Fetch lead counts
    const leadCountsMap = new Map<string, number>();
    if (customerIds.length > 0) {
      try {
        const { data: leads } = await supabase
          .from("leads")
          .select("customer_id")
          .in("customer_id", customerIds);

        if (leads) {
          for (const l of leads) {
            leadCountsMap.set(l.customer_id, (leadCountsMap.get(l.customer_id) ?? 0) + 1);
          }
        }
      } catch {
        // leads table may be empty
      }
    }

    const enrichedCustomers: AdminCustomerSummary[] = customerProfiles.map((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return {
        ...p,
        email: emailMap.get(p.id) ?? (raw.email as string | null) ?? null,
        phone: (raw.phone as string | null) ?? null,
        date_of_birth: (raw.date_of_birth as string | null) ?? null,
        birthplace: (raw.birthplace as string | null) ?? null,
        gender: (raw.gender as string | null) ?? null,
        total_bookings: bookingCountsMap.get(p.id) ?? 0,
        total_enquiries: leadCountsMap.get(p.id) ?? 0,
      };
    });

    return {
      success: true,
      data: {
        customers: enrichedCustomers,
        totalCount: count ?? 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load customers.",
    };
  }
}

/**
 * Fetch full details, kundli profile, bookings, and enquiries for a specific customer.
 */
export async function getAdminCustomerDetails(
  customerId: string
): Promise<AuthResult<AdminCustomerDetailedView>> {
  try {
    await requireSuperAdmin();

    if (!isValidUUID(customerId)) {
      return { success: false, error: "Invalid customer identifier." };
    }

    const supabase = await createAdminClient("main");

    // 1. Base profile
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", customerId)
      .single();

    if (pErr || !profile) {
      return { success: false, error: "Customer profile not found." };
    }

    // 2. Auth user info (email & verification)
    let email: string | null = null;
    let emailVerified = false;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(customerId);
      if (authUser?.user) {
        email = authUser.user.email ?? null;
        emailVerified = Boolean(authUser.user.email_confirmed_at);
      }
    } catch {
      // Graceful fallback
    }

    const raw = profile as unknown as Record<string, unknown>;
    const fullProfile: CustomerFullProfile = {
      id: profile.id,
      full_name: profile.full_name || null,
      email,
      phone: (raw.phone as string | null) ?? null,
      date_of_birth: (raw.date_of_birth as string | null) ?? null,
      time_of_birth: (raw.time_of_birth as string | null) ?? null,
      birthplace: (raw.birthplace as string | null) ?? null,
      gender: (raw.gender as "male" | "female" | "other" | "prefer_not_to_say" | null) ?? null,
      avatar_url: (raw.avatar_url as string | null) ?? null,
      emailVerified,
      role: profile.role,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    // 3. Customer bookings
    let bookings: CustomerBooking[] = [];
    try {
      const { data: bData } = await supabase
        .from("customer_bookings")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      bookings = (bData as CustomerBooking[]) ?? [];
    } catch {
      // customer_bookings may not exist
    }

    // 4. Customer leads / enquiries
    let leads: Lead[] = [];
    try {
      const { data: lData } = await supabase
        .from("leads")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      leads = (lData as Lead[]) ?? [];
    } catch {
      // leads query error fallback
    }

    return {
      success: true,
      data: {
        profile: profile as Profile,
        fullProfile,
        bookings,
        leads,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load customer details.",
    };
  }
}

/**
 * Super Admin: Delete Customer Account at any time.
 * Purges personal data and cancels pending requests with authoritative audit logging.
 */
export async function deleteCustomerAccountBySuperAdmin(
  customerId: string,
  reason: string
): Promise<AuthResult<{ customerId: string }>> {
  try {
    const { user: adminUser } = await requireSuperAdmin();

    if (!isValidUUID(customerId)) {
      return { success: false, error: "Invalid customer ID." };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: "A valid deletion justification reason is required." };
    }

    const supabase = await createAdminClient("main");

    // Fetch before-state
    const { data: customerProfile, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", customerId)
      .maybeSingle();

    if (fetchErr || !customerProfile) {
      return { success: false, error: "Customer not found." };
    }

    if (customerProfile.role !== "customer") {
      return { success: false, error: "This user is not a customer account." };
    }

    // Try RPC procedure if installed in migration 060
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      "admin_hard_delete_user_account",
      {
        p_user_id: customerId,
        p_actor_id: adminUser.id,
        p_reason: reason.trim(),
      }
    );

    // Invalidate cached auth emails map so deleted accounts disappear immediately
    cachedAuthEmailMap = null;

    if (!rpcErr && rpcResult?.success) {
      revalidatePath("/super-admin/customers");
      revalidatePath("/super-admin");
      return { success: true, data: { customerId } };
    }

    // Fallback if RPC is not yet applied on remote DB: Execute transactional cleanup
    // 1. Cancel future bookings
    await supabase
      .from("customer_bookings")
      .update({
        status: "cancelled",
        cancellation_reason: `Customer account deleted by Super Admin: ${reason.trim()}`,
        cancelled_at: new Date().toISOString(),
        cancelled_by: adminUser.id,
      })
      .eq("customer_id", customerId)
      .in("status", ["pending", "confirmed"]);

    // 2. Close active leads
    await supabase
      .from("leads")
      .update({
        status: "closed",
        notes: `[Closed: Customer account deleted by Super Admin - ${reason.trim()}]`,
        updated_at: new Date().toISOString(),
      })
      .eq("customer_id", customerId);

    // 3. Mark any open deletion requests as COMPLETED
    await supabase
      .from("account_deletion_requests")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: reason.trim(),
      })
      .eq("user_id", customerId);

    // 4. Try auth.admin.deleteUser & profile deletion
    let authDeleted = false;
    try {
      const { error: authErr } = await supabase.auth.admin.deleteUser(customerId);
      if (!authErr) authDeleted = true;
    } catch {
      // Continue to profile deletion/anonymization if direct auth deletion is restricted
    }

    // Attempt direct profile deletion
    const { error: profileDeleteErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", customerId);

    if (profileDeleteErr) {
      // If foreign keys prevent hard delete, update role to 'deleted' and anonymize so it never appears in directory
      await supabase
        .from("profiles")
        .update({
          role: "deleted",
          full_name: "[Deleted Customer]",
          phone: null,
          date_of_birth: null,
          time_of_birth: null,
          birthplace: null,
          avatar_url: null,
          gender: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);
    }

    // 5. Audit Log
    await logAdminAction({
      actorId: adminUser.id,
      actorRole: "super_admin",
      action: "customer.delete_account",
      targetType: "customer",
      targetId: customerId,
      reason: reason.trim(),
      beforeState: customerProfile,
      afterState: { status: "DELETED", purgedAt: new Date().toISOString() },
    });

    revalidatePath("/super-admin/customers");
    revalidatePath("/super-admin");
    return { success: true, data: { customerId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete customer account.",
    };
  }
}
