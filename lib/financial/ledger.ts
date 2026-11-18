import { createAdminClient } from "@/lib/supabase/admin";
import { ACCOUNT_CODES } from "./types";

export interface JournalLineInput {
  accountCode: string;
  debitPaise: number;
  creditPaise: number;
}

export interface CreateJournalEntryParams {
  entryNumber?: string;
  referenceType:
    | "consultation_payment"
    | "subscription_payment"
    | "consultant_settlement"
    | "refund"
    | "jyotish_payment_intent";
  referenceId: string;
  description: string;
  entryDate?: string;
  lines: JournalLineInput[];
}

/**
 * Creates an immutable double-entry journal entry with line items.
 * Validates that sum(debits) === sum(credits) down to the exact paise.
 */
export async function createDoubleEntryJournal(
  params: CreateJournalEntryParams
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const { lines, referenceType, referenceId, description } = params;

  // 1. Validation: At least two lines required
  if (!lines || lines.length < 2) {
    return { success: false, error: "A double-entry journal entry requires at least 2 lines." };
  }

  // 2. Parity check: Total Debits must strictly equal Total Credits
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debitPaise < 0 || line.creditPaise < 0) {
      return { success: false, error: "Journal lines cannot have negative debit or credit amounts." };
    }
    if (line.debitPaise > 0 && line.creditPaise > 0) {
      return { success: false, error: "A single line item cannot have both debit and credit amounts." };
    }
    if (line.debitPaise === 0 && line.creditPaise === 0) {
      return { success: false, error: "Journal line must have either debit or credit greater than 0." };
    }

    totalDebit += line.debitPaise;
    totalCredit += line.creditPaise;
  }

  if (totalDebit !== totalCredit) {
    return {
      success: false,
      error: `Accounting equation violated: Total debits (${totalDebit}) must equal total credits (${totalCredit}).`,
    };
  }

  const supabase = await createAdminClient("main");

  // 3. Generate entry number if not provided
  const entryNumber =
    params.entryNumber ||
    `JE-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 4. Try executing via transactional RPC for atomic guarantee
  try {
    const { data: rpcJournalId, error: rpcErr } = await supabase.rpc(
      "post_atomic_double_entry_journal",
      {
        p_entry_number: entryNumber,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_description: description,
        p_lines: lines,
        p_metadata: { entry_date: params.entryDate || new Date().toISOString().slice(0, 10) },
      }
    );

    if (!rpcErr && rpcJournalId) {
      return { success: true, entryId: rpcJournalId };
    }
  } catch {
    // If RPC is not available in environment, fall through safely
  }

  // 5. Resolve accounts by code
  const accountCodes = Array.from(new Set(lines.map((l) => l.accountCode)));
  const { data: accounts, error: accErr } = await supabase
    .from("financial_accounts")
    .select("id, code, balance_paise, type")
    .in("code", accountCodes);

  if (accErr || !accounts || accounts.length < accountCodes.length) {
    return {
      success: false,
      error: `Failed to resolve financial accounts: ${accErr?.message || "Missing accounts in database"}`,
    };
  }

  interface AccountRow {
    id: string;
    code: string;
    balance_paise: number;
    type: string;
  }

  const accountMap = new Map<string, AccountRow>(
    (accounts as AccountRow[]).map((a) => [a.code, a])
  );

  // 6. Insert journal entry header
  const { data: entry, error: entryErr } = await supabase
    .from("financial_journal_entries")
    .insert({
      entry_number: entryNumber,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      entry_date: params.entryDate || new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (entryErr || !entry) {
    return { success: false, error: `Failed to record journal header: ${entryErr?.message}` };
  }

  // 7. Insert lines
  const lineRecords = lines.map((l) => {
    const acc = accountMap.get(l.accountCode)!;
    return {
      journal_entry_id: entry.id,
      account_id: acc.id,
      debit_paise: l.debitPaise,
      credit_paise: l.creditPaise,
    };
  });

  const { error: linesErr } = await supabase.from("financial_journal_lines").insert(lineRecords);
  if (linesErr) {
    return { success: false, error: `Failed to record journal lines: ${linesErr.message}` };
  }

  // 7. Update account balances safely
  for (const l of lines) {
    const acc = accountMap.get(l.accountCode)!;
    let delta = 0;
    if (acc.type === "asset" || acc.type === "expense") {
      delta = l.debitPaise - l.creditPaise;
    } else {
      delta = l.creditPaise - l.debitPaise;
    }

    const { error: balanceError } = await supabase
      .from("financial_accounts")
      .update({
        balance_paise: acc.balance_paise + delta,
      })
      .eq("id", acc.id);
    if (balanceError) {
      return { success: false, error: `Failed to update account ${acc.code}: ${balanceError.message}` };
    }
  }

  return { success: true, entryId: entry.id };
}

/**
 * Convenience helper: Records a consultation payment in the double-entry ledger.
 * Debit: Instamojo Clearing Account (Asset)
 * Credit: Platform Commission Revenue (Revenue)
 * Credit: Astrologer Payable Liability (Liability)
 */
export async function recordConsultationPaymentInLedger(params: {
  paymentId: string;
  grossPaise: number;
  platformFeePaise: number;
  astrologerPayablePaise: number;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  return createDoubleEntryJournal({
    referenceType: "consultation_payment",
    referenceId: params.paymentId,
    description: params.description,
    lines: [
      {
        accountCode: ACCOUNT_CODES.INSTAMOJO_CLEARING,
        debitPaise: params.grossPaise,
        creditPaise: 0,
      },
      {
        accountCode: ACCOUNT_CODES.PLATFORM_COMMISSION_REVENUE,
        debitPaise: 0,
        creditPaise: params.platformFeePaise,
      },
      {
        accountCode: ACCOUNT_CODES.ASTROLOGER_PAYABLE,
        debitPaise: 0,
        creditPaise: params.astrologerPayablePaise,
      },
    ],
  });
}

/**
 * Convenience helper: Records a subscription purchase/renewal in the ledger.
 * Debit: Instamojo Clearing Account (Asset)
 * Credit: Astrologer Subscription Revenue (Revenue)
 */
export async function recordSubscriptionPaymentInLedger(params: {
  paymentId: string;
  amountPaise: number;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  return createDoubleEntryJournal({
    referenceType: "subscription_payment",
    referenceId: params.paymentId,
    description: params.description,
    lines: [
      {
        accountCode: ACCOUNT_CODES.INSTAMOJO_CLEARING,
        debitPaise: params.amountPaise,
        creditPaise: 0,
      },
      {
        accountCode: ACCOUNT_CODES.SUBSCRIPTION_REVENUE,
        debitPaise: 0,
        creditPaise: params.amountPaise,
      },
    ],
  });
}

/**
 * General financial transaction recorder for Karmic Ascension Pay orchestration.
 */
export async function recordFinancialTransaction(params: {
  entityType: "consultation" | "subscription";
  referenceId: string;
  amountPaise: number;
  commissionPaise?: number;
  astrologerPaise?: number;
  astrologerId?: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  if (params.entityType === "consultation") {
    const commission = params.commissionPaise ?? Math.round(params.amountPaise * 0.1);
    const astrologerAmount = params.astrologerPaise ?? params.amountPaise - commission;
    return recordConsultationPaymentInLedger({
      paymentId: params.referenceId,
      grossPaise: params.amountPaise,
      platformFeePaise: commission,
      astrologerPayablePaise: astrologerAmount,
      description: params.description,
    });
  } else {
    return recordSubscriptionPaymentInLedger({
      paymentId: params.referenceId,
      amountPaise: params.amountPaise,
      description: params.description,
    });
  }
}

export async function recordJyotishPaymentIntentInLedger(params: {
  intentId: string;
  entityType: "consultation" | "subscription";
  amountPaise: number;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  if (params.entityType === "subscription") {
    return createDoubleEntryJournal({
      referenceType: "jyotish_payment_intent",
      referenceId: params.intentId,
      description: params.description,
      lines: [
        { accountCode: ACCOUNT_CODES.INSTAMOJO_CLEARING, debitPaise: params.amountPaise, creditPaise: 0 },
        { accountCode: ACCOUNT_CODES.SUBSCRIPTION_REVENUE, debitPaise: 0, creditPaise: params.amountPaise },
      ],
    });
  }

  return createDoubleEntryJournal({
    referenceType: "jyotish_payment_intent",
    referenceId: params.intentId,
    description: params.description,
    lines: [
      { accountCode: ACCOUNT_CODES.INSTAMOJO_CLEARING, debitPaise: params.amountPaise, creditPaise: 0 },
      { accountCode: ACCOUNT_CODES.ESCROW_CONSULTATION, debitPaise: 0, creditPaise: params.amountPaise },
    ],
  });
}


