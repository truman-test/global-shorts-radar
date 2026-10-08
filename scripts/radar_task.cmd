@echo off
rem Wrapper for scheduled runs: scripts\radar_task.cmd run  |  scripts\radar_task.cmd track
rem Runs from the repository root with the project venv and appends to data\cron.log.
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%" || exit /b 1
if not exist "data" mkdir "data"
set "PYTHONIOENCODING=utf-8"
echo [%date% %time%] radar %* >> "data\cron.log"
".venv\Scripts\radar.exe" %* >> "data\cron.log" 2>&1
set "RC=%ERRORLEVEL%"
echo [%date% %time%] exit %RC% >> "data\cron.log"
endlocal & exit /b %RC%
