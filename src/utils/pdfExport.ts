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

const COLORS = {
  emerald: [16, 185, 129] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  gray: [156, 163, 175] as [number, number, number],
  slate800: [30, 41, 59] as [number, number, number],
  slate600: [71, 85, 105] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  purple: [139, 92, 246] as [number, number, number],
};

const getStatusColor = (progress: number, endDate?: string) => {
  if (progress === 100) return COLORS.emerald;
  if (!endDate) return COLORS.slate500;
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  if (endDate < todayStr && progress < 100) return COLORS.red;
  
  // For the "diffDays <= 3" warning, we can just do a simple check
  // or use the Date object just for the difference calculation (with T12:00:00 to avoid timezone issues)
  const endObj = new Date(endDate + 'T12:00:00');
  const todayObj = new Date(todayStr + 'T12:00:00');
  const diffDays = Math.ceil((endObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 3 && progress < 100) return COLORS.amber;
  if (progress >= 75) return COLORS.purple;
  if (progress > 0) return COLORS.amber;
  return COLORS.gray;
};

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
    overallProgress = 0
  } = options;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const now = new Date();
  const formattedDate = format(now, "dd/MM/yyyy", { locale: ptBR });

  if (projectSteps) {
    // --- NEW CLEAN SCHEDULE LAYOUT ---
    let yPos = margin;

    // Header
    doc.setDrawColor(COLORS.orange[0], COLORS.orange[1], COLORS.orange[2]);
    doc.setLineWidth(1);
    doc.circle(margin + 5, yPos + 5, 5);
    doc.setLineWidth(0.5);
    doc.circle(margin + 5, yPos + 5, 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
    doc.text(projectName || 'Cronograma de Obra', margin + 15, yPos + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
    doc.text(`Data: ${formattedDate}`, pageWidth - margin, yPos + 7, { align: 'right' });

    yPos += 12;

    doc.setFontSize(11);
    doc.setTextColor(COLORS.slate600[0], COLORS.slate600[1], COLORS.slate600[2]);
    doc.text(userName ? `Responsável: ${userName}` : companyName, margin + 15, yPos);

    yPos += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
    doc.text('PROGRESSO GERAL DA OBRA', margin, yPos);
    doc.text(`${overallProgress}%`, pageWidth - margin, yPos, { align: 'right' });

    yPos += 4;
    doc.setFillColor(COLORS.slate100[0], COLORS.slate100[1], COLORS.slate100[2]);
    doc.rect(margin, yPos, contentWidth, 3, 'F');
    doc.setFillColor(COLORS.emerald[0], COLORS.emerald[1], COLORS.emerald[2]);
    doc.rect(margin, yPos, contentWidth * (overallProgress / 100), 3, 'F');

    yPos += 15;

    projectSteps.forEach((step) => {
      const estimatedHeight = 30 + (step.subSteps.length * 12);
      if (yPos + estimatedHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFillColor(COLORS.slate100[0], COLORS.slate100[1], COLORS.slate100[2]);
      doc.rect(margin, yPos, contentWidth, 12, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
      doc.text(`${step.title.toUpperCase()} (${step.weight}%)`, margin + 4, yPos + 8);

      doc.setFontSize(11);
      doc.text(`${step.progress}%`, pageWidth - margin - 4, yPos + 8, { align: 'right' });

      yPos += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
      const formatDateToBR = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      };

      const startStr = step.startDate ? formatDateToBR(step.startDate) : '-';
      const endStr = step.endDate ? formatDateToBR(step.endDate) : '-';
      doc.text(`${startStr} → ${endStr}`, margin + 4, yPos);

      yPos += 4;

      doc.setFillColor(COLORS.slate100[0], COLORS.slate100[1], COLORS.slate100[2]);
      doc.rect(margin + 4, yPos, contentWidth - 8, 2, 'F');
      const stageColor = getStatusColor(step.progress, step.endDate);
      doc.setFillColor(stageColor[0], stageColor[1], stageColor[2]);
      doc.rect(margin + 4, yPos, (contentWidth - 8) * (step.progress / 100), 2, 'F');

      yPos += 12;

      step.subSteps.forEach((sub: any) => {
        if (yPos > pageHeight - margin - 10) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
        doc.text(sub.title, margin + 10, yPos);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
        const subStartStr = sub.startDate ? formatDateToBR(sub.startDate) : '-';
        const subEndStr = sub.endDate ? formatDateToBR(sub.endDate) : '-';
        doc.text(`${subStartStr} → ${subEndStr}`, margin + 10, yPos + 5);

        const resp = sub.responsavelNome || '-';
        doc.text(`Resp: ${resp}`, margin + 50, yPos + 5);

        const comp = (sub.complexity || 'media').toUpperCase();
        const compColor = sub.complexity === 'alta' ? COLORS.red : (sub.complexity === 'media' ? COLORS.amber : COLORS.emerald);
        doc.setTextColor(compColor[0], compColor[1], compColor[2]);
        doc.text(comp, margin + 90, yPos + 5);

        doc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
        doc.text(`Peso: ${sub.weight}%`, margin + 115, yPos + 5);

        const barWidth = 40;
        const barX = pageWidth - margin - barWidth;
        doc.setFillColor(COLORS.slate100[0], COLORS.slate100[1], COLORS.slate100[2]);
        doc.rect(barX, yPos - 1, barWidth, 4, 'F');
        const subColor = getStatusColor(sub.progress, sub.endDate);
        doc.setFillColor(subColor[0], subColor[1], subColor[2]);
        doc.rect(barX, yPos - 1, barWidth * (sub.progress / 100), 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
        doc.text(`${sub.progress}%`, barX - 10, yPos + 2, { align: 'right' });

        doc.setDrawColor(COLORS.slate100[0], COLORS.slate100[1], COLORS.slate100[2]);
        doc.line(margin + 10, yPos + 8, pageWidth - margin, yPos + 8);

        yPos += 12;
      });

      yPos += 8;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
      const footerText = `ConstrutoraPro Gestão de Obras - Relatório Gerado em ${format(now, "dd/MM/yyyy HH:mm")}`;
      doc.text(footerText, margin, pageHeight - 10);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save(filename);
  } else if (head && body) {
    // --- OLD TABLE FALLBACK FOR OTHER PAGES ---
    const landscapeDoc = new jsPDF('l', 'mm', 'a4');
    const lWidth = landscapeDoc.internal.pageSize.width;
    const lHeight = landscapeDoc.internal.pageSize.height;

    landscapeDoc.setFontSize(18);
    landscapeDoc.setTextColor(COLORS.slate800[0], COLORS.slate800[1], COLORS.slate800[2]);
    landscapeDoc.text(companyName, margin, 20);

    landscapeDoc.setFontSize(14);
    landscapeDoc.setTextColor(COLORS.slate600[0], COLORS.slate600[1], COLORS.slate600[2]);
    landscapeDoc.text(title, margin, 28);

    landscapeDoc.setFontSize(10);
    landscapeDoc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
    let yPos = 36;
    
    if (projectName) {
      landscapeDoc.text(`Obra: ${projectName}`, margin, yPos);
      yPos += 6;
    }
    
    landscapeDoc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm")}`, margin, yPos);
    yPos += 6;
    
    if (userName) {
      landscapeDoc.text(`Responsável: ${userName}`, margin, yPos);
      yPos += 6;
    }

    if (summary && summary.length > 0) {
      yPos += 4;
      summary.forEach(item => {
        landscapeDoc.text(`${item.label}: ${item.value}`, margin, yPos);
        yPos += 5;
      });
    }

    autoTable(landscapeDoc, {
      startY: yPos + 5,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.slate800,
        textColor: COLORS.white,
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.slate600,
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        landscapeDoc.setFontSize(8);
        landscapeDoc.setTextColor(COLORS.slate500[0], COLORS.slate500[1], COLORS.slate500[2]);
        landscapeDoc.text(`Página ${landscapeDoc.getNumberOfPages()}`, lWidth - margin - 15, lHeight - 10);
      }
    });

    landscapeDoc.save(filename);
  }
};
