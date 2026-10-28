@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Fase B: Whisper small nas aulas completas (cerca de 30 min por hora de aula; retomavel)
start "" /wait /belownormal /b python -u scripts\retranscrever.py --fino
echo.
echo Vídeos sem legenda:
start "" /wait /belownormal /b python -u scripts\retranscrever.py
python scripts\editar_estudo.py
python scripts\montar_dados.py
pause
