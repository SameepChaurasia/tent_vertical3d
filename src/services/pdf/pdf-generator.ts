import type { Configuration, ProductDefinition, PriceQuote } from '../../domain/schemas';
import { formatCentsAsDisplay } from '../../domain/pricing/pricing-engine';

/**
 * PDF Generator — creates a production-ready A4 PDF summarising the order.
 *
 * ARCHITECTURE:
 * - jsPDF is lazy-loaded to keep it out of the initial bundle (~250KB).
 * - The PDF includes: order header, option summary, price breakdown,
 *   2D artwork preview (rendered to an offscreen canvas), and 3D snapshots.
 * - Page layout uses a 20mm margin with a clean typographic hierarchy.
 *
 * NOTE: In production, PDF generation would happen server-side (Vercel function)
 * to prevent client-side manipulation. The client version exists for the demo.
 */

interface PdfGenerationOptions {
  configuration: Configuration;
  productDefinition: ProductDefinition;
  quote: PriceQuote;
  /** Custom Pantone codes or printing instructions */
  designNotes?: string;
  /** Base64 data URL of the 3D preview snapshot */
  previewSnapshot?: string;
  /** Base64 data URL of the 2D artwork canvas */
  artworkSnapshot?: string;
}

/**
 * Generates and downloads a production summary PDF.
 * Returns the blob URL for programmatic use.
 */
export async function generateProductionPdf(
  options: PdfGenerationOptions,
): Promise<string> {
  /* Lazy-load jsPDF to avoid bloating the initial bundle */
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const { configuration, productDefinition, quote } = options;

  /* ── Helper functions ── */
  function addLine(height = 0.3) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(height);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  function checkPageBreak(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  /* ── Page 1: Order Summary ── */

  /* Header */
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Production Order Summary', margin, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(productDefinition.name, margin, y);
  y += 6;

  /* Order details */
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Configuration ID: ${configuration.configurationId}`, margin, y);
  y += 4;
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 4;
  doc.text(`Quote ID: ${quote.quoteId}`, margin, y);
  y += 8;

  addLine();

  /* ── Option Selections ── */
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Configuration Options', margin, y);
  y += 8;

  for (const group of productDefinition.optionGroups) {
    const selectedId = configuration.options[group.id];
    const selectedChoice = group.choices.find((c) => c.id === selectedId);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(`${group.label}:`, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(selectedChoice?.label ?? 'None', margin + 50, y);
    y += 6;
  }

  y += 4;
  addLine();

  /* ── Section Colours ── */
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Section Specifications', margin, y);
  y += 8;

  for (const section of productDefinition.sections) {
    const sectionConfig = configuration.sections[section.id];
    if (!sectionConfig) continue;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(section.label, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.text(`Base Color: ${sectionConfig.baseColor}`, margin + 40, y);

    /* Draw colour swatch */
    const hex = sectionConfig.baseColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      doc.setFillColor(r, g, b);
      doc.rect(margin + 80, y - 3, 8, 4, 'F');
    }

    y += 5;

    /* Layer count */
    const layerCount = sectionConfig.layers.length;
    if (layerCount > 0) {
      const textLayers = sectionConfig.layers.filter((l) => l.kind === 'text').length;
      const imageLayers = sectionConfig.layers.filter((l) => l.kind === 'image').length;
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.text(
        `  ${layerCount} layer(s): ${textLayers} text, ${imageLayers} image`,
        margin + 4,
        y,
      );
      y += 5;
    }

    y += 2;
  }

  y += 2;
  addLine();

  /* ── Design Notes / Printing Instructions ── */
  if (options.designNotes && options.designNotes.trim().length > 0) {
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Custom Printing Instructions / PMS Codes', margin, y);
    y += 6;

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(options.designNotes.trim(), margin + 4, y + 6, { maxWidth: contentWidth - 8 });
    y += 22;
    addLine();
  }

  /* ── Price Breakdown ── */
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Price Breakdown', margin, y);
  y += 8;

  for (const item of quote.lineItems) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, margin, y);

    const amountText = formatCentsAsDisplay(
      Math.abs(item.amountCents),
      quote.currency,
    );
    const prefix = item.amountCents < 0 ? '−' : '';
    doc.setTextColor(item.amountCents < 0 ? 46 : 40, item.amountCents < 0 ? 139 : 40, item.amountCents < 0 ? 87 : 40);
    doc.text(prefix + amountText, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }

  y += 2;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Total', margin, y);
  doc.text(
    formatCentsAsDisplay(quote.totalCents, quote.currency),
    pageWidth - margin,
    y,
    { align: 'right' },
  );
  y += 12;

  /* ── 3D Preview Image ── */
  if (options.previewSnapshot) {
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3D Preview', margin, y);
    y += 6;

    try {
      doc.addImage(options.previewSnapshot, 'PNG', margin, y, contentWidth, contentWidth * 0.6);
      y += contentWidth * 0.6 + 8;
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(200, 100, 100);
      doc.text('[3D preview image could not be embedded]', margin, y);
      y += 6;
    }
  }

  /* ── 2D Artwork Image ── */
  if (options.artworkSnapshot) {
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('2D Artwork Layout', margin, y);
    y += 6;

    try {
      const artworkSize = Math.min(contentWidth, 120);
      doc.addImage(options.artworkSnapshot, 'PNG', margin, y, artworkSize, artworkSize);
      y += artworkSize + 8;
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(200, 100, 100);
      doc.text('[Artwork image could not be embedded]', margin, y);
      y += 6;
    }
  }

  /* ── Footer ── */
  checkPageBreak(20);
  y += 4;
  addLine(0.2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(180, 180, 180);
  doc.text('This document was generated by the Product Configurator.', margin, y);
  y += 4;
  doc.text('Prices are subject to confirmation. This is not an invoice.', margin, y);
  y += 4;
  doc.text(
    `Quote valid until: ${new Date(quote.expiresAt).toLocaleString()}`,
    margin,
    y,
  );

  /* ── Save ── */
  const fileName = `order-${configuration.configurationId.slice(0, 8)}.pdf`;
  doc.save(fileName);

  /* Return blob URL for programmatic access */
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
