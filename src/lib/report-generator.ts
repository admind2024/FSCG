// src/lib/report-generator.ts
// Professional PDF report generation using jsPDF + autoTable

import { ReportParams } from "@/types/dashboard";

function fmt(amount: number, currency: string): string {
  const symbols: Record<string, string> = { EUR: "\u20AC", RSD: "RSD", USD: "$", BAM: "KM" };
  const symbol = symbols[currency] || currency;
  const formatted = amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${symbol}`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export async function generateEventReport(params: ReportParams): Promise<void> {
  // Lazy import to reduce bundle size
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // autoTable plugin registration
  if (typeof autoTableModule.default === "function") {
    autoTableModule.default(doc);
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const blue = [0, 71, 204] as [number, number, number];
  const darkGray = [51, 51, 51] as [number, number, number];
  const lightGray = [102, 102, 102] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];
  const green = [5, 150, 105] as [number, number, number];
  const violet = [124, 58, 237] as [number, number, number];

  const c = params.currency;

  // ═══════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════
  doc.setFontSize(14);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.text("RAKUNAT DOO", margin, y);

  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text("PIB: 03145280 | PDV: 40/31-03142-2", margin, y + 5);
  doc.text("Z.R.: 510-213582-76, CKB | info@rakunat.com", margin, y + 9);

  doc.setFontSize(16);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.text("IZVJESTAJ O ISPLATAMA", pageWidth - margin, y, { align: "right" });

  doc.setFontSize(11);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text(params.eventName, pageWidth - margin, y + 6, { align: "right" });

  const currentDate = new Date().toLocaleDateString("sr-Latn-ME", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(`Datum: ${currentDate}`, pageWidth - margin, y + 11, { align: "right" });

  y += 16;
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ═══════════════════════════════════════════════════════════
  // EVENT INFO
  // ═══════════════════════════════════════════════════════════
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  const infoText = [
    params.venue && `Mjesto: ${params.venue}`,
    params.date && `Datum: ${params.date}`,
    params.time && `Vrijeme: ${params.time}`,
    `Kapacitet: ${params.capacity.toLocaleString("de-DE")}`,
    `Popunjenost: ${pct(params.fillPercentage)}`,
  ].filter(Boolean).join("  |  ");
  doc.text(infoText, margin, y);
  y += 6;

  // ═══════════════════════════════════════════════════════════
  // HELPER: Section title
  // ═══════════════════════════════════════════════════════════
  function sectionTitle(title: string) {
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 1;
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER: autoTable wrapper
  // ═══════════════════════════════════════════════════════════
  function addTable(
    head: string[][],
    body: (string | number)[][],
    opts?: { summaryRows?: number; columnStyles?: Record<number, any> },
  ) {
    if (y > 250) { doc.addPage(); y = margin; }

    const totalRows = body.length;
    const summaryCount = opts?.summaryRows || 0;

    (doc as any).autoTable({
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [221, 221, 221],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [248, 249, 250],
        textColor: darkGray,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        ...opts?.columnStyles,
      },
      didParseCell: (data: any) => {
        // Summary rows styling
        if (data.section === "body" && data.row.index >= totalRows - summaryCount) {
          data.cell.styles.fillColor = [240, 247, 255];
          data.cell.styles.fontStyle = "bold";
        }
        // Right-align numeric columns (all except first)
        if (data.column.index > 0) {
          data.cell.styles.halign = "right";
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ═══════════════════════════════════════════════════════════
  // 1. FINANSIJSKI PREGLED
  // ═══════════════════════════════════════════════════════════
  sectionTitle("FINANSIJSKI PREGLED");

  const finBody: string[][] = [
    [`Ukupna prodaja (${params.totalSold} karata)`, fmt(params.totalRevenue, c)],
    [`Osnovica`, fmt(params.baseAmount, c)],
    [`PDV (${params.pdvPercentRevenue}%)`, fmt(params.pdvAmount, c)],
  ];
  if (params.savez) {
    finBody.push([
      `Savez karte (${params.savez.gratis} gratis / ${params.savez.paid} sa cijenom)`,
      `${params.savez.count} kom`,
    ]);
  }
  finBody.push([`E-Tickets prihod (ukupni)`, `-${fmt(params.totalETicketsRevenue, c)}`]);
  if (params.igraciProdaja) {
    finBody.push([`  - Naknada od prodaje karata`, fmt(params.eTicketsFee, c)]);
    finBody.push([
      `  - Procenat od prodaje igraci (${params.igraciProdaja.count} x ${params.igraciProdaja.feePercent}%+PDV)`,
      fmt(params.igraciProdaja.totalFee, c),
    ]);
  }
  if (params.deductions.length > 0) {
    const totalDed = params.deductions.reduce((s, d) => s + d.amount, 0);
    finBody.push([`Ukupno odbici`, `-${fmt(totalDed, c)}`]);
  }
  finBody.push([`FINALNI IZNOS ZA ISPLATU`, fmt(params.finalPayout, c)]);

  addTable([["Stavka", "Iznos"]], finBody, { summaryRows: 1 });

  // ═══════════════════════════════════════════════════════════
  // 2. PREGLED PO KANALIMA PRODAJE
  // ═══════════════════════════════════════════════════════════
  sectionTitle("PREGLED PO KANALIMA PRODAJE");

  const ch = params.channels;
  const channelBody: string[][] = [
    ["Online", `${ch.online.count}`, fmt(ch.online.amount, c), `${ch.online.feePercent}%`, `-${fmt(ch.online.totalFee, c)}`],
    ["Biletarnica", `${ch.biletarnica.count}`, fmt(ch.biletarnica.amount, c), `${ch.biletarnica.feePercent}%`, `-${fmt(ch.biletarnica.totalFee, c)}`],
    ["Virman", `${ch.virman.count}`, fmt(ch.virman.amount, c), `${ch.virman.feePercent}%`, `-${fmt(ch.virman.totalFee, c)}`],
    ["Kartica", `${ch.kartica.count}`, fmt(ch.kartica.amount, c), `${ch.kartica.feePercent}%`, `-${fmt(ch.kartica.totalFee, c)}`],
  ];
  if (params.savez) {
    channelBody.push(["Savez", `${params.savez.count}`, "-", "-", "-"]);
  }
  const totalFees = ch.online.totalFee + ch.biletarnica.totalFee + ch.virman.totalFee + ch.kartica.totalFee;
  channelBody.push([
    "UKUPNO",
    `${params.totalSold}${params.savez ? ` (+${params.savez.count})` : ""}`,
    fmt(params.totalRevenue, c),
    "",
    `-${fmt(totalFees, c)}`,
  ]);

  addTable(
    [["Kanal", "Br. karata", "Prodaja", "Naknada %", "Naknada iznos"]],
    channelBody,
    { summaryRows: 1 },
  );

  // ═══════════════════════════════════════════════════════════
  // 3. PROCENTI PRODAJE PO KANALIMA
  // ═══════════════════════════════════════════════════════════
  sectionTitle("PROCENTI PRODAJE PO KANALIMA");

  const sp = params.salesPercentages;
  addTable(
    [["Kanal", "Procenat", "Br. karata", "Iznos"]],
    [
      ["Online", pct(sp.online), `${ch.online.count}`, fmt(ch.online.amount, c)],
      [
        "Biletarnica (got.+kart.)",
        pct(sp.biletarnica),
        `${ch.biletarnica.count + ch.kartica.count}`,
        fmt(ch.biletarnica.amount + ch.kartica.amount, c),
      ],
      ["Virman", pct(sp.virman), `${ch.virman.count}`, fmt(ch.virman.amount, c)],
    ],
  );

  // ═══════════════════════════════════════════════════════════
  // 4. IGRACI PRODAJA DETALJ
  // ═══════════════════════════════════════════════════════════
  if (params.igraciProdaja) {
    sectionTitle("PROCENAT OD PRODAJE IGRACI");

    const ip = params.igraciProdaja;
    addTable(
      [["Stavka", "Iznos"]],
      [
        [`Ukupna prodaja igraci (${ip.count} karata)`, fmt(ip.total, c)],
        [`Naknada (${ip.feePercent}%)`, fmt(ip.fee, c)],
        [`PDV (${params.pdvPercentFee}%) na naknadu`, fmt(ip.pdv, c)],
        [`UKUPNO E-TICKETS PRIHOD OD IGRACA`, fmt(ip.totalFee, c)],
      ],
      { summaryRows: 1 },
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 5. ODBICI
  // ═══════════════════════════════════════════════════════════
  if (params.deductions.length > 0) {
    sectionTitle("DODATNI ODBICI");

    const dedBody = params.deductions.map((d) => [d.name, `-${fmt(d.amount, c)}`]);
    const totalDed = params.deductions.reduce((s, d) => s + d.amount, 0);
    dedBody.push(["UKUPNO ODBICI", `-${fmt(totalDed, c)}`]);

    addTable([["Naziv", "Iznos"]], dedBody, { summaryRows: 1 });
  }

  // ═══════════════════════════════════════════════════════════
  // 6. CHECK-IN STATISTIKE
  // ═══════════════════════════════════════════════════════════
  if (params.scanStats) {
    const ss = params.scanStats;

    sectionTitle("CHECK-IN / SKENIRANJE");

    // Summary
    addTable(
      [["", "Ukupno", "Skenirano", "Procenat"]],
      [[
        "Svi ulazi",
        `${ss.total}`,
        `${ss.scanned}`,
        pct(ss.percentage),
      ]],
    );

    // By tribune
    if (ss.byTribune.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(...darkGray);
      doc.setFont("helvetica", "bold");
      doc.text("Po tribinama:", margin, y);
      y += 3;

      addTable(
        [["Tribina", "Ukupno", "Skenirano", "Procenat"]],
        ss.byTribune.map((t) => [t.name, `${t.total}`, `${t.scanned}`, pct(t.percentage)]),
      );
    }

    // By entrance
    if (ss.byEntrance.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(...darkGray);
      doc.setFont("helvetica", "bold");
      doc.text("Po ulazima:", margin, y);
      y += 3;

      addTable(
        [["Ulaz", "Ukupno", "Skenirano", "Procenat"]],
        ss.byEntrance.map((e) => [e.name, `${e.total}`, `${e.scanned}`, pct(e.percentage)]),
      );
    }

    // By sales channel
    if (ss.byChannel.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(...darkGray);
      doc.setFont("helvetica", "bold");
      doc.text("Po kanalu prodaje:", margin, y);
      y += 3;

      addTable(
        [["Kanal", "Ukupno", "Skenirano", "Procenat"]],
        ss.byChannel.map((ch) => [ch.name, `${ch.total}`, `${ch.scanned}`, pct(ch.percentage)]),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FINALNI IZNOS BOX
  // ═══════════════════════════════════════════════════════════
  if (y > 250) { doc.addPage(); y = margin; }

  y += 4;
  doc.setFillColor(...green);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("FINALNI IZNOS ZA ISPLATU", margin + 6, y + 9);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(params.finalPayout, c), pageWidth - margin - 6, y + 9.5, { align: "right" });
  y += 20;

  // ═══════════════════════════════════════════════════════════
  // POTPISI
  // ═══════════════════════════════════════════════════════════
  if (y > 245) { doc.addPage(); y = margin; }

  y += 15;
  doc.setDrawColor(...darkGray);
  doc.setLineWidth(0.3);

  const sigWidth = 60;
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - sigWidth - 10;

  doc.line(sig1X, y, sig1X + sigWidth, y);
  doc.line(sig2X, y, sig2X + sigWidth, y);

  doc.setFontSize(8);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text("Organizator dogadjaja", sig1X + sigWidth / 2, y + 4, { align: "center" });
  doc.text("Ovlasceno lice", sig2X + sigWidth / 2, y + 4, { align: "center" });

  // ═══════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generisano putem E-Tickets Dashboard | ${currentDate} | Strana ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  // Save
  const safeName = params.eventName.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`Izvjestaj-${safeName}-${dateStr}.pdf`);
}
