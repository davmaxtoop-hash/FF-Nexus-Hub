FF NEXUS HUB — PLAYER ACCOUNTS + NEON DATABASE

WHAT THIS VERSION ADDS
- Free player account creation and login.
- Player accounts are stored centrally in Neon PostgreSQL, not just in one browser.
- Main website shows the live registered-player count when the server has DATABASE_URL configured.
- Admin Dashboard shows the real player count and a Registered Players table.
- Tournament registration requires a logged-in player account.
- Tournament registrations are stored in Neon and the server checks the configured maximum slots.
- Player account creation is free. Creator/Vendor paid listing flow remains unchanged.

REQUIRED HOST ENVIRONMENT VARIABLES
DATABASE_URL = your Neon PostgreSQL connection string
JWT_SECRET = a long random secret used to sign player sessions
PORT = usually supplied automatically by the host; optional locally (defaults to 3000)

DEPLOYMENT
This project is now a Node/Express app, not a static-only site.
Start command: npm start
The host must run server.js and provide DATABASE_URL + JWT_SECRET.

NEON
The server automatically creates these tables on startup:
- player_accounts
- tournament_registrations_db
No manual SQL is required for the initial setup.

IMPORTANT
Do not put DATABASE_URL, JWT_SECRET, or other secrets inside index.html or script.js.
The admin login in this demo is still client-side. Before production, replace it with server-side admin authentication and protect /api/admin/players.
