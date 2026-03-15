import os
import re

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    modified = False

    # 1. Add missing logger import if not present and we're going to use it
    if "import logging" not in text and "print(" in text and "functions_python" in file_path and not "venv" in file_path:
        first_import = text.find("import ")
        if first_import == -1:
            first_import = text.find("from ")
        
        insert_text = "import logging\nlogger = logging.getLogger(__name__)\n"
        text = text[:first_import] + insert_text + text[first_import:]
        modified = True

    # replace prints
    if re.search(r'(?<!\.)\bprint\(', text):
        text = re.sub(r'(?<!\.)\bprint\(', 'logger.info(', text)
        modified = True

    # For endpoints/__init__.py, remove generateSmartPortfolio
    if "__init__.py" in file_path and "generateSmartPortfolio" in text:
        text = text.replace("    generateSmartPortfolio,\n", "")
        text = text.replace("generateSmartPortfolio", "") # fallback
        modified = True

    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Processed {file_path}")

files = [
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\endpoints\__init__.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\api\schedulers.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\api\endpoints_admin.py",
]

for f in files:
    if os.path.exists(f):
        process_file(f)
