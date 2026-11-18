"use client";

import React, { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  LayoutDashboard,
  MessageSquareText,
  SquarePen,
  Star,
  UserRound,
  Wallet,
  Bell,
  LifeBuoy,
  X,
  MessageSquare,
  ShieldCheck,
  Users,
  Clock,
  Sparkles,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/astrologer/SignOutButton";
import { ComponentErrorBoundary } from "@/components/common/ComponentErrorBoundary";
import { Ornament } from "@/components/astrologer/ui/Ornament";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type NavItem = {
  href: string;
  label: string;
  i18nKey: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/astrologer/dashboard", label: "Dashboard", i18nKey: "dashboard", icon: LayoutDashboard },
  { href: "/astrologer/broadcast", label: "Live Broadcast", i18nKey: "broadcasts", icon: Sparkles },
  { href: "/astrologer/pujas", label: "Puja Rituals", i18nKey: "pujaBooking", icon: Flame },
  { href: "/astrologer/chat", label: "Live Chat", i18nKey: "liveChat", icon: MessageSquare },
  { href: "/astrologer/leads", label: "My Leads", i18nKey: "enquiries", icon: MessageSquareText },
  { href: "/astrologer/crm", label: "Client CRM", i18nKey: "clients", icon: Users },
  { href: "/astrologer/bookings", label: "Bookings", i18nKey: "bookings", icon: CalendarClock },
  { href: "/astrologer/availability", label: "Working Hours", i18nKey: "availability", icon: Clock },
  { href: "/astrologer/profile", label: "My Profile", i18nKey: "profile", icon: UserRound, exact: true },
  { href: "/astrologer/subscription", label: "Subscription", i18nKey: "subscription", icon: Sparkles },
  { href: "/astrologer/privacy", label: "Privacy & Data", i18nKey: "privacy", icon: ShieldCheck },
  { href: "/astrologer/reviews", label: "Client Reviews", i18nKey: "reviews", icon: Star },
  { href: "/astrologer/earnings", label: "Earnings", i18nKey: "earnings", icon: Wallet },
  { href: "/astrologer/communications", label: "Admin Notices", i18nKey: "communications", icon: ShieldCheck },
  { href: "/astrologer/notifications", label: "Notifications", i18nKey: "notifications", icon: Bell },
  { href: "/astrologer/support", label: "Support", i18nKey: "support", icon: LifeBuoy },
  { href: "/astrologer/protection-rituals", label: "Protection Rituals", i18nKey: "protectionRituals", icon: ShieldCheck },
  { href: "/astrologer/profile/edit", label: "Edit Profile", i18nKey: "profile", icon: SquarePen },
];

const COMING_SOON: { label: string; icon: LucideIcon; desc: string }[] = [];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type SidebarProps = {
  open: boolean;
  onNavigate: () => void;
  onClose: () => void;
};

function AstrologerSidebarComponent({ open, onNavigate, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const getTranslatedLabel = (key: string, defaultLabel: string) => {
    const nav = t.navigation as Record<string, string>;
    return nav[key] || defaultLabel;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] overflow-hidden lg:w-64 border-r border-white/5 bg-midnight text-ivory transition-transform duration-200 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full max-lg:invisible"
      }`}
    >
      <Image
        src="/images/karmic-ascension/sidebar-palace-art.webp"
        alt="Karmic Ascension Palace Art"
        fill
        priority
        sizes="288px"
        aria-hidden="true"
        className="pointer-events-none object-cover object-top"
      />
      {/* Dark gradient mask for clear readability matching CustomerSidebar */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(21,16,39,0.1) 18%, rgba(21,16,39,0.85) 30%, rgba(21,16,39,0.92) 80%, rgba(21,16,39,0.4) 92%, rgba(21,16,39,0.1) 100%)",
        }}
      />

      {/* Brand logo click overlay */}
      <Link
        href="/astrologer/dashboard"
        prefetch={true}
        onClick={onNavigate}
        className="absolute inset-x-6 top-[7%] z-10 h-[20%] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
      >
        <span className="sr-only">Karmic Ascension Astrologer Portal, go to dashboard</span>
      </Link>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute right-3 top-3 z-20 rounded-lg bg-midnight/60 p-2 text-ivory/90 hover:bg-midnight focus-visible:outline-2 focus-visible:outline-champagne lg:hidden"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="absolute inset-x-0 bottom-3 top-[28%] z-10 flex flex-col overflow-y-auto px-5 sidebar-scrollbar">
        <nav aria-label="Astrologer portal navigation" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne ${
                  active
                    ? "bg-gradient-to-b from-[#e0bb6c] to-[#b98a36] font-semibold text-midnight shadow-[0_8px_20px_-8px_rgba(196,154,74,0.7)]"
                    : "text-ivory/75 hover:translate-x-0.5 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {getTranslatedLabel(item.i18nKey, item.label)}
              </Link>
            );
          })}

          {COMING_SOON.length > 0 && (
            <>
          <Ornament className="mt-3 px-2" />
          <p className="mt-2 px-3.5 text-[11px] font-semibold uppercase tracking-widest text-ivory/55">
            Coming soon
          </p>

          {COMING_SOON.map(({ label, icon: Icon }) => (
            <div
              key={label}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-2 text-sm text-ivory/70"
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{label}</span>
              <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </div>
          ))}
            </>
          )}
        </nav>

        <div className="mt-4 pt-3 pb-8 border-t border-gold/40 lg:hidden">
          <ComponentErrorBoundary name="AstrologerSignOutSidebar">
            <SignOutButton
              variant="goldLight"
              className="w-full justify-center !text-midnight font-bold tracking-wide shadow-[0_4px_16px_rgba(232,197,119,0.4)]"
            />
          </ComponentErrorBoundary>
        </div>
      </div>
    </aside>
  );
}

export const AstrologerSidebar = memo(AstrologerSidebarComponent);
