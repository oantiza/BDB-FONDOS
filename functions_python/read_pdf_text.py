import PyPDF2

def read_pdf():
    try:
        reader = PyPDF2.PdfReader('C:/Users/oanti/Documents/BDB-FONDOS/Informe Estratégico Global Febrero 2026.pdf')
        text = ''
        for page in reader.pages:
            text += page.extract_text() + '\n'
        
        with open('C:/Users/oanti/Documents/BDB-FONDOS/pdf_output.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print("OK: PDF Exportado a txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    read_pdf()
