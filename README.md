# Secure Grant Management Portal

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://docs.docker.com/compose/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A secure, multi-user **Grant Management Portal** implementing:
- **Role-Based Access Control (RBAC)** with three roles: `ADMIN`, `GRANTOR`, `GRANTEE`
- **OAuth 2.0** authentication via GitHub and Google
- **JWT-based** local authentication
- **MVC architecture** with service layer
- **Docker Compose** orchestration of app + PostgreSQL + Redis

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Role Permissions Matrix](#role-permissions-matrix)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)

---

## Features

- 🔐 **Local auth** (email/password + bcrypt) with JWT issuance
- 🔑 **OAuth 2.0** with GitHub and Google providers
- 🛡️ **RBAC middleware** — role-checked endpoints returning proper 401/403
- 🎫 **Token blacklisting** in Redis for secure logout
- 📊 **PostgreSQL** database with Sequelize ORM
- ⚡ **Redis** caching for sessions and token blacklisting
- 🐳 **Dockerized** — single `docker-compose up` start
- 🧪 **Test suite** with ≥70% coverage (Jest + Supertest)
- 🔒 **Security** — Helmet headers, CORS, rate limiting

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Docker Compose                  │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   app    │  │    db    │  │  cache   │  │
│  │ Node.js  │──│ Postgres │  │  Redis   │  │
│  │ :3000    │  │  :5432   │  │  :6379   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
         │
    MVC Pattern
         │
  ┌──────┴──────┐
  │  Routes     │  ← Express Router
  ├─────────────┤
  │ Controllers │  ← HTTP Request/Response
  ├─────────────┤
  │  Services   │  ← Business Logic
  ├─────────────┤
  │   Models    │  ← Sequelize ORM
  └─────────────┘
```

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd secure-grant-management-portal
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values (especially OAuth credentials). The defaults work out of the box for local development without OAuth.

### 3. Start with Docker Compose

```bash
docker-compose up --build
```

This single command will:
1. Build the Node.js application image
2. Start PostgreSQL and wait for it to be healthy
3. Start Redis and wait for it to be healthy
4. Run the database initialization (creates tables + seeds roles + admin user)
5. Start the API server on port 3000

### 4. Verify the Application is Running

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "grant-portal-api",
  "timestamp": "...",
  "uptime": 5.2,
  "environment": "production"
}
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (`development`/`production`) | Yes |
| `PORT` | API server port | Yes (default: 3000) |
| `DATABASE_URL` | Full PostgreSQL connection URL | Yes |
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PORT` | PostgreSQL port | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_USER` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `JWT_SECRET` | Secret for signing JWTs | Yes |
| `JWT_EXPIRES_IN` | JWT expiry (e.g., `1h`) | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Yes |
| `REDIS_URL` | Redis connection URL | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | For GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | For GitHub OAuth |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL | For GitHub OAuth |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | For Google OAuth |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | For Google OAuth |
| `ADMIN_EMAIL` | Default admin email | Yes (seed) |
| `ADMIN_PASSWORD` | Default admin password | Yes (seed) |

---

## API Documentation

**Base URL:** `http://localhost:3000/api`

**Authentication:** Include the JWT in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/register` | Register new user | No |
| `POST` | `/auth/login` | Login (email/password) | No |
| `GET` | `/auth/github` | GitHub OAuth redirect | No |
| `GET` | `/auth/github/callback` | GitHub OAuth callback | No |
| `GET` | `/auth/google` | Google OAuth redirect | No |
| `GET` | `/auth/google/callback` | Google OAuth callback | No |
| `POST` | `/auth/logout` | Logout + blacklist token | Yes |
| `GET` | `/auth/me` | Get current user profile | Yes |

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123"
}
```

Response `201`:
```json
{
  "status": "success",
  "data": { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com" }
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@grantportal.com", "password": "Admin@123456" }
```

Response `200`:
```json
{
  "status": "success",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "email": "...", "roles": ["ADMIN"] }
}
```

### User Management (Admin Only)

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| `GET` | `/users` | List all users | ADMIN |
| `GET` | `/users/:userId` | Get user by ID | ADMIN |
| `POST` | `/users/:userId/roles` | Assign role to user | ADMIN |
| `DELETE` | `/users/:userId/roles/:roleName` | Remove role | ADMIN |
| `PATCH` | `/users/:userId/deactivate` | Deactivate user | ADMIN |

#### Assign Role
```bash
POST /api/users/{userId}/roles
Authorization: Bearer <admin-token>

{ "roleName": "GRANTOR" }
```

### Grant Management

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| `POST` | `/grants` | Create grant | GRANTOR |
| `GET` | `/grants` | List all grants | Any authenticated |
| `GET` | `/grants/:id` | Get single grant | Any authenticated |
| `PUT` | `/grants/:id` | Update grant | GRANTOR (owner only) |
| `DELETE` | `/grants/:id` | Delete grant | GRANTOR (owner) or ADMIN |
| `POST` | `/grants/:id/apply` | Apply for grant | GRANTEE |
| `GET` | `/grants/:id/applications` | View applications | GRANTOR (owner only) |

#### Create Grant
```bash
POST /api/grants
Authorization: Bearer <grantor-token>

{
  "title": "AI Research Grant 2026",
  "description": "Funding for cutting-edge AI research.",
  "amount": 100000,
  "deadline": "2026-12-31T00:00:00Z",
  "status": "open"
}
```

### Application Management

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| `GET` | `/applications/my` | Get my applications | GRANTEE |
| `GET` | `/applications/:id` | Get single application | GRANTEE (own) or GRANTOR (grant owner) or ADMIN |
| `PATCH` | `/applications/:id/status` | Update status | GRANTOR (grant owner) |

#### Apply for Grant
```bash
POST /api/grants/{grantId}/apply
Authorization: Bearer <grantee-token>

{ "proposal": "Our organization proposes to..." }
```

---

## Role Permissions Matrix

| Endpoint | ADMIN | GRANTOR | GRANTEE |
|----------|-------|---------|---------|
| Register/Login | ✅ | ✅ | ✅ |
| GET /users | ✅ | ❌ | ❌ |
| POST /users/:id/roles | ✅ | ❌ | ❌ |
| POST /grants | ❌ | ✅ | ❌ |
| GET /grants | ✅ | ✅ | ✅ |
| GET /grants/:id | ✅ | ✅ | ✅ |
| PUT /grants/:id | ❌ | ✅ (owner) | ❌ |
| DELETE /grants/:id | ✅ | ✅ (owner) | ❌ |
| POST /grants/:id/apply | ❌ | ❌ | ✅ |
| GET /grants/:id/applications | ❌ | ✅ (owner) | ❌ |
| GET /applications/my | ❌ | ❌ | ✅ |
| GET /applications/:id | ✅ | ✅ (grant owner) | ✅ (own) |
| PATCH /applications/:id/status | ❌ | ✅ (grant owner) | ❌ |

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage Report
```bash
npm run test:coverage
```

The coverage report will be generated in the `coverage/` directory.  
View the HTML report: `coverage/lcov-report/index.html`

### Run Tests in Watch Mode
```bash
npm run test:watch
```

---

## Project Structure

```
secure-grant-management-portal/
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Service orchestration
├── .env.example                  # Environment variable documentation
├── package.json                  # Dependencies and scripts
├── PROJECT_PLAN.md               # Agile planning document
├── README.md                     # This file
│
├── src/
│   ├── app.js                    # Express application setup
│   ├── server.js                 # Server entry point
│   │
│   ├── db/
│   │   ├── database.js           # Sequelize connection
│   │   ├── init.sql              # Schema + seed SQL (auto-runs in Docker)
│   │   └── seed.js               # Programmatic seed script
│   │
│   ├── models/                   # Sequelize models (M in MVC)
│   │   ├── index.js              # Model associations
│   │   ├── User.js
│   │   ├── Role.js
│   │   ├── UserRole.js
│   │   ├── Grant.js
│   │   └── Application.js
│   │
│   ├── services/                 # Business logic layer
│   │   ├── AuthService.js        # Auth + OAuth logic
│   │   ├── UserService.js        # User management
│   │   ├── GrantService.js       # Grant CRUD + ownership
│   │   └── ApplicationService.js # Application submission + status
│   │
│   ├── controllers/              # HTTP handlers (C in MVC)
│   │   ├── AuthController.js
│   │   ├── UserController.js
│   │   ├── GrantController.js
│   │   └── ApplicationController.js
│   │
│   ├── routes/                   # Express route definitions
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── grants.js
│   │   └── applications.js
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.js               # authenticate + authorize (RBAC)
│   │   └── errorHandler.js       # Global error + validation handlers
│   │
│   └── utils/                    # Utility modules
│       ├── jwt.js                # JWT generation + verification
│       ├── redis.js              # Redis client + caching
│       ├── logger.js             # Winston logger
│       └── ApiError.js           # Custom error class
│
└── tests/
    ├── setup.js                  # Jest configuration + Redis mock
    ├── helpers.js                # Test utilities + mock factories
    │
    ├── unit/
    │   ├── jwt.test.js
    │   ├── apiError.test.js
    │   ├── auth.middleware.test.js
    │   ├── authService.test.js
    │   ├── grantService.test.js
    │   └── applicationService.test.js
    │
    └── integration/
        ├── general.test.js       # Health check, 404, security headers
        ├── auth.test.js          # Registration, login, OAuth, logout
        ├── grants.test.js        # Grant CRUD + RBAC enforcement
        └── users.test.js         # Admin user management
```

---

## Default Seed Data

After `docker-compose up`, the database is seeded with:

| Type | Value |
|------|-------|
| **Admin Email** | `admin@grantportal.com` |
| **Admin Password** | `Admin@123456` |
| **Roles** | `ADMIN`, `GRANTOR`, `GRANTEE` |

> ⚠️ **Change the default admin password** before deploying to production!

---

## OAuth 2.0 Setup

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Set **Authorization callback URL** to `http://localhost:3000/api/auth/github/callback`
4. Copy the **Client ID** and **Client Secret** to `.env`

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** / **OAuth 2.0**
4. Create **OAuth 2.0 Client ID** credentials (Web Application)
5. Set **Authorized redirect URIs** to `http://localhost:3000/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** to `.env`

---

## Security Considerations

- Passwords are hashed with **bcrypt** (cost factor 12)
- JWTs are signed with **HS256** and include issuer/audience validation
- Tokens can be **blacklisted** (revoked) via Redis on logout
- **Helmet** adds security headers (XSS protection, HSTS, etc.)
- **Rate limiting** prevents brute-force attacks (100 req/15min)
- **Input validation** via express-validator on all routes
- Environment variables store all secrets (never in code)

---

## License

MIT © Grant Portal Dev
