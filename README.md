# Club App (Demo)

This is a small demo showing user registration with OTP mobile verification, login with JWT, and a static frontend.

Quick start

1. Copy `.env.example` to `.env` and adjust `MONGO_URI` and `JWT_SECRET`.
2. Install dependencies:

   npm install

3. Start the server:

   npm run start

The server serves the static files in the project root. Open `http://localhost:4000/testing.html` to use the demo UI.

Notes

- OTPs are printed to the server console in this demo. To send real SMS, integrate an SMS provider (Twilio, etc.) where the server logs the OTP.
- Passwords are stored hashed using bcrypt.
- This is a demo and should not be used in production without further hardening (rate limiting, secure cookie handling, TLS, input validation, etc.).
