@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Acervo local: textos do Seminario e videos (lento e retomavel; pode fechar e rodar de novo)
start "Textos do Seminario" /belownormal cmd /c python -u scripts\baixar_textos.py --pausa 1.5
python -u scripts\baixar_videos.py --pausa 20
python scripts\montar_dados.py
pause
