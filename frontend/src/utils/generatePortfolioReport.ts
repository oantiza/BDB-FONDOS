
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePortfolioReport = async (
    pageIds: string[],
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
                    const params = clonedDoc.getElementsByClassName('pdf-visible-only');
                    for (let i = 0; i < params.length; i++) {
                        (params[i] as HTMLElement).style.display = 'flex'; // Restore flex display for headers
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

    // Iterate through provided page IDs
    for (let i = 0; i < pageIds.length; i++) {
        // Detect if page should be landscape (e.g. correlation matrix)
        // Heuristic: if ID contains 'matrix' or 'page-4', use landscape. 
        // Better: Pass object config, but kept simple for now. 
        // Current logic: Page 4 (Correlation) is landscape.
        const isLandscape = pageIds[i].includes('page-4') || pageIds[i].includes('correlation');

        await captureAndAddPage(
            pageIds[i],
            i === 0,
            isLandscape ? 'l' : 'p'
        );
    }

    doc.save(filename);
};
