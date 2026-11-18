import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  TrendingUp,
  Sparkles,
  Users,
  ShieldCheck,
  Lock,
  Calendar,
  ChevronRight,
  ArrowRight,
  IndianRupee,
  Headphones,
  Users2,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { AstrologerShowcase } from "@/components/public/AstrologerShowcase";
import { createPublicServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  AUTHORITATIVE_SAFE_PUBLIC_FIELDS,
  PUBLIC_VISIBLE_APPROVAL_STATUS,
} from "@/lib/astrologer/visibility";
import type { PublicAstrologerProfile } from "@/lib/types/astrologer.types";

export const metadata: Metadata = {
  title: "Karmic Ascension | Bridging Wisdom, Connecting Lives | Vedic Astrology",
  description:
    "Find Clarity. Connect with Trusted Astrologers. Get personalised guidance for your relationships, career, wellbeing and important life decisions from verified astrologers.",
  openGraph: {
    title: "Karmic Ascension — Ancient Wisdom • Modern Guidance",
    description:
      "Find Clarity. Connect with Trusted Astrologers. Get personalised guidance for your relationships, career, wellbeing and important life decisions.",
    type: "website",
    url: "https://astrologer-platform.vercel.app",
  },
};

export const revalidate = 60;

export default async function HomePage() {
  const [profile, astrologers] = await Promise.all([
    getCurrentProfile(),
    (async () => {
      try {
        const supabase = createPublicServerClient("main");
        const { data } = await supabase
          .from("astrologer_profiles")
          .select(AUTHORITATIVE_SAFE_PUBLIC_FIELDS)
          .eq("approval_status", PUBLIC_VISIBLE_APPROVAL_STATUS)
          .order("created_at", { ascending: false })
          .limit(6);

        return (data as unknown as PublicAstrologerProfile[]) || [];
      } catch (error) {
        console.error("[Home Page Astrologer Fetch]", error);
        return [];
      }
    })(),
  ]);

  return (
    <div className="min-h-screen bg-[#faf7f0] text-[#1b122c] flex flex-col font-sans selection:bg-[#e2c173]/30 selection:text-[#180f28]">
      {/* 1. Header Navigation */}
      <PublicNavbar currentRole={profile?.role ?? null} isLoggedIn={Boolean(profile)} />

      <main id="main-content" className="flex-1">
        {/* ============================================================== */}
        {/* 2. HERO SECTION — EXACT PIXEL-PERFECT REPLICA OF ATTACHED IMAGE */}
        {/* ============================================================== */}
        <section className="relative overflow-hidden bg-[#150d2a] pt-24 pb-14 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20 text-white">
          {/* Background Vedic scholar image positioned on the right */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="relative w-full h-full">
              <Image
                src="/images/karmic-ascension/vedic-scholar-hero.jpg"
                alt="Vedic Scholar Astrologer reading horoscope manuscript"
                fill
                priority
                sizes="100vw"
                className="object-cover object-right lg:object-center opacity-40 lg:opacity-90"
              />
              {/* Radial and linear vignette gradients to seamlessly blend left text area */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#150d2a] via-[#150d2a]/95 to-transparent sm:via-[#150d2a]/80 lg:from-[#150d2a] lg:via-[#150d2a]/70 lg:to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#150d2a] via-transparent to-[#150d2a]/60" />
            </div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[440px] lg:min-h-[500px]">
              {/* Left Column: Hero Typography, Eyebrow, CTAs and Trust Badges */}
              <div className="lg:col-span-7 xl:col-span-6 space-y-6 text-left">
                {/* Eyebrow: ANCIENT WISDOM • MODERN GUIDANCE */}
                <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#cfb683]">
                  ANCIENT WISDOM • MODERN GUIDANCE
                </div>

                {/* Mobile-only Vedic scholar hero image: positioned right after "ANCIENT WISDOM • MODERN GUIDANCE" */}
                <div className="lg:hidden flex flex-col items-center justify-center pt-1 pb-2">
                  <div className="w-full flex justify-end pr-1 pb-2">
                    <div className="text-right text-[11px] font-serif italic text-white/75 tracking-wider flex items-center gap-1.5 ml-auto">
                      <span>&ldquo;Guidance Today for a Brighter Tomorrow&rdquo;</span>
                      <span className="text-[#dfba63] text-[9px]">✦</span>
                    </div>
                  </div>

                  <div className="relative w-full max-w-[420px] aspect-[16/10] rounded-2xl overflow-hidden border border-[#eddcb8]/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-[#100720]">
                    <Image
                      src="/images/karmic-ascension/vedic-scholar-hero.jpg"
                      alt="Vedic Scholar Astrologer reading horoscope manuscript with zodiac wheel"
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, 420px"
                      className="object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#150d2a]/80 via-transparent to-transparent pointer-events-none" />
                  </div>
                </div>

                {/* Main Headline */}
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-medium tracking-tight text-white leading-[1.12]">
                  Find Clarity.
                  <br />
                  Connect with
                  <br />
                  <span className="text-[#f1ca79]">Trusted Astrologers.</span>
                </h1>

                {/* Supporting description */}
                <p className="text-sm sm:text-[15px] text-white/80 leading-relaxed max-w-lg">
                  Get personalised guidance for your relationships, career, wellbeing and important life decisions from verified astrologers.
                </p>

                {/* CTAs matching image: [ (users) Explore Astrologers -> ]  [ (play) How It Works ] */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    href="#astrologers"
                    className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#e3c16f] to-[#cf9e3e] px-6 py-3.5 text-xs sm:text-sm font-bold text-[#140c26] shadow-lg shadow-[#000]/30 hover:brightness-105 transition-all focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    <Users2 className="h-4 w-4 text-[#140c26]" />
                    <span>Explore Astrologers</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 backdrop-blur-xs px-5 py-3.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 hover:border-white/35 transition-colors focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    <svg className="h-4 w-4 fill-white/90" viewBox="0 0 24 24">
                      <polygon points="6 4 19 12 6 20 6 4" />
                    </svg>
                    <span>How It Works</span>
                  </Link>
                </div>

                {/* 3 Trust Badges with round circular ring borders */}
                <div className="pt-6 flex flex-col sm:grid sm:grid-cols-3 gap-4 border-t border-white/10">
                  {/* Badge 1: Verified Astrologers */}
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 shadow-xs">
                      <ShieldCheck className="h-5 w-5 text-[#deb967]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Verified Astrologers</h4>
                      <p className="text-[11px] text-white/65">Trusted & Experienced</p>
                    </div>
                  </div>

                  {/* Badge 2: Secure & Private */}
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 shadow-xs">
                      <Lock className="h-4 w-4 text-[#deb967]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Secure & Private</h4>
                      <p className="text-[11px] text-white/65">Your Conversations are Safe</p>
                    </div>
                  </div>

                  {/* Badge 3: Flexible Consultations */}
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 shadow-xs">
                      <Calendar className="h-4 w-4 text-[#deb967]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Flexible Consultations</h4>
                      <p className="text-[11px] text-white/65">Chat, Call or Video</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop/Web view: Right spacer with top-right quote matching the reference design */}
              <div className="hidden lg:flex lg:col-span-5 xl:col-span-6 justify-end items-start pr-4 pt-4 self-start">
                <div className="text-right text-xs font-serif italic text-white/70 tracking-wider flex items-center gap-1.5">
                  <span>&ldquo;Guidance Today for a Brighter Tomorrow&rdquo;</span>
                  <span className="text-[#dfba63] text-[10px]">✦</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. GUIDANCE FOR EVERY CHAPTER OF LIFE — SERVICES 4 CARDS        */}
        {/* ============================================================== */}
        <section id="services" className="py-14 sm:py-18 bg-[#fbf8f2]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold text-[#181126] tracking-tight">
                Guidance for Every Chapter of Life
              </h2>
              {/* Star diamond ornament */}
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="h-[1px] w-10 bg-[#e2ceaf]" />
                <span className="text-[#c49a4a] text-xs">✦</span>
                <span className="h-[1px] w-10 bg-[#e2ceaf]" />
              </div>
              <p className="text-xs sm:text-[13px] text-[#6b607c]">
                Explore our wide range of astrology services and get answers to life&apos;s important questions.
              </p>
            </div>

            {/* Exactly 4 Horizontal Service Cards */}
            <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Card 1: Love & Relationships */}
              <Link
                href="/auth"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-[#dfba63] transition-all duration-300"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fdf2f2] text-[#d65f5f]">
                  <Heart className="h-6 w-6 stroke-[1.7]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-semibold text-[#181126] group-hover:text-[#a07422] transition-colors truncate">
                    Love & Relationships
                  </h3>
                  <p className="text-[11px] text-[#716583] line-clamp-2 mt-0.5 leading-snug">
                    Find clarity in love, marriage and relationships.
                  </p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#faf5eb] text-[#8c651e] group-hover:bg-[#dfba63] group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>

              {/* Card 2: Career & Finance */}
              <Link
                href="/auth"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-[#dfba63] transition-all duration-300"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff8eb] text-[#d99f2b]">
                  <TrendingUp className="h-6 w-6 stroke-[1.7]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-semibold text-[#181126] group-hover:text-[#a07422] transition-colors truncate">
                    Career & Finance
                  </h3>
                  <p className="text-[11px] text-[#716583] line-clamp-2 mt-0.5 leading-snug">
                    Get guidance for career growth, business and financial stability.
                  </p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#faf5eb] text-[#8c651e] group-hover:bg-[#dfba63] group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>

              {/* Card 3: Kundli & Birth Chart */}
              <Link
                href="/auth"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-[#dfba63] transition-all duration-300"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#faf4e6] text-[#b4882e]">
                  {/* Lotus emblem svg */}
                  <svg className="h-6 w-6 fill-none stroke-current stroke-[1.7]" viewBox="0 0 24 24">
                    <path d="M12 3c-2 4-5 8-8 10 3 0 6 1 8 4 2-3 5-4 8-4-3-2-6-6-8-10z" />
                    <circle cx="12" cy="18" r="1.5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-semibold text-[#181126] group-hover:text-[#a07422] transition-colors truncate">
                    Kundli & Birth Chart
                  </h3>
                  <p className="text-[11px] text-[#716583] line-clamp-2 mt-0.5 leading-snug">
                    Decode your life path with detailed Kundli analysis.
                  </p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#faf5eb] text-[#8c651e] group-hover:bg-[#dfba63] group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>

              {/* Card 4: Family & Wellbeing */}
              <Link
                href="/auth"
                className="group relative flex items-center gap-3.5 rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-[#dfba63] transition-all duration-300"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4faee] text-[#4f8a37]">
                  {/* Plant / wellbeing icon */}
                  <svg className="h-6 w-6 fill-none stroke-current stroke-[1.7]" viewBox="0 0 24 24">
                    <path d="M12 21V11" />
                    <path d="M12 11C10 7 6 6 4 7c0 4 3 6 8 4z" />
                    <path d="M12 11c2-4 6-5 8-4 0 4-3 6-8 4z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-semibold text-[#181126] group-hover:text-[#a07422] transition-colors truncate">
                    Family & Wellbeing
                  </h3>
                  <p className="text-[11px] text-[#716583] line-clamp-2 mt-0.5 leading-snug">
                    Find solutions for family harmony, health and mental peace.
                  </p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#faf5eb] text-[#8c651e] group-hover:bg-[#dfba63] group-hover:text-white transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 4. MEET OUR TRUSTED ASTROLOGERS — EXACT SECTION AS IN IMAGE    */}
        {/* ============================================================== */}
        <section id="astrologers" className="py-12 sm:py-16 bg-[#faf7f0]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Header with Title and "View All Astrologers ->" button */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#181126]">
                  Meet Our Trusted Astrologers
                </h2>
                <p className="mt-1 text-xs sm:text-[13px] text-[#6e627d]">
                  Connect with experienced and verified astrologers who are here to guide you.
                </p>
              </div>

              <Link
                href="/auth"
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-[#e2d2b8] bg-white px-4 py-2 text-xs font-semibold text-[#6f4b16] hover:border-[#c5963a] hover:bg-[#fffdfa] shadow-2xs transition-colors"
              >
                <span>View All Astrologers</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Astrologer Showcase 3 Cards */}
            <AstrologerShowcase astrologers={astrologers} />

            {/* Bottom 4 Horizontal Benefit Badges matching image: Verified profiles | Transparent pricing | Private consultations | Support when you need it */}
            <div className="mt-9 rounded-2xl border border-[#ebdcc4] bg-[#fdfcf9] px-6 py-5 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Badge 1: Verified profiles */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2e5ce] text-[#8f641e]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#191127]">Verified profiles</h4>
                  <p className="text-[11px] text-[#766986]">Trusted & experienced astrologers</p>
                </div>
              </div>

              {/* Badge 2: Transparent pricing */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2e5ce] text-[#8f641e]">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#191127]">Transparent pricing</h4>
                  <p className="text-[11px] text-[#766986]">No hidden charges</p>
                </div>
              </div>

              {/* Badge 3: Private consultations */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2e5ce] text-[#8f641e]">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#191127]">Private consultations</h4>
                  <p className="text-[11px] text-[#766986]">100% secure and confidential</p>
                </div>
              </div>

              {/* Badge 4: Support when you need it */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2e5ce] text-[#8f641e]">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#191127]">Support when you need it</h4>
                  <p className="text-[11px] text-[#766986]">Our team is always here to help</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 5. HOW IT WORKS SECTION — DARK PURPLE COSMIC AESTHETIC         */}
        {/* ============================================================== */}
        <section id="how-it-works" className="relative py-16 sm:py-20 bg-[#160d2b] text-white overflow-hidden">
          {/* Subtle celestial background gradient & astrological geometry */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-15">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#dfba63] to-transparent blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#5e2b86] to-transparent blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-2.5">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold text-white tracking-tight">
                How It Works
              </h2>
              {/* Star diamond ornament */}
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="h-[1px] w-10 bg-[#e2ceaf]/40" />
                <span className="text-[#dfba63] text-xs">✦</span>
                <span className="h-[1px] w-10 bg-[#e2ceaf]/40" />
              </div>
              <p className="text-xs sm:text-[13px] text-white/70">
                Get guidance from trusted astrologers in just a few simple steps.
              </p>
            </div>

            {/* Exactly 4 Steps with circular icons and step number badges as in design */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative">
              {[
                {
                  step: "1",
                  title: "Browse Astrologers",
                  desc: "Explore verified profiles",
                  icon: (
                    <svg className="h-6 w-6 stroke-current fill-none stroke-[1.8]" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  ),
                },
                {
                  step: "2",
                  title: "Choose a Service",
                  desc: "Select chat, call or video",
                  icon: (
                    <Calendar className="h-6 w-6 stroke-[1.8]" />
                  ),
                },
                {
                  step: "3",
                  title: "Book a Consultation",
                  desc: "Make a secure payment",
                  icon: (
                    <svg className="h-6 w-6 stroke-current fill-none stroke-[1.8]" viewBox="0 0 24 24">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  ),
                },
                {
                  step: "4",
                  title: "Get Your Guidance",
                  desc: "Connect and get answers",
                  icon: (
                    <svg className="h-6 w-6 stroke-current fill-none stroke-[1.8]" viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center relative group">
                  {/* Circular icon container with small golden numbered badge */}
                  <div className="relative mb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[#dfba63] shadow-inner group-hover:border-[#dfba63] group-hover:scale-105 transition-all duration-300">
                      {item.icon}
                    </div>
                    {/* Number Badge at bottom right of icon */}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#e3c16f] to-[#cf9e3e] text-[10px] font-bold text-[#150d28] shadow-md">
                      {item.step}
                    </span>
                  </div>

                  <h3 className="font-display text-sm sm:text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-white/65 max-w-[200px]">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 6. WHY CHOOSE KARMIC ASCENSION? SECTION — MATCHING DESIGN IMAGE */}
        {/* ============================================================== */}
        <section id="why-choose-us" className="py-16 sm:py-20 bg-[#faf6ee]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Vedic Meditation Chakra Art */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-[380px] aspect-square rounded-3xl overflow-hidden border border-[#eddcb8] shadow-[0_4px_20px_rgba(0,0,0,0.06)] bg-white">
                  <Image
                    src="/images/karmic-ascension/why-choose-chakra.webp"
                    alt="Vedic meditation silhouette with seven glowing chakras and astrology celestial mandala"
                    fill
                    sizes="(max-width: 1024px) 380px, 420px"
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Right Column: Title, Diamond ornament and 4 Clean Cards (2x2 grid) */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold text-[#181126] tracking-tight">
                    Why Choose Karmic Ascension?
                  </h2>
                  {/* Star diamond ornament */}
                  <div className="flex items-center gap-2 pt-1.5">
                    <span className="h-[1px] w-10 bg-[#e2ceaf]" />
                    <span className="text-[#c49a4a] text-xs">✦</span>
                    <span className="h-[1px] w-10 bg-[#e2ceaf]" />
                  </div>
                </div>

                {/* 2x2 Grid of 4 Feature Cards as in design reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card 1: Authentic Guidance */}
                  <div className="rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-3.5 hover:border-[#dfba63] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff8eb] text-[#d99f2b]">
                      <svg className="h-5 w-5 stroke-current fill-none stroke-[1.8]" viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-[#181126]">
                        Authentic Guidance
                      </h3>
                      <p className="mt-0.5 text-xs text-[#716583] leading-snug">
                        From verified and experienced astrologers
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Wide Range of Experts */}
                  <div className="rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-3.5 hover:border-[#dfba63] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff8eb] text-[#d99f2b]">
                      <Users className="h-5 w-5 stroke-[1.8]" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-[#181126]">
                        Wide Range of Experts
                      </h3>
                      <p className="mt-0.5 text-xs text-[#716583] leading-snug">
                        Vedic, Tarot, Numerology and more
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Safe & Confidential */}
                  <div className="rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-3.5 hover:border-[#dfba63] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff8eb] text-[#d99f2b]">
                      <Lock className="h-5 w-5 stroke-[1.8]" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-[#181126]">
                        Safe & Confidential
                      </h3>
                      <p className="mt-0.5 text-xs text-[#716583] leading-snug">
                        Your privacy is our priority
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Trusted by Thousands */}
                  <div className="rounded-2xl border border-[#ede1cc] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-start gap-3.5 hover:border-[#dfba63] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff8eb] text-[#d99f2b]">
                      <Sparkles className="h-5 w-5 stroke-[1.8]" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-[#181126]">
                        Trusted by Thousands
                      </h3>
                      <p className="mt-0.5 text-xs text-[#716583] leading-snug">
                        Join a growing community
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 7. ABOUT SECTION                                              */}
        {/* ============================================================== */}
        <section id="about" className="py-14 sm:py-18 bg-white border-t border-[#ede3cf]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#181126]">
              About Karmic Ascension
            </h2>
            <p className="text-sm text-[#5d516e] leading-relaxed max-w-3xl mx-auto">
              Karmic Ascension is dedicated to preserving the pristine integrity of classical Vedic Jyotish while making authentic consultations accessible to seekers worldwide. Our platform connects you only with rigorously vetted astrologers, ensuring your personal guidance is confidential, compassionate, and truthful.
            </p>
            <div className="pt-2">
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e3c16f] to-[#cf9e3e] px-6 py-2.5 text-xs font-bold text-[#140c26] shadow-sm hover:brightness-105 transition-all"
              >
                <span>Join Karmic Ascension Today</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}