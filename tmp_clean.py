import os
import re

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Add missing logger import if not present
    if "import logging" not in text:
        # insert after first imports
        first_import = text.find("import ")
        if first_import == -1:
            first_import = text.find("from ")
        
        insert_text = "import logging\nlogger = logging.getLogger(__name__)\n"
        text = text[:first_import] + insert_text + text[first_import:]

    # For data_fetcher
    if "data_fetcher.py" in file_path:
        text = text.replace("raise Exception(", "raise ValueError(")
        # remove internal logger
        text = text.replace("import logging\n            logger = logging.getLogger(__name__)\n\n", "")
        text = text.replace("import logging\n            logger = logging.getLogger(__name__)\n", "")

    if "frontier_engine.py" in file_path:
        bad_cov = '''try:
            S = get_covariance_matrix(df)
        except Exception as cov_err:
            print(
                f"⚠️ [Senior EF] Canonical covariance failed, falling back: {cov_err}"
            )
            returns = df.pct_change().dropna(how="all")
            S = returns.cov() * 252
            from pypfopt import risk_models
            S = risk_models.fix_nonpositive_semidefinite(S)'''
            
        good_cov = '''try:
            S = get_covariance_matrix(df)
        except Exception as cov_err:
            logger.warning(
                f"⚠️ [Senior EF] Canonical covariance failed, falling back: {cov_err}"
            )
            from pypfopt import risk_models
            S = risk_models.sample_cov(df, frequency=252)
            S = risk_models.fix_nonpositive_semidefinite(S)'''
        text = text.replace(bad_cov, good_cov)

    # replace prints
    text = re.sub(r'(?<!\.)\bprint\(', 'logger.info(', text)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text)

files = [
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\services\data_fetcher.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\services\portfolio\frontier_engine.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\services\portfolio\utils.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\api\endpoints_portfolio.py",
    r"c:\Users\oanti\Documents\BDB-FONDOS\functions_python\services\portfolio\analyzer.py"
]

for f in files:
    if os.path.exists(f):
        process_file(f)
        print(f"Processed {f}")
