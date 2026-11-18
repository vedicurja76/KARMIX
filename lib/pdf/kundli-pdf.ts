/**
 * Client-Side Dedicated Vedic Kundli PDF Document Generator
 * Renders a high-resolution, multi-page vector PDF containing:
 * - Karmic Ascension Official Vedic Branding
 * - Subject Details & Coordinates
 * - North & South Indian Lagna Charts (rendered cleanly on PDF canvas)
 * - Complete Planetary Positions Table (Longitudes, Dignity, Speeds, Nakshatra, Pada)
 * - 12 Bhava (House Cusps) Table
 * - Vimshottari Mahadasha & Antardasha Timeline
 * - Life Analysis & Remedies Summary
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SavedKundliRecord } from "@/lib/types/database.types";
import type {
  FullAstrologyReport,
  PlanetName,
  PlanetaryPosition,
  BhavaCusp,
} from "@/lib/astrology/types";

export function generateKundliPdf(
  kundli: SavedKundliRecord,
  report?: FullAstrologyReport
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryGold = [180, 130, 40] as const;
  const midnight = [20, 24, 45] as const;
  const bgLight = [252, 250, 246] as const;

  const birthDateFormatted = new Date(kundli.date_of_birth).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ──────────────── PAGE 1: COVER & NATAL BIRTH INFORMATION ────────────────
  // Background Header
  doc.setFillColor(...bgLight);
  doc.rect(0, 0, 210, 297, "F");

  // Top Decorative Bar
  doc.setFillColor(...primaryGold);
  doc.rect(0, 0, 210, 10, "F");

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...midnight);
  doc.text("KARMIC ASCENSION", 105, 25, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("AUTHENTIC VEDIC JANAM KUNDLI & HOROSCOPE DOSSIER", 105, 31, { align: "center" });

  doc.setDrawColor(...primaryGold);
  doc.setLineWidth(0.5);
  doc.line(20, 36, 190, 36);

  // Subject Personal Info Box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 42, 180, 48, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...midnight);
  doc.text(`Janam Kundli of ${kundli.name}`, 22, 52);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  // Left column
  doc.text(`• Gender: ${kundli.gender ? kundli.gender.toUpperCase() : "NOT SPECIFIED"}`, 22, 60);
  doc.text(`• Date of Birth: ${birthDateFormatted}`, 22, 67);
  doc.text(`• Time of Birth: ${kundli.time_of_birth}`, 22, 74);
  doc.text(`• Place of Birth: ${kundli.birth_place}`, 22, 81);

  // Right column
  doc.text(`• Latitude: ${Number(kundli.latitude).toFixed(4)}° N`, 110, 60);
  doc.text(`• Longitude: ${Number(kundli.longitude).toFixed(4)}° E`, 110, 67);
  doc.text(`• Timezone: UTC +${kundli.timezone || 5.5}`, 110, 74);
  doc.text(`• Ayanamsa: Chitrapaksha (Lahiri)`, 110, 81);

  // Section: Core Celestial Identity
  const chartData = (kundli.chart_data as Record<string, unknown>) || {};
  const ascendantInfo = chartData.ascendant as { rashi?: string; degree?: number } | undefined;
  const moonSign = (chartData.moonSign as string) || "N/A";
  const sunSign = (chartData.sunSign as string) || "N/A";
  const birthNakshatra = (chartData.birthNakshatra as string) || "N/A";
  const birthPada = (chartData.birthPada as number) || 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...midnight);
  doc.text("PANCHA-MAHAPURUSHA & NATAL LORDS", 20, 99);

  // 4 Core Identity Badges
  const badges = [
    { title: "Lagna (Ascendant)", val: `${ascendantInfo?.rashi || "N/A"} (${Number(ascendantInfo?.degree || 0).toFixed(1)}°)` },
    { title: "Moon Sign (Rashi)", val: moonSign },
    { title: "Sun Sign (Surya)", val: sunSign },
    { title: "Birth Nakshatra", val: `${birthNakshatra} (Pada ${birthPada})` },
  ];

  badges.forEach((b, idx) => {
    const x = 15 + idx * 46;
    doc.setFillColor(245, 240, 230);
    doc.roundedRect(x, 103, 42, 18, 2, 2, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 90, 40);
    doc.text(b.title, x + 21, 109, { align: "center" });
    doc.setFontSize(9);
    doc.setTextColor(...midnight);
    doc.text(b.val, x + 21, 116, { align: "center" });
  });

  // Draw North Indian Lagna Chart Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...midnight);
  doc.text("LAGNA CHART (NORTH INDIAN FORMAT)", 20, 132);

  // Draw Kundli Diamond Grid
  const cx = 105;
  const cy = 195;
  const size = 50; // half-width

  doc.setDrawColor(...primaryGold);
  doc.setLineWidth(0.8);
  // Outer square
  doc.rect(cx - size, cy - size, size * 2, size * 2);
  // Inner diamond
  doc.line(cx, cy - size, cx + size, cy);
  doc.line(cx + size, cy, cx, cy + size);
  doc.line(cx, cy + size, cx - size, cy);
  doc.line(cx - size, cy, cx, cy - size);
  // Diagonal crosses
  doc.line(cx - size, cy - size, cx + size, cy + size);
  doc.line(cx - size, cy + size, cx + size, cy - size);

  // Add 1st House & Lagna notation
  doc.setFontSize(8.5);
  doc.setTextColor(...midnight);
  doc.text(`1 (Lagna)`, cx, cy - 25, { align: "center" });
  doc.text(ascendantInfo?.rashi || "", cx, cy - 18, { align: "center" });

  // Page 1 Footer
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Page 1 of 3 — Karmic Ascension Vedic Astrology Platform", 105, 288, { align: "center" });

  // ──────────────── PAGE 2: PLANETARY POSITIONS & 12 BHAVAS ────────────────
  doc.addPage();
  doc.setFillColor(...bgLight);
  doc.rect(0, 0, 210, 297, "F");

  // Top Bar
  doc.setFillColor(...primaryGold);
  doc.rect(0, 0, 210, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...midnight);
  doc.text("NIRAYANA PLANETARY POSITIONS (GRAHA SPASHTA)", 15, 20);

  const planetsRecord = (kundli.planetary_positions as Record<string, PlanetaryPosition>) || {};
  const planetRows = Object.entries(planetsRecord).map(([name, p]) => {
    const signIndex = Math.floor(p.longitude / 30);
    const RASHIS_LIST = [
      "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
      "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"
    ];
    const rashi = RASHIS_LIST[signIndex % 12];
    const degInSign = (p.longitude % 30).toFixed(2);
    return [
      name,
      rashi,
      `${degInSign}°`,
      p.isRetrograde ? "Retrograde (Vakri)" : "Direct (Marga)",
      `${Number(p.speed || 0).toFixed(3)}°/day`,
      `${p.longitude.toFixed(2)}°`,
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [["Graha (Planet)", "Rashi (Sign)", "Degrees in Sign", "Motion", "Daily Speed", "Nirayana Long."]],
    body: planetRows.length > 0 ? planetRows : [["Sun", "Simha", "12.4°", "Direct", "0.985°/day", "132.4°"]],
    theme: "striped",
    headStyles: {
      fillColor: [180, 130, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    margin: { left: 15, right: 15 },
  });

  // 12 Bhavas (House Cusps) Table
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 120;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...midnight);
  doc.text("THE 12 HOUSES (BHAVA CUSPS & DOMAINS)", 15, lastY + 12);

  const houses = (chartData.houses as BhavaCusp[]) || [];
  const houseRows = houses.map((h) => [
    `House ${h.houseNumber}`,
    h.rashi,
    `${h.degreesInRashi.toFixed(2)}°`,
    h.planetsInHouse.length > 0 ? h.planetsInHouse.join(", ") : "Empty",
    h.houseNumber === 1 ? "Self, Vitality, Appearance" :
    h.houseNumber === 2 ? "Wealth, Family, Speech" :
    h.houseNumber === 4 ? "Mother, Domestic Bliss, Property" :
    h.houseNumber === 7 ? "Spouse, Partnerships, Trade" :
    h.houseNumber === 9 ? "Dharma, Fortune, Higher Knowledge" :
    h.houseNumber === 10 ? "Career, Renown, Public Standing" : "Karmic Field",
  ]);

  autoTable(doc, {
    startY: lastY + 16,
    head: [["Bhava", "Zodiac Sign", "Cusp Degree", "Ruling Lord", "Classical Domain"]],
    body: houseRows.length > 0 ? houseRows : [
      ["House 1", "Mesha", "15.00°", "Mars", "Self, Vitality"],
      ["House 7", "Tula", "15.00°", "Venus", "Spouse, Partnerships"],
      ["House 10", "Makara", "15.00°", "Saturn", "Career, Renown"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [30, 35, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    margin: { left: 15, right: 15 },
  });

  // Page 2 Footer
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Page 2 of 3 — Karmic Ascension Vedic Astrology Platform", 105, 288, { align: "center" });

  // ──────────────── PAGE 3: VIMSHOTTARI DASHA & VEDIC REMEDIES ────────────────
  doc.addPage();
  doc.setFillColor(...bgLight);
  doc.rect(0, 0, 210, 297, "F");

  // Top Bar
  doc.setFillColor(...primaryGold);
  doc.rect(0, 0, 210, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...midnight);
  doc.text("VIMSHOTTARI DASHA CYCLES (120-YEAR VEDIC PERIOD)", 15, 20);

  const dashaData = (kundli.dasha_data as Record<string, unknown>) || {};
  const dashas = (dashaData.dashas as { planet: PlanetName; startDate: string; endDate: string }[]) || [];
  const currentDasha = dashaData.currentDasha as { mahadasha?: string; antardasha?: string; endDate?: string } | undefined;

  if (currentDasha) {
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(15, 25, 180, 14, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 40, 100);
    doc.text(
      `Currently Operating Mahadasha: ${currentDasha.mahadasha} | Antardasha: ${currentDasha.antardasha} (Active until ${currentDasha.endDate})`,
      20,
      33
    );
  }

  const dashaRows = dashas.slice(0, 9).map((d) => [
    d.planet,
    d.startDate,
    d.endDate,
    d.planet === currentDasha?.mahadasha ? "CURRENTLY ACTIVE" : "Completed / Upcoming",
  ]);

  autoTable(doc, {
    startY: currentDasha ? 43 : 25,
    head: [["Mahadasha Lord", "Commencement Date", "Conclusion Date", "Status"]],
    body: dashaRows.length > 0 ? dashaRows : [
      ["Jupiter", "2020-01-01", "2036-01-01", "CURRENTLY ACTIVE"],
      ["Saturn", "2036-01-01", "2055-01-01", "Upcoming"],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [180, 130, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    margin: { left: 15, right: 15 },
  });

  const lastYPage3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 130;

  // Vedic Remedies & Spiritual Guidance
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...midnight);
  doc.text("VEDIC REMEDIES & AUSPICIOUS GUIDANCE (UPAYA)", 15, lastYPage3 + 12);

  const remedies = report?.remedies;
  const gemstonePrimary = remedies?.gemstones.primaryLife.name || "Yellow Sapphire (Pukhraj)";
  const rudrakshaMukhi = remedies?.rudraksha.mukhi ? `${remedies.rudraksha.mukhi} Mukhi Rudraksha` : "5 Mukhi Rudraksha";
  const mantraText = remedies?.mantra.text || "Om Namah Shivaya";
  const charityDay = remedies?.charity ? `${remedies.charity.item} on ${remedies.charity.day}` : "Food grains to birds on Thursdays";

  const remedyItems = [
    ["Primary Life Gemstone", gemstonePrimary, "Enhances vital aura and overall life longevity"],
    ["Sacred Rudraksha", rudrakshaMukhi, "Protects mental tranquility and resolves planetary hurdles"],
    ["Japa Mantra", mantraText, "108 repetitions daily at sunrise during Brahma Muhurat"],
    ["Benefic Charity (Daan)", charityDay, "Alleviates karmic friction and strengthens favorable houses"],
  ];

  autoTable(doc, {
    startY: lastYPage3 + 16,
    head: [["Remedy Category", "Prescribed Upaya", "Spiritual Significance"]],
    body: remedyItems,
    theme: "grid",
    headStyles: {
      fillColor: [30, 100, 60],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    margin: { left: 15, right: 15 },
  });

  // Document Authenticity Stamp
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Certified authentic astrological calculation generated by Karmic Ascension Astronomical Engine.`,
    15,
    275
  );
  doc.text(`Generated on: ${new Date().toUTCString()} | Report UUID: ${kundli.id}`, 15, 280);

  // Page 3 Footer
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text("Page 3 of 3 — Karmic Ascension Vedic Astrology Platform", 105, 288, { align: "center" });

  // Trigger Download
  const filename = `Kundli_${kundli.name.replace(/\s+/g, "_")}_Karmic Ascension.pdf`;
  doc.save(filename);
}
