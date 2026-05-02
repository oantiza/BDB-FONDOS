param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Test-IsUnderBase {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [Parameter(Mandatory = $true)][string]$BasePath
  )

  $fullPath = (Resolve-FullPath $PathValue).TrimEnd("\")
  $fullBase = (Resolve-FullPath $BasePath).TrimEnd("\")
  return $fullPath.Equals($fullBase, [System.StringComparison]::OrdinalIgnoreCase) -or
    $fullPath.StartsWith($fullBase + "\", [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-IsUnderRoot {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [Parameter(Mandatory = $true)][string]$RootPath
  )

  if (-not (Test-IsUnderBase -PathValue $PathValue -BasePath $RootPath)) {
    throw "Ruta fuera del repo: $PathValue"
  }
}

function Ensure-Dir {
  param([Parameter(Mandatory = $true)][string]$DirPath)

  Assert-IsUnderRoot -PathValue $DirPath -RootPath $script:RootResolved
  if (-not (Test-Path -LiteralPath $DirPath)) {
    New-Item -ItemType Directory -Path $DirPath -Force | Out-Null
    $script:Manifest.created_dirs.Add((Resolve-FullPath $DirPath)) | Out-Null
  }
}

function Get-UniqueTargetPath {
  param([Parameter(Mandatory = $true)][string]$TargetPath)

  if (-not (Test-Path -LiteralPath $TargetPath)) {
    return $TargetPath
  }

  $parent = Split-Path -Parent $TargetPath
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($TargetPath)
  $ext = [System.IO.Path]::GetExtension($TargetPath)
  $stamp = Get-Date -Format "yyyyMMdd_HHmmssfff"
  $i = 1

  do {
    $candidate = Join-Path $parent ("{0}__migrated_{1}_{2}{3}" -f $stem, $stamp, $i, $ext)
    $i++
  } while (Test-Path -LiteralPath $candidate)

  return $candidate
}

function Add-MoveRecord {
  param(
    [string]$SourcePath,
    [string]$TargetPath,
    [string]$Kind,
    [string]$Note
  )

  $script:Manifest.moves.Add([ordered]@{
      source = Resolve-FullPath $SourcePath
      target = Resolve-FullPath $TargetPath
      kind   = $Kind
      note   = $Note
    }) | Out-Null
}

function Add-SkipRecord {
  param(
    [string]$SourcePath,
    [string]$Reason
  )

  $script:Manifest.skipped.Add([ordered]@{
      source = Resolve-FullPath $SourcePath
      reason = $Reason
    }) | Out-Null
}

function Remove-DirIfEmpty {
  param([Parameter(Mandatory = $true)][string]$DirPath)

  if (-not (Test-Path -LiteralPath $DirPath -PathType Container)) {
    return
  }

  $hasChildren = Get-ChildItem -LiteralPath $DirPath -Force -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $hasChildren) {
    Assert-IsUnderRoot -PathValue $DirPath -RootPath $script:RootResolved
    Remove-Item -LiteralPath $DirPath -Force
    $script:Manifest.removed_empty_dirs.Add((Resolve-FullPath $DirPath)) | Out-Null
  }
}

function Remove-EmptyAncestors {
  param(
    [Parameter(Mandatory = $true)][string]$StartDir,
    [Parameter(Mandatory = $true)][string]$StopAt
  )

  $current = Resolve-FullPath $StartDir
  $stop = Resolve-FullPath $StopAt

  while (Test-IsUnderBase -PathValue $current -BasePath $stop) {
    if ($current.Equals($stop, [System.StringComparison]::OrdinalIgnoreCase)) {
      break
    }

    Remove-DirIfEmpty -DirPath $current
    if (Test-Path -LiteralPath $current) {
      break
    }

    $parent = Split-Path -Parent $current
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent.Equals($current, [System.StringComparison]::OrdinalIgnoreCase)) {
      break
    }
    $current = $parent
  }
}

function Move-PathSafe {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$DestDir,
    [Parameter(Mandatory = $true)][string]$Kind,
    [string]$Note = ""
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    Add-SkipRecord -SourcePath $SourcePath -Reason "source_missing"
    return $null
  }

  Assert-IsUnderRoot -PathValue $SourcePath -RootPath $script:RootResolved
  Assert-IsUnderRoot -PathValue $DestDir -RootPath $script:RootResolved
  Ensure-Dir -DirPath $DestDir

  $item = Get-Item -LiteralPath $SourcePath -Force
  if ($item.PSIsContainer) {
    $hasChildren = Get-ChildItem -LiteralPath $SourcePath -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $hasChildren) {
      Remove-DirIfEmpty -DirPath $SourcePath
      return $null
    }
  }

  $targetPath = Join-Path $DestDir $item.Name

  if ($item.PSIsContainer) {
    if (Test-Path -LiteralPath $targetPath) {
      $targetItem = Get-Item -LiteralPath $targetPath -Force
      if (-not $targetItem.PSIsContainer) {
        $targetPath = Get-UniqueTargetPath -TargetPath $targetPath
      }
    }

    if (Test-Path -LiteralPath $targetPath -PathType Container) {
      Get-ChildItem -LiteralPath $SourcePath -Force | ForEach-Object {
        Move-PathSafe -SourcePath $_.FullName -DestDir $targetPath -Kind $Kind -Note $Note | Out-Null
      }
      Remove-DirIfEmpty -DirPath $SourcePath
      return $targetPath
    }

    Move-Item -LiteralPath $SourcePath -Destination $targetPath
    Add-MoveRecord -SourcePath $SourcePath -TargetPath $targetPath -Kind $Kind -Note $Note
    Remove-EmptyAncestors -StartDir (Split-Path -Parent $SourcePath) -StopAt $script:RootResolved
    return $targetPath
  }

  if (Test-Path -LiteralPath $targetPath) {
    $targetPath = Get-UniqueTargetPath -TargetPath $targetPath
  }

  Move-Item -LiteralPath $SourcePath -Destination $targetPath
  Add-MoveRecord -SourcePath $SourcePath -TargetPath $targetPath -Kind $Kind -Note $Note
  Remove-EmptyAncestors -StartDir (Split-Path -Parent $SourcePath) -StopAt $script:RootResolved
  return $targetPath
}

function Move-DirectoryContents {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$DestDir,
    [Parameter(Mandatory = $true)][string]$Kind,
    [string]$Note = ""
  )

  if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    Add-SkipRecord -SourcePath $SourceDir -Reason "source_dir_missing"
    return
  }

  Ensure-Dir -DirPath $DestDir

  Get-ChildItem -LiteralPath $SourceDir -Force | ForEach-Object {
    Move-PathSafe -SourcePath $_.FullName -DestDir $DestDir -Kind $Kind -Note $Note | Out-Null
  }

  Remove-DirIfEmpty -DirPath $SourceDir
  Remove-EmptyAncestors -StartDir (Split-Path -Parent $SourceDir) -StopAt $script:RootResolved
}

function Move-FilesByExtensions {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$DestDir,
    [Parameter(Mandatory = $true)][string[]]$Extensions,
    [Parameter(Mandatory = $true)][string]$Kind,
    [string]$Note = ""
  )

  if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    Add-SkipRecord -SourcePath $SourceDir -Reason "source_dir_missing"
    return
  }

  $normalized = $Extensions | ForEach-Object { $_.ToLowerInvariant() }
  $files = Get-ChildItem -LiteralPath $SourceDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $normalized -contains $_.Extension.ToLowerInvariant() }

  foreach ($file in $files) {
    Move-PathSafe -SourcePath $file.FullName -DestDir $DestDir -Kind $Kind -Note $Note | Out-Null
  }

  Remove-DirIfEmpty -DirPath $SourceDir
  Remove-EmptyAncestors -StartDir $SourceDir -StopAt $script:RootResolved
}

$script:RootResolved = Resolve-FullPath $Root
Assert-IsUnderRoot -PathValue $script:RootResolved -RootPath $script:RootResolved

$dataRoot = Join-Path $script:RootResolved "data"
$docsRoot = Join-Path $script:RootResolved "docs"
$overridesRoot = Join-Path $script:RootResolved "overrides"
$testsRoot = Join-Path $script:RootResolved "tests"
$schemasRoot = Join-Path $script:RootResolved "schemas"

$dataInput = Join-Path $dataRoot "input_pdfs"
$dataCanonical = Join-Path $dataRoot "canonical"
$dataReview = Join-Path $dataRoot "review"
$dataError = Join-Path $dataRoot "error"
$dataWork = Join-Path $dataRoot "work"
$dataWorkManifests = Join-Path $dataWork "manifests"
$docsParser = Join-Path $docsRoot "parser"
$docsAudits = Join-Path $docsRoot "audits"
$docsAuditsLegacy = Join-Path $docsAudits "legacy"
$overridesData = Join-Path $overridesRoot "05_overrides"
$legacyRoots = Join-Path $dataWork "legacy_roots"

$script:Manifest = [ordered]@{
  generated_at       = (Get-Date).ToString("o")
  root               = $script:RootResolved
  created_dirs       = New-Object System.Collections.Generic.List[string]
  moves              = New-Object System.Collections.Generic.List[object]
  skipped            = New-Object System.Collections.Generic.List[object]
  removed_empty_dirs = New-Object System.Collections.Generic.List[string]
}

@(
  $dataInput,
  $dataCanonical,
  $dataReview,
  $dataError,
  $dataWork,
  $dataWorkManifests,
  $docsParser,
  $docsAudits,
  $docsAuditsLegacy,
  $overridesRoot,
  $overridesData,
  $testsRoot,
  $schemasRoot,
  $legacyRoots
) | ForEach-Object { Ensure-Dir -DirPath $_ }

# PDFs operativos
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\00_input_pdfs") -DestDir $dataInput -Extensions @(".pdf") -Kind "input_pdf" -Note "backup input pdfs"
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "PROCESADOS") -DestDir $dataInput -Extensions @(".pdf") -Kind "input_pdf" -Note "processed pdf archive"
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "ERRORES") -DestDir $dataInput -Extensions @(".pdf") -Kind "input_pdf" -Note "error pdf archive"
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "ENTRADA_TEST") -DestDir $dataInput -Extensions @(".pdf") -Kind "input_pdf" -Note "entrada_test pdfs"
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "test_input") -DestDir $dataInput -Extensions @(".pdf") -Kind "input_pdf" -Note "test_input pdfs"

# JSON principales
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\04_canonical") -DestDir $dataCanonical -Extensions @(".json") -Kind "canonical_json" -Note "canonical payloads"
Move-FilesByExtensions -SourceDir (Join-Path $script:RootResolved "PROCESADOS") -DestDir $dataCanonical -Extensions @(".json") -Kind "canonical_json" -Note "latest processed json"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\05_overrides\review_queue") -DestDir $dataReview -Kind "review_json" -Note "review queue"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\08_logs\errors") -DestDir $dataError -Kind "error_json" -Note "error payloads"

# Trabajo interno
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\01_raw_text") -DestDir (Join-Path $dataWork "raw_text") -Kind "work_artifact" -Note "raw text"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\02_raw_llm") -DestDir (Join-Path $dataWork "raw_llm") -Kind "work_artifact" -Note "raw llm"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\03_parsed_ms") -DestDir (Join-Path $dataWork "parsed_ms") -Kind "work_artifact" -Note "parsed morningstar"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\06_exports") -DestDir (Join-Path $dataWork "exports") -Kind "work_artifact" -Note "exports"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\07_manifests") -DestDir (Join-Path $dataWork "manifests") -Kind "work_artifact" -Note "manifests"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\08_logs") -DestDir (Join-Path $dataWork "logs") -Kind "work_artifact" -Note "logs"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "BDB_PARSE_BACKUP\scripts") -DestDir (Join-Path $dataWork "scripts_backup") -Kind "work_artifact" -Note "backup scripts"

# Overrides, schema y tests
Move-PathSafe -SourcePath (Join-Path $script:RootResolved "scripts\validate_manual_overrides.js") -DestDir $overridesRoot -Kind "governance_script" -Note "institutional validator" | Out-Null
Move-PathSafe -SourcePath (Join-Path $script:RootResolved "_backup_old\schemas\manual_override.schema.json") -DestDir $schemasRoot -Kind "schema" -Note "manual override schema" | Out-Null
Move-PathSafe -SourcePath (Join-Path $script:RootResolved "_backup_old\tests\manual_overrides") -DestDir $testsRoot -Kind "test_suite" -Note "manual overrides regression tests" | Out-Null

# Documentacion
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "_backup_old\docs") -DestDir $docsParser -Kind "parser_doc" -Note "legacy parser docs"
Move-PathSafe -SourcePath (Join-Path $script:RootResolved "prompts_chat.md") -DestDir $docsParser -Kind "parser_doc" -Note "parser prompts" | Out-Null
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "reports") -DestDir $docsAudits -Kind "audit_doc" -Note "taxonomy reports"
Move-DirectoryContents -SourceDir (Join-Path $script:RootResolved "_backup_old\audits_and_dumps") -DestDir $docsAuditsLegacy -Kind "audit_doc" -Note "legacy audits and dumps"

# Residuos legacy para no perder trazabilidad
foreach ($legacyDir in @(
    (Join-Path $script:RootResolved "BDB_PARSE_BACKUP"),
    (Join-Path $script:RootResolved "PROCESADOS"),
    (Join-Path $script:RootResolved "ERRORES"),
    (Join-Path $script:RootResolved "ENTRADA_TEST"),
    (Join-Path $script:RootResolved "test_input"),
    (Join-Path $script:RootResolved "reports"),
    (Join-Path $script:RootResolved "_backup_old")
  )) {
  if (Test-Path -LiteralPath $legacyDir) {
    $hasChildren = Get-ChildItem -LiteralPath $legacyDir -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $hasChildren) {
      Remove-DirIfEmpty -DirPath $legacyDir
    } else {
      Move-PathSafe -SourcePath $legacyDir -DestDir $legacyRoots -Kind "legacy_root" -Note "residual root after structured migration" | Out-Null
    }
  }
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$manifestPath = Join-Path $dataWorkManifests "repo_reorg_manifest_$stamp.json"
$summary = [ordered]@{
  generated_at       = $script:Manifest.generated_at
  root               = $script:Manifest.root
  created_dirs       = $script:Manifest.created_dirs
  moved_count        = $script:Manifest.moves.Count
  skipped_count      = $script:Manifest.skipped.Count
  removed_empty_dirs = $script:Manifest.removed_empty_dirs
  moves              = $script:Manifest.moves
  skipped            = $script:Manifest.skipped
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Output "Reorganization complete"
Write-Output "Manifest: $manifestPath"
