$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = "z:\HR PORTAL\backups"
$backupDir = "$backupRoot\backup_$timestamp"

Write-Host "Creating backup at $backupDir..."
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# List of items to backup (files and folders)
$itemsToBackup = @(
    "src",
    "public",
    "firestore.rules",
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "index.html",
    "App.tsx"
)

foreach ($item in $itemsToBackup) {
    $sourcePath = "z:\HR PORTAL\$item"
    if (Test-Path $sourcePath) {
        Write-Host "Backing up $item..."
        Copy-Item -Path $sourcePath -Destination $backupDir -Recurse -Force
    } else {
        Write-Warning "Item not found: $item"
    }
}

# Create a restore script inside the backup folder for easy restoration
$restoreScriptPath = "$backupDir\restore_this_backup.ps1"
$restoreScriptContent = @"
`$backupDir = "`$PSScriptRoot"
`$targetDir = "z:\HR PORTAL"

Write-Host "Restoring from `$backupDir to `$targetDir..."

# Confirmation
`$confirm = Read-Host "Are you sure you want to overwrite current files with this backup? (y/n)"
if (`$confirm -ne 'y') {
    Write-Host "Restore cancelled."
    exit
}

`$itemsToRestore = @(
    "src",
    "public",
    "firestore.rules",
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "index.html",
    "App.tsx"
)

foreach (`$item in `$itemsToRestore) {
    `$sourcePath = "`$backupDir\`$item"
    `$destPath = "`$targetDir\`$item"
    if (Test-Path `$sourcePath) {
        Write-Host "Restoring `$item..."
        Copy-Item -Path `$sourcePath -Destination "`$targetDir" -Recurse -Force
    }
}

Write-Host "Restore completed successfully!"
"@

Set-Content -Path $restoreScriptPath -Value $restoreScriptContent
Write-Host "Backup completed successfully!"
Write-Host "To restore this state later, run: $restoreScriptPath"
