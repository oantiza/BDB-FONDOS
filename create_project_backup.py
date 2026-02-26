import os
import zipfile
import datetime
import sys

def create_clean_zip():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"BDB-FONDOS_Source_{timestamp}.zip"
    
    # Directorios y extensiones a excluir (solo archivos del programa, sin dependencias)
    EXCLUDE_DIRS = {
        'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', 
        '.firebase', '.git', 'seguridad', 'SEGURIDAD', '.idea', '.vscode',
        'coverage', 'cypress', 'logs', '.antigravity'
    }
    EXCLUDE_EXTENSIONS = {'.log', '.zip', '.pyc', '.pyo', '.pyd', '.sqlite3'}
    
    print(f"📦 Creando copia de seguridad: {zip_filename}")
    print("✨ Solo se incluirá código fuente, excluyendo dependencias.")

    count = 0
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Eliminar directorios excluidos para que os.walk no entre en ellos
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                if file == zip_filename: # No copiarse a sí mismo
                    continue
                    
                file_path = os.path.join(root, file)
                zipf.write(file_path, file_path)
                count += 1
    
    size_mb = os.path.getsize(zip_filename) / (1024 * 1024)
    print(f"✅ ¡Copia completada con éxito! Se añadieron {count} archivos.")
    print(f"💾 Tamaño de la copia: {size_mb:.2f} MB")
    print("\n💡 NOTA PARA LA REINSTALACIÓN:")
    print("   1. Instala Python 3.12 (o superior) y Node.js.")
    print("   2. Extrae este archivo ZIP en tu nueva PC.")
    print("   3. Para el backend Python: Ejecuta 'python -m venv venv', actívalo, instala dependencias.")
    print("   4. Para el frontend/Node: Ejecuta 'npm install'.")

if __name__ == "__main__":
    create_clean_zip()
