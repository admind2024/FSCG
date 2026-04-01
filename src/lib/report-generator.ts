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
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const blue: [number, number, number] = [0, 71, 204];
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [102, 102, 102];
  const green: [number, number, number] = [5, 150, 105];

  const c = params.currency;

  // ── Helpers ──────────────────────────────────────────────
  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - 20) {
      doc.addPage();
      cursorY = margin;
    }
  }

  function drawSectionTitle(title: string) {
    ensureSpace(12);
    cursorY += 3;
    doc.setFontSize(10);
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, cursorY);
    cursorY += 1;
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 4;
  }

  function drawTable(
    head: string[][],
    body: string[][],
    opts?: { summaryRows?: number },
  ) {
    ensureSpace(15);
    const totalRows = body.length;
    const summaryCount = opts?.summaryRows || 0;

    // Track finalY via callback
    let tableEndY = cursorY + 10;

    autoTable(doc, {
      startY: cursorY,
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
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index >= totalRows - summaryCount) {
          data.cell.styles.fillColor = [240, 247, 255];
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index > 0) {
          data.cell.styles.halign = "right";
        }
      },
      didDrawPage: (data: any) => {
        tableEndY = data.cursor.y;
      },
    });

    cursorY = tableEndY + 4;
  }

  function drawSubLabel(text: string) {
    ensureSpace(8);
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, cursorY);
    cursorY += 3;
  }

  // ── HEADER ──────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.text("RAKUNAT DOO", margin, cursorY);

  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text("PIB: 03145280 | PDV: 40/31-03142-2", margin, cursorY + 5);
  doc.text("Z.R.: 510-213582-76, CKB | info@rakunat.com", margin, cursorY + 9);

  doc.setFontSize(16);
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.text("IZVJESTAJ O ISPLATAMA", pageWidth - margin, cursorY, { align: "right" });

  doc.setFontSize(11);
  doc.setTextColor(...darkGray);
  doc.setFont("helvetica", "bold");
  doc.text(params.eventName, pageWidth - margin, cursorY + 6, { align: "right" });

  const currentDate = new Date().toLocaleDateString("sr-Latn-ME", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text(`Datum: ${currentDate}`, pageWidth - margin, cursorY + 11, { align: "right" });

  cursorY += 16;
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 6;

  // ── EVENT INFO ──────────────────────────────────────────
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
  doc.text(infoText, margin, cursorY);
  cursorY += 6;

  // ── 1. FINANSIJSKI PREGLED ──────────────────────────────
  drawSectionTitle("FINANSIJSKI PREGLED");

  const finBody: string[][] = [
    [`Ukupna prodaja (${params.totalSold} karata)`, fmt(params.totalRevenue, c)],
    ["Osnovica", fmt(params.baseAmount, c)],
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
      `  - Procenat igraci (${params.igraciProdaja.count} x ${params.igraciProdaja.feePercent}%+PDV)`,
      fmt(params.igraciProdaja.totalFee, c),
    ]);
  }
  if (params.deductions.length > 0) {
    const totalDed = params.deductions.reduce((s, d) => s + d.amount, 0);
    finBody.push(["Ukupno odbici", `-${fmt(totalDed, c)}`]);
  }
  finBody.push(["FINALNI IZNOS ZA ISPLATU", fmt(params.finalPayout, c)]);

  drawTable([["Stavka", "Iznos"]], finBody, { summaryRows: 1 });

  // ── 2. PREGLED PO KANALIMA ─────────────────────────────
  drawSectionTitle("PREGLED PO KANALIMA PRODAJE");

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

  drawTable(
    [["Kanal", "Br. karata", "Prodaja", "Naknada %", "Naknada iznos"]],
    channelBody,
    { summaryRows: 1 },
  );

  // ── 3. PROCENTI PRODAJE ─────────────────────────────────
  drawSectionTitle("PROCENTI PRODAJE PO KANALIMA");

  const sp = params.salesPercentages;
  drawTable(
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

  // ── 4. IGRACI PRODAJA ──────────────────────────────────
  if (params.igraciProdaja) {
    drawSectionTitle("PROCENAT OD PRODAJE IGRACI");

    const ip = params.igraciProdaja;
    drawTable(
      [["Stavka", "Iznos"]],
      [
        [`Ukupna prodaja igraci (${ip.count} karata)`, fmt(ip.total, c)],
        [`Naknada (${ip.feePercent}%)`, fmt(ip.fee, c)],
        [`PDV (${params.pdvPercentFee}%) na naknadu`, fmt(ip.pdv, c)],
        ["UKUPNO E-TICKETS PRIHOD OD IGRACA", fmt(ip.totalFee, c)],
      ],
      { summaryRows: 1 },
    );
  }

  // ── 5. ODBICI ───────────────────────────────────────────
  if (params.deductions.length > 0) {
    drawSectionTitle("DODATNI ODBICI");

    const dedBody = params.deductions.map((d) => [d.name, `-${fmt(d.amount, c)}`]);
    const totalDed = params.deductions.reduce((s, d) => s + d.amount, 0);
    dedBody.push(["UKUPNO ODBICI", `-${fmt(totalDed, c)}`]);

    drawTable([["Naziv", "Iznos"]], dedBody, { summaryRows: 1 });
  }

  // ── 6. CHECK-IN STATISTIKE ─────────────────────────────
  if (params.scanStats) {
    const ss = params.scanStats;

    drawSectionTitle("CHECK-IN / SKENIRANJE");

    drawTable(
      [["", "Ukupno", "Skenirano", "Procenat"]],
      [["Svi ulazi", `${ss.total}`, `${ss.scanned}`, pct(ss.percentage)]],
    );

    if (ss.byTribune.length > 0) {
      drawSubLabel("Po tribinama:");
      drawTable(
        [["Tribina", "Ukupno", "Skenirano", "Procenat"]],
        ss.byTribune.map((t) => [t.name, `${t.total}`, `${t.scanned}`, pct(t.percentage)]),
      );
    }

    if (ss.byEntrance.length > 0) {
      drawSubLabel("Po ulazima:");
      drawTable(
        [["Ulaz", "Ukupno", "Skenirano", "Procenat"]],
        ss.byEntrance.map((e) => [e.name, `${e.total}`, `${e.scanned}`, pct(e.percentage)]),
      );
    }

    if (ss.byChannel.length > 0) {
      drawSubLabel("Po kanalu prodaje:");
      drawTable(
        [["Kanal", "Ukupno", "Skenirano", "Procenat"]],
        ss.byChannel.map((ch) => [ch.name, `${ch.total}`, `${ch.scanned}`, pct(ch.percentage)]),
      );
    }
  }

  // ── FINALNI IZNOS BOX ──────────────────────────────────
  ensureSpace(20);
  cursorY += 4;
  doc.setFillColor(...green);
  doc.roundedRect(margin, cursorY, contentWidth, 14, 2, 2, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("FINALNI IZNOS ZA ISPLATU", margin + 6, cursorY + 9);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(params.finalPayout, c), pageWidth - margin - 6, cursorY + 9.5, { align: "right" });
  cursorY += 20;

  // ── POTPISI ────────────────────────────────────────────
  ensureSpace(25);
  cursorY += 15;
  doc.setDrawColor(...darkGray);
  doc.setLineWidth(0.3);

  const sigWidth = 60;
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - sigWidth - 10;

  doc.line(sig1X, cursorY, sig1X + sigWidth, cursorY);
  doc.line(sig2X, cursorY, sig2X + sigWidth, cursorY);

  doc.setFontSize(8);
  doc.setTextColor(...lightGray);
  doc.setFont("helvetica", "normal");
  doc.text("Organizator dogadjaja", sig1X + sigWidth / 2, cursorY + 4, { align: "center" });
  doc.text("Ovlasceno lice", sig2X + sigWidth / 2, cursorY + 4, { align: "center" });

  // ── FOOTER (all pages) ─────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generisano putem E-Tickets Dashboard | ${currentDate} | Strana ${i}/${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" },
    );
  }

  // Save
  const safeName = params.eventName.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`Izvjestaj-${safeName}-${dateStr}.pdf`);
}
