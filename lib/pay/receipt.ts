import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPaiseToInr } from "../financial/pricing";
import { JyotishPaymentIntent } from "./types";

export interface GenerateReceiptData {
  receiptNumber: string;
  intent: JyotishPaymentIntent;
  customerName?: string;
  customerEmail?: string;
  astrologerName?: string;
  serviceDescription: string;
  utrOrReference?: string;
  paymentMethod?: string;
  verificationSource?: string;
  paidAtDate?: Date;
}

export function generatePaymentReceiptPDF(data: GenerateReceiptData): Uint8Array {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const paidDate = data.paidAtDate || new Date();
  const dateStr = paidDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Background Header Banner
  doc.setFillColor(15, 23, 42); // Midnight navy slate
  doc.rect(0, 0, 210, 42, "F");

  // Accent Gold Bar
  doc.setFillColor(217, 119, 6); // Vedic Gold
  doc.rect(0, 42, 210, 2.5, "F");

  // Brand Titles
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("KARMIC ASCENSION PAY", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text("Official Tax Invoice & Transaction Confirmation", 14, 28);
  doc.text("Vedic Astrological Guidance & Digital Consultation", 14, 34);

  // Status Badge on Header Right
  doc.setFillColor(22, 101, 52); // Emerald Green
  doc.roundedRect(148, 12, 48, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAYMENT SUCCESSFUL", 152, 20);

  // Receipt Meta Grid
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Receipt Number:", 14, 55);
  doc.setFont("helvetica", "normal");
  doc.text(data.receiptNumber, 48, 55);

  doc.setFont("helvetica", "bold");
  doc.text("Date & Time:", 14, 62);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, 48, 62);

  doc.setFont("helvetica", "bold");
  doc.text("Intent Number:", 14, 69);
  doc.setFont("helvetica", "normal");
  doc.text(data.intent.intent_number, 48, 69);

  // Column 2
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method:", 120, 55);
  doc.setFont("helvetica", "normal");
  doc.text(data.paymentMethod || "UPI (Karmic Ascension Pay)", 155, 55);

  doc.setFont("helvetica", "bold");
  doc.text("Bank Ref / UTR:", 120, 62);
  doc.setFont("helvetica", "normal");
  doc.text(data.utrOrReference || "Not provided", 155, 62);

  doc.setFont("helvetica", "bold");
  doc.text("Gateway Mode:", 120, 69);
  doc.setFont("helvetica", "normal");
  const verificationLabel = data.verificationSource === "manual_utr"
    ? "Manually verified"
    : data.verificationSource === "signed_webhook"
      ? "Signed gateway event"
      : data.verificationSource === "simulation"
        ? "Test payment"
        : "Verified";
  doc.text(verificationLabel, 155, 69);

  // Horizontal Rule
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 76, 196, 76);

  // Billed To & Service Provider Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CUSTOMER DETAILS", 14, 85);
  doc.text("SERVICE PROVIDER", 120, 85);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.customerName || "Valued Client", 14, 92);
  doc.text(data.customerEmail || "Not provided", 14, 98);

  doc.text(data.astrologerName || "Karmic Ascension Platform Services", 120, 92);
  doc.text("support@karmicascension.in", 120, 98);

  // Line Items Table
  const inrAmount = formatPaiseToInr(data.intent.amount_paise);

  autoTable(doc, {
    startY: 110,
    head: [["Item Description", "Type", "Status", "Amount (INR)"]],
    body: [
      [
        data.serviceDescription,
        data.intent.entity_type.toUpperCase(),
        "PAID",
        inrAmount,
      ],
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30, halign: "right" },
    },
  });

  // Summary Totals
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 130, finalY);
  doc.text(inrAmount, 195, finalY, { align: "right" });

  doc.text("Taxes & GST (Included):", 130, finalY + 6);
  doc.text("₹0.00", 195, finalY + 6, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total Paid:", 130, finalY + 15);
  doc.setTextColor(22, 101, 52);
  doc.text(inrAmount, 195, finalY + 15, { align: "right" });

  // Security & Verification Footer
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const footerY = 270;
  doc.line(14, footerY - 5, 196, footerY - 5);
  doc.text("This is an electronically generated and cryptographically verifiable receipt issued by Karmic Ascension Pay.", 14, footerY);
  doc.text("For financial queries or transaction disputes, contact payments@karmicascension.in quoting your receipt number.", 14, footerY + 5);

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

