# Project Plan — Secure Grant Management Portal

> **Agile Planning Document**  
> This document outlines the epics, user stories, and acceptance criteria for the Secure Grant Management Portal.

---

## Epics Overview

| # | Epic | Description |
|---|------|-------------|
| 1 | User Authentication | Login/registration via local credentials and OAuth 2.0 |
| 2 | Role Management | Admin assigns/removes roles for users |
| 3 | Grant Management | Grantors create, update, and delete grant opportunities |
| 4 | Application Submission | Grantees apply for grants and track their applications |

---

## Epic 1: User Authentication

### User Story 1.1 — Local Registration

> **As a new user**, I want to register with my email and password so that I can create an account on the portal without needing a third-party login.

#### Acceptance Criteria

- ✓ A `POST /api/auth/register` endpoint is available.
- ✓ The endpoint accepts `name`, `email`, and `password` in the request body.
- ✓ Upon success, a new user account is created in the database with the default `GRANTEE` role.
- ✓ The response returns HTTP `201 Created` with the user's `id`, `name`, and `email` (no password hash exposed).
- ✓ If the email already exists, the API returns `409 Conflict`.
- ✓ Passwords must be at least 8 characters and contain uppercase, lowercase, and a number.

---

### User Story 1.2 — Local Login

> **As a registered user**, I want to log in with my email and password so that I can access the portal and receive a JWT.

#### Acceptance Criteria

- ✓ A `POST /api/auth/login` endpoint is available.
- ✓ On successful authentication, the API returns a JSON object containing `accessToken`.
- ✓ The JWT payload includes `userId` and `roles` array.
- ✓ The token includes `iat` and `exp` claims.
- ✓ If credentials are invalid, the API returns `401 Unauthorized`.
- ✓ The password is verified using bcrypt, never stored in plaintext.

---

### User Story 1.3 — OAuth 2.0 Sign In with GitHub

> **As a new user**, I want to sign in with my GitHub account so that I don't have to remember another password and benefit from GitHub's security.

#### Acceptance Criteria

- ✓ A `GET /api/auth/github` endpoint redirects the user to GitHub's authorization URL.
- ✓ A `GET /api/auth/github/callback` endpoint handles the OAuth 2.0 callback.
- ✓ Clicking "Sign in with GitHub" initiates the OAuth 2.0 Authorization Code Flow.
- ✓ Upon successful authentication, the user's GitHub profile (email, name) is fetched.
- ✓ A new account is created if the user doesn't exist, with the default `GRANTEE` role.
- ✓ The user receives a JWT (`accessToken`) upon successful OAuth login.
- ✓ If GitHub returns an error, the API responds with `400 Bad Request`.

---

### User Story 1.4 — OAuth 2.0 Sign In with Google

> **As a new user**, I want to sign in with my Google account so that I can use my existing Google credentials for convenient access.

#### Acceptance Criteria

- ✓ A `GET /api/auth/google` endpoint redirects to Google's authorization URL.
- ✓ A `GET /api/auth/google/callback` endpoint handles the Google OAuth callback.
- ✓ Upon successful authentication, a JWT is issued.
- ✓ A new user account is created with the `GRANTEE` role if the email is not found.
- ✓ If the user already exists, their account is retrieved and a JWT is issued.

---

### User Story 1.5 — Logout

> **As a logged-in user**, I want to log out so that my session token is invalidated and my account is secure.

#### Acceptance Criteria

- ✓ A `POST /api/auth/logout` endpoint is available (requires authentication).
- ✓ The current JWT is blacklisted in Redis upon logout.
- ✓ After logout, using the old JWT returns `401 Unauthorized`.
- ✓ The response returns HTTP `200 OK` with a success message.

---

## Epic 2: Role Management

### User Story 2.1 — Admin Assigns Role to User

> **As an ADMIN**, I want to assign a `GRANTOR` or other role to a registered user so that they can create and manage grant opportunities.

#### Acceptance Criteria

- ✓ A `POST /api/users/{userId}/roles` endpoint is available.
- ✓ The endpoint requires the `ADMIN` role (JWT with `ADMIN` in the roles array).
- ✓ The request body accepts `{ "roleName": "GRANTOR" }`.
- ✓ On success, the role is stored in the `user_roles` table and a `200 OK` is returned with the updated user object.
- ✓ If the target user doesn't exist, `404 Not Found` is returned.
- ✓ If the role doesn't exist (e.g., `"SUPERUSER"`), `400 Bad Request` is returned.
- ✓ If the user already has the role, `409 Conflict` is returned.
- ✓ Non-ADMIN users receive `403 Forbidden`.

---

### User Story 2.2 — Admin Views All Users

> **As an ADMIN**, I want to view all registered users and their roles so that I can manage access and permissions across the platform.

#### Acceptance Criteria

- ✓ A `GET /api/users` endpoint is available.
- ✓ The endpoint requires the `ADMIN` role.
- ✓ The response includes a list of all users with their assigned roles.
- ✓ Password hashes are never exposed in the response.
- ✓ Non-ADMIN users receive `403 Forbidden`.

---

## Epic 3: Grant Management

### User Story 3.1 — Grantor Creates a Grant

> **As a GRANTOR**, I want to create a new grant opportunity so that eligible organizations can apply for funding.

#### Acceptance Criteria

- ✓ A `POST /api/grants` endpoint is available.
- ✓ Only users with the `GRANTOR` role can create grants.
- ✓ The request body requires `title`, `description`, and `amount`.
- ✓ The grant is automatically associated with the logged-in `GRANTOR` as the owner (`grantor_id`).
- ✓ The response returns HTTP `201 Created` with the full grant object.
- ✓ A `GRANTEE` or `ADMIN` attempting to create a grant receives `403 Forbidden`.
- ✓ Missing required fields return `400 Bad Request`.

---

### User Story 3.2 — Grantor Updates and Deletes Their Grant

> **As a GRANTOR**, I want to update and delete grants I own so that I can keep grant information accurate and remove outdated opportunities.

#### Acceptance Criteria

- ✓ A `PUT /api/grants/{grantId}` endpoint allows the owning GRANTOR to update a grant.
- ✓ A `DELETE /api/grants/{grantId}` endpoint allows the owning GRANTOR or an ADMIN to delete a grant.
- ✓ A GRANTOR who does not own the grant receives `403 Forbidden` on both update and delete.
- ✓ An ADMIN can delete any grant regardless of ownership.
- ✓ If the grant doesn't exist, `404 Not Found` is returned.
- ✓ Successful update returns `200 OK` with the updated grant.
- ✓ Successful deletion returns `200 OK` with a confirmation message.

---

### User Story 3.3 — Grantor Views Applications for Their Grant

> **As a GRANTOR**, I want to view all applications submitted for my grants so that I can review and respond to them.

#### Acceptance Criteria

- ✓ A `GET /api/grants/{grantId}/applications` endpoint is available.
- ✓ Only the GRANTOR who owns the grant can access this endpoint.
- ✓ The response includes a list of applications with grantee details.
- ✓ A different GRANTOR trying to access another GRANTOR's applications receives `403 Forbidden`.
- ✓ A GRANTEE trying to access this endpoint receives `403 Forbidden`.

---

## Epic 4: Application Submission and Management

### User Story 4.1 — Grantee Browses Available Grants

> **As a GRANTEE**, I want to browse available grant opportunities so that I can find grants I'm eligible for and wish to apply to.

#### Acceptance Criteria

- ✓ A `GET /api/grants` endpoint is available to all authenticated users.
- ✓ The response returns an array of grant objects with title, description, amount, and status.
- ✓ Unauthenticated requests return `401 Unauthorized`.
- ✓ The response includes grantor information for each grant.

---

### User Story 4.2 — Grantee Submits a Grant Application

> **As a GRANTEE**, I want to submit a proposal for a grant so that I can apply for funding from available opportunities.

#### Acceptance Criteria

- ✓ A `POST /api/grants/{grantId}/apply` endpoint is available.
- ✓ Only users with the `GRANTEE` role can submit applications.
- ✓ The request body requires a `proposal` text (minimum 10 characters).
- ✓ The grant must be in `open` status; otherwise `400 Bad Request` is returned.
- ✓ A grantee can only submit one application per grant; duplicate attempts return `409 Conflict`.
- ✓ On success, a new application is created with status `submitted` and HTTP `201 Created` is returned.

---

### User Story 4.3 — Grantee Tracks Their Applications

> **As a GRANTEE**, I want to view all my submitted applications and their current statuses so that I can track my progress.

#### Acceptance Criteria

- ✓ A `GET /api/applications/my` endpoint returns all applications submitted by the logged-in GRANTEE.
- ✓ A `GET /api/applications/{appId}` endpoint returns a specific application.
- ✓ Only the GRANTEE who submitted the application can view it (or the GRANTOR of the parent grant, or ADMIN).
- ✓ The response includes grant details and current status.
- ✓ Unauthorized access returns `403 Forbidden`.

---

### User Story 4.4 — Grantor Reviews and Updates Application Status

> **As a GRANTOR**, I want to update the status of applications for my grants so that I can communicate outcomes to applicants.

#### Acceptance Criteria

- ✓ A `PATCH /api/applications/{appId}/status` endpoint is available.
- ✓ Only the GRANTOR who owns the parent grant can update the status.
- ✓ Valid statuses are: `submitted`, `under_review`, `approved`, `rejected`.
- ✓ Invalid status values return `400 Bad Request`.
- ✓ On success, returns `200 OK` with the updated application.
- ✓ Optional `reviewer_notes` field can be included.

---

## Technical Requirements Summary

| Requirement | Implementation |
|------------|----------------|
| Containerization | Docker + Docker Compose (app, db, cache services) |
| Authentication | JWT (access + refresh tokens) |
| OAuth 2.0 | GitHub and Google providers |
| RBAC | Middleware-based role checking (ADMIN, GRANTOR, GRANTEE) |
| Database | PostgreSQL with Sequelize ORM |
| Caching | Redis for token blacklisting and session data |
| Testing | Jest with ≥70% coverage |
| Architecture | MVC pattern (Models, Controllers, Services as views) |
| Security | Helmet, CORS, rate limiting, bcrypt password hashing |
