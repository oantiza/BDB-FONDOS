import zipfile
import os
import datetime

def create_zip():
    # Name with timestamp
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"BDB-FONDOS_Source_{timestamp}.zip"
    
    # Directories and files to include
    include_paths = [
        "frontend/src",
        "functions_python",
        "firebase.json",
        "firestore.rules",
        "firestore.indexes.json",
        "storage.rules",
        "package.json",
        "frontend/package.json",
        "README.md"
    ]
    
    # Exclude patterns
    exclude_dirs = {"node_modules", ".git", ".firebase", "dist", "__pycache__", ".pytest_cache", "venv", ".venv", "env"}
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for path in include_paths:
            if not os.path.exists(path):
                print(f"Skipping {path} (not found)")
                continue
                
            if os.path.isdir(path):
                for root, dirs, files in os.walk(path):
                    # Filter out excluded directories
                    dirs[:] = [d for d in dirs if d not in exclude_dirs]
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Avoid zipping the zip itself if it's in an included path (unlikely here)
                        if file == zip_filename:
                            continue
                        
                        relative_path = os.path.relpath(file_path, ".")
                        zipf.write(file_path, relative_path)
                        print(f"Added: {relative_path}")
            else:
                zipf.write(path, path)
                print(f"Added: {path}")

    print(f"\nSuccessfully created {zip_filename} in the current directory.")
    return zip_filename

if __name__ == "__main__":
    create_zip()
