@echo off
chcp 65001 >nul
cd /d "%~dp0site"
title Olavo Estudos - site local
start "" http://localhost:5180/
call npx vite --port 5180 --strictPort
