/**
 * ─────────────────────────────────────────────────────────────────────────────
 * pdfGenerator.js  —  High-Fidelity Client-Side A4 Catalog PDF Generator
 * Uses jsPDF & html2canvas to render multi-page A4 PDF documents with zero backend dependency.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Slugify string for clean filenames
 */
export function slugify(text) {
  return (text || 'catalog')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * Generate and download a multi-page A4 PDF catalog from DOM elements.
 * 
 * @param {Array<HTMLElement>} pageElements - Array of rendered DOM container elements for each page
 * @param {Object} options - Configuration options
 * @param {string} options.catalogName - Name of the catalog
 * @param {string} options.businessName - Name of the business
 * @param {Function} options.onProgress - Callback with { current, total, percentage, status }
 * @returns {Promise<{ success: boolean, filename: string }>}
 */
export async function generateCatalogPDF(pageElements, options = {}) {
  const {
    catalogName = 'Product Catalog',
    businessName = '',
    onProgress = () => {}
  } = options;

  if (!pageElements || pageElements.length === 0) {
    throw new Error('No catalog pages provided for PDF export.');
  }

  const totalPages = pageElements.length;
  onProgress({ current: 0, total: totalPages, percentage: 5, status: 'Initializing PDF engine...' });

  // Create A4 portrait PDF (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pdfWidth = 210;
  const pdfHeight = 297;

  try {
    for (let i = 0; i < totalPages; i++) {
      const pageEl = pageElements[i];
      const pageNum = i + 1;

      onProgress({
        current: pageNum,
        total: totalPages,
        percentage: Math.round(10 + (pageNum / totalPages) * 75),
        status: `Rendering Page ${pageNum} of ${totalPages}...`
      });

      // Capture page container with html2canvas at high resolution (scale: 2 for 300DPI clarity)
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc, clonedElement) => {
          // Ensure cloned element is visible and fixed to exact A4 pixel dimensions
          clonedElement.style.display = 'block';
          clonedElement.style.width = '794px';
          clonedElement.style.minHeight = '1123px';
          clonedElement.style.height = '1123px';
          clonedElement.style.maxHeight = '1123px';
          clonedElement.style.overflow = 'hidden';
          clonedElement.style.boxSizing = 'border-box';
          clonedElement.style.transform = 'none';
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Fill entire A4 page with 0 margins
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    onProgress({
      current: totalPages,
      total: totalPages,
      percentage: 95,
      status: 'Finalizing PDF document...'
    });

    const fileSlug = slugify(`${catalogName}${businessName ? `-${businessName}` : ''}`);
    const filename = `catalog-${fileSlug || 'catalog'}.pdf`;

    pdf.save(filename);

    onProgress({
      current: totalPages,
      total: totalPages,
      percentage: 100,
      status: 'Download ready!'
    });

    return { success: true, filename };
  } catch (error) {
    console.error('[pdfGenerator] PDF Generation Error:', error);
    throw error;
  }
}
