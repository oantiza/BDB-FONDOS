import os
import zipfile
import datetime

def zip_project(source_dir, output_filename):
    # Directories and files to exclude
    exclude_dirs = {
        'node_modules', 'venv', 'dist', 'build', '__pycache__', 
        '.git', '.firebase', '.idea', '.vscode'
    }
    exclude_files = {
        '.env', 'serviceAccountKey.json'
    }
    exclude_exts = {
        '.zip', '.tar', '.gz'
    }

    print(f"Creating zip file: {output_filename}")
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Exclude directories by modifying 'dirs' in-place so os.walk skips them
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                # Exclude specific files and extensions
                if file in exclude_files:
                    continue
                if any(file.endswith(ext) for ext in exclude_exts):
                    continue
                
                # Exclude this script itself
                if file == os.path.basename(__file__):
                    continue
                
                file_path = os.path.join(root, file)
                # Ensure we don't zip the output file if it's being created in same dir
                if os.path.abspath(file_path) == os.path.abspath(output_filename):
                    continue
                    
                arcname = os.path.relpath(file_path, source_dir)
                try:
                    zipf.write(file_path, arcname)
                except Exception as e:
                    print(f"Error adding {file_path}: {e}")

    print("Success! Zip file created.")

if __name__ == '__main__':
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_zip = f"BDB-FONDOS_Backup_{timestamp}.zip"
    source = "."
    zip_project(source, output_zip)
