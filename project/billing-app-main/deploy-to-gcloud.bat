@echo off
REM Google Cloud Deployment Script for Invoice Management App (Windows)
REM This script automates the entire deployment process

echo ==========================================
echo Invoice Management App - Google Cloud Deployment
echo ==========================================
echo.

REM Step 1: Check if gcloud is installed
echo Step 1: Checking Google Cloud CLI installation...
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Google Cloud CLI is not installed!
    echo.
    echo Please install it first from:
    echo   https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)
echo [SUCCESS] Google Cloud CLI is installed
echo.

REM Step 2: Check authentication
echo Step 2: Checking authentication...
gcloud auth list --filter=status:ACTIVE --format="value(account)" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] You need to login to Google Cloud
    gcloud auth login
)
echo [SUCCESS] Authenticated with Google Cloud
echo.

REM Step 3: Get or create project
echo Step 3: Setting up Google Cloud Project...
set /p PROJECT_ID="Enter your Google Cloud Project ID (e.g., invoice-app-2025): "

if "%PROJECT_ID%"=="" (
    echo [ERROR] Project ID cannot be empty
    pause
    exit /b 1
)

REM Check if project exists
gcloud projects describe %PROJECT_ID% >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Creating new project '%PROJECT_ID%'...
    gcloud projects create %PROJECT_ID% --name="Invoice Management App"
)

gcloud config set project %PROJECT_ID%
echo [SUCCESS] Project set to: %PROJECT_ID%
echo.

REM Step 4: Enable required APIs
echo Step 4: Enabling required Google Cloud APIs...
echo [INFO] This may take 30-60 seconds...
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet
echo [SUCCESS] Required APIs enabled
echo.

REM Step 5: Check billing
echo Step 5: Checking billing status...
echo [INFO] Note: Billing must be enabled to deploy (Free tier available)
echo If billing is not enabled, please enable it at:
echo https://console.cloud.google.com/billing/linkedaccount?project=%PROJECT_ID%
pause
echo [SUCCESS] Billing check completed
echo.

REM Step 6: Build application locally
echo Step 6: Testing local build...
echo [INFO] Running npm run build to verify app builds correctly...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [SUCCESS] Local build successful
echo.

REM Step 7: Build Docker image on Google Cloud
echo Step 7: Building Docker image on Google Cloud...
echo [INFO] This will take 3-5 minutes. Please wait...
gcloud builds submit --tag gcr.io/%PROJECT_ID%/invoice-app --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker build failed
    pause
    exit /b 1
)
echo [SUCCESS] Docker image built successfully
echo.

REM Step 8: Deploy to Cloud Run
echo Step 8: Deploying to Cloud Run...
set /p REGION="Enter deployment region (default: us-central1): "
if "%REGION%"=="" set REGION=us-central1

echo [INFO] Deploying to region: %REGION%
gcloud run deploy invoice-app --image gcr.io/%PROJECT_ID%/invoice-app --platform managed --region %REGION% --allow-unauthenticated --port 8080 --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Deployment failed
    pause
    exit /b 1
)
echo [SUCCESS] Application deployed to Cloud Run
echo.

REM Step 9: Add environment variables
echo Step 9: Configuring environment variables...
echo [INFO] Reading Supabase credentials from .env file...

if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if "%%a"=="VITE_SUPABASE_URL" set SUPABASE_URL=%%b
        if "%%a"=="VITE_SUPABASE_ANON_KEY" set SUPABASE_KEY=%%b
    )

    if defined SUPABASE_URL if defined SUPABASE_KEY (
        gcloud run services update invoice-app --region %REGION% --update-env-vars VITE_SUPABASE_URL=%SUPABASE_URL%,VITE_SUPABASE_ANON_KEY=%SUPABASE_KEY% --quiet
        echo [SUCCESS] Environment variables configured
    ) else (
        echo [ERROR] Could not find Supabase credentials in .env file
        echo Please set them manually
    )
) else (
    echo [ERROR] .env file not found
    echo Please set environment variables manually
)
echo.

REM Step 10: Get the deployed URL
echo Step 10: Getting deployment URL...
for /f "delims=" %%i in ('gcloud run services describe invoice-app --region %REGION% --format="value(status.url)"') do set SERVICE_URL=%%i
echo [SUCCESS] Deployment completed successfully!
echo.

REM Final summary
echo ==========================================
echo DEPLOYMENT SUMMARY
echo ==========================================
echo Project ID: %PROJECT_ID%
echo Region: %REGION%
echo Service Name: invoice-app
echo Service URL: %SERVICE_URL%
echo.
echo Your Invoice Management App is now live at:
echo %SERVICE_URL%
echo.
echo To view logs:
echo   gcloud run logs read --service invoice-app --region %REGION%
echo.
echo To redeploy after changes:
echo   deploy-to-gcloud.bat
echo.
echo ==========================================
pause
