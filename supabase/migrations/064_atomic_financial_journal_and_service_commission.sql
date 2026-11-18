-- ============================================================================
-- Migration 064: Atomic Double-Entry Financial Journal & Service-Specific Commission Rules
-- Complies with Phase 5, Phase 6, Phase 11, Phase 18, and Phase 19 Requirements
-- ============================================================================

-- 1. Extend commission_settings with service_type scope ('chat', 'voice', 'video', 'puja', 'all')
ALTER TABLE public.commission_settings
    ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'all'
    CHECK (service_type IN ('chat', 'voice', 'video', 'puja', 'all'));

-- Ensure index exists for service-specific commission queries
CREATE INDEX IF NOT EXISTS idx_commission_settings_service_lookup
    ON public.commission_settings (service_type, is_active, effective_from DESC);

-- 2. Transactional RPC for atomic double-entry journal posting with parity validation
CREATE OR REPLACE FUNCTION public.post_atomic_double_entry_journal(
    p_entry_number TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_description TEXT,
    p_lines JSONB,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_journal_id UUID;
    v_line JSONB;
    v_total_debit BIGINT := 0;
    v_total_credit BIGINT := 0;
    v_account RECORD;
    v_debit BIGINT;
    v_credit BIGINT;
    v_account_code TEXT;
    v_line_desc TEXT;
BEGIN
    -- Idempotency check: if journal entry already exists for reference, return existing ID
    IF p_reference_type IS NOT NULL AND p_reference_id IS NOT NULL THEN
        SELECT id INTO v_journal_id
        FROM public.financial_journal_entries
        WHERE reference_type = p_reference_type
          AND reference_id = p_reference_id
        LIMIT 1;

        IF v_journal_id IS NOT NULL THEN
            RETURN v_journal_id;
        END IF;
    END IF;

    -- Validate input lines
    IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
        RAISE EXCEPTION 'A double-entry journal entry requires at least 2 lines.';
    END IF;

    -- Pre-calculate totals to ensure debit equals credit strictly
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_debit := COALESCE((v_line->>'debitPaise')::BIGINT, 0);
        v_credit := COALESCE((v_line->>'creditPaise')::BIGINT, 0);

        IF v_debit < 0 OR v_credit < 0 THEN
            RAISE EXCEPTION 'Journal line amounts cannot be negative.';
        END IF;
        IF v_debit > 0 AND v_credit > 0 THEN
            RAISE EXCEPTION 'A single line item cannot have both debit and credit amounts.';
        END IF;
        IF v_debit = 0 AND v_credit = 0 THEN
            RAISE EXCEPTION 'Journal line must have either debit or credit greater than 0.';
        END IF;

        v_total_debit := v_total_debit + v_debit;
        v_total_credit := v_total_credit + v_credit;
    END LOOP;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'Accounting equation violated: Total debits (%) must equal total credits (%).', v_total_debit, v_total_credit;
    END IF;

    -- Insert journal entry header
    INSERT INTO public.financial_journal_entries (
        entry_number,
        reference_type,
        reference_id,
        description,
        status,
        metadata
    )
    VALUES (
        p_entry_number,
        p_reference_type,
        p_reference_id,
        p_description,
        'posted',
        COALESCE(p_metadata, '{}'::JSONB)
    )
    RETURNING id INTO v_journal_id;

    -- Process each line item and atomically update account balance
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_account_code := v_line->>'accountCode';
        v_debit := COALESCE((v_line->>'debitPaise')::BIGINT, 0);
        v_credit := COALESCE((v_line->>'creditPaise')::BIGINT, 0);
        v_line_desc := v_line->>'description';

        SELECT * INTO v_account
        FROM public.financial_accounts
        WHERE code = v_account_code
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Financial account with code % not found.', v_account_code;
        END IF;

        -- Insert line item
        INSERT INTO public.financial_journal_lines (
            journal_entry_id,
            account_id,
            debit_paise,
            credit_paise,
            description
        )
        VALUES (
            v_journal_id,
            v_account.id,
            v_debit,
            v_credit,
            v_line_desc
        );

        -- Update account balance in accordance with account type
        -- For ASSET and EXPENSE: normal balance is Debit (+ debit, - credit)
        -- For LIABILITY, EQUITY, REVENUE: normal balance is Credit (+ credit, - debit)
        IF v_account.type IN ('asset', 'expense') THEN
            UPDATE public.financial_accounts
            SET balance_paise = balance_paise + v_debit - v_credit,
                updated_at = pg_catalog.now()
            WHERE id = v_account.id;
        ELSE
            UPDATE public.financial_accounts
            SET balance_paise = balance_paise + v_credit - v_debit,
                updated_at = pg_catalog.now()
            WHERE id = v_account.id;
        END IF;
    END LOOP;

    RETURN v_journal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_atomic_double_entry_journal(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_atomic_double_entry_journal(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO service_role;
