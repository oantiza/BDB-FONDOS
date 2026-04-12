"""
Genera el PDF del manual usando Playwright (Chromium headless).
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

DOCS_DIR = Path(__file__).parent
HTML_PATH = DOCS_DIR / "Manual_Usuario_BDB_FONDOS.html"
PDF_PATH = DOCS_DIR / "Manual_Usuario_BDB_FONDOS.pdf"

async def main():
    print("🚀 Iniciando generación de PDF...")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        file_url = HTML_PATH.as_uri()
        print(f"📖 Cargando: {file_url}")
        await page.goto(file_url, wait_until="networkidle")

        # Wait for fonts to load
        await page.wait_for_timeout(2000)

        print("📄 Generando PDF...")
        await page.pdf(
            path=str(PDF_PATH),
            format="A4",
            print_background=True,
            margin={
                "top": "2cm",
                "bottom": "2.5cm",
                "left": "2.5cm",
                "right": "2.5cm",
            },
            display_header_footer=True,
            header_template='<div style="font-size:8px; color:#94a3b8; width:100%; text-align:center; font-family:Inter,sans-serif; padding-top:8px;">BDB-FONDOS — Manual de Usuario</div>',
            footer_template='<div style="font-size:8px; color:#94a3b8; width:100%; text-align:center; font-family:Inter,sans-serif; padding-bottom:8px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        )
        await browser.close()

    size_kb = PDF_PATH.stat().st_size / 1024
    print(f"✅ PDF generado exitosamente: {PDF_PATH}")
    print(f"📊 Tamaño: {size_kb:.0f} KB")

asyncio.run(main())
