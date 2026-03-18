import os
import zipfile
import time
from pathlib import Path

def create_clean_migration():
    project_root = Path(r"c:\Users\oanti\Documents\BDB-FONDOS")
    output_filename = "MIGRACION_LIMPIA_BDB.zip"
    output_path = project_root / output_filename

    # Rules
    exclude_dirs = {".antigravity", "node_modules", ".venv", ".pytest_cache", ".git", "__pycache__"}
    include_files = {
        "antigravity.json", ".antigravityignore", ".antigravity_persona",
        "package.json", "requirements.txt", "serviceAccountKey.json",
        "firebase.json", ".firebaserc", "firestore.rules", "firestore.indexes.json", "storage.rules"
    }
    exclude_extensions = {".csv", ".pdf"}

    print(f"Iniciando creación de {output_filename}...")
    
    start_time = time.time()
    files_count = 0

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(project_root):
            rel_root = Path(root).relative_to(project_root)
            
            # Filter directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                file_path = Path(root) / file
                rel_path = rel_root / file
                
                # Check inclusion rules
                is_config = file in include_files
                is_source = file_path.suffix not in exclude_extensions
                
                # Special rule: exclude heavy csv/pdf from root, but maybe keep them elsewhere?
                # User said: "todos los archivos .csv o .pdf pesados de la raíz"
                is_heavy_root_media = rel_root == Path(".") and file_path.suffix in exclude_extensions
                
                if (is_config or is_source) and not is_heavy_root_media:
                    if str(rel_path) == output_filename:
                        continue
                    
                    zipf.write(file_path, rel_path)
                    files_count += 1

    end_time = time.time()
    duration = end_time - start_time
    size_mb = output_path.stat().st_size / (1024 * 1024)

    print(f"¡Éxito! Archivo generado en: {output_path}")
    print(f"Archivos incluidos: {files_count}")
    print(f"Tamaño total: {size_mb:.2f} MB")
    print(f"Tiempo empleado: {duration:.2f} segundos")

if __name__ == "__main__":
    create_clean_migration()
