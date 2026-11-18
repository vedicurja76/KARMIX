"use client";

import React, { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Sparkles,
  ClipboardList,
  CalendarCheck2,
  Receipt,
  Gift,
  Bell,
  X,
  MessageSquare,
  ShieldCheck,
  LifeBuoy,
  Sun,
  Moon,
  Heart,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { CustomerSignOutButton } from "@/components/customer/CustomerSignOutButton";
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
  { href: "/customer/astrologers", label: "Astrologers", i18nKey: "astrologers", icon: Sparkles },
  { href: "/customer/favorites", label: "Favourite Astrologers", i18nKey: "favorites", icon: Heart },
  { href: "/customer/broadcasts", label: "Live Broadcasts", i18nKey: "broadcasts", icon: Sparkles },
  { href: "/customer/puja", label: "Online Puja Booking", i18nKey: "pujaBooking", icon: Sparkles },
  { href: "/customer/tools", label: "Astrology Tools & KP", i18nKey: "astrologyTools", icon: Compass },
  { href: "/customer/chat", label: "Live Chat", i18nKey: "liveChat", icon: MessageSquare },
  { href: "/customer/kundli", label: "My Kundli", i18nKey: "myKundli", icon: Compass },
  { href: "/customer/kundli-milan", label: "Kundli Milan", i18nKey: "kundliMilan", icon: Heart },
  { href: "/customer/panchang", label: "Daily Panchang", i18nKey: "panchang", icon: Sun },
  { href: "/customer/horoscope", label: "Daily Horoscope", i18nKey: "horoscope", icon: Moon },
  { href: "/customer/remedies", label: "Vedic Remedies", i18nKey: "remedies", icon: ShieldCheck },
  { href: "/customer/protection-rituals", label: "Protection Rituals", i18nKey: "protectionRituals", icon: ShieldCheck },
  { href: "/customer/numerology", label: "Numerology", i18nKey: "numerology", icon: Sparkles },
  { href: "/customer/planetary-transits", label: "Planetary Transits", i18nKey: "planetaryTransits", icon: Compass },
  { href: "/customer/muhurat", label: "Shubh Muhurat", i18nKey: "muhurat", icon: Sun },
  { href: "/customer/reports", label: "Report Library", i18nKey: "reportLibrary", icon: ClipboardList },
  { href: "/customer/profile", label: "My Kundli Profile", i18nKey: "profile", icon: User },
  { href: "/customer/enquiries", label: "My Enquiries", i18nKey: "enquiries", icon: ClipboardList },
  { href: "/customer/bookings", label: "Bookings", i18nKey: "bookings", icon: CalendarCheck2 },
  { href: "/customer/billing", label: "Billing & Receipts", i18nKey: "billing", icon: Receipt },
  { href: "/customer/notification", label: "Notifications", i18nKey: "notifications", icon: Bell },
  { href: "/customer/offers", label: "Special Offers", i18nKey: "specialOffers", icon: Gift },
  { href: "/customer/ai-services", label: "AI Recommendations", i18nKey: "aiServices", icon: Sparkles },
  { href: "/customer/privacy", label: "Privacy & Data", i18nKey: "privacy", icon: ShieldCheck },
  { href: "/customer/support", label: "Support & Help", i18nKey: "support", icon: LifeBuoy },
];

const COMING_SOON: { label: string; icon: LucideIcon; desc: string }[] = [];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type SidebarProps = {
  open: boolean;
  isLoggedIn?: boolean;
  onNavigate: () => void;
  onClose: () => void;
};

function CustomerSidebarComponent({ open, isLoggedIn = true, onNavigate, onClose }: SidebarProps) {
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
        className="pointer-events-none object-cover opacity-18 mix-blend-screen"
      />
      <div className="relative flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gold/15 px-6">
          <Link
            href="/customer"
            onClick={onNavigate}
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/20 text-gold-deep border border-gold/40">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-wide text-champagne">
                Karmic Ascension
              </p>
              <p className="text-[10px] text-ivory/60">Seeker Portal</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ivory/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3.5 py-4 scrollbar-thin"
        >
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
              <div className="space-y-1 pt-1">
                {COMING_SOON.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-xl px-3.5 py-2 text-xs text-ivory/50"
                      title={item.desc}
                    >
                      <div className="flex items-center gap-3 font-medium text-ivory/70">
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 pl-7 text-[11px] leading-relaxed text-ivory/40">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {isLoggedIn && (
          <div className="shrink-0 border-t border-gold/15 p-3.5">
            <ComponentErrorBoundary name="CustomerSignOutButton">
              <CustomerSignOutButton />
            </ComponentErrorBoundary>
          </div>
        )}
      </div>
    </aside>
  );
}

export const CustomerSidebar = memo(CustomerSidebarComponent);
