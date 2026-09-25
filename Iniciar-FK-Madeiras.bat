@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File ".\scripts\iniciar-fk-madeiras.ps1"
pause
