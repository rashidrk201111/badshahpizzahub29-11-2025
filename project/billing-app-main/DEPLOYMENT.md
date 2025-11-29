# Google Cloud Deployment Guide

This guide will help you deploy your Invoice Management App to Google Cloud.

## Prerequisites

1. **Google Cloud Account** - [Sign up here](https://cloud.google.com/)
2. **gcloud CLI** - [Install here](https://cloud.google.com/sdk/docs/install)
3. **Docker** (optional, for local testing)

## Option 1: Deploy with Cloud Run (Recommended)

Cloud Run is the easiest and most cost-effective option for this app.

### Step 1: Set up Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create YOUR-PROJECT-ID --name="Invoice App"

# Set the project
gcloud config set project YOUR-PROJECT-ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### Step 2: Build and Deploy

```bash
# Build the Docker image
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/invoice-app

# Deploy to Cloud Run
gcloud run deploy invoice-app \
  --image gcr.io/YOUR-PROJECT-ID/invoice-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Step 3: Add Environment Variables

After deployment, add your Supabase credentials:

```bash
gcloud run services update invoice-app \
  --region us-central1 \
  --update-env-vars VITE_SUPABASE_URL=your-supabase-url \
  --update-env-vars VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Important:** Get your Supabase URL and Anon Key from your `.env` file.

### Step 4: Access Your App

After deployment completes, you'll see a URL like:
```
https://invoice-app-xxxxxxxxxx-uc.a.run.app
```

Visit this URL to access your deployed app!

## Option 2: Deploy with App Engine

App Engine is another option with automatic scaling.

### Deploy Steps

```bash
# Build the app
npm run build

# Deploy to App Engine
gcloud app deploy app.yaml

# View your app
gcloud app browse
```

## Option 3: Continuous Deployment with Cloud Build

Set up automatic deployments from your Git repository.

### Step 1: Connect Repository

```bash
# Create a trigger
gcloud builds triggers create github \
  --repo-name=YOUR-REPO-NAME \
  --repo-owner=YOUR-GITHUB-USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

Now every push to the `main` branch will automatically deploy!

## Cost Optimization

Cloud Run Free Tier includes:
- 2 million requests per month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

Your app will likely stay within the free tier for small to medium usage.

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify Docker builds locally: `docker build -t test .`

### Environment Variables Not Working
- Remember: Vite requires `VITE_` prefix for client-side variables
- Rebuild after changing environment variables

### App Not Loading
- Check logs: `gcloud run logs read --service=invoice-app`
- Verify Supabase credentials are correct

## Custom Domain

To use your own domain:

```bash
gcloud run domain-mappings create \
  --service invoice-app \
  --domain yourdomain.com \
  --region us-central1
```

Then update your DNS records as instructed.

## Support

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [App Engine Documentation](https://cloud.google.com/appengine/docs)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
