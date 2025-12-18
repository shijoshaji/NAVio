# Set path to project root (one level up from this script)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
Set-Location $ProjectRoot

$dbFile = "backend\mf_tracker.db"
$intervalSeconds = 1800  # 30 minutes

Write-Host "Project Root: $ProjectRoot"
Write-Host "Tracking DB: $dbFile"

# Check if this is a git repository
if (-not (Test-Path ".git")) {
    Write-Host "Not a git repository. Auto-backup job will exit."
    Start-Sleep -Seconds 3
    exit
}

# CONFIGURATION: Allowed branches for auto-backup
$AllowedBranches = @("End_User")

# Get current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
$currentBranch = $currentBranch.Trim()

if ($AllowedBranches -notcontains $currentBranch) {
    Write-Host "Current branch '$currentBranch' is not in the allowed backup list ($($AllowedBranches -join ', '))."
    Write-Host "Auto-backup job will exit."
    Start-Sleep -Seconds 5
    exit
}

Write-Host "Branch verification successful: '$currentBranch' is allowed."

Write-Host "Starting Auto-Backup for $dbFile..."
Write-Host "Checking for changes every 30 minutes."

while ($true) {
    try {
        $status = git status --porcelain $dbFile
        if ($status) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            Write-Host "Changes detected at $timestamp. Committing..."
            
            git add $dbFile
            git commit -m "Auto-backup DB file: $timestamp"
            
            Write-Host "Pushing to remote..."
            git push
            
            Write-Host "Backup complete."
        } else {
            Write-Host "No changes detected. Sleeping..."
        }
    } catch {
        Write-Host "Error during backup process: $_"
    }
    
    Start-Sleep -Seconds $intervalSeconds
}