@echo off
chcp 65001 >nul 2>nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT=%CD%"
set "PY=%ROOT%\.venv\Scripts\python.exe"
REM 设置 UTF-8 编码，避免中文乱码
set "PYTHONIOENCODING=utf-8"

echo ================================================
echo   辰光 Agent 平台 - 一键启动
echo   数据库: SQLite    缓存: fakeredis  (无需 Docker)
echo ================================================
echo.

REM ==================== 1. Python 环境 ====================
echo [1/5] 检查 Python 环境 ...
set "SYS_PY="
where py >nul 2>&1
if not errorlevel 1 (
    set "SYS_PY=py -3"
) else (
    where python >nul 2>&1
    if not errorlevel 1 set "SYS_PY=python"
)

if not defined SYS_PY (
    echo.
    echo [错误] 未检测到 Python，请先安装 Python 3.10 或更高版本
    echo        安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

REM 检查虚拟环境是否有效
if not exist "%PY%" (
    echo       未发现有效虚拟环境，正在创建 .venv ...
    %SYS_PY% -m venv .venv
    if errorlevel 1 (
        echo.
        echo [错误] 创建虚拟环境失败
        pause
        exit /b 1
    )
    echo       虚拟环境创建完成
) else (
    echo       虚拟环境已存在
)

REM ==================== 2. 安装依赖 ====================
echo [2/5] 安装 Python 依赖 ...
"%PY%" -c "import fastapi, uvicorn, aiosqlite, fakeredis, alembic, sqlalchemy" >nul 2>&1
if errorlevel 1 (
    echo       首次运行或依赖缺失，正在安装依赖包 ...
    "%PY%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败，可配置清华镜像源：
        echo        pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
        echo.
        pause
        exit /b 1
    )
)
echo       核心依赖检查通过

"%PY%" -c "import minio" >nul 2>&1
if errorlevel 1 (
    echo       安装 minio 客户端 ...
    "%PY%" -m pip install minio
)
echo       依赖安装完成

REM ==================== 3. 初始化数据库 ====================
echo [3/5] 初始化数据库 ...
"%PY%" bootstrap_db.py
if errorlevel 1 (
    echo.
    echo [错误] 数据库初始化失败
    pause
    exit /b 1
)
echo       数据库就绪

REM ==================== 4. 前端依赖 ====================
echo [4/5] 检查前端依赖 ...
if not exist "%ROOT%\app\node_modules" (
    echo       首次运行，正在安装 npm 依赖 ...
    pushd "%ROOT%\app"
    call npm.cmd install
    popd
    if errorlevel 1 (
        echo.
        echo [错误] npm 安装失败，请确认已安装 Node.js 18+
        pause
        exit /b 1
    )
) else (
    echo       前端依赖已存在
)

REM ==================== 5. 启动服务 ====================
echo [5/5] 启动前后端服务 ...

call :port_busy 8080
if "!BUSY!"=="1" (
    echo       端口 8080 已被占用，跳过后端启动
) else (
    start "辰光Agent-后端 8080" /D "%ROOT%" cmd /k "%PY% -m uvicorn src.main:app --host 127.0.0.1 --port 8080"
    echo       后端服务启动中 ...
)

call :port_busy 5173
if "!BUSY!"=="1" (
    echo       端口 5173 已被占用，跳过前端启动
) else (
    start "辰光Agent-前端 5173" /D "%ROOT%\app" cmd /k "npm.cmd run dev"
    echo       前端服务启动中 ...
)

echo.
echo       等待服务就绪 ...
"%PY%" wait_ready.py 120
set "READY=!ERRORLEVEL!"

echo.
echo ================================================
echo   后端 API 文档: http://localhost:8080/docs
echo   健康检查:      http://localhost:8080/health
echo   前端访问:      http://localhost:5173
echo   默认账号:      admin / 123456
echo.
if "!READY!"=="0" (
    echo   启动成功！正在打开浏览器 ...
    start "" "http://localhost:5173"
) else (
    echo   启动超时，请查看控制台输出排查
)
echo.
echo   关闭窗口即可停止服务
echo ================================================
echo.
pause
exit /b 0

REM ==================== 端口占用检测函数 ====================
:port_busy
set "BUSY=0"
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
if not errorlevel 1 set "BUSY=1"
exit /b 0
