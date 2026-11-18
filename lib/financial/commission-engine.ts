import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthSession } from "@/lib/auth/session";
import { canAccessCommissionStatement } from "@/lib/financial/commission-access";
import { isCommissionSettingEffective } from "@/lib/financial/commission-rules";
import { revalidatePath } from "next/cache";

export interface CommissionSettingsRecord {
  id: string;
  commission_rate: number;
  applicable_scope: string;
  consultant_id?: string | null;
  effective_from: string;
  effective_until?: string | null;
  is_active: boolean;
  description?: string | null;
  created_at: string;
}

export interface CommissionLedgerRecord {
  id: string;
  consultant_id: string;
  booking_id?: string | null;
  direct_payment_id?: string | null;
  puja_booking_id?: string | null;
  payment_order_id?: string | null;
  payment_intent_id?: string | null;
  entry_type:
    | "COMMISSION_EARNED"
    | "COMMISSION_REVERSED"
    | "SETTLEMENT_PAYMENT"
    | "SETTLEMENT_ALLOCATION"
    | "REFUND_ADJUSTMENT"
    | "MANUAL_ADJUSTMENT";
  commission_rate: number;
  gross_amount_paise: number;
  commission_amount_paise: number;
  currency: string;
  status: "posted" | "settled" | "reversed" | "pending";
  reversal_of?: string | null;
  idempotency_key?: string | null;
  description: string;
  created_at: string;
}

export interface DirectConsultationPaymentRecord {
  id: string;
  booking_id: string;
  customer_id: string;
  utr: string;
  amount_paise: number;
  payment_date: string;
  status: "pending" | "verified" | "rejected" | "refunded" | "failed";
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
}

export interface ConsultantCommissionSettlementRecord {
  id: string;
  settlement_number: string;
  amount_paise: number;
  status: string;
  submitted_utr: string | null;
  payment_date: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface ConsultantBalanceSummary {
  consultant_id: string;
  total_gross_paise: number;
  total_commission_earned_paise: number;
  total_settled_paise: number;
  total_reversed_paise: number;
  outstanding_commission_paise: number; // Negative balance / liability owed to Karmic Ascension
  last_settlement_at?: string | null;
  last_calculated_at: string;
}

/**
 * Retrieves the effective platform commission rate.
 * Defaults to 10% if unconfigured.
 */
/**
 * Retrieves the effective platform commission rate.
 * Supports service-specific rates ('chat', 'voice', 'video', 'puja', or 'all') and consultant-specific overrides.
 * Defaults to 10% if unconfigured.
 */
export async function getEffectiveCommissionRate(
  consultantId?: string,
  serviceType: "chat" | "voice" | "video" | "puja" | "all" = "all"
): Promise<number> {
  const admin = await createAdminClient("main");
  const now = new Date();
  const nowIso = now.toISOString();
  const selection = "commission_rate, service_type, effective_from, effective_until, is_active";

  // 1. Check consultant-specific commission rate
  if (consultantId) {
    const { data: specific, error } = await admin
      .from("commission_settings")
      .select(selection)
      .eq("consultant_id", consultantId)
      .eq("is_active", true)
      .lte("effective_from", nowIso)
      .or(`effective_until.is.null,effective_until.gt.${nowIso}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && specific) {
      const rate = Number(specific.commission_rate);
      if (
        isCommissionSettingEffective(specific as any, now) &&
        Number.isFinite(rate) &&
        rate >= 0 &&
        rate <= 100
      ) {
        return rate;
      }
    }
  }

  // 2. Check service-specific global commission rate (e.g. 'chat', 'voice', 'video', 'puja')
  if (serviceType && serviceType !== "all") {
    const { data: serviceSetting, error: serviceErr } = await admin
      .from("commission_settings")
      .select(selection)
      .eq("service_type", serviceType)
      .is("consultant_id", null)
      .eq("is_active", true)
      .lte("effective_from", nowIso)
      .or(`effective_until.is.null,effective_until.gt.${nowIso}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!serviceErr && serviceSetting) {
      const sRate = Number(serviceSetting.commission_rate);
      if (
        isCommissionSettingEffective(serviceSetting as any, now) &&
        Number.isFinite(sRate) &&
        sRate >= 0 &&
        sRate <= 100
      ) {
        return sRate;
      }
    }
  }

  // 3. Fallback to global platform commission rate
  const { data: globalSetting, error } = await admin
    .from("commission_settings")
    .select(selection)
    .eq("applicable_scope", "all")
    .is("consultant_id", null)
    .eq("is_active", true)
    .lte("effective_from", nowIso)
    .or(`effective_until.is.null,effective_until.gt.${nowIso}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load global commission rate: ${error.message}`);
  }

  const globalRate = Number(globalSetting?.commission_rate);
  if (
    globalSetting &&
    isCommissionSettingEffective(globalSetting as any, now) &&
    Number.isFinite(globalRate) &&
    globalRate >= 0 &&
    globalRate <= 100
  ) {
    return globalRate;
  }

  return 10.0;
}

/**
 * Posts an immutable commission entry into the double-entry commission ledger
 * when an eligible consultation or booking is completed.
 */
export async function postCommissionLedgerEntry({
  consultantId,
  bookingId,
  pujaBookingId,
  paymentOrderId,
  paymentIntentId,
  grossAmountPaise,
  idempotencyKey,
  description,
  customRate,
}: {
  consultantId: string;
  bookingId?: string;
  pujaBookingId?: string;
  paymentOrderId?: string;
  paymentIntentId?: string;
  grossAmountPaise: number;
  idempotencyKey?: string;
  description: string;
  customRate?: number;
}): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    if (!consultantId || !Number.isSafeInteger(grossAmountPaise) || grossAmountPaise <= 0) {
      return { success: false, error: "Invalid consultant or transaction amount" };
    }

    const admin = await createAdminClient("main");
    const rate = customRate !== undefined ? customRate : await getEffectiveCommissionRate(consultantId);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return { success: false, error: "Invalid commission rate" };
    }
    const commissionPaise = Math.round((grossAmountPaise * rate) / 100);

    const referenceId = bookingId || pujaBookingId || paymentOrderId || paymentIntentId;
    if (!idempotencyKey && !referenceId) {
      return { success: false, error: "An idempotency key or transaction reference is required" };
    }
    const idempotency =
      idempotencyKey || `COMM_${consultantId}_${referenceId}`;

    // 1. Insert into commission_ledger
    const { data: ledgerEntry, error: insertErr } = await admin
      .from("commission_ledger")
      .insert({
        consultant_id: consultantId,
        booking_id: bookingId || null,
        puja_booking_id: pujaBookingId || null,
        payment_order_id: paymentOrderId || null,
        payment_intent_id: paymentIntentId || null,
        entry_type: "COMMISSION_EARNED",
        commission_rate: rate,
        gross_amount_paise: grossAmountPaise,
        commission_amount_paise: commissionPaise,
        currency: "INR",
        status: "posted",
        idempotency_key: idempotency,
        description,
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: existingEntry, error: existingEntryError } = await admin
          .from("commission_ledger")
          .select("id, consultant_id, booking_id, puja_booking_id, payment_order_id, payment_intent_id, gross_amount_paise")
          .eq("idempotency_key", idempotency)
          .maybeSingle();

        if (existingEntryError) {
          return { success: false, error: existingEntryError.message };
        }
        if (
          !existingEntry ||
          existingEntry.consultant_id !== consultantId ||
          existingEntry.booking_id !== (bookingId || null) ||
          existingEntry.puja_booking_id !== (pujaBookingId || null) ||
          existingEntry.payment_order_id !== (paymentOrderId || null) ||
          existingEntry.payment_intent_id !== (paymentIntentId || null) ||
          Number(existingEntry.gross_amount_paise) !== grossAmountPaise
        ) {
          return { success: false, error: "Idempotency key is already associated with a different transaction" };
        }

        await refreshConsultantBalanceSummary(consultantId);
        revalidatePath("/astrologer/earnings");
        revalidatePath("/super-admin/financials");
        return { success: true, entryId: existingEntry.id };
      }
      return { success: false, error: insertErr.message };
    }

    // 2. Recompute and update consultant balance summary
    await refreshConsultantBalanceSummary(consultantId);

    revalidatePath("/astrologer/earnings");
    revalidatePath("/super-admin/financials");

    return { success: true, entryId: ledgerEntry.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to post commission" };
  }
}

/**
 * Refreshes consultant's materialized liability and float balance from ledger.
 */
export async function refreshConsultantBalanceSummary(
  consultantId: string
): Promise<ConsultantBalanceSummary | null> {
  const admin = await createAdminClient("main");

  // Attempt atomic DB RPC refresh first
  const { data, error } = await admin.rpc("refresh_consultant_balance_summary", {
    p_consultant_id: consultantId,
  });

  if (!error) {
    const summary = Array.isArray(data) ? data[0] : data;
    if (summary) {
      return summary as ConsultantBalanceSummary;
    }
  }

  // Graceful fallback if RPC does not exist in schema cache (e.g. migration 055 not yet applied)
  try {
    const { data: entries, error: ledgerError } = await admin
      .from("commission_ledger")
      .select("entry_type, gross_amount_paise, commission_amount_paise, status")
      .eq("consultant_id", consultantId);

    if (ledgerError) {
      console.warn("[refreshConsultantBalanceSummary] Ledger query fallback failed:", ledgerError.message);
    }

    let totalGross = 0;
    let totalCommissionEarned = 0;
    let totalSettled = 0;
    let totalReversed = 0;

    for (const e of entries || []) {
      if (e.entry_type === "COMMISSION_EARNED" && e.status !== "reversed") {
        totalGross += Number(e.gross_amount_paise || 0);
        totalCommissionEarned += Number(e.commission_amount_paise || 0);
      } else if (e.entry_type === "SETTLEMENT_PAYMENT" || e.entry_type === "SETTLEMENT_ALLOCATION") {
        totalSettled += Number(e.commission_amount_paise || 0);
      } else if (e.entry_type === "COMMISSION_REVERSED" || e.entry_type === "REFUND_ADJUSTMENT") {
        totalReversed += Number(e.commission_amount_paise || 0);
      }
    }

    const outstandingPaise = Math.max(0, totalCommissionEarned - totalSettled - totalReversed);
    const nowIso = new Date().toISOString();

    const summary: ConsultantBalanceSummary = {
      consultant_id: consultantId,
      total_gross_paise: totalGross,
      total_commission_earned_paise: totalCommissionEarned,
      total_settled_paise: totalSettled,
      total_reversed_paise: totalReversed,
      outstanding_commission_paise: outstandingPaise,
      last_calculated_at: nowIso,
    };

    // Upsert into consultant_balance_summaries if table is available
    await admin.from("consultant_balance_summaries").upsert(
      {
        consultant_id: consultantId,
        total_gross_paise: totalGross,
        total_commission_earned_paise: totalCommissionEarned,
        total_settled_paise: totalSettled,
        total_reversed_paise: totalReversed,
        outstanding_commission_paise: outstandingPaise,
        last_calculated_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "consultant_id" }
    );

    return summary;
  } catch (fallbackErr) {
    console.warn("[refreshConsultantBalanceSummary] Fallback calculation failed:", fallbackErr);
    return {
      consultant_id: consultantId,
      total_gross_paise: 0,
      total_commission_earned_paise: 0,
      total_settled_paise: 0,
      total_reversed_paise: 0,
      outstanding_commission_paise: 0,
      last_calculated_at: new Date().toISOString(),
    };
  }
}

/**
 * Retrieves the authenticated consultant's balance summary and recent ledger statements.
 */
export async function getConsultantCommissionStatement(consultantIdOverride?: string) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return { success: false, error: "Authentication required", data: null };
    }

    const admin = await createAdminClient("main");
    const { data: callerProfile, error: callerProfileError } = await admin
      .from("astrologer_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (callerProfileError) {
      return { success: false, error: callerProfileError.message, data: null };
    }

    const targetConsultantId = consultantIdOverride || callerProfile?.id;
    if (!targetConsultantId) {
      return { success: false, error: "Astrologer profile not found", data: null };
    }

    if (
      !canAccessCommissionStatement(
        session.profile.role,
        callerProfile?.id || null,
        targetConsultantId
      )
    ) {
      return { success: false, error: "Not authorized to access this consultant statement", data: null };
    }

    // Refresh summary
    const summary = await refreshConsultantBalanceSummary(targetConsultantId);

    // Fetch entries
    const { data: ledgerEntries, error: ledgerError } = await admin
      .from("commission_ledger")
      .select("*")
      .eq("consultant_id", targetConsultantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (ledgerError) {
      return { success: false, error: ledgerError.message, data: null };
    }

    let directPaymentsList: DirectConsultationPaymentRecord[] = [];
    const { data: directPayments, error: directPaymentError } = await admin
      .from("direct_consultation_payments")
      .select("id, booking_id, customer_id, utr, amount_paise, payment_date, status, submitted_at, reviewed_at, review_notes, rejection_reason, refunded_at, refund_reason")
      .eq("astrologer_id", targetConsultantId)
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (directPaymentError) {
      // If table is missing from schema cache, gracefully fall back to empty list
      console.warn("[getConsultantCommissionStatement] direct_consultation_payments lookup:", directPaymentError.message);
    } else if (directPayments) {
      directPaymentsList = directPayments as DirectConsultationPaymentRecord[];
    }

    const { data: settlements, error: settlementError } = await admin
      .from("commission_settlements")
      .select("id, settlement_number, amount_paise, status, submitted_utr, payment_date, submitted_at, reviewed_at, rejection_reason, review_notes, created_at")
      .eq("consultant_id", targetConsultantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (settlementError) {
      return { success: false, error: settlementError.message, data: null };
    }

    return {
      success: true,
      data: {
        summary,
        ledger: (ledgerEntries || []) as CommissionLedgerRecord[],
        directPayments: directPaymentsList,
        settlements: (settlements || []) as ConsultantCommissionSettlementRecord[],
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load statement", data: null };
  }
}
