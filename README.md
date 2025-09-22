# Pooja Kit — Full Website (Node + Express + SQLite)

This is a ready-to-run full website for **Pooja Kit** (backend + frontend). It includes:

- Node.js + Express backend
- SQLite database (data.sqlite3 created automatically)
- Admin user auto-created:
  - Email: armanhacker900@gmail.com
  - Password: admin-1234
- Formspree integration (server-side) using the Formspree URL provided by you.
- Frontend static files (public/), admin panel at `/admin.html`

## How to run (on your machine)

1. Ensure you have Node.js (>=16) installed.
2. Unzip this project and open a terminal in the project folder.
3. Run:

```bash
npm install
npm start
```

4. Open `http://localhost:3000` in your browser.

## Notes & Next steps (important)

- This project is **production-ready** for local hosting and small deployments, but you should:
  - Replace `JWT_SECRET` with a strong secret (set env var `JWT_SECRET`).
  - Use HTTPS in production and set secure cookie flags.
  - Optionally migrate to a managed database for high traffic.
  - Lock CORS origins to your frontend domain.

- Formspree: the server will attempt to POST order details to the Formspree endpoint so the admin receives email notifications. The Formspree URL is already set to `https://formspree.io/f/mzzvoalo`. If you want to change it, set environment variable `FORMSPREE_URL` or edit `server.js`.

If you want, I can:
- Add email notifications using nodemailer + SMTP.
- Add Razorpay / Stripe payment integration.
- Deploy this to a VPS (DigitalOcean) or to a Platform (Render / Railway) with a deployment script.
