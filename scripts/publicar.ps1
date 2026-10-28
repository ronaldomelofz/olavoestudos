# Publica olvaoestudos.netlify.app. Por padrão o texto integral das aulas NÃO vai para o site público
# (fica só na versão local, ESTUDAR-LOCAL.bat); use -ComTextos para incluí-lo.
param([switch]$ComTextos)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz
python scripts\montar_dados.py | Out-Null
Set-Location site
npm run build
python ..\scripts\filtrar_publico.py
if ($ComTextos) { Write-Host 'textos integrais continuam fora: o filtro público já os retirou' }
netlify deploy --prod --dir dist --site d645c321-83cf-4cb5-a7d8-c1280a622e8e --no-build
