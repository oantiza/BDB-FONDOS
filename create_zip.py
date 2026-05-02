import os
import zipfile

def create_zip(output_filename, source_dir):
    exclude_dirs = {
        'node_modules', '.git', '.venv', '__pycache__', '.firebase', '.agent', 
        'dist', 'build', 'venv', 'env', 'data', 'docs'
    }
    
    exclude_files = {
        'serviceAccountKey.json',
        'create_zip.py'
    }
    
    exclude_extensions = {
        '.zip', '.tar.gz', '.rar'
    }

    print(f"Creating {output_filename}...")
    
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file in exclude_files:
                    continue
                
                ext = os.path.splitext(file)[1].lower()
                if ext in exclude_extensions:
                    continue
                
                # Check if it's an .env file
                if file.startswith('.env'):
                    continue

                # Also skip the output file itself just in case
                if file == os.path.basename(output_filename):
                    continue
                    
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                
                # Optional: you can print the file being added
                # print(f"Adding {arcname}")
                zipf.write(file_path, arcname)
                
    print("Done!")

if __name__ == '__main__':
    source = r'c:\Users\oanti\Documents\BDB-FONDOS'
    output = r'c:\Users\oanti\Documents\BDB-FONDOS\BDB-FONDOS_SourceCode.zip'
    create_zip(output, source)
