# Builds the installer with your Windows user folder replaced by "~" inside
# the compiled program, so the exe does not contain your username.
# Run from the infertune-app folder:  powershell -ExecutionPolicy Bypass -File scripts\build-clean.ps1

$ErrorActionPreference = "Stop"

# Your source, the Cargo cache and the Rust toolchain all live under the user
# folder, so one prefix covers them.
$env:RUSTFLAGS = "--remap-path-prefix=$($env:USERPROFILE)=~"

npm run tauri build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Check the result: look for the username inside the built files.
$user = $env:USERNAME
$files = @(Get-ChildItem "src-tauri\target\release\*.exe") +
         @(Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue)

$latin1 = [System.Text.Encoding]::GetEncoding(28591)
$dirty = $false

foreach ($f in $files) {
    $text = $latin1.GetString([System.IO.File]::ReadAllBytes($f.FullName))
    if ($text.Contains($env:USERPROFILE) -or $text.Contains("Users\$user")) {
        Write-Host "STILL CONTAINS YOUR USER FOLDER: $($f.Name)" -ForegroundColor Red
        $dirty = $true
    } else {
        Write-Host "clean: $($f.Name)" -ForegroundColor Green
    }
}

if ($dirty) { exit 1 }
