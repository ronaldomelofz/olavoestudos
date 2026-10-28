@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Versao local de estudo (com o texto integral das aulas)
python scripts\editar_estudo.py
python scripts\montar_dados.py
cd site
call npm run build
start "" http://localhost:4173/
call npx vite preview --port 4173
