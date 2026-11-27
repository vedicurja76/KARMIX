"use server";

// =====================================================
// ASTROLOGER PORTAL EXTENDED SERVER ACTIONS
// Reviews, Bookings, Earnings, Notifications, & Support
// =====================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAstrologer } from "@/lib/auth/session";
import { getOwnAstrologerProfile } from "@/lib/astrologer/guard";
import { checkBookingTransition, meetingStatusForBooking } from "@/lib/consultation/booking-lifecycle";
import type { AuthResult } from "@/lib/types/auth.types";
import type {
  CustomerBooking,
  CustomerNotification,
  ConsultationReview,
  BookingStatus,
} from "@/lib/types/database.types";

export interface AstrologerEarningsRecord {
  id: string;
  booking_id: string;
  customer_name: string;
  service_type: string;
  consultation_mode: string;
  fee_amount: number;
  payment_status: "verified" | "pending" | "unpaid" | "refunded";
  currency: string;
  scheduled_at: string;
  status: string;
  created_at: string;
}

export interface AstrologerEarningsSummary {
  totalConsultations: number;
  completedConsultations: number;
  totalEarningsValue: number;
  pendingEarningsValue: number;
  records: AstrologerEarningsRecord[];
}

/**
 * Resolves the authenticated astrologer's profile record using request-memoized lookup.
 */
async function getAuthenticatedAstrologerProfile() {
  const { user, target } = await requireAstrologer();
  const { profile, error } = await getOwnAstrologerProfile();

  if (error || !profile) {
    throw new Error(error || "Astrologer profile record not found.");
  }

  const supabase = await createClient(target);
  return { user, profile, supabase };
}

/**
 * Loads all consultation bookings assigned to the authenticated astrologer.
 */
export async function getAstrologerBookingsAction(): Promise<
  AuthResult<CustomerBooking[]>
> {
  try {
    const { profile } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { data: bookings, error } = await admin
      .from("customer_bookings")
      .select("*, customer:customer_id(full_name, avatar_url)")
      .eq("astrologer_id", profile.id)
      .order("scheduled_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const rawBookings = (bookings || []) as Array<
      CustomerBooking & {
        customer?: { full_name?: string | null; avatar_url?: string | null } | null;
      }
    >;
    const enriched: CustomerBooking[] = rawBookings.map((b) => ({
      ...b,
      customer_name: b.customer?.full_name || "Verified Customer",
      customer_avatar_url: b.customer?.avatar_url || null,
    }));

    return { success: true, data: enriched };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load bookings.",
    };
  }
}

/**
 * Updates the status of a booking assigned to the authenticated astrologer.
 * Allows confirming, completing, or cancelling a consultation.
 */
export async function updateAstrologerBookingStatusAction(params: {
  bookingId: string;
  status: BookingStatus;
  cancellationReason?: string;
  notes?: string;
}): Promise<AuthResult<CustomerBooking>> {
  try {
    const { profile } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const validStatuses: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled", "no_show"];
    if (!validStatuses.includes(params.status)) {
      return { success: false, error: "Invalid booking status." };
    }

    // Verify ownership
    const { data: beforeBooking, error: fetchErr } = await admin
      .from("customer_bookings")
      .select("*, customer:customer_id(full_name)")
      .eq("id", params.bookingId)
      .eq("astrologer_id", profile.id)
      .single();

    if (fetchErr || !beforeBooking) {
      return { success: false, error: "Booking record not found or unauthorized." };
    }

    // Enforce the authoritative lifecycle (no reopening terminal bookings, no early completion)
    const transition = checkBookingTransition(beforeBooking.status as BookingStatus, params.status, {
      scheduledAt: beforeBooking.scheduled_at,
    });
    if (!transition.allowed) {
      return { success: false, error: transition.reason };
    }

    // Payment Verification Guard:
    // Prevent astrologer from unilaterally confirming an unpaid booking.
    if (params.status === "confirmed" && beforeBooking.status === "pending") {
      const priceNum = Number(beforeBooking.price) || 0;
      const isPayAtDrop = beforeBooking.payment_mode === "pay_at_drop";
      const isPaid = beforeBooking.payment_status === "paid";
      const isFree = priceNum <= 0;

      if (!isFree && !isPayAtDrop && !isPaid) {
        const [directRes, orderRes, intentRes] = await Promise.all([
          admin
            .from("direct_consultation_payments")
            .select("id")
            .eq("booking_id", params.bookingId)
            .eq("status", "verified")
            .limit(1),
          admin
            .from("payment_orders")
            .select("id")
            .eq("entity_type", "consultation")
            .eq("entity_id", params.bookingId)
            .eq("status", "successful")
            .limit(1),
          admin
            .from("payment_intents")
            .select("id")
            .eq("entity_type", "consultation")
            .eq("booking_id", params.bookingId)
            .eq("status", "succeeded")
            .limit(1),
        ]);

        const hasVerifiedPayment =
          Boolean(directRes.data?.length) ||
          Boolean(orderRes.data?.length) ||
          Boolean(intentRes.data?.length);

        if (!hasVerifiedPayment) {
          return {
            success: false,
            error: "This consultation cannot be confirmed until payment is verified.",
          };
        }
      }
    }
    if (transition.noop) {
      // Repeated request for the state the booking is already in: succeed without side effects
      if (params.status === "completed") {
        const { error: accrualError } = await admin.rpc("accrue_verified_booking_commissions", {
          p_booking_id: params.bookingId,
        });
        if (accrualError) {
          console.warn("[updateAstrologerBookingStatusAction] verified commission reconciliation notice:", accrualError.message);
        }
      }
      return { success: true, data: beforeBooking as unknown as CustomerBooking };
    }

    const updatePayload: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };

    if (params.status === "cancelled") {
      updatePayload.cancellation_reason = params.cancellationReason || "Cancelled by astrologer";
      updatePayload.cancelled_at = new Date().toISOString();
    }

    // If transitioning to completed, use the atomic RPC if available
    if (params.status === "completed") {
      const atomicRes = await admin.rpc("complete_astrologer_consultation_atomic", {
        p_booking_id: params.bookingId,
        p_astrologer_id: profile.id,
        p_notes: params.notes || null,
      });

      if (!atomicRes.error && atomicRes.data) {
        // Post-chat / post-call wallet deduction (Chat first, wallet deduction after completion)
        // Video requires upfront payment — wallet deduction not applicable here.
        const isWalletPostBilling =
          (beforeBooking.consultation_mode === "Chat" ||
            beforeBooking.consultation_mode === "Call") &&
          beforeBooking.direct_payment_status !== "paid" &&
          beforeBooking.direct_payment_status !== "confirmed";

        if (isWalletPostBilling) {
          try {
            const { calculateConsultationFee, resolveConsultationRate } = await import(
              "@/lib/consultation/billing-engine"
            );
            const actualEndedAt = new Date();
            const rateInfo = resolveConsultationRate({
              mode: beforeBooking.consultation_mode as "Chat" | "Call" | "Video",
              chatRate: profile.chat_price_per_minute,
              voiceRate: profile.voice_price_per_minute,
              videoRate: profile.video_price_per_minute,
            });

            const hasActualStart = Boolean(beforeBooking.actual_started_at);
            const durationSeconds = hasActualStart
              ? Math.max(
                1,
                Math.floor(
                  (actualEndedAt.getTime() -
                    new Date(beforeBooking.actual_started_at as string).getTime()) /
                  1000
                )
              )
              : Number(beforeBooking.price) > 0
                ? (Number(beforeBooking.duration_minutes) || 1) * 60
                : 0;

            const feeCalc = calculateConsultationFee({
              durationSeconds,
              ratePerMinutePaise: rateInfo.ratePaise,
              commissionPercent: 10,
            });

            const computedRupees =
              hasActualStart && feeCalc.grossAmountPaise > 0
                ? feeCalc.grossAmountRupees
                : Number(beforeBooking.price) > 0
                  ? Number(beforeBooking.price)
                  : feeCalc.grossAmountRupees;

            // Persist authoritative duration, rate & computed price before atomic wallet RPC
            await admin
              .from("customer_bookings")
              .update({
                actual_ended_at: actualEndedAt.toISOString(),
                billable_minutes: feeCalc.billableMinutes,
                rate_per_minute: rateInfo.rateRupees,
                price: computedRupees,
                updated_at: actualEndedAt.toISOString(),
              })
              .eq("id", beforeBooking.id);

            if (computedRupees > 0) {
              const { data: walletPayData, error: walletDebitErr } = await admin.rpc(
                "pay_consultation_via_wallet_atomic",
                {
                  p_customer_id: beforeBooking.customer_id,
                  p_booking_id: beforeBooking.id,
                }
              );

              if (walletDebitErr || !walletPayData?.success) {
                const failReason =
                  walletDebitErr?.message ||
                  walletPayData?.error ||
                  "Insufficient wallet balance";
                console.warn(
                  "[updateAstrologerBookingStatusAction] Post-completion wallet debit failed:",
                  failReason
                );
                // Notify customer so they can recharge/pay via Wallet or UPI without marking paid
                await admin.from("customer_notifications").insert({
                  customer_id: beforeBooking.customer_id,
                  title: "Consultation Payment Pending",
                  message: `Your ${beforeBooking.consultation_mode} consultation (${feeCalc.billableMinutes} min, ₹${computedRupees.toFixed(2)}) ended, but automatic wallet deduction could not complete (${failReason}). Please pay via Wallet or UPI in My Bookings.`,
                  link_url: "/customer/bookings",
                  event_type: "booking_wallet_debit_failed",
                  is_read: false,
                  created_at: actualEndedAt.toISOString(),
                });
              } else {
                const collectedRupees = walletPayData.amount_paise
                  ? Number(walletPayData.amount_paise) / 100
                  : computedRupees;
                await admin
                  .from("customer_bookings")
                  .update({
                    payment_collected_amount: collectedRupees,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", beforeBooking.id);

                // Credit astrologer's operating wallet (idempotent)
                try {
                  const { creditAstrologerOperatingWallet } = await import(
                    "@/lib/financial/astrologer-wallet-engine"
                  );
                  const amountPaise =
                    walletPayData.amount_paise || Math.round(computedRupees * 100);
                  if (amountPaise > 0) {
                    await creditAstrologerOperatingWallet({
                      astrologerId: profile.id,
                      amountPaise,
                      creditType: "RECHARGE",
                      idempotencyKey: `wallet_pay_astro_credit_${beforeBooking.id}`,
                      description: `Post-consultation fee (${feeCalc.billableMinutes} min) via Customer Wallet for booking #${beforeBooking.id}`,
                      metadata: {
                        booking_id: beforeBooking.id,
                        customer_id: beforeBooking.customer_id,
                        billable_minutes: feeCalc.billableMinutes,
                        rate_per_minute_inr: rateInfo.rateRupees,
                        order_number: walletPayData.order_number,
                        receipt_number: walletPayData.receipt_number,
                        trigger: "completion_auto_debit",
                      },
                    });
                  }
                } catch (creditErr) {
                  console.warn(
                    "[updateAstrologerBookingStatusAction] Astrologer wallet credit notice:",
                    creditErr
                  );
                }

                // Notify customer about automatic wallet deduction
                const { error: notifErr } = await admin.from("customer_notifications").insert({
                  customer_id: beforeBooking.customer_id,
                  title: "Consultation Fee Deducted",
                  message: `₹${collectedRupees.toFixed(2)} (${feeCalc.billableMinutes} min @ ₹${rateInfo.rateRupees}/min) has been deducted from your wallet for the completed ${beforeBooking.consultation_mode} consultation.`,
                  link_url: "/customer/bookings",
                  event_type: "booking_wallet_deducted",
                  is_read: false,
                  created_at: new Date().toISOString(),
                });
                if (notifErr) {
                  console.warn(
                    "[updateAstrologerBookingStatusAction] deduction notification failed:",
                    notifErr.message
                  );
                }
              }
            }
          } catch (walletAutoErr) {
            console.warn(
              "[updateAstrologerBookingStatusAction] Post-completion auto wallet debit error:",
              walletAutoErr
            );
          }
        }

        // Reconcile financial general ledgers
        try {
          const { reconcileCompletedConsultationLedgers } = await import("@/lib/financial/ledger");
          await reconcileCompletedConsultationLedgers({
            bookingId: beforeBooking.id,
            astrologerId: profile.id,
          });
        } catch (ledgerReconcileErr) {
          console.warn("[updateAstrologerBookingStatusAction] Ledger reconciliation notice:", ledgerReconcileErr);
        }

        revalidatePath("/astrologer/dashboard");
        revalidatePath("/astrologer/bookings");
        revalidatePath("/astrologer/earnings");
        revalidatePath("/customer/bookings");
        revalidatePath("/customer");
        revalidatePath("/customer/wallet");
        revalidatePath("/super-admin/bookings", "page");
        revalidatePath("/super-admin", "page");

        return {
          success: true,
          data: atomicRes.data as CustomerBooking,
        };
      }
    }

    // Conditional on the status we validated against, so concurrent requests cannot both win
    const { data: updatedBooking, error: updateErr } = await admin
      .from("customer_bookings")
      .update(updatePayload)
      .eq("id", params.bookingId)
      .eq("status", beforeBooking.status)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
    if (!updatedBooking) {
      return {
        success: false,
        error: "This booking was changed by someone else. Please refresh and try again.",
      };
    }

    // Keep the meeting record consistent with the booking so the two can never contradict
    const syncedMeetingStatus = meetingStatusForBooking(params.status);
    if (syncedMeetingStatus) {
      const nowIso = new Date().toISOString();
      const { error: meetingSyncErr } = await admin
        .from("consultation_meetings")
        .update({
          status: syncedMeetingStatus,
          ...(syncedMeetingStatus === "ended" ? { ended_at: nowIso } : {}),
          updated_at: nowIso,
        })
        .eq("booking_id", params.bookingId)
        .in("status", ["scheduled", "waiting", "active"]);
      if (meetingSyncErr) {
        console.error("[updateAstrologerBookingStatusAction] meeting sync failed:", meetingSyncErr.message);
      }
    }

    // Notify customer on status update
    try {
      let notifTitle = "";
      let notifMessage = "";
      if (params.status === "confirmed") {
        notifTitle = "Consultation Confirmed";
        notifMessage = `${profile.display_name} confirmed your ${beforeBooking.service_type || "consultation"} session.`;
      } else if (params.status === "completed") {
        notifTitle = "Consultation Completed";
        notifMessage = `Your session with ${profile.display_name} has concluded. You can leave a review.`;
      } else if (params.status === "cancelled") {
        notifTitle = "Consultation Cancelled";
        notifMessage = `Your consultation with ${profile.display_name} was cancelled: ${params.cancellationReason || "Session cancelled"}.`;
      }

      if (notifTitle) {
        const { error: notifInsertErr } = await admin.from("customer_notifications").insert({
          customer_id: beforeBooking.customer_id,
          title: notifTitle,
          message: notifMessage,
          link_url: "/customer/bookings",
          event_type: `booking_${params.status}`,
          is_read: false,
          created_at: new Date().toISOString(),
        });
        if (notifInsertErr) {
          console.warn("[updateAstrologerBookingStatusAction] notification insert failed:", notifInsertErr.message);
        }
      }
    } catch (notifErr) {
      console.warn("[updateAstrologerBookingStatusAction] customer notification notice:", notifErr);
    }

    // Invalidate caches across astrologer, customer, and admin portals
    revalidatePath("/astrologer/dashboard");
    revalidatePath("/astrologer/bookings");
    revalidatePath("/astrologer/earnings");
    revalidatePath("/customer/bookings");
    revalidatePath("/customer");
    revalidatePath("/super-admin/bookings", "page");
    revalidatePath("/super-admin", "page");

    if (params.status === "completed") {
      const { error: accrualError } = await admin.rpc("accrue_verified_booking_commissions", {
        p_booking_id: beforeBooking.id,
      });
      if (accrualError) {
        console.warn("[updateAstrologerBookingStatusAction] verified commission accrual notice:", accrualError.message);
      }

      try {
        const { reconcileCompletedConsultationLedgers } = await import("@/lib/financial/ledger");
        await reconcileCompletedConsultationLedgers({
          bookingId: beforeBooking.id,
          astrologerId: profile.id,
        });
      } catch (ledgerReconcileErr) {
        console.warn("[updateAstrologerBookingStatusAction] Ledger reconciliation notice:", ledgerReconcileErr);
      }
    }

    return {
      success: true,
      data: updatedBooking as CustomerBooking,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update booking status.",
    };
  }
}

/**
 * Loads customer reviews & ratings submitted for this astrologer.
 */
export async function getAstrologerReviewsAction(): Promise<
  AuthResult<{
    reviews: (ConsultationReview & { customer_name?: string })[];
    averageRating: number;
    totalReviews: number;
  }>
> {
  try {
    const { profile } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { data: reviews, error } = await admin
      .from("consultation_reviews")
      .select("*, customer:customer_id(full_name)")
      .eq("astrologer_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const reviewList = (reviews || []) as Array<
      ConsultationReview & {
        customer?: { full_name?: string | null } | null;
      }
    >;
    const totalReviews = reviewList.length;
    const avg =
      totalReviews > 0
        ? Number((reviewList.reduce((acc, r) => acc + (r.rating || 5), 0) / totalReviews).toFixed(1))
        : 0.0;

    const enriched = reviewList.map((r) => ({
      ...r,
      customer_name: r.customer?.full_name || "Verified Customer",
    }));

    return {
      success: true,
      data: {
        reviews: enriched,
        averageRating: avg,
        totalReviews,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load reviews.",
    };
  }
}

/**
 * Loads earnings and fee breakdown derived from consultations.
 */
export async function getAstrologerEarningsAction(): Promise<
  AuthResult<AstrologerEarningsSummary>
> {
  try {
    const { profile, supabase } = await getAuthenticatedAstrologerProfile();

    const { data: bookings, error } = await supabase
      .from("customer_bookings")
      .select("*, customer:customer_id(full_name)")
      .eq("astrologer_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const allBookings = (bookings || []) as Array<
      CustomerBooking & {
        customer?: { full_name?: string | null } | null;
      }
    >;
    const bookingIds = allBookings.map((booking) => booking.id);
    const paymentStatusByBooking = new Map<string, AstrologerEarningsRecord["payment_status"]>();
    if (bookingIds.length > 0) {
      const admin = await createAdminClient("main");
      const [directPayments, paymentOrders, paymentIntents] = await Promise.all([
        admin
          .from("direct_consultation_payments")
          .select("booking_id, status, submitted_at")
          .in("booking_id", bookingIds)
          .order("submitted_at", { ascending: false }),
        admin
          .from("payment_orders")
          .select("entity_id")
          .eq("entity_type", "consultation")
          .eq("status", "successful")
          .in("entity_id", bookingIds),
        admin
          .from("payment_intents")
          .select("booking_id")
          .eq("entity_type", "consultation")
          .eq("status", "succeeded")
          .in("booking_id", bookingIds),
      ]);

      if (directPayments.error) {
        // Handle gracefully if table is not yet migrated in database schema
        console.warn("[getAstrologerEarningsAction] direct_consultation_payments lookup:", directPayments.error.message);
      }
      if (paymentOrders.error) {
        return { success: false, error: `Failed to load platform payment records: ${paymentOrders.error.message}` };
      }
      if (paymentIntents.error) {
        return { success: false, error: `Failed to load payment intent records: ${paymentIntents.error.message}` };
      }

      for (const payment of (directPayments.error ? [] : directPayments.data) || []) {
        if (paymentStatusByBooking.has(payment.booking_id)) continue;
        paymentStatusByBooking.set(
          payment.booking_id,
          payment.status === "verified"
            ? "verified"
            : payment.status === "pending"
              ? "pending"
              : payment.status === "refunded"
                ? "refunded"
                : "unpaid"
        );
      }
      for (const order of paymentOrders.data || []) {
        paymentStatusByBooking.set(order.entity_id, "verified");
      }
      for (const intent of paymentIntents.data || []) {
        paymentStatusByBooking.set(intent.booking_id, "verified");
      }
      // Direct booking payment status from wallet or gateway
      for (const b of allBookings) {
        if (b.direct_payment_status === "paid" || b.payment_status === "paid") {
          paymentStatusByBooking.set(b.id, "verified");
        }
      }
    }

    const customerMap: Record<string, string> = {};

    // First populate names from the joined customer relation
    const missingCustomerIds: string[] = [];
    for (const b of allBookings) {
      if (b.customer?.full_name) {
        customerMap[b.customer_id] = b.customer.full_name;
      } else if (b.customer_id && !customerMap[b.customer_id]) {
        missingCustomerIds.push(b.customer_id);
      }
    }

    // Only fallback query for customer profiles if any were missing from join
    if (missingCustomerIds.length > 0) {
      const uniqueMissing = Array.from(new Set(missingCustomerIds));
      const { data: customers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueMissing);
      if (customers) {
        for (const c of customers) {
          if (c.id && c.full_name) {
            customerMap[c.id] = c.full_name;
          }
        }
      }
    }

    let completedCount = 0;
    let totalEarnings = 0;
    let pendingEarnings = 0;

    const records: AstrologerEarningsRecord[] = allBookings.map((b) => {
      const price = Number(b.price) || 0;
      const paymentStatus = paymentStatusByBooking.get(b.id) || "unpaid";
      if (b.status === "completed") {
        completedCount++;
        if (paymentStatus === "verified") {
          totalEarnings += price;
        }
      } else if (b.status === "confirmed" || b.status === "pending") {
        pendingEarnings += price;
      }

      return {
        id: `earn-${b.id.slice(0, 8)}`,
        booking_id: b.id,
        customer_name: customerMap[b.customer_id] || "Customer",
        service_type: b.service_type,
        consultation_mode: b.consultation_mode,
        fee_amount: price,
        payment_status: paymentStatus,
        currency: "INR",
        scheduled_at: b.scheduled_at,
        status: b.status,
        created_at: b.created_at,
      };
    });

    return {
      success: true,
      data: {
        totalConsultations: allBookings.length,
        completedConsultations: completedCount,
        totalEarningsValue: totalEarnings,
        pendingEarningsValue: pendingEarnings,
        records,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load earnings.",
    };
  }
}

/**
 * Loads persistent notifications for the authenticated astrologer.
 */
export async function getAstrologerNotificationsAction(): Promise<
  AuthResult<CustomerNotification[]>
> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { data: notifications, error } = await admin
      .from("customer_notifications")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (notifications || []) as CustomerNotification[],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load notifications.",
    };
  }
}

/**
 * Marks an astrologer notification as read.
 */
export async function markAstrologerNotificationReadAction(
  notificationId: string
): Promise<AuthResult<{ success: boolean }>> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { error } = await admin
      .from("customer_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("customer_id", user.id);

    if (error) {
      return { success: false, error: "Failed to update notification." };
    }

    revalidatePath("/astrologer/notifications", "page");
    revalidatePath("/astrologer", "layout");
    return { success: true, data: { success: true } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark notification.",
    };
  }
}

/**
 * Deletes all notifications for the authenticated astrologer.
 */
export async function clearAllAstrologerNotificationsAction(): Promise<
  AuthResult<{ success: boolean }>
> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { error } = await admin
      .from("customer_notifications")
      .delete()
      .eq("customer_id", user.id);

    if (error) {
      return { success: false, error: `Failed to clear notifications: ${error.message}` };
    }

    revalidatePath("/astrologer/notifications", "page");
    revalidatePath("/astrologer", "layout");

    return { success: true, data: { success: true } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to clear notifications.",
    };
  }
}

/**
 * Deletes a single notification for the authenticated astrologer.
 */
export async function deleteAstrologerNotificationAction(
  notificationId: string
): Promise<AuthResult<{ success: boolean }>> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { error } = await admin
      .from("customer_notifications")
      .delete()
      .eq("id", notificationId)
      .eq("customer_id", user.id);

    if (error) {
      return { success: false, error: `Failed to delete notification: ${error.message}` };
    }

    revalidatePath("/astrologer/notifications", "page");
    revalidatePath("/astrologer", "layout");

    return { success: true, data: { success: true } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete notification.",
    };
  }
}

/**
 * Marks all notifications as read for the authenticated astrologer.
 */
export async function markAllAstrologerNotificationsReadAction(): Promise<
  AuthResult<{ success: boolean }>
> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { error } = await admin
      .from("customer_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("customer_id", user.id)
      .eq("is_read", false);

    if (error) {
      return { success: false, error: "Failed to mark all notifications as read." };
    }

    revalidatePath("/astrologer/notifications", "page");
    revalidatePath("/astrologer", "layout");

    return { success: true, data: { success: true } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark all notifications.",
    };
  }
}

/**
 * Returns the unread notification count for the authenticated astrologer.
 */
export async function getAstrologerUnreadNotificationCount(): Promise<AuthResult<number>> {
  try {
    const { user } = await getAuthenticatedAstrologerProfile();
    const admin = await createAdminClient("main");

    const { count, error } = await admin
      .from("customer_notifications")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .eq("is_read", false);

    if (error) {
      return { success: true, data: 0 };
    }

    return { success: true, data: count || 0 };
  } catch {
    return { success: true, data: 0 };
  }
}


