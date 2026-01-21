
import os
import zipfile
import datetime

def create_clean_zip():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"BDB-FONDOS_Clean_{timestamp}.zip"
    
    # Exclusions
    EXCLUDE_DIRS = {
        'node_modules', '.venv', '__pycache__', 'dist', 'build', 
        '.firebase', '.git', 'seguridad', '.idea', '.vscode'
    }
    EXCLUDE_EXTENSIONS = {'.log', '.zip', '.pyc'}
    
    print(f"📦 Creating backup: {zip_filename}")
    print(f"🚫 Excluding: {', '.join(EXCLUDE_DIRS)} and *{', *'.join(EXCLUDE_EXTENSIONS)}")

    count = 0
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Edit dirs in-place to prune them
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                if file == zip_filename: # Don't zip itself if running multiple times
                    continue
                    
                file_path = os.path.join(root, file)
                zipf.write(file_path, file_path)
                count += 1
    
    size_mb = os.path.getsize(zip_filename) / (1024 * 1024)
    print(f"✅ Backup complete! Added {count} files.")
    print(f"Start-Process '{zip_filename}'") # Hint for shell
    print(f"💾 Size: {size_mb:.2f} MB")

if __name__ == "__main__":
    create_clean_zip()
