import Link from "next/link";
import Image from "next/image";
import { Star, ChevronRight } from "lucide-react";
import type { PublicAstrologerProfile } from "@/lib/types/astrologer.types";

interface AstrologerShowcaseProps {
  astrologers: PublicAstrologerProfile[];
  isLoggedIn?: boolean;
}

export function AstrologerShowcase({ astrologers, isLoggedIn = false }: AstrologerShowcaseProps) {
  // Reference cards matching the 3 prominent astrologers shown in the user's design image
  const referenceScholars = [
    {
      id: "ref-1",
      slug: "acharya-dev-sharma",
      display_name: "Acharya Dev Sharma",
      is_top_rated: true,
      image: "/images/karmic-ascension/acharya-dev-sharma.jpg",
      tags: ["Vedic Astrology", "Kundli Analysis", "Career Guidance"],
      rating: "4.9",
      consultations: "2.1k",
      is_online: true,
      fee: 499,
    },
    {
      id: "ref-2",
      slug: "dr-meera-joshi",
      display_name: "Dr. Meera Joshi",
      is_top_rated: false,
      image: "/images/karmic-ascension/dr-meera-joshi.jpg",
      tags: ["Love & Relationships", "Marriage Guidance", "Family Issues"],
      rating: "4.8",
      consultations: "1.8k",
      is_online: true,
      fee: 599,
    },
    {
      id: "ref-3",
      slug: "pandit-raghav-tripathi",
      display_name: "Pandit Raghav Tripathi",
      is_top_rated: false,
      image: "/images/karmic-ascension/pandit-raghav-tripathi.jpg",
      tags: ["Kundli Analysis", "Gemstones", "Spiritual Guidance"],
      rating: "4.8",
      consultations: "1.5k",
      is_online: true,
      fee: 450,
    },
  ];

  // Merge with real live database approved astrologers when available
  const displayItems =
    astrologers && astrologers.length >= 3
      ? astrologers.slice(0, 3).map((a, idx) => ({
          id: a.id,
          slug: a.slug || a.id,
          display_name: a.display_name,
          is_top_rated: idx === 0,
          image: a.profile_photo_url || referenceScholars[idx]?.image || "/images/karmic-ascension/acharya-dev-sharma.jpg",
          tags: Array.isArray(a.specializations) && a.specializations.length > 0
            ? a.specializations.slice(0, 3)
            : referenceScholars[idx]?.tags || ["Vedic Astrology", "Kundli Analysis"],
          rating: "4.9",
          consultations: a.experience_years ? `${a.experience_years * 150}+ consultations` : referenceScholars[idx]?.consultations || "1.2k+ consultations",
          is_online: true,
          fee: a.consultation_fee || 500,
        }))
      : referenceScholars;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 w-full">
      {displayItems.map((item) => (
        <article
          key={item.id}
          className="group relative flex flex-col justify-between rounded-2xl border border-[#ede1cc] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(196,154,74,0.12)] hover:border-[#dfba63] transition-all duration-300 min-w-0"
        >
          <div>
            {/* Top Row: Avatar with online dot + Name + Optional TOP RATED badge */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div className="relative h-14 w-14 rounded-full overflow-hidden border border-[#e6d3af] bg-[#fbf6ec]">
                  <Image
                    src={item.image}
                    alt={item.display_name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                {/* Active green status indicator dot situated outside the circle at top-right */}
                {item.is_online && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white z-10"
                    title="Online now"
                    aria-label="Online now"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h3
                    className="font-display text-[15px] font-semibold text-[#181126] group-hover:text-[#a07422] transition-colors leading-snug"
                    title={item.display_name}
                  >
                    {item.display_name}
                  </h3>
                  {item.is_top_rated && (
                    <span className="inline-flex shrink-0 items-center rounded-md bg-[#f7eedc] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#986c1d]">
                      Top Rated
                    </span>
                  )}
                </div>

                {/* Subtitle / Specialization bullet line: wraps naturally up to 2 lines without clipped letters */}
                <p
                  className="mt-1 text-[11px] text-[#6d617d] font-medium leading-relaxed line-clamp-2 break-normal"
                  title={item.tags.join(" • ")}
                >
                  {item.tags.join(" • ")}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Rating with gold stars + "View Profile ->" link */}
          <div className="mt-4 pt-3 border-t border-[#f2e8d7]/70 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <div className="flex items-center text-[#d99f2b]" aria-label={`Rating: ${item.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#d99f2b] stroke-[#d99f2b]" aria-hidden="true" />
                ))}
              </div>
              <span className="font-bold text-[#1a1228] text-[12px]">{item.rating}</span>
              <span className="text-[11px] text-[#7d718e]">({item.consultations})</span>
            </div>

            <Link
              href="/auth"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#8b631d] hover:text-[#191128] transition-colors group/link shrink-0 ml-auto"
            >
              <span>View Profile</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
