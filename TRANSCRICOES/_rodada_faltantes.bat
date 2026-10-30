chcp 65001 >nul
cd /d E:\PROJETOS-CURSOR\ESTUDOS\PROFESSOR-OLAVO
python -u scripts\retranscrever.py --pausa 5 --ids OpKvK75lG0w YoApKNuOQ1A dUtpd4NuivM kfu6OtIWhDw pGh0ZLZrhV4 pjMOTYmhuVc vf5IxZ3Frto
python -u scripts\retranscrever.py --pausa 5 --ids=-ARru63yog0
python -u scripts\editar_estudo.py
python -u scripts\montar_dados.py
echo [%date% %time%] FIM faltantes>> TRANSCRICOES\_log_whisper.txt
