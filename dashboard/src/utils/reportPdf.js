import jsPDF from 'jspdf';
import { formatDateTime, shortId, statusLabel, titleCase } from './dashboardData.js';

const BRAND = [22, 93, 90];
const BRAND_SOFT = [232, 240, 238];
const ACCENT = [242, 183, 5];
const TEXT = [26, 45, 52];
const MUTED = [92, 111, 117];
const STROKE = [213, 221, 224];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeader(doc, generatedAt) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 30, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 30, PAGE_W, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MuniPrioritise', MARGIN, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Supervisor summary report', MARGIN, 22);
  doc.text(`Generated ${generatedAt}`, PAGE_W - MARGIN, 22, { align: 'right' });
}

function drawSectionTitle(doc, title, y) {
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...STROKE);
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 9;
}

function drawKpis(doc, overview, y) {
  const items = [
    ['Open requests', String(overview.total_open)],
    ['Avg response', `${overview.avg_response_time_hours} h`],
    ['Resolution rate', `${overview.resolution_rate_percent}%`],
    ['Equity score', String(overview.equity_score)],
  ];
  const gap = 4;
  const width = (CONTENT_W - gap * (items.length - 1)) / items.length;

  items.forEach(([label, value], index) => {
    const x = MARGIN + index * (width + gap);
    doc.setFillColor(...BRAND_SOFT);
    doc.roundedRect(x, y, width, 22, 2, 2, 'F');
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setTextColor(...BRAND);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(value, x + 4, y + 17);
  });
  return y + 22 + 10;
}

function drawCategoryBars(doc, rows, y) {
  const max = Math.max(...rows.map((row) => Number(row.avg_response_hours) || 0), 1);
  const labelW = 32;
  const valueW = 22;
  const barW = CONTENT_W - labelW - valueW;

  rows.forEach((row) => {
    const hours = Number(row.avg_response_hours) || 0;
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(titleCase(row.category), MARGIN, y + 4);
    doc.setFillColor(...BRAND_SOFT);
    doc.rect(MARGIN + labelW, y, barW, 5, 'F');
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN + labelW, y, Math.max((hours / max) * barW, 0.5), 5, 'F');
    doc.text(`${hours} h`, PAGE_W - MARGIN, y + 4, { align: 'right' });
    y += 8;
  });
  return y + 4;
}

function drawRequestsTable(doc, reports, startY, generatedAt) {
  const columns = [
    { label: 'ID', width: 24, value: (r) => shortId(r.id) },
    { label: 'Category', width: 30, value: (r) => titleCase(r.category) },
    { label: 'Severity', width: 22, value: (r) => String(r.severity) },
    { label: 'Status', width: 30, value: (r) => statusLabel(r.status) },
    { label: 'Ward', width: 28, value: (r) => String(r.ward_id) },
    { label: 'Created', width: 48, value: (r) => formatDateTime(r.created_at) },
  ];
  const rowH = 7;
  let y = startY;

  const drawHead = () => {
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let x = MARGIN;
    columns.forEach((column) => {
      doc.text(column.label, x + 2, y + 4.8);
      x += column.width;
    });
    y += rowH;
  };

  drawHead();
  doc.setFont('helvetica', 'normal');
  reports.forEach((report, index) => {
    if (y + rowH > PAGE_H - 16) {
      doc.addPage();
      drawHeader(doc, generatedAt);
      y = 42;
      drawHead();
      doc.setFont('helvetica', 'normal');
    }
    if (index % 2 === 1) {
      doc.setFillColor(245, 247, 248);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    doc.setTextColor(...TEXT);
    doc.setFontSize(9);
    let x = MARGIN;
    columns.forEach((column) => {
      doc.text(doc.splitTextToSize(column.value(report), column.width - 3)[0], x + 2, y + 4.8);
      x += column.width;
    });
    y += rowH;
  });
}

function drawFooters(doc) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...STROKE);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('MuniPrioritise supervisor console', MARGIN, PAGE_H - 7);
    doc.text(`Page ${page} of ${total}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  }
}

// Builds and downloads the supervisor summary. Table rows are capped so the report stays readable.
export function downloadSummaryPdf({ overview, analytics, reports, maxRows = 25 }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedAt = formatDateTime(new Date());

  drawHeader(doc, generatedAt);
  let y = drawSectionTitle(doc, 'Key indicators', 44);
  y = drawKpis(doc, overview, y);
  y = drawSectionTitle(doc, 'Average response time by category', y);
  y = drawCategoryBars(doc, analytics.responseTimeByCategory || [], y);

  const shown = reports.slice(0, maxRows);
  const suffix = reports.length > shown.length ? ` (latest ${shown.length} of ${reports.length})` : '';
  y = drawSectionTitle(doc, `Requests${suffix}`, y + 2);
  drawRequestsTable(doc, shown, y, generatedAt);

  drawFooters(doc);
  doc.save('muniprioritise-summary.pdf');
}
