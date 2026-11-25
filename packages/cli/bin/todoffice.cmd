@echo off
rem todoffice launcher for the packaged Windows app: <install>\resources\cli\todoffice.cmd
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\TodOffice.exe" "%~dp0genoffice.cjs" %*
endlocal
