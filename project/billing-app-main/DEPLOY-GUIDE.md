# Complete Google Cloud Deployment Guide

This guide provides everything you need to deploy your Invoice Management App to Google Cloud.

## 🚀 Quick Start (Automated Deployment)

I've created automated deployment scripts for you. Choose based on your operating system:

### For Mac/Linux:
```bash
./deploy-to-gcloud.sh
```

### For Windows:
```bash
deploy-to-gcloud.bat
```

The script will:
1. Check if Google Cloud CLI is installed
2. Authenticate you with Google Cloud
3. Create or select a project
4. Enable required APIs
5. Build your application
6. Deploy to Cloud Run
7. Configure environment variables
8. Give you the live URL

---

## 📋 Prerequisites

### 1. Install Google Cloud CLI

**Windows:**
- Download from: https://cloud.google.com/sdk/docs/install
- Run the installer
- Open new Command Prompt/PowerShell
- Verify: `gcloud --version`

**Mac:**
```bash
brew install google-cloud-sdk
```

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud --version
```

### 2. Google Cloud Account
- Sign up at https://cloud.google.com/
- You get $300 free credits
- Billing must be enabled (but stays within free tier for small apps)

---

## 🔧 Manual Deployment Steps

If you prefer to deploy manually or the script fails:

### Step 1: Login to Google Cloud
```bash
gcloud auth login
```

### Step 2: Create Project
```bash
# Create a new project
gcloud projects create invoice-app-2025 --name="Invoice Management App"

# Set as active project
gcloud config set project invoice-app-2025
```

### Step 3: Enable Required APIs
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 4: Enable Billing
1. Go to: https://console.cloud.google.com/billing
2. Select your project
3. Link billing account

### Step 5: Build Application
```bash
# Test local build first
npm run build

# Build Docker image on Google Cloud
gcloud builds submit --tag gcr.io/invoice-app-2025/invoice-app
```

### Step 6: Deploy to Cloud Run
```bash
gcloud run deploy invoice-app \
  --image gcr.io/invoice-app-2025/invoice-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Step 7: Add Environment Variables
```bash
gcloud run services update invoice-app \
  --region us-central1 \
  --update-env-vars VITE_SUPABASE_URL=https://glqwrljhewvmoordermx.supabase.co \
  --update-env-vars VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdscXdybGpoZXd2bW9vcmRlcm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzY0ODYsImV4cCI6MjA3NTY1MjQ4Nn0.JjQjuiLnTwp2XgSg_J3mqxP5K9CLS0PJcSxH4IArp-0
```

### Step 8: Get Your URL
```bash
gcloud run services describe invoice-app --region us-central1 --format 'value(status.url)'
```

Visit the URL to access your deployed app!

---

## 🔄 Updating Your Deployed App

After making changes to your code:

### Option 1: Use the script (Easy)
```bash
# Mac/Linux
./deploy-to-gcloud.sh

# Windows
deploy-to-gcloud.bat
```

### Option 2: Manual update
```bash
# Rebuild and redeploy
gcloud builds submit --tag gcr.io/invoice-app-2025/invoice-app
gcloud run deploy invoice-app \
  --image gcr.io/invoice-app-2025/invoice-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

---

## 📊 Useful Commands

### View all services
```bash
gcloud run services list
```

### View logs
```bash
gcloud run logs read --service invoice-app --region us-central1 --limit 50
```

### View real-time logs
```bash
gcloud run logs tail --service invoice-app --region us-central1
```

### Check service details
```bash
gcloud run services describe invoice-app --region us-central1
```

### Delete service
```bash
gcloud run services delete invoice-app --region us-central1
```

### List all projects
```bash
gcloud projects list
```

### Switch project
```bash
gcloud config set project YOUR-PROJECT-ID
```

---

## 🌐 Custom Domain Setup

To use your own domain (e.g., myinvoiceapp.com):

### Step 1: Verify domain ownership
```bash
gcloud domains verify myinvoiceapp.com
```

### Step 2: Map domain to service
```bash
gcloud run domain-mappings create \
  --service invoice-app \
  --domain myinvoiceapp.com \
  --region us-central1
```

### Step 3: Update DNS records
Add the DNS records provided by Google Cloud to your domain registrar.

---

## 💰 Cost & Free Tier

### Cloud Run Free Tier (Monthly)
- ✅ 2 million requests
- ✅ 360,000 GB-seconds of memory
- ✅ 180,000 vCPU-seconds
- ✅ 1 GB network egress

**Your invoice app will likely stay completely FREE for:**
- Personal use
- Small business (under 100 invoices/day)
- Development/testing

**You only pay if you exceed free tier limits.**

### Cost Calculator
Estimate costs: https://cloud.google.com/products/calculator

---

## 🛠️ Troubleshooting

### Problem: "gcloud: command not found"
**Solution:** Install Google Cloud CLI (see Prerequisites)

### Problem: "Permission denied"
**Solution:**
```bash
gcloud auth login
gcloud auth application-default login
```

### Problem: "Project not found"
**Solution:**
```bash
gcloud config get-value project
gcloud config set project YOUR-PROJECT-ID
```

### Problem: "Billing must be enabled"
**Solution:**
1. Visit: https://console.cloud.google.com/billing
2. Link billing account to project

### Problem: "502 Bad Gateway" on deployed app
**Solution:**
```bash
# Check logs for errors
gcloud run logs read --service invoice-app --region us-central1

# Common causes:
# 1. Environment variables not set
# 2. Port mismatch (should be 8080)
# 3. Build errors
```

### Problem: Environment variables not working
**Solution:**
```bash
# Verify environment variables
gcloud run services describe invoice-app --region us-central1

# Re-add them
gcloud run services update invoice-app \
  --region us-central1 \
  --update-env-vars VITE_SUPABASE_URL=your-url,VITE_SUPABASE_ANON_KEY=your-key
```

### Problem: Build fails
**Solution:**
```bash
# Test build locally first
npm run build

# Check if all dependencies are installed
npm install

# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Problem: "Resource exhausted" error
**Solution:** You've exceeded free tier limits
```bash
# Check usage at:
https://console.cloud.google.com/run

# Options:
# 1. Wait until next month (limits reset)
# 2. Upgrade to paid tier
# 3. Optimize your app to use fewer resources
```

---

## 🔒 Security Best Practices

### 1. Use Secret Manager for sensitive data (Advanced)
```bash
# Store secrets
echo -n "your-secret-value" | gcloud secrets create my-secret --data-file=-

# Use in Cloud Run
gcloud run services update invoice-app \
  --region us-central1 \
  --set-secrets=SECRET_NAME=my-secret:latest
```

### 2. Enable audit logging
```bash
# View audit logs
gcloud logging read "resource.type=cloud_run_revision"
```

### 3. Set up uptime monitoring
Visit: https://console.cloud.google.com/monitoring

---

## 📚 Additional Resources

- **Cloud Run Documentation:** https://cloud.google.com/run/docs
- **Pricing Details:** https://cloud.google.com/run/pricing
- **Best Practices:** https://cloud.google.com/run/docs/best-practices
- **Quickstarts:** https://cloud.google.com/run/docs/quickstarts
- **Support:** https://cloud.google.com/support

---

## ✅ Deployment Checklist

Before deploying:
- [ ] Google Cloud CLI installed
- [ ] Logged in with `gcloud auth login`
- [ ] Project created and selected
- [ ] Billing enabled on project
- [ ] App builds successfully locally (`npm run build`)
- [ ] `.env` file exists with Supabase credentials

After deploying:
- [ ] Visit deployed URL and test login
- [ ] Check logs for errors
- [ ] Test creating invoice
- [ ] Test all features
- [ ] Set up monitoring (optional)
- [ ] Configure custom domain (optional)

---

## 🎉 Success!

Once deployed, your Invoice Management App will be:
- ✅ Live and accessible worldwide
- ✅ Automatically scaled based on traffic
- ✅ Running on Google's infrastructure
- ✅ HTTPS enabled by default
- ✅ Backed up automatically

**Your deployment URL format:**
```
https://invoice-app-xxxxxxxxxx-uc.a.run.app
```

Enjoy your deployed app! 🚀
