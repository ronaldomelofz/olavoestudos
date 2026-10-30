@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Olavo Estudos - processamento automatico
echo Processamento 100%% local e automatico (sem login externo). Pode fechar e rodar de novo.
echo.
echo 1/6 Legendas YouTube (quando disponivel)
python -u scripts\extrair_textos.py --pausa 10 --lote 10 --pausa-lote 60
echo.
echo 2/6 Retranscricao fina das aulas
start "" /wait /belownormal /b python -u scripts\retranscrever.py --fino
echo.
echo 3/6 Retranscricao dos videos sem legenda (MP4 locais)
start "" /wait /belownormal /b python -u scripts\retranscrever.py
echo.
echo 4/6 Edicao para estudo
python scripts\editar_estudo.py
echo.
echo 5/6 Extracao de audios dos MP4
python -u scripts\extrair_audios.py
echo.
echo 6/6 Dados do site + biblioteca
python scripts\montar_dados.py
python scripts\montar_biblioteca.py --sem-baixar
echo.
echo Concluido.
pause
