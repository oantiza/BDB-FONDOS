import os
import zipfile
import datetime

def create_zip():
    # Configuration
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"BDB-FONDOS_FILES_{timestamp}.zip"
    source_dir = "."
    
    # Exclusions
    EXCLUDE_DIRS = {
        'node_modules', '.git', '.firebase', '__pycache__', 
        'dist', 'build', '.gemini', '.agent', '.vscode', '.idea', 'venv', 'env'
    }
    EXCLUDE_EXTENSIONS = {'.zip', '.tar', '.gz', '.rar', '.7z', '.log', '.tmp'}
    EXCLUDE_FILES = {'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'} # Optional: remove lock files if "only files" implies source. Keeping them is usually better strictly speaking, but "heavy" libraries implies dependencies. I'll keep lock files as they are small and important.
    
    # Actually, let's KEEP lock files, user said "no heavy libraries", lock files are lightweight.
    
    print(f"Creating zip file: {output_filename}")
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in EXCLUDE_EXTENSIONS:
                    continue
                if file == output_filename: # Don't zip self
                    continue
                if file in EXCLUDE_FILES:
                    pass # Decided to keep them? Let's keep them.
                    
                file_path = os.path.join(root, file)
                # Calculate archive name (relative path)
                arcname = os.path.relpath(file_path, source_dir)
                
                try:
                    zipf.write(file_path, arcname)
                    # print(f"Added: {arcname}") # Too verbose for large projects
                except Exception as e:
                    print(f"Error adding {arcname}: {e}")

    print(f"Successfully created: {os.path.abspath(output_filename)}")
    # Print size
    size_mb = os.path.getsize(output_filename) / (1024 * 1024)
    print(f"Size: {size_mb:.2f} MB")

if __name__ == "__main__":
    create_zip()
