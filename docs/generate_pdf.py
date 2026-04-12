"""
Genera el PDF del Manual de Usuario de BDB-FONDOS.
Convierte el Markdown a HTML con estilos profesionales y luego a PDF.
"""
import markdown
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(SCRIPT_DIR, "Manual_Usuario_BDB_FONDOS.md")
HTML_PATH = os.path.join(SCRIPT_DIR, "Manual_Usuario_BDB_FONDOS.html")

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@page {
    size: A4;
    margin: 2cm 2.5cm;
    @bottom-center {
        content: counter(page);
        font-size: 9px;
        color: #94a3b8;
        font-family: 'Inter', sans-serif;
    }
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    line-height: 1.7;
    color: #1e293b;
    background: #ffffff;
    max-width: 210mm;
    margin: 0 auto;
    padding: 2cm 2.5cm;
}

/* HEADINGS */
h1 {
    font-size: 28px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px 0;
    padding-bottom: 12px;
    border-bottom: 3px solid #0f172a;
    letter-spacing: -0.5px;
    page-break-before: always;
}

h1:first-of-type {
    page-break-before: avoid;
    text-align: center;
    font-size: 34px;
    border-bottom: 3px solid #D4AF37;
    color: #0f172a;
    margin-bottom: 16px;
}

h2 {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 32px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e2e8f0;
    letter-spacing: -0.3px;
    page-break-before: always;
}

h2:first-of-type {
    page-break-before: avoid;
}

h3 {
    font-size: 14px;
    font-weight: 600;
    color: #1e40af;
    margin-top: 20px;
    margin-bottom: 8px;
    padding-left: 10px;
    border-left: 3px solid #3b82f6;
}

h4 {
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
}

/* PARAGRAPHS */
p {
    margin-bottom: 8px;
    text-align: justify;
    hyphens: auto;
}

strong {
    font-weight: 600;
    color: #0f172a;
}

em {
    color: #475569;
}

/* LISTS */
ul, ol {
    margin: 8px 0;
    padding-left: 22px;
}

li {
    margin-bottom: 4px;
}

li strong {
    color: #1e40af;
}

/* TABLES */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10.5px;
    page-break-inside: avoid;
}

thead {
    background: #0f172a;
}

th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #ffffff;
    border: 1px solid #1e293b;
}

td {
    padding: 7px 12px;
    border: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
}

tbody tr:nth-child(even) {
    background: #f8fafc;
}

tbody tr:hover {
    background: #f1f5f9;
}

/* CODE */
code {
    background: #f1f5f9;
    color: #be185d;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
    font-family: 'Consolas', 'Monaco', monospace;
}

pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 12px 0;
    font-size: 10px;
    line-height: 1.5;
    page-break-inside: avoid;
}

pre code {
    background: transparent;
    color: #e2e8f0;
    padding: 0;
}

/* HORIZONTAL RULES */
hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 24px 0;
}

/* BLOCKQUOTES */
blockquote {
    border-left: 3px solid #D4AF37;
    padding: 8px 16px;
    margin: 12px 0;
    background: #fffbeb;
    font-style: italic;
    color: #92400e;
}

/* LINKS */
a {
    color: #1e40af;
    text-decoration: none;
}

/* FIRST PAGE - Title styling */
body > p:first-of-type {
    text-align: center;
    font-size: 12px;
    color: #64748b;
}

/* Prevent orphans and widows */
p, li {
    orphans: 3;
    widows: 3;
}

h1, h2, h3, h4 {
    page-break-after: avoid;
}

table, pre, blockquote {
    page-break-inside: avoid;
}

/* TOC-like section for the Index */
h2 + p + ol,
h2 + ol {
    columns: 2;
    column-gap: 30px;
}

h2 + p + ol li,
h2 + ol li {
    break-inside: avoid;
}
"""

def main():
    # Read markdown
    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_content = f.read()

    # Convert to HTML
    extensions = ['tables', 'fenced_code', 'toc', 'smarty']
    html_body = markdown.markdown(md_content, extensions=extensions)

    # Build full HTML document
    html_doc = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manual de Usuario — BDB-FONDOS</title>
    <style>{CSS}</style>
</head>
<body>
{html_body}
</body>
</html>"""

    # Write HTML
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_doc)

    print(f"✅ HTML generado: {HTML_PATH}")
    print(f"📄 Abre este archivo en un navegador y usa Ctrl+P → 'Guardar como PDF'")
    print(f"   O bien usa el script de Puppeteer para generar el PDF automáticamente.")

if __name__ == "__main__":
    main()
