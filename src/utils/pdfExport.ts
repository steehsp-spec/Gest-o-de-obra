import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportPdfOptions {
  title: string;
  projectName?: string;
  userName?: string;
  companyName?: string;
  filename: string;
  head?: string[][];
  body?: any[][];
  summary?: { label: string; value: string }[];
  projectSteps?: any[];
  overallProgress?: number;
}

export const exportToPdf = (options: ExportPdfOptions) => {
  const {
    title,
    projectName,
    userName,
    companyName = 'A&R Engenharia',
    filename,
    head,
    body,
    summary,
    projectSteps,
    overallProgress
  } = options;

  if (projectSteps) {
    // New layout
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    const now = new Date();
    const formattedDate = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, margin, 20);

    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text(title, margin, 28);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    let yPos = 38;
    
    if (projectName) {
      doc.text(`Obra: ${projectName}`, margin, yPos);
      yPos += 6;
    }
    
    doc.text(`Gerado em: ${formattedDate}`, margin, yPos);
    yPos += 6;
    
    if (userName) {
      doc.text(`Gerado por: ${userName}`, margin, yPos);
      yPos += 6;
    }

    // Overall Progress
    yPos += 10;
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`Progresso Geral: ${overallProgress}%`, margin, yPos);
    yPos += 4;
    
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, contentWidth, 6, 'F');
    doc.setFillColor(34, 197, 94); // Green
    doc.rect(margin, yPos, contentWidth * ((overallProgress || 0) / 100), 6, 'F');
    
    yPos += 15;

    // Steps
    projectSteps.forEach(step => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      // Step Block
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(`${step.title} (${step.weight}%)`, margin, yPos);
      yPos += 6;

      // Step Progress Bar
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, 4, 'F');
      const stepColor = step.progress === 100 ? [34, 197, 94] : (step.progress > 0 ? [234, 179, 8] : [156, 163, 175]);
      doc.setFillColor(stepColor[0], stepColor[1], stepColor[2]);
      doc.rect(margin, yPos, contentWidth * (step.progress / 100), 4, 'F');
      yPos += 10;

      // Subitems
      doc.setFont('helvetica', 'normal');
      step.subSteps.forEach((sub: any) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        
        const subColor = sub.progress === 100 ? [34, 197, 94] : (sub.progress > 0 ? [234, 179, 8] : [156, 163, 175]);
        doc.setTextColor(subColor[0], subColor[1], subColor[2]);
        const indicator = sub.progress === 100 ? '✔' : (sub.progress > 0 ? '●' : '○');
        
        doc.setFontSize(10);
        doc.text(`${indicator} ${sub.title}`, margin + 5, yPos);
        doc.text(`${sub.progress}%`, pageWidth - margin - 15, yPos);
        doc.text(format(new Date(sub.endDate), 'dd/MM/yy'), pageWidth - margin - 40, yPos);
        
        yPos += 6;
      });
      yPos += 6;
    });

    doc.save(filename);
  } else if (head && body) {
    // Old layout
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;

    const now = new Date();
    const formattedDate = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // text-slate-800
    doc.text(companyName, margin, 20);

    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105); // text-slate-600
    doc.text(title, margin, 28);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // text-slate-500
    let yPos = 36;
    
    if (projectName) {
      doc.text(`Obra: ${projectName}`, margin, yPos);
      yPos += 6;
    }
    
    doc.text(`Gerado em: ${formattedDate}`, margin, yPos);
    yPos += 6;
    
    if (userName) {
      doc.text(`Gerado por: ${userName}`, margin, yPos);
      yPos += 6;
    }

    yPos += 4;

    // Summary if provided
    if (summary && summary.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Resumo:', margin, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      
      // Draw summary in a grid
      const summaryX = margin;
      let currentX = summaryX;
      let currentY = yPos;
      
      summary.forEach((item, index) => {
        if (index > 0 && index % 3 === 0) {
          currentX = summaryX;
          currentY += 6;
        }
        doc.text(`${item.label}: ${item.value}`, currentX, currentY);
        currentX += 80;
      });
      
      yPos = currentY + 12;
    }

    // Table
    autoTable(doc, {
      startY: yPos,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: {
        fillColor: [22, 27, 34], // Dark background
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { top: margin, right: margin, bottom: 20, left: margin },
      didDrawPage: (data) => {
        // Footer
        const str = `Página ${doc.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // text-slate-400
        
        const footerText = `Gerado por ConstrutoraPro Gestão de Obras - ${formattedDate}`;
        
        doc.text(footerText, margin, pageHeight - 10);
        doc.text(str, pageWidth - margin - doc.getTextWidth(str), pageHeight - 10);
      },
    });

    doc.save(filename);
  }
};
