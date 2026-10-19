<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d4936cfb-70cb-46d9-94de-d51420f56ef4

## Run locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`.
3. Set `GEMINI_API_KEY` in `.env.local` if you want live Gemini features.
4. Run the app:
   `npm run dev`

## Data and accounts

This standalone version has no Firebase dependency:

- Email registration and login use the included Express server.
- Passwords are stored as salted hashes in the operating system's temporary
  application-data directory.
- Restaurants, menus, and orders are stored in browser `localStorage`.
- Demo Customer, Restaurant Owner, and Admin accounts remain available.

This storage model is suitable for local demonstrations. For a production or
multi-user deployment, replace the temporary user store and browser storage
with a persistent server database and secure server-side sessions.

## Deploy to Vercel

The included `vercel.json` builds the Vite frontend, sends `/api/*` requests to
the Express serverless function, and sends other routes to the React SPA.

1. Import the repository into Vercel.
2. Keep the framework/build settings from the repository; do not override the
   output directory in the dashboard.
3. Add `GEMINI_API_KEY` in **Project Settings → Environment Variables** if live
   AI search/chat is required.
4. Add `GOOGLE_MAPS_API_KEY` or `GOOGLE_MAPS_PLATFORM_KEY` if Google Maps is
   required. Without it, the app uses its existing fallback behavior.
5. Redeploy after changing environment variables.

Important: Vercel Functions do not provide a durable application database.
The current browser-based restaurant/menu/order data works per browser, but
email accounts stored in the server's temporary directory can disappear or
differ between function instances. Use the demo accounts for a deployed demo,
or connect a persistent database before offering real multi-user accounts.
