$sourcePath = "c:\Users\oanti\Documents\BDB-FONDOS"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tempPath = "c:\Users\oanti\Documents\BDB-FONDOS_TempBackup"
$destinationFile = "c:\Users\oanti\Documents\BDB-FONDOS_ProgramOnly_$timestamp.zip"

if (Test-Path $tempPath) { Remove-Item -Recurse -Force $tempPath }
New-Item -ItemType Directory -Path $tempPath

# Define what to include
$includeFolders = @(
    "frontend/src",
    "frontend/public",
    "functions",
    "functions_python/api",
    "functions_python/endpoints",
    "functions_python/models",
    "functions_python/services",
    "functions_python/utils"
)

$includeFiles = @(
    "firebase.json",
    ".firebaserc",
    "firestore.rules",
    "storage.rules",
    "firestore.indexes.json",
    "package.json",
    "package-lock.json",
    "frontend/package.json",
    "frontend/vite.config.js",
    "frontend/tsconfig.json",
    "frontend/index.html",
    "frontend/tailwind.config.js",
    "frontend/postcss.config.js",
    "functions_python/main.py",
    "functions_python/requirements.txt",
    "README.md"
)

Write-Host "Copying core program files..."

# Copy folders
foreach ($folder in $includeFolders) {
    $src = Join-Path $sourcePath $folder
    $dest = Join-Path $tempPath $folder
    if (Test-Path $src) {
        New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
        Copy-Item -Path $src -Destination $dest -Recurse -Force
    }
}

# Copy files
foreach ($file in $includeFiles) {
    $src = Join-Path $sourcePath $file
    $dest = Join-Path $tempPath $file
    if (Test-Path $src) {
        New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
        Copy-Item -Path $src -Destination $dest -Force
    }
}

Write-Host "Compressing files into $destinationFile..."
# Using tar because it's available and usually more reliable than Compress-Archive for some systems
tar -a -c -f $destinationFile -C $tempPath .

if (Test-Path $destinationFile) {
    Write-Host "Program-only backup created successfully at: $destinationFile"
    Write-Host "Final size: $((Get-Item $destinationFile).Length / 1KB) KB"
    # Verify contents
    $count = (tar -t -f $destinationFile).Count
    Write-Host "Total entries in ZIP: $count"
    Remove-Item -Recurse -Force $tempPath
} else {
    Write-Host "Failed to create backup."
}
