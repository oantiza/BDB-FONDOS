
from fpdf import FPDF
import datetime
import io
from .charts import generate_asset_allocation_chart

class PrivateBankingReport(FPDF):
    def __init__(self, title, date):
        super().__init__()
        self.report_title = title
        self.report_date = date
        self.set_auto_page_break(auto=True, margin=15)

    def header(self):
        # Logo placeholder (Text for now, can be image if available)
        self.set_font('Times', 'B', 12)
        self.set_text_color(11, 37, 69) # #0B2545 (Navy Blue)
        self.cell(0, 10, 'MACRO & ESTRATEGIA | PRIVATE BANKING', 0, 1, 'L')
        
        # Line break
        self.ln(5)
        
        # Gold line
        self.set_draw_color(212, 175, 55) # #D4AF37 (Gold)
        self.set_line_width(0.5)
        self.line(10, 25, 200, 25)
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Página {self.page_no()} | Confidencial - Generado por Gemini 3 Pro', 0, 0, 'C')

    def chapter_title(self, label):
        self.set_font('Times', 'B', 14)
        self.set_text_color(11, 37, 69) # Navy
        self.cell(0, 10, label, 0, 1, 'L')
        self.ln(2)
        # Underline
        self.set_draw_color(200, 200, 200)
        self.set_line_width(0.2)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def chapter_body(self, text):
        self.set_font('Arial', '', 10)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 6, text)
        self.ln(5)

    def chapter_body_bold_key(self, key, value):
        self.set_font('Arial', 'B', 10)
        self.write(6, key + ": ")
        self.set_font('Arial', '', 10)
        self.write(6, value)
        self.ln(6)

def generate_pdf_from_data(report_data):
    """
    Generates a PDF byte stream from the report JSON data.
    """
    pdf = PrivateBankingReport(report_data.get('title', 'Informe de Estrategia'), report_data.get('date', ''))
    pdf.add_page()

    # --- TITLE & METADATA ---
    pdf.set_font('Times', 'B', 20)
    pdf.set_text_color(11, 37, 69)
    pdf.multi_cell(0, 10, report_data.get('title', 'Informe Estratégico Global'), align='C')
    pdf.ln(5)

    pdf.set_font('Arial', 'B', 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"FECHA: {report_data.get('date', '')} | RÉGIMEN: {report_data.get('regime', 'N/A')}", 0, 1, 'C')
    pdf.ln(10)

    # --- EXECUTIVE SUMMARY ---
    pdf.chapter_title('Resumen Ejecutivo')
    pdf.chapter_body(report_data.get('executive_summary', 'Sin resumen disponible.'))
    
    # --- INVESTMENT THESIS (Monthly) ---
    if report_data.get('investment_thesis'):
        pdf.chapter_title('Tesis de Inversión (Mes)')
        pdf.chapter_body(report_data.get('investment_thesis'))

    # --- MACRO ANALYSIS ---
    pdf.chapter_title('Análisis Macroeconómico')
    macro = report_data.get('macro_analysis', {})
    if isinstance(macro, dict):
        for k, v in macro.items():
            key_clean = k.replace('_', ' ').capitalize()
            if isinstance(v, str):
                pdf.chapter_body_bold_key(key_clean, v)
            elif isinstance(v, dict): # Handle nested objects like AnalysisSection
                content = v.get('content', '')
                pdf.chapter_body_bold_key(key_clean, content)
    
    # --- GEOPOLITICS ---
    geo = report_data.get('geopolitics', {})
    if geo:
        pdf.chapter_title('Geopolítica')
        if isinstance(geo, dict):
            pdf.chapter_body_bold_key('Situación', geo.get('summary', ''))
            pdf.chapter_body_bold_key('Impacto', geo.get('impact', ''))

    pdf.add_page() 

    # --- ASSET ALLOCATION MATRIX ---
    pdf.chapter_title('Matriz de Asignación de Activos')
    
    # --- CHART INSERTION ---
    pdf.set_y(pdf.get_y() + 5) # Spacing
    chart_y = pdf.get_y()
    
    alloc = report_data.get('asset_allocation', []) or report_data.get('model_portfolio', [])
    chart_stream = generate_asset_allocation_chart(alloc)
    
    if chart_stream:
        # Place chart on the right side
        pdf.image(chart_stream, x=110, y=chart_y, w=80) 
        # Restrict table width to left side
        table_width_limit = 100
    else:
        table_width_limit = 190

    # --- TABLE ---
    pdf.set_xy(10, chart_y)
    
    # Table Header
    pdf.set_font('Arial', 'B', 8)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_text_color(11, 37, 69)
    
    col_widths = [40, 30, 30] if chart_stream else [50, 40, 90] # Compact if chart exists
    headers = ['ACTIVO', 'VISIÓN', 'RACIONAL (Resumido)'] if chart_stream else ['ACTIVO', 'VISIÓN', 'RACIONAL']
    
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, 1, 0, 'C', True)
    pdf.ln()

    # Table Body
    pdf.set_font('Arial', '', 7)
    pdf.set_text_color(0, 0, 0)
    
    for item in alloc:
        asset = item.get('asset') or item.get('asset_class', 'N/A')
        view = item.get('view', 'Neutral')
        rationale = item.get('rationale', '')
        
        # Truncate rationale if chart is present to fit
        if chart_stream and len(rationale) > 50:
            rationale = rationale[:47] + "..."

        # Colorize View
        pdf.set_font('Arial', 'B', 7)
        if view in ['SOBREPONDERAR', 'OVERWEIGHT']: pdf.set_text_color(0, 100, 0)
        elif view in ['INFRAPONDERAR', 'UNDERWEIGHT']: pdf.set_text_color(150, 0, 0)
        else: pdf.set_text_color(80, 80, 80)
        
        row_height = 6
        
        # Draw cells manually to handle specific layout
        x_curr = pdf.get_x()
        y_curr = pdf.get_y()
        
        # Asset
        pdf.set_text_color(0,0,0)
        pdf.cell(col_widths[0], row_height, asset[:25], 1, 0, 'L')
        
        # View
        if view in ['SOBREPONDERAR', 'OVERWEIGHT']: pdf.set_text_color(0, 100, 0)
        elif view in ['INFRAPONDERAR', 'UNDERWEIGHT']: pdf.set_text_color(150, 0, 0)
        else: pdf.set_text_color(80, 80, 80)
        
        # Shorten view label for compact table
        view_label = view.replace('SOBREPONDERAR', 'SOBRE').replace('INFRAPONDERAR', 'INFRA')
        pdf.cell(col_widths[1], row_height, view_label, 1, 0, 'C')
        
        # Rationale
        pdf.set_text_color(60,60,60)
        pdf.cell(col_widths[2], row_height, rationale, 1, 0, 'L')
        
        pdf.ln()
    
    # If chart was placed, ensure we move below it for next section if any
    if chart_stream:
        pdf.set_y(max(pdf.get_y(), chart_y + 85)) # Chart height approx 80 + margin

    pdf.ln(10)

    # --- TAIL RISKS ---
    risks = report_data.get('tail_risks', [])
    if risks:
        pdf.chapter_title('Riesgos de Cola (Tail Risks)')
        pdf.set_font('Arial', '', 9)
        for r in risks:
            risk_txt = f"• {r.get('risk')} (Prob: {r.get('probability')}, Imp: {r.get('impact')})"
            pdf.multi_cell(0, 6, risk_txt)
            pdf.ln(1)

    # Output to byte stream
    return pdf.output()
