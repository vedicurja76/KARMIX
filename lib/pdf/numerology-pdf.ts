/**
 * Dedicated Client-Side Numerology Vector PDF Generator
 * Generates an authoritative PDF report matching the Karmic Ascension visual brand.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ComprehensiveNumerologyReport } from "@/lib/astrology/numerology-engine";

export function generateNumerologyPdf(report: ComprehensiveNumerologyReport): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const goldPrimary = [184, 138, 54] as const;
  const midnight = [20, 24, 45] as const;
  const ivoryBg = [253, 251, 247] as const;
  const charcoal = [60, 64, 75] as const;

  // Background
  doc.setFillColor(...ivoryBg);
  doc.rect(0, 0, 210, 297, "F");

  // Header Banner
  doc.setFillColor(...midnight);
  doc.rect(0, 0, 210, 32, "F");

  doc.setFillColor(...goldPrimary);
  doc.rect(0, 32, 210, 2, "F");

  // Title
  doc.setTextColor(...goldPrimary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("KARMIC ASCENSION", 14, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cosmic Number Vibrations & Vedic Numerology Report", 14, 23);

  const printDate = new Date(report.calculatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text(`Generated: ${printDate}`, 155, 23);

  // 1. Subject Details
  let currentY = 44;
  doc.setTextColor(...midnight);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Devotee Particulars", 14, currentY);

  currentY += 6;
  autoTable(doc, {
    startY: currentY,
    head: [["Subject Full Name", "Date of Birth", "Birth Time", "Birthplace"]],
    body: [
      [
        report.input.fullName,
        report.input.dateOfBirth,
        report.input.birthTime || "Not Specified",
        report.input.birthPlace || "Not Specified",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [...midnight], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { textColor: [...charcoal], fontSize: 9 },
    styles: { cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 2. Core Numbers Table
  doc.setTextColor(...midnight);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Core Cosmic Vibration Numbers", 14, currentY);

  currentY += 6;
  autoTable(doc, {
    startY: currentY,
    head: [["Vibration Type", "Number", "Compound", "Planetary Ruler", "Calculation Formula"]],
    body: [
      [
        "Moolank (Root / Birth Number)",
        report.moolank.number.toString(),
        report.moolank.compoundNumber.toString(),
        report.moolank.rulingPlanet,
        report.moolank.calculation,
      ],
      [
        "Bhagyank (Destiny / Life Path)",
        report.bhagyank.number.toString(),
        report.bhagyank.compoundNumber.toString(),
        report.bhagyank.rulingPlanet,
        report.bhagyank.calculation,
      ],
      [
        "Namank (Chaldean Name Number)",
        report.namankChaldean.number.toString(),
        report.namankChaldean.compoundNumber.toString(),
        report.harmonicAffinities.rulingPlanet,
        report.namankChaldean.calculation,
      ],
      [
        "Namank (Pythagorean Name Number)",
        report.namankPythagorean.number.toString(),
        report.namankPythagorean.compoundNumber.toString(),
        "N/A",
        report.namankPythagorean.calculation,
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [...goldPrimary], textColor: [...midnight], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { textColor: [...charcoal], fontSize: 9 },
    styles: { cellPadding: 3.5 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 3. Harmonic Affinities Table
  doc.setTextColor(...midnight);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Harmonic Affinities & Remedial Guidance", 14, currentY);

  currentY += 6;
  autoTable(doc, {
    startY: currentY,
    head: [["Attribute", "Auspicious Resonance Factor"]],
    body: [
      ["Friendly Resonance Numbers", report.harmonicAffinities.friendlyNumbers.join(", ")],
      ["Challenging Polar Numbers", report.harmonicAffinities.challengingNumbers.join(", ")],
      ["Lucky Weekdays", report.harmonicAffinities.luckyDays.join(", ")],
      ["Harmonic Colors", report.harmonicAffinities.luckyColors.join(", ")],
      ["Sacred Consecrated Gemstone", report.harmonicAffinities.recommendedGem],
      ["Ruling Deity / Energy", report.harmonicAffinities.deity],
    ],
    theme: "grid",
    headStyles: { fillColor: [...midnight], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { textColor: [...charcoal], fontSize: 9 },
    styles: { cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 4. Numerological Synthesis Narrative
  doc.setTextColor(...midnight);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Vedic Numerological Synthesis", 14, currentY);

  currentY += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...charcoal);

  const synthesisLines = doc.splitTextToSize(report.synthesis.synthesis, 182);
  doc.text(synthesisLines, 14, currentY);
  currentY += synthesisLines.length * 4.5 + 4;

  const adviceLines = doc.splitTextToSize(report.synthesis.advice, 182);
  doc.text(adviceLines, 14, currentY);
  currentY += adviceLines.length * 4.5 + 8;

  // 5. Optional Supplementary Vedic Astrology
  if (report.vedicBirthChart?.availability === "available") {
    doc.setTextColor(...midnight);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Supplementary Vedic Natal Insights", 14, currentY);

    currentY += 5;
    autoTable(doc, {
      startY: currentY,
      head: [["Lagna (Ascendant)", "Chandra Rashi (Moon Sign)", "Janma Nakshatra", "Surya Rashi (Sun Sign)"]],
      body: [
        [
          `${report.vedicBirthChart.ascendantSign} (${report.vedicBirthChart.ascendantDegree})`,
          report.vedicBirthChart.moonSign || "N/A",
          `${report.vedicBirthChart.nakshatra} (Pada ${report.vedicBirthChart.nakshatraPada || 1})`,
          report.vedicBirthChart.sunSign || "N/A",
        ],
      ],
      theme: "plain",
      headStyles: { fillColor: [240, 235, 220], textColor: [...midnight], fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { textColor: [...charcoal], fontSize: 8.5 },
      styles: { cellPadding: 2.5 },
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 160);
  doc.text(
    "Karmic Ascension Authentic Vedic & Chaldean Calculation Engine • Private & Confidential",
    14,
    290
  );

  doc.save(`Karmic Ascension_Numerology_${report.input.fullName.replace(/\s+/g, "_")}.pdf`);
}

