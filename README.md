# 🍽️ SmartMess — Intelligent Campus Mess & Feedback Management System

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-7.1-indigo?style=for-the-badge&logo=prisma)](https://www.prisma.io/)

> **SmartMess** is a modern, campus mess management and dining feedback platform, built specifically for university hostels (Bhawans). It bridges the communication gap between students and mess administration by modernizing daily menu publication, dietary headcount tracking, multi-tier meal ratings, dish-level analytics, and instant critical alerts.

---

## 📌 Table of Contents

- [Features](#-features)
- [Tech Stack Overview](#-tech-stack-overview)
- [Environment Variables Setup](#-environment-variables-setup)
- [Database Setup & Seeding](#-database-setup--seeding)
- [Running Development Servers](#-running-development-servers)
- [API Endpoints Overview](#-api-endpoints-overview)

---

## ✨ Features

### 🎓 Student Experience
- **Live Meal Schedules**: Real-time access to daily and weekly breakfast, lunch, and dinner menus.
- **Multimodal Feedback**: Submit 1-to-5 star ratings with dish-level feedback, comments, and photographic proof.
- **Dietary Choice & Coupons**: Pre-select dietary preferences (`VEG` or `NON-VEG`) for upcoming special meals.
- **Responsive Mobile Portal**: Touch-friendly web app and PWA support tailored for on-the-go student access.

### 👨‍🍳 Mess Staff & Administration
- **Smart Menu Processing**: Upload menu PDFs or photos with Google Gemini AI OCR parsing.
- **Performance Analytics**: Visual rating trends, weekly meal reviews, and student satisfaction breakdown via Chart.js.
- **Critical Alerts Monitor**: Instant highlighting and alerts for dishes rated $\le 2.0$ stars for quality interventions.
- **Upcoming Coupon Headcounts**: Live tally of registered non-veg/special meal coupons to minimize food wastage.
- **Meal Schedule Manager**: Dynamic adjustments of daily timings and menu items with instant student sync.

---

## 💻 Tech Stack Overview

### Frontend
- **Framework**: [Next.js](https://nextjs.org/) (v16 App Router) + [React](https://react.dev/) (v19) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: Vanilla CSS, Modern Theme Tokens (DM Sans & Fraunces Typography), [Tailwind CSS](https://tailwindcss.com/)
- **Icons & UI**: [Remix Icon](https://remixicon.com/), [Framer Motion](https://www.framer.com/motion/), [Lenis](https://lenis.darkroom.engineering/) Smooth Scroll
- **Visualizations**: [Chart.js](https://www.chartjs.org/)
- **PWA**: `@ducanh2912/next-pwa`

### Backend
- **Runtime & Server**: [Node.js](https://nodejs.org/) (v18+) & [Express](https://expressjs.com/) (v5)
- **AI OCR & Vision**: [Google Gen AI SDK](https://ai.google.dev/) (`@google/genai`, `@google/generative-ai`)
- **File & Media Handling**: [Multer](https://github.com/expressjs/multer) & `pdf-parse`
- **Authentication**: [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) & [bcrypt](https://www.npmjs.com/package/bcrypt) password hashing
- **CORS & Utilities**: `cors`, `dotenv`

### Database & ORM
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Compatible with [Neon Serverless Postgres](https://neon.tech/) with SSL connection pooling)
- **ORM**: [Prisma](https://www.prisma.io/) (v7 with `@prisma/adapter-pg` and `@prisma/client`)

---


## 🔐 Environment Variables Setup

Both services use `.env` files for configuration. Sensitive credentials and secrets are excluded from source control via `.gitignore`.

### Backend Configuration (`smartmess-platform/backend/.env`)

Create a `.env` file inside the `smartmess-platform/backend` folder:

```bash
# In smartmess-platform/backend/
touch .env
```

Populate it with the following configuration template:

```env
# Server Port
PORT=5000

# Database Connection (PostgreSQL / Neon)
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?sslmode=require"

# Google Gemini API Key (Required for AI menu image/PDF recognition)
GEMINI_API_KEY="your-google-gemini-api-key-here"

# Google Sheets Webhook (Optional, for contact form synchronization)
GOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/your-webhook-id/exec"
```

> **Security Note:** Replace `<DB_USER>`, `<DB_PASSWORD>`, `<DB_HOST>`, etc., with your actual database credentials. Never commit this file to GitHub.

### Frontend Configuration (`smartmess-platform/frontend/.env.local`)

Create an optional `.env.local` file inside `smartmess-platform/frontend` if customizing the backend API target:

```env
# Backend API Base URL
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

---

## 🗄️ Database Setup & Seeding

Once your `DATABASE_URL` is configured in `smartmess-platform/backend/.env`, synchronize the Prisma database schema and seed the initial hostel Bhawans:

```bash
cd smartmess-platform/backend

# Generate Prisma Client bindings
npx prisma generate

# Push the schema definitions to your PostgreSQL database
npx prisma db push

# Seed default Bhawans into the database
node seed-bhawans.js
```

---

## 💻 Running Development Servers

To run the application locally, start both the backend API server and the frontend Next.js dev server.

### Terminal 1: Backend Server (Port 5000)

```bash
cd smartmess-platform/backend
npm run dev
```
- **Backend API URL**: [http://localhost:5000](http://localhost:5000)
- **Health Check Endpoint**: [http://localhost:5000/api/bhawans](http://localhost:5000/api/bhawans)

### Terminal 2: Frontend Server (Port 3000)

```bash
cd smartmess-platform/frontend
npm run dev
```
- **Frontend App URL**: [http://localhost:3000](http://localhost:3000)
- **Student Dashboard**: [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Staff Admin Dashboard**: [http://localhost:3000/staff-dashboard.html](http://localhost:3000/staff-dashboard.html)

---

## 📡 API Endpoints Overview

The backend exposes RESTful endpoints under `/api`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Student & staff authentication |
| `POST` | `/api/auth/google` | Student Google OAuth verification |
| `GET` | `/api/bhawans` | List all hostel Bhawans |
| `GET` | `/api/menus/bhawan/:bhawanId` | Fetch active weekly menu for a Bhawan |
| `POST` | `/api/menus/upload` | Upload & OCR process weekly menu document |
| `DELETE`| `/api/menus/latest-week/:bhawanId` | Delete latest uploaded menu for a Bhawan |
| `GET` | `/api/feedback/bhawan/:bhawanId` | Retrieve reviews, ratings & feedback trends |
| `POST` | `/api/feedback/rate` | Submit meal ratings and photos |
| `GET` | `/api/feedback/dietary-counts` | Get coupon counts for upcoming special meals |
| `POST` | `/api/contact` | Submit contact grievance or feedback |

---


