#!/bin/bash

# Google Cloud Deployment Script for Invoice Management App
# This script automates the entire deployment process

set -e  # Exit on any error

echo "=========================================="
echo "Invoice Management App - Google Cloud Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Step 1: Check if gcloud is installed
echo "Step 1: Checking Google Cloud CLI installation..."
if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud CLI is not installed!"
    echo ""
    echo "Please install it first:"
    echo "  Windows: https://cloud.google.com/sdk/docs/install"
    echo "  Mac: brew install google-cloud-sdk"
    echo "  Linux: curl https://sdk.cloud.google.com | bash"
    exit 1
fi
print_success "Google Cloud CLI is installed"
echo ""

# Step 2: Check if user is logged in
echo "Step 2: Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    print_info "You need to login to Google Cloud"
    gcloud auth login
fi
print_success "Authenticated with Google Cloud"
echo ""

# Step 3: Get or create project
echo "Step 3: Setting up Google Cloud Project..."
read -p "Enter your Google Cloud Project ID (e.g., invoice-app-2025): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    print_error "Project ID cannot be empty"
    exit 1
fi

# Check if project exists
if gcloud projects describe "$PROJECT_ID" &> /dev/null; then
    print_info "Project '$PROJECT_ID' already exists"
else
    print_info "Creating new project '$PROJECT_ID'..."
    gcloud projects create "$PROJECT_ID" --name="Invoice Management App"
fi

gcloud config set project "$PROJECT_ID"
print_success "Project set to: $PROJECT_ID"
echo ""

# Step 4: Enable required APIs
echo "Step 4: Enabling required Google Cloud APIs..."
print_info "This may take 30-60 seconds..."
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet
print_success "Required APIs enabled"
echo ""

# Step 5: Check billing
echo "Step 5: Checking billing status..."
print_info "Note: Billing must be enabled to deploy (Free tier available)"
echo "If billing is not enabled, please enable it at:"
echo "https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
read -p "Press Enter when billing is enabled..."
print_success "Billing check completed"
echo ""

# Step 6: Build application locally
echo "Step 6: Testing local build..."
print_info "Running npm run build to verify app builds correctly..."
npm run build
print_success "Local build successful"
echo ""

# Step 7: Build Docker image on Google Cloud
echo "Step 7: Building Docker image on Google Cloud..."
print_info "This will take 3-5 minutes. Please wait..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/invoice-app --quiet
print_success "Docker image built successfully"
echo ""

# Step 8: Deploy to Cloud Run
echo "Step 8: Deploying to Cloud Run..."
read -p "Enter deployment region (default: us-central1): " REGION
REGION=${REGION:-us-central1}

print_info "Deploying to region: $REGION"
gcloud run deploy invoice-app \
  --image gcr.io/$PROJECT_ID/invoice-app \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --quiet

print_success "Application deployed to Cloud Run"
echo ""

# Step 9: Add environment variables
echo "Step 9: Configuring environment variables..."
print_info "Reading Supabase credentials from .env file..."

if [ -f .env ]; then
    SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2)
    SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d '=' -f2)

    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
        gcloud run services update invoice-app \
          --region $REGION \
          --update-env-vars VITE_SUPABASE_URL=$SUPABASE_URL \
          --update-env-vars VITE_SUPABASE_ANON_KEY=$SUPABASE_KEY \
          --quiet
        print_success "Environment variables configured"
    else
        print_error "Could not find Supabase credentials in .env file"
        echo "Please set them manually using:"
        echo "gcloud run services update invoice-app --region $REGION --update-env-vars VITE_SUPABASE_URL=your-url,VITE_SUPABASE_ANON_KEY=your-key"
    fi
else
    print_error ".env file not found"
    echo "Please set environment variables manually"
fi
echo ""

# Step 10: Get the deployed URL
echo "Step 10: Getting deployment URL..."
SERVICE_URL=$(gcloud run services describe invoice-app --region $REGION --format 'value(status.url)')
print_success "Deployment completed successfully!"
echo ""

# Final summary
echo "=========================================="
echo "DEPLOYMENT SUMMARY"
echo "=========================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Name: invoice-app"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Your Invoice Management App is now live at:"
echo -e "${GREEN}$SERVICE_URL${NC}"
echo ""
echo "To view logs:"
echo "  gcloud run logs read --service invoice-app --region $REGION"
echo ""
echo "To redeploy after changes:"
echo "  ./deploy-to-gcloud.sh"
echo ""
echo "=========================================="
