import Image from "next/image";

type Variant = "hero" | "cover";

// Where the painting is anchored so the sage and zodiac wheel stay visible in a short, wide strip.
const POSITION: Record<Variant, string> = {
  hero: "object-[84%_40%] sm:object-[center_36%]",
  cover: "object-[84%_34%] sm:object-[center_32%]",
};

/** Painted celestial banner. Place inside a `relative overflow-hidden` container. */
export function HeroArt({
  variant = "hero",
  priority = false,
  className = "",
}: {
  variant?: Variant;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`celestial-surface pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Image
        src="/images/karmic-ascension/dashboard-celestial-hero.webp"
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 70vw, 100vw"
        className={`object-cover ${POSITION[variant]}`}
      />
    </div>
  );
}
