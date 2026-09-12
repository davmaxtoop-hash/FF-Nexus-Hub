FF NEXUS HUB — RAILWAY-READY PROJECT

Files:
- index.html: public website
- admin.html: admin dashboard
- style.css: responsive gaming UI
- script.js: frontend interactions and API calls
- server.js: Express backend, Neon DB, JWT auth and Paystack integration
- railway.json: Railway start/health configuration
- .env.example: required environment variables
- assets/: future/static assets

SERVER CONFIGURATION
--------------------
Required Railway environment variables:
- DATABASE_URL = Neon PostgreSQL connection string
- JWT_SECRET = long random secret
- ADMIN_PASSWORD = private admin password
- PAYSTACK_SECRET_KEY = Paystack secret key
- PAYSTACK_PUBLIC_KEY = Paystack public key
- APP_URL = deployed HTTPS URL
- LISTING_FEE_NGN = server-enforced creator/vendor listing fee (default 10000)

Optional:
- PORT = Railway normally supplies this automatically

ADMIN AUTH
----------
The admin password is never stored in script.js. Admin login returns a short-lived server JWT and protected admin API routes require that token.

PAYSTACK
--------
Creator and Vendor listing payments are initialized and verified on the server. The amount is controlled by LISTING_FEE_NGN on the server, so a visitor cannot lower the fee by editing browser JavaScript or localStorage. Keep PAYSTACK_SECRET_KEY private and never commit it to GitHub.

DATABASE
--------
On startup the server creates the required player, stats, notification, listing application, and tournament registration tables if they do not exist. /api/health returns healthy only after database initialization succeeds.

RAILWAY
-------
Start command: npm start
Health check: /api/health
The Express 5 wildcard route uses the supported /{*splat} syntax.

IMPORTANT ARCHITECTURE NOTE
---------------------------
Player accounts, player stats, applications, payments and tournament registrations are stored in Neon. Visual admin content/settings (news, creator/vendor cards, tournaments, payment methods and site settings) are also persisted to the Neon `site_content` table. Browser localStorage is used only as a local working cache. The public site reads the shared database copy, so content survives browser changes and server restarts when DATABASE_URL points to a persistent Neon database.

The admin frontend now queues content saves to avoid concurrent PUT requests overwriting one another. It also avoids the old behavior where an old browser cache could overwrite newer database content at admin login. If an edit is made while the admin JWT has expired or the database is unavailable, the browser marks the content as unsynced and retries the local copy after the next successful admin login.

SECURITY NOTES
--------------
- Never commit a real .env file.
- Never expose PAYSTACK_SECRET_KEY.
- Use a strong random JWT_SECRET.
- Change the default LISTING_FEE_NGN if your actual business fee is different.
- The project is a Free Fire community concept and is not affiliated with Garena.


MAX SHOP ROUTES
- Public introduction: /max-shop/
- Actual shop: /max-shop/store/
- MAX SHOP admin: /max-shop/secure-portal-7k4m/ by default
- There is no public Admin link/button on the Nexus Hub or MAX SHOP pages.
- The old /max-shop/admin/ and admin HTML URLs return 404.
- Admin still requires MAXSHOP_ADMIN_PASSWORD plus JWT_SECRET.
- Optional Railway variable MAXSHOP_ADMIN_PATH can replace "secure-portal-7k4m" with your own path segment.
