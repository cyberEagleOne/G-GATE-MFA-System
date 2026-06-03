Write-Host "Starting G-GATE local demo..." -ForegroundColor Green

docker compose up -d

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; py brain.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\dashboard'; npm run dev"

Write-Host ""
Write-Host "Dashboard will be available at http://localhost:5173" -ForegroundColor Cyan
Write-Host "MQTT TCP for ESP32 remains available on this laptop IP at port 1883." -ForegroundColor Yellow
