import os
import zipfile
from datetime import datetime

def create_zip(source_dir, output_filename):
    # Exclude these directories
    exclude_dirs = {
        'node_modules', 
        'venv', 
        '.git', 
        '.firebase', 
        '.gemini', 
        '.antigravity',
        '__pycache__', 
        'build', 
        'dist',
        '.pytest_cache',
        '.ruff_cache',
        'temp_backup',
        'temp_retirement_zip',
        '.agent'
    }
    
    # Exclude these file extensions
    exclude_exts = {'.zip', '.log', '.env', '.pyc', '.exe', '.dll', '.so', '.dylib'}
    
    # Exclude files larger than 10MB (optional, but requested "exclude heavy")
    max_file_size = 10 * 1024 * 1024 # 10MB

    zipf = zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED)
    
    count = 0
    skipped_large = 0
    for root, dirs, files in os.walk(source_dir):
        # Modify dirs in place to skip excluded directories entirely
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            # Skip the output file itself if it's in the source tree
            if file == os.path.basename(output_filename):
                continue

            # Skip excluded extensions
            if any(file.lower().endswith(ext) for ext in exclude_exts):
                continue
                
            file_path = os.path.join(root, file)
            
            # Check file size
            try:
                if os.path.getsize(file_path) > max_file_size:
                    print(f"[SKIP] Large file: {file} ({os.path.getsize(file_path)//(1024*1024)} MB)")
                    skipped_large += 1
                    continue
            except OSError:
                continue

            # Make the path relative to the source directory
            rel_path = os.path.relpath(file_path, source_dir)
            zipf.write(file_path, rel_path)
            count += 1
            
    zipf.close()
    print(f"Backup created! Added {count} files to {output_filename}")
    if skipped_large > 0:
        print(f"{skipped_large} large files were skipped.")

if __name__ == '__main__':
    source = r"c:\Users\oanti\Documents\BDB-FONDOS"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output = rf"c:\Users\oanti\Documents\BDB-FONDOS\BDB-FONDOS_Backup_{timestamp}.zip"
    create_zip(source, output)
