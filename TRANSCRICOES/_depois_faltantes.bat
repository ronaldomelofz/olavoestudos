chcp 65001 >nul
cd /d E:\PROJETOS-CURSOR\ESTUDOS\PROFESSOR-OLAVO
:wait
timeout /t 30 /nobreak >nul
tasklist /fi "IMAGENAME eq python.exe" /v | findstr /i retranscrever >nul
if not errorlevel 1 goto wait
python -u scripts\retranscrever.py --pausa 5 --ids=-ARru63yog0
python -u scripts\editar_estudo.py
python -u scripts\montar_dados.py
echo FIM 8 faltantes>> TRANSCRICOES\_log_faltantes.txt
