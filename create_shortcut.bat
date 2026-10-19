@echo off
title Create Zuma Desktop Shortcut
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $desktop = [System.Environment]::GetFolderPath('Desktop'); $s = $WshShell.CreateShortcut(\"$desktop\Zuma Deluxe Aztec.lnk\"); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"' + $PSScriptRoot + '\launch_silent.vbs\"'; $s.WorkingDirectory = $PSScriptRoot; $s.IconLocation = $PSScriptRoot + '\assets\app_icon.ico,0'; $s.Description = 'Zuma Deluxe Aztec - لعبة زوما الآزتيك'; $s.Save(); Write-Host 'Shortcut created successfully on Desktop!'"
pause
