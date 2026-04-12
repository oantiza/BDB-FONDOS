import pypandoc
import sys
import os

try:
    print(f"Pandoc version: {pypandoc.get_pandoc_version()}")
except Exception as e:
    print("Downloading pandoc...")
    pypandoc.download_pandoc()

print("Converting to DOCX...")
try:
    pypandoc.convert_file('Auditoria_Ejecutiva_BDB_FONDOS.md', 'docx', outputfile='Auditoria_Ejecutiva_BDB_FONDOS.docx')
    print("DOCX created successfully.")
except Exception as e:
    print(f"Error converting to DOCX: {e}")
