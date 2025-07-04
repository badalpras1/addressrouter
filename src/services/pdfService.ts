import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RouteData } from '../types/index';

export function generateRoutePDF(routeData: RouteData): void {
  console.log('generateRoutePDF called', routeData);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPosition = margin;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Route Plan', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Date and time
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, margin, yPosition);
  yPosition += 12;

  // Route summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Route Summary', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Distance: ${routeData.totalDistance}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Estimated Duration: ${routeData.totalDuration}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Number of Stops: ${routeData.selectedAddresses.length}`, margin, yPosition);
  yPosition += 12;

  // Starting point
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Starting Point', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${routeData.startingPoint.address}`, margin, yPosition);
  yPosition += 15;

  // Route stops table header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Route Stops (Optimized Order)', margin, yPosition);
  yPosition += 6;

  // Prepare table data
  const waypointOrder = routeData.route.routes[0].waypoint_order || [];
  const orderedAddresses = waypointOrder.map((index: number) => routeData.selectedAddresses[index]);

  const tableBody = orderedAddresses.map((address, idx) => [
    `${idx + 1}`,
    address.businessName?.length > 0 ? address.businessName : '-',
    address.address?.length > 0 ? address.address : '-'
  ]);

  // Add return to start row
  tableBody.push([
    `${orderedAddresses.length + 1}`,
    'Return to Start',
    routeData.startingPoint.address?.length > 0 ? routeData.startingPoint.address : '-'
  ]);

  console.log('Calling autoTable with body:', tableBody);
  // Use autoTable for the stops table
  autoTable(doc, {
    head: [['Stop', 'Business Name', 'Address']],
    body: tableBody,
    startY: yPosition,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 18 }, // Stop
      1: { cellWidth: 50 }, // Business Name
      2: { cellWidth: 90 }  // Address
    },
    didDrawPage: (data) => {
      // Footer
      const pageCount = doc.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount} - Generated by Address Mapping & Route Planner`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }
  });
  console.log('autoTable finished');

  // Save the PDF
  const fileName = 'route-stops-table.pdf';
  doc.save(fileName);
}