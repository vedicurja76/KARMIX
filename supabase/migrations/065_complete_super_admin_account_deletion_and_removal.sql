-- ============================================================================
-- MIGRATION 065: Complete Super Admin Account Deletion & Directory Removal
-- ============================================================================

-- 1. Ensure profiles_role_check includes 'deleted' so deleted users never match 'customer' or 'astrologer'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('customer', 'astrologer', 'consultant_admin', 'super_admin', 'admin', 'deleted'));

-- 2. Ensure astrologer_profiles_approval_status_check includes 'archived'
ALTER TABLE public.astrologer_profiles
  DROP CONSTRAINT IF EXISTS astrologer_profiles_approval_status_check;

ALTER TABLE public.astrologer_profiles
  ADD CONSTRAINT astrologer_profiles_approval_status_check
    CHECK (approval_status IN (
      'draft',
      'pending',
      'changes_requested',
      'approved',
      'rejected',
      'suspended',
      'archived'
    ));

-- 3. Upgrade public.admin_hard_delete_user_account to completely remove user
-- and ensure it never appears in customer directory or astrologer listings
CREATE OR REPLACE FUNCTION public.admin_hard_delete_user_account(
  p_user_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT 'Administrative account deletion by Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_astrologer_id UUID;
  v_email TEXT;
  v_name TEXT;
BEGIN
  -- 1. Check if user exists in public.profiles
  SELECT role, full_name INTO v_role, v_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    -- Check if user is in auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    IF v_email IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = p_user_id;
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Deleted orphan auth user',
        'user_id', p_user_id
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found in system'
    );
  END IF;

  -- Prevent deleting the last or another super_admin without explicit safeguarding
  IF v_role = 'super_admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Super Admin accounts cannot be self-deleted or purged through this procedure.'
    );
  END IF;

  -- 2. If astrologer, handle dependent records safely
  IF v_role = 'astrologer' THEN
    SELECT id INTO v_astrologer_id
    FROM public.astrologer_profiles
    WHERE user_id = p_user_id;

    IF v_astrologer_id IS NOT NULL THEN
      -- Archive astrologer profile and strip PII
      UPDATE public.astrologer_profiles
      SET
        approval_status = 'archived',
        display_name = '[Deleted Astrologer]',
        slug = CONCAT('deleted-', gen_random_uuid()),
        bio = 'This astrologer account was deleted by Super Admin.',
        phone = NULL,
        profile_photo_url = NULL,
        consultation_fee = 0,
        languages = '{}',
        specializations = '{}',
        updated_at = NOW()
      WHERE id = v_astrologer_id;
      
      -- Cancel any future pending bookings
      UPDATE public.customer_bookings
      SET
        status = 'cancelled',
        cancellation_reason = 'Astrologer account deleted by platform administrator',
        cancelled_at = NOW(),
        cancelled_by = p_actor_id
      WHERE astrologer_id = v_astrologer_id
        AND status IN ('pending', 'confirmed')
        AND scheduled_at > NOW();

      -- Unassign any active leads
      UPDATE public.leads
      SET
        astrologer_id = NULL,
        status = 'new',
        updated_at = NOW()
      WHERE astrologer_id = v_astrologer_id
        AND status NOT IN ('closed', 'converted');
    END IF;
  END IF;

  -- 3. If customer, cancel active future bookings
  IF v_role = 'customer' THEN
    UPDATE public.customer_bookings
    SET
      status = 'cancelled',
      cancellation_reason = 'Customer account deleted by platform administrator',
      cancelled_at = NOW(),
      cancelled_by = p_actor_id
    WHERE customer_id = p_user_id
      AND status IN ('pending', 'confirmed')
      AND scheduled_at > NOW();

    -- Close active leads
    UPDATE public.leads
    SET
      status = 'closed',
      notes = CONCAT(COALESCE(notes, ''), ' [Customer account deleted by Super Admin]'),
      updated_at = NOW()
    WHERE customer_id = p_user_id;
  END IF;

  -- 4. Mark any pending deletion request as COMPLETED
  UPDATE public.account_deletion_requests
  SET
    status = 'COMPLETED',
    completed_at = NOW(),
    reviewed_by = p_actor_id,
    reviewed_at = NOW(),
    admin_notes = p_reason
  WHERE user_id = p_user_id
    AND status NOT IN ('COMPLETED', 'CANCELLED');

  -- 5. Nullify or unassign any administrative/reviewer foreign keys pointing to this user
  UPDATE public.leads SET assigned_to = NULL WHERE assigned_to = p_user_id;
  UPDATE public.leads SET assigned_by = NULL WHERE assigned_by = p_user_id;
  UPDATE public.customer_bookings SET cancelled_by = NULL WHERE cancelled_by = p_user_id;
  
  -- 6. Attempt direct deletion of auth and profile record
  BEGIN
    -- Try deleting directly from public.profiles first if foreign keys allow
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- If restricted by financial/historical transactions, change role to 'deleted'
    -- so it is completely removed from customer and astrologer directories
    UPDATE public.profiles
    SET
      role = 'deleted',
      full_name = '[Deleted User]',
      phone = NULL,
      date_of_birth = NULL,
      time_of_birth = NULL,
      birthplace = NULL,
      avatar_url = NULL,
      gender = NULL,
      updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Also try deleting from auth.users
    BEGIN
      DELETE FROM auth.users WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- Silently retain auth if restricted
    END;
  END;

  -- 7. Record in admin audit logs
  INSERT INTO public.admin_audit_logs (
    actor_id,
    actor_role,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state
  ) VALUES (
    p_actor_id,
    'super_admin',
    'account.super_admin_delete',
    v_role,
    p_user_id,
    p_reason,
    jsonb_build_object('name', v_name, 'role', v_role),
    jsonb_build_object('status', 'DELETED', 'purged_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'role', v_role,
    'message', 'User account successfully deleted and removed by Super Admin.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_hard_delete_user_account TO authenticated;
