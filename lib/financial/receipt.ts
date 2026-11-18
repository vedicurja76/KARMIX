import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPaiseToInr } from "./pricing";

export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  paymentId: string;
  date: string;
  buyerName: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  serviceTitle: string;
  serviceType: string;
  providerName?: string | null;
  amountPaise: number;
  platformFeePaise?: number;
  status: string;
  paymentMethod?: string;
}

/**
 * Generates an official, branded Karmic Ascension PDF receipt.
 * Works both in client-side download and returns ArrayBuffer/Blob.
 */
export function generatePaymentReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const goldPrimary = [180, 130, 40] as const;
  const midnight = [20, 24, 45] as const;
  const muted = [100, 105, 120] as const;
  const lightBg = [250, 248, 244] as const;

  // Background card & header
  doc.setFillColor(...lightBg);
  doc.rect(0, 0, 210, 297, "F");

  // Top Accent Bar
  doc.setFillColor(...goldPrimary);
  doc.rect(0, 0, 210, 8, "F");

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...midnight);
  doc.text("KARMIC ASCENSION", 20, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("Vedic Astrological Guidance & Spiritual Consultancy", 20, 31);
  doc.text("Official Tax Invoice & Payment Receipt", 20, 36);

  // Status Badge (Top Right)
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(145, 18, 45, 12, 2, 2, "F");
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.roundedRect(145, 18, 45, 12, 2, 2, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text("PAID & VERIFIED", 152, 25.5);

  // Divider
  doc.setDrawColor(220, 215, 205);
  doc.setLineWidth(0.5);
  doc.line(20, 44, 190, 44);

  // Receipt & Customer Metadata Section
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midnight);
  doc.text("RECEIPT DETAILS", 20, 52);
  doc.text("BILLED TO", 110, 52);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);

  doc.text(`Receipt No: ${data.receiptNumber}`, 20, 59);
  doc.text(`Order No: ${data.orderNumber}`, 20, 65);
  doc.text(`Payment ID: ${data.paymentId}`, 20, 71);
  doc.text(`Date & Time: ${data.date}`, 20, 77);

  doc.text(`Customer Name: ${data.buyerName}`, 110, 59);
  if (data.buyerEmail) doc.text(`Email: ${data.buyerEmail}`, 110, 65);
  if (data.buyerPhone) doc.text(`Phone: ${data.buyerPhone}`, 110, 71);
  if (data.providerName) doc.text(`Astrologer: ${data.providerName}`, 110, 77);

  // Itemized Table
  const tableData = [
    [
      data.serviceTitle,
      data.serviceType,
      "1",
      formatPaiseToInr(data.amountPaise),
    ],
  ];

  autoTable(doc, {
    startY: 86,
    margin: { left: 20, right: 20 },
    head: [["Description", "Service Category", "Qty", "Amount (INR)"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: [235, 230, 220],
      textColor: [20, 24, 45],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      textColor: [30, 35, 50],
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 35, halign: "right" },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Totals Box
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("Subtotal:", 130, finalY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midnight);
  doc.text(formatPaiseToInr(data.amountPaise), 188, finalY, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("Taxes & Processing Fee:", 130, finalY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midnight);
  doc.text("₹0.00", 188, finalY + 6, { align: "right" });

  doc.setDrawColor(200, 195, 185);
  doc.line(130, finalY + 9, 190, finalY + 9);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...goldPrimary);
  doc.text("Total Paid:", 130, finalY + 16);
  doc.text(formatPaiseToInr(data.amountPaise), 188, finalY + 16, { align: "right" });

  // Security Verification Footer
  const footerY = 250;
  doc.setDrawColor(220, 215, 205);
  doc.line(20, footerY, 190, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "This is a system-generated electronic payment receipt verified through Instamojo secure gateway.",
    20,
    footerY + 8
  );
  doc.text(
    "For customer queries, cancellations, or support, please visit: https://karmicascension.com/support",
    20,
    footerY + 13
  );

  return doc;
}

