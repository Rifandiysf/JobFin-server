# JobFin Server

REST API backend for **JobFin** (Job Tracker), an app for recording and tracking job applications, with authentication, a dashboard summary, and cached travel routes to company locations.

## Features

- **JWT authentication**: register and log in with email and password (hashed with `bcryptjs`)
- **Google login**: OAuth 2.0 via Passport (`passport-google-oauth20`)
- **Forgot and reset password**: reset tokens are stored in the database and the link is sent by email through [Resend](https://resend.com)
- **Job application CRUD**: create, read, update, and delete applications
- **User settings**: manage profile and account preferences
- **Dashboard summary**: statistics overview of your applications
- **OSRM route caching**: route data is stored in the `job_applications` table so the frontend doesn't need to recalculate it

## Tech Stack

| Category | Technology |
| --- | --- |
| Runtime | Node.js (ES Modules) |
| Framework | Express 5 |
| ORM | Prisma |
| Database | MySQL |
| Auth | JSON Web Token, bcryptjs, Passport Google OAuth 2.0 |
| Email | Resend |
| Other | cors, dotenv, nodemon |

## Project Structure

```
JobFin-server/
├── prisma/              # Prisma schema, migrations, and seed
├── src/
│   ├── app.mjs          # Express setup (middleware & routes)
│   ├── routes/          # Endpoint definitions
│   ├── controllers/     # Request/response handlers
│   ├── services/        # Business logic
│   └── models/          # Prisma queries
├── .env.example         # Example environment variables
├── prisma.config.ts     # Prisma configuration
├── server.mjs           # Server entry point
└── package.json
```

The architecture follows a layered MVC pattern: **routes → controllers → services → models**.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- MySQL 8 (or a compatible MariaDB)
- A [Google Cloud Console](https://console.cloud.google.com/) account for an OAuth Client ID
- A [Resend](https://resend.com) account for sending email

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Rifandiysf/JobFin-server.git
   cd JobFin-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Then fill in the values using the table below.

4. **Create the MySQL database**

   ```sql
   CREATE DATABASE job_tracker;
   ```

5. **Generate the Prisma Client and run migrations**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. *(Optional)* **Seed initial data**

   ```bash
   npm run prisma:seed
   ```

7. **Start the server**

   ```bash
   npm run dev
   ```

   The server runs at `http://localhost:5000` (or whatever `PORT` is set to).

## Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | MySQL connection string | `mysql://user:password@localhost:3306/job_tracker` |
| `JWT_SECRET` | Secret used to sign JWTs (use a long, random string) | — |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | Server port | `5000` |
| `FRONTEND_URL` | Frontend URL (used for CORS and redirects) | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Client ID from Google Cloud Console | — |
| `GOOGLE_CLIENT_SECRET` | Client Secret from Google Cloud Console | — |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect URI | `http://localhost:5000/api/v1/auth/google/callback` |
| `RESEND_API_KEY` | Resend API key | `re_xxxxxxxx` |
| `EMAIL_FROM` | Sender address for emails | `Job Tracker <onboarding@resend.dev>` |
| `RESET_PASSWORD_URL` | Reset password page on the frontend | `http://localhost:3000/reset-password` |

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

### Google OAuth Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create an **OAuth client ID** of type *Web application*.
3. Add your `GOOGLE_CALLBACK_URL` to the **Authorized redirect URIs**.
4. Copy the Client ID and Client Secret into your `.env` file.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the server with hot reload (nodemon) |
| `npm run prisma:generate` | Generate the Prisma Client |
| `npm run prisma:migrate` | Run database migrations (dev) |
| `npm run prisma:studio` | Open Prisma Studio to browse data |
| `npm run prisma:seed` | Run the seeder |

For production, start the server with `node server.mjs`.

## Database Schema

| Table | Description |
| --- | --- |
| `users` | User accounts (email/password or Google) |
| `job_applications` | Job applications, including OSRM route cache fields |
| `password_reset_tokens` | Tokens for the forgot password flow |

## API

Base URL: `http://localhost:5000/api/v1`

Endpoints that require authentication use this header:

```
Authorization: Bearer <token>
```

## API Endpoints Used

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Log in with email and password |
| `GET` | `/auth/google` | Start Google OAuth flow |
| `GET` | `/users/me` | Get the current user's profile |
| `PUT` | `/users/me/home-address` | Update home address |
| `PUT` | `/users/me/theme` | Update theme preference |
| `PUT` | `/users/me/change-password` | Change password |
| `GET` | `/jobs` | List applications (`page`, `limit`, `status`, `search`) |
| `POST` | `/jobs` | Create an application |
| `GET` | `/jobs/:id` | Get an application |
| `PUT` | `/jobs/:id` | Update an application |
| `DELETE` | `/jobs/:id` | Delete an application |
| `GET` | `/dashboard/summary` | Totals, status breakdown, average distance, monthly trend |

## Forgot Password Flow

1. The user submits their email to the *forgot password* endpoint.
2. The server generates a token and stores it in `password_reset_tokens`.
3. An email containing the link `RESET_PASSWORD_URL?token=...` is sent through Resend.
4. The user sets a new password through the *reset password* endpoint using that token.

## License

[ISC](https://opensource.org/licenses/ISC) © Rifandi Yusuf
