@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Olavo Estudos - processamento
echo Processamento do acervo (lento e retomavel; pode fechar e rodar de novo)
echo.
echo 1/5 Legendas que o YouTube recusou
python -u scripts\extrair_textos.py --pausa 10 --lote 10 --pausa-lote 60
echo.
echo 2/5 Retranscricao fina das aulas completas
start "" /wait /belownormal /b python -u scripts\retranscrever.py --fino
echo.
echo 3/5 Retranscricao dos videos sem legenda (a partir dos MP4 locais)
start "" /wait /belownormal /b python -u scripts\retranscrever.py
echo.
echo 4/5 Edicao para estudo
python scripts\editar_estudo.py
echo.
echo 5/5 Dados do site
python scripts\montar_dados.py
echo.
echo Concluido.
pause
