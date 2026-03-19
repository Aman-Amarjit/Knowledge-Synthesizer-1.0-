@echo off
setlocal
echo ==================================================
echo   🧠 Knowledge Synthesizer: Starting Dual-Server
echo ==================================================

REM 1. Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH. 
    echo Please install Python 3.10+ and try again.
    pause
    exit /b
)

REM 2. Check for dependencies
echo [INFO] Ensuring backend dependencies are installed...
pip install -r backend/requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies. Check your internet connection.
    pause
    exit /b
)

REM 3. Start Unified Backend & Frontend Server (Port 8000)
echo [INFO] Starting Application Server (Port 8000)...
start "Knowledge Synthesizer" cmd /c "cd backend && python main.py"

REM 5. Wait for servers to initialize
echo [INFO] Waiting for servers to start (5s)...
timeout /t 5 /nobreak >nul

REM 5. Open Application
echo [INFO] Opening the application in your browser...
start http://localhost:8000

echo.
echo ==================================================
echo   🚀 Application is now running!
echo   - App: http://localhost:8000
echo ==================================================
pause
