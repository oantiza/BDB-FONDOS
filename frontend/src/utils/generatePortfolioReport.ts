
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePortfolioReport = async (
    page1Id: string,
    page2Id: string,
    page3Id: string,
    page4Id?: string,
    filename: string = 'Informe_Cartera.pdf'
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 10; // mm

    const captureAndAddPage = async (elementId: string, isFirstPage: boolean = false, orientation: 'p' | 'l' = 'p') => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with id ${elementId} not found`);
            return;
        }

        // Add new page if not first
        if (!isFirstPage) {
            doc.addPage('a4', orientation);
        }

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: orientation === 'l' ? 1600 : 1400, // Wider for landscape
                ignoreElements: (node) => node.classList.contains('no-print'),
                onclone: (clonedDoc) => {
                    // SHOW elements meant for PDF only (e.g. Grouped Table)
                    const pdfShow = clonedDoc.getElementsByClassName('pdf-show-during-capture');
                    for (let i = 0; i < pdfShow.length; i++) {
                        (pdfShow[i] as HTMLElement).classList.remove('hidden');
                        (pdfShow[i] as HTMLElement).style.display = 'block';
                    }

                    // HIDE elements meant for Screen only (e.g. Flat Table)
                    const pdfHide = clonedDoc.getElementsByClassName('pdf-hide-during-capture');
                    for (let i = 0; i < pdfHide.length; i++) {
                        (pdfHide[i] as HTMLElement).style.display = 'none';
                    }

                    // Existing logic for headers (renamed or kept as is if used elsewhere)
                    const params = clonedDoc.getElementsByClassName('pdf-visible-only');
                    for (let i = 0; i < params.length; i++) {
                        (params[i] as HTMLElement).style.display = 'flex';
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);

            // Calculate dimensions based on orientation
            const pageWidth = doc.internal.pageSize.getWidth();
            // const pageHeight = doc.internal.pageSize.getHeight();

            const pdfWidth = pageWidth - (margin * 2);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.addImage(imgData, 'PNG', margin, margin, pdfWidth, pdfHeight);

        } catch (error) {
            console.error(`Error capturing element ${elementId}`, error);
        }
    };

    // Page 1: Composition (Portrait)
    await captureAndAddPage(page1Id, true, 'p');

    // Page 2: Metrics + Holdings + Donut (Portrait)
    await captureAndAddPage(page2Id, false, 'p');

    // Page 3: Historical + Risk Map (Portrait)
    await captureAndAddPage(page3Id, false, 'p');

    // Page 4: Correlation Matrix (Landscape) - Optional
    if (page4Id) {
        await captureAndAddPage(page4Id, false, 'l');
    }

    doc.save(filename);
};
