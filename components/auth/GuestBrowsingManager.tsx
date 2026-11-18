"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ModalBackdrop } from "@/components/admin/ModalBackdrop";
import { UnifiedAuthFlow } from "@/components/auth/UnifiedAuthFlow";
import { X, Sparkles, Compass } from "lucide-react";

const GUEST_BROWSE_START_KEY = "karmic_guest_browse_start";
const GUEST_PROMPT_DISMISSED_KEY = "karmic_guest_prompt_dismissed";
const GUEST_TIMER_DURATION_MS = 45000; // 45 seconds of gentle guest exploration before subtle sign-in reminder

/**
 * Public routes where guest exploration is permitted and the timer runs.
 */
function isPublicExplorationRoute(pathname: string): boolean {
  // Never prompt on customer or astrologer or admin portals
  if (
    pathname.startsWith("/customer") ||
    pathname.startsWith("/astrologer") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/super-admin")
  ) {
    return false;
  }
  if (pathname === "/") return true;
  if (pathname.startsWith("/astrologers")) return true;
  if (pathname.startsWith("/explore")) return true;
  if (pathname.startsWith("/horoscope")) return true;
  if (pathname.startsWith("/panchang")) return true;
  if (pathname.startsWith("/kundli")) return true;
  return false;
}

/**
 * Auth pages where guest timer should NEVER run.
 */
function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname.includes("/login") ||
    pathname.includes("/signup") ||
    pathname.includes("/forgot-password") ||
    pathname.includes("/reset-password")
  );
}

export function GuestBrowsingManager() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Check Supabase Auth Session
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted && session) {
        setIsAuthenticated(true);
      }
    });

    // Check if dismissed previously in this session
    if (typeof window !== "undefined" && sessionStorage.getItem(GUEST_PROMPT_DISMISSED_KEY) === "true") {
      return;
    }

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        const loggedIn = Boolean(session);
        setIsAuthenticated(loggedIn);
        if (loggedIn) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          setIsPromptOpen(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Centralized Guest Timer Evaluation
  useEffect(() => {
    if (isAuthenticated) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsPromptOpen(false);
      return;
    }

    // Check session dismissal
    if (typeof window !== "undefined" && sessionStorage.getItem(GUEST_PROMPT_DISMISSED_KEY) === "true") {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (isAuthRoute(pathname) || !isPublicExplorationRoute(pathname)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsPromptOpen(true);
    }, GUEST_TIMER_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, isAuthenticated]);

  // 3. Handle modal dismissal
  function handleDismiss() {
    setIsPromptOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(GUEST_PROMPT_DISMISSED_KEY, "true");
    }
  }

  // If user is authenticated, do not render modal
  if (isAuthenticated) {
    return null;
  }

  return (
    <ModalBackdrop
      isOpen={isPromptOpen}
      onClose={handleDismiss}
      zIndexClass="z-50"
      closeOnOutsideClick={true}
      closeOnEscape={true}
      ariaLabel="Guest Exploration Prompt"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-gold/40 bg-white p-6 sm:p-8 shadow-2xl">
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-gold/10 hover:text-midnight transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Unified Authentication State Machine (Who are you?) */}
        <UnifiedAuthFlow
          isModal={true}
          onSuccess={() => {
            setIsPromptOpen(false);
          }}
        />
      </div>
    </ModalBackdrop>
  );
}
