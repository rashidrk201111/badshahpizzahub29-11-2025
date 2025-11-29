# 🚀 Quick Deploy Guide - Google Cloud

Follow these steps to deploy your Invoice Management App to Google Cloud in 10-15 minutes.

---

## ✅ Step 1: Install Google Cloud CLI

### Windows:
1. Download installer: https://cloud.google.com/sdk/docs/install
2. Run `GoogleCloudSDKInstaller.exe`
3. Follow installation wizard
4. **Important:** Check "Run gcloud init after installation"
5. Close and reopen your terminal/Command Prompt

### Mac:
```bash
brew install google-cloud-sdk
```

### Linux:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Verify Installation:
```bash
gcloud --version
```
You should see version information.

---

## ✅ Step 2: Copy Project to Your Local Machine

Make sure you have all project files including:
- `Dockerfile`
- `nginx.conf`
- `app.yaml`
- `.env` file with Supabase credentials
- `deploy-to-gcloud.sh` (Mac/Linux) or `deploy-to-gcloud.bat` (Windows)
- All source files in `src/` folder

---

## ✅ Step 3: Open Terminal in Project Folder

Navigate to your project directory:

**Windows (Command Prompt):**
```bash
cd C:\path\to\your\invoice-app
```

**Mac/Linux:**
```bash
cd /path/to/your/invoice-app
```

**Tip:** You can also right-click the folder and select "Open in Terminal" (Mac/Linux) or "Open in Command Prompt" (Windows)

---

## ✅ Step 4: Run Automated Deployment Script

### Mac/Linux:
```bash
chmod +x deploy-to-gcloud.sh
./deploy-to-gcloud.sh
```

### Windows:
```bash
deploy-to-gcloud.bat
```

---

## 📋 What the Script Will Ask You:

### 1. **Login to Google Cloud**
- Browser window will open
- Select your Google account
- Click "Allow" to grant permissions

### 2. **Enter Project ID**
```
Enter your Google Cloud Project ID: invoice-app-2025
```
- Use a unique name (letters, numbers, hyphens only)
- Example: `invoice-app-2025`, `my-invoice-system`, `business-invoices`

### 3. **Enable Billing**
- You'll be prompted to enable billing
- Go to: https://console.cloud.google.com/billing
- Link your billing account (required even for free tier)
- **Don't worry:** Small apps stay within free tier limits

### 4. **Choose Region**
```
Enter deployment region (default: us-central1):
```
Common regions:
- `us-central1` (Iowa, USA)
- `us-east1` (South Carolina, USA)
- `europe-west1` (Belgium)
- `asia-southeast1` (Singapore)

Just press Enter for default `us-central1`

---

## ⏱️ Deployment Timeline:

1. ✅ Checking CLI installation - **10 seconds**
2. ✅ Authentication - **30 seconds**
3. ✅ Project setup - **20 seconds**
4. ✅ Enabling APIs - **60 seconds**
5. ✅ Local build test - **30 seconds**
6. ✅ Building Docker image - **3-5 minutes** ⏳
7. ✅ Deploying to Cloud Run - **1-2 minutes** ⏳
8. ✅ Configuring environment - **20 seconds**

**Total Time: 5-10 minutes**

---

## 🎉 Success! What You'll Get:

At the end, you'll see:

```
==========================================
DEPLOYMENT SUMMARY
==========================================
Project ID: invoice-app-2025
Region: us-central1
Service Name: invoice-app
Service URL: https://invoice-app-xxxxxxxxxx-uc.a.run.app

Your Invoice Management App is now live at:
https://invoice-app-xxxxxxxxxx-uc.a.run.app
==========================================
```

**Copy and visit your URL!** 🎊

---

## 🧪 Test Your Deployed App:

1. Open the URL in your browser
2. You should see the login page
3. Create a new admin account (if first time)
4. Login and test creating an invoice
5. Check all features work

---

## 🔧 If Something Goes Wrong:

### Problem: "gcloud: command not found"
**Solution:** Google Cloud CLI not installed or terminal needs restart
```bash
# Restart terminal and try:
gcloud --version
```

### Problem: "Billing must be enabled"
**Solution:**
1. Visit: https://console.cloud.google.com/billing
2. Click "Link a billing account"
3. Create free trial account or add payment method
4. Run deployment script again

### Problem: "Permission denied" on script
**Solution (Mac/Linux only):**
```bash
chmod +x deploy-to-gcloud.sh
./deploy-to-gcloud.sh
```

### Problem: Build fails
**Solution:**
```bash
# Test build locally first
npm install
npm run build

# If successful, run deployment again
```

### Problem: "502 Bad Gateway" on deployed URL
**Solution:** Check logs for errors
```bash
gcloud run logs read --service invoice-app --region us-central1
```

Common causes:
- Environment variables not set (re-run step 9 of script)
- Port mismatch (should be 8080)

---

## 📱 After Successful Deployment:

### View Logs:
```bash
gcloud run logs read --service invoice-app --region us-central1 --limit 50
```

### Update After Code Changes:
Simply re-run the deployment script:
```bash
./deploy-to-gcloud.sh    # Mac/Linux
deploy-to-gcloud.bat     # Windows
```

### Check Service Status:
```bash
gcloud run services describe invoice-app --region us-central1
```

### Delete Service (if needed):
```bash
gcloud run services delete invoice-app --region us-central1
```

---

## 💰 Cost Estimate:

**Cloud Run Free Tier (Monthly):**
- ✅ 2 million requests FREE
- ✅ 360,000 GB-seconds memory FREE
- ✅ 180,000 vCPU-seconds FREE

**Your invoice app will be FREE for:**
- Personal use
- Small business (< 100 invoices/day)
- Development/testing

**Typical costs if you exceed free tier:**
- $0.00002400 per request (after 2M requests)
- Very small costs for most businesses

---

## 🔒 Security Notes:

✅ **Already Configured:**
- HTTPS enabled automatically
- Environment variables secured
- Supabase Row Level Security active
- Authentication required for all operations

✅ **Optional Enhancements:**
- Set up custom domain
- Enable Cloud Armor (DDoS protection)
- Add API rate limiting
- Configure backup policies

---

## 📞 Need Help?

### Check Documentation:
- Full guide: `DEPLOY-GUIDE.md`
- Deployment details: `DEPLOYMENT.md`

### Google Cloud Support:
- Documentation: https://cloud.google.com/run/docs
- Support: https://cloud.google.com/support

### Common Commands:
```bash
# List all services
gcloud run services list

# View real-time logs
gcloud run logs tail --service invoice-app --region us-central1

# Get service URL
gcloud run services describe invoice-app --region us-central1 --format 'value(status.url)'

# List all projects
gcloud projects list

# Switch project
gcloud config set project YOUR-PROJECT-ID
```

---

## ✅ Deployment Checklist:

Before running script:
- [ ] Google Cloud CLI installed (`gcloud --version` works)
- [ ] Project files on local machine
- [ ] `.env` file exists with Supabase credentials
- [ ] `npm install` completed
- [ ] In project directory in terminal

After deployment:
- [ ] Got successful deployment message
- [ ] URL is accessible
- [ ] Login page loads
- [ ] Can create admin account
- [ ] Can create and view invoices
- [ ] All features working

---

## 🎯 Quick Command Reference:

```bash
# Start deployment
./deploy-to-gcloud.sh                    # Mac/Linux
deploy-to-gcloud.bat                     # Windows

# View logs
gcloud run logs read --service invoice-app --region us-central1

# Get URL
gcloud run services describe invoice-app --region us-central1 --format 'value(status.url)'

# Update deployment
./deploy-to-gcloud.sh                    # Just run again

# Delete service
gcloud run services delete invoice-app --region us-central1
```

---

## 🚀 You're Ready!

Run the deployment script and your Invoice Management App will be live in about 10 minutes!

```bash
./deploy-to-gcloud.sh    # Mac/Linux
deploy-to-gcloud.bat     # Windows
```

Good luck! 🎉
