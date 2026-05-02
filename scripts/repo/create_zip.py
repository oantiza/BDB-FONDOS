"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: repo
PURPOSE: Utility to create a zip of the source code, excluding build artifacts and dependencies.
SAFE_MODE: LOCAL_ONLY
RUN: python scripts/repo/create_zip.py
"""
import os
import zipfile

def create_zip(source_dir, output_filename):
    # Exclude these directories
    exclude_dirs = {
        'node_modules', 
        'venv', 
        '.git', 
        '.firebase', 
        '.gemini', 
        '__pycache__', 
        'build', 
        'dist',
        '.pytest_cache'
    }
    
    # Exclude these file extensions
    exclude_exts = {'.zip', '.log', '.env', '.pyc'}

    zipf = zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED)
    
    count = 0
    for root, dirs, files in os.walk(source_dir):
        # Modify dirs in place to skip excluded directories entirely
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            # Skip excluded extensions
            if any(file.endswith(ext) for ext in exclude_exts):
                continue
                
            file_path = os.path.join(root, file)
            # Make the path relative to the source directory
            rel_path = os.path.relpath(file_path, source_dir)
            zipf.write(file_path, rel_path)
            count += 1
            
    zipf.close()
    print(f"✅ Backup created! Added {count} files to {output_filename}")

if __name__ == '__main__':
    source = r"c:\Users\oanti\Documents\BDB-FONDOS"
    output = r"c:\Users\oanti\Documents\BDB-FONDOS\BDB-FONDOS_Source_20260315_Final.zip"
    create_zip(source, output)

