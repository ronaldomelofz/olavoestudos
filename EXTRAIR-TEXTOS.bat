@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Fase A: legendas com tempo (lento e retomavel; pode fechar e rodar de novo)
python -u scripts\extrair_textos.py --pausa 8 --lote 10 --pausa-lote 60
echo.
echo Edicao para estudo e dados do site
python scripts\editar_estudo.py
python scripts\montar_dados.py
pause
