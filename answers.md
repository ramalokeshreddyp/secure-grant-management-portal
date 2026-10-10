# Technical Questionnaire Responses

**Project**: Secure Grant Management Portal with RBAC and OAuth 2.0  
**Candidate / Developer**: Rama Lokesh Reddy P  
**Repository**: [secure-grant-management-portal](https://github.com/ramalokeshreddyp/secure-grant-management-portal.git)

---

### 1. Describe your implementation of Role-Based Access Control. Did you build it from scratch or use a library? Explain the trade-offs of your approach.

**Implementation Details:**
I built the Role-Based Access Control (RBAC) system **from scratch** using modular Express.js middlewares located in [`src/middleware/auth.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/middleware/auth.js):
- **Authentication Layer (`authenticate`)**:
  1. Extracts the Bearer token from the `Authorization` header.
  2. Queries Redis via `isTokenBlacklisted(token)` in [`src/utils/redis.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/utils/redis.js) to reject revoked tokens immediately.
  3. Verifies token validity and signature using `verifyToken` in [`src/utils/jwt.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/utils/jwt.js).
  4. Attaches the decoded payload (`userId`, `roles`, `email`) directly to `req.user`.
- **Authorization Layer (`authorize(...allowedRoles)`)**:
  Higher-order middleware checking whether `req.user.roles` intersects with the required roles:
  ```javascript
  const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
  if (!hasRole) {
    throw ApiError.forbidden(`Access denied. Required roles: ${allowedRoles.join(', ')}.`);
  }
  ```
- **Fine-Grained Resource Ownership**:
  Role checks are combined with ownership validation in the service layer ([`GrantService.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/services/GrantService.js) and [`ApplicationService.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/services/ApplicationService.js)). For example, while `GRANTOR` has access to modify grants, only the grantor who owns the grant (or an `ADMIN`) can update or delete it.

**Trade-offs of this approach:**
- **Advantages**:
  - **Zero External Engine Dependencies**: Avoids heavy third-party policy engines like Casbin or Oso, keeping container footprint small and build times fast.
  - **Full Architectural Control & Customizability**: Direct, transparent integration with JWT payload caching and Redis token revocation without proxy or adapter overhead.
  - **Simplicity & Auditability**: Minimal cognitive overhead—any developer can inspect [`src/middleware/auth.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/middleware/auth.js) and immediately verify role enforcement rules.
- **Trade-offs / Disadvantages**:
  - **Scalability of Complex Policies**: Does not support dynamic Attribute-Based Access Control (ABAC) or multi-tenant domain rule definitions without modifying application code.
  - **Maintenance Overhead**: Rule changes or complex hierarchy trees must be maintained in the middleware and service layers rather than through an external declarative policy configuration.

---

### 2. What was the most challenging aspect of implementing the OAuth 2.0 flow, and how did you overcome it?

**The Challenge:**
The most challenging aspect was **handling CSRF protection and multi-provider identity reconciliation with existing local accounts while maintaining atomic transactional consistency**:
1. **CSRF State Parameter Security**: OAuth redirects are vulnerable to CSRF and state injection attacks if the `state` parameter is static or predictable.
2. **Provider Data Divergence & Account Collision**: Google returns user profiles with fields `{ sub, email, name }`, whereas GitHub returns `{ id, login, name }` and requires a separate authenticated call to `/user/emails` to retrieve primary verified emails. Furthermore, if a user previously registered via local email/password and later signs in with OAuth using the same email (or vice versa), unhandled flows can create duplicate records or overwrite password hashes.

**How I Overcame It:**
1. **Cryptographic State Caching via Redis**:
   In [`src/services/AuthService.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/services/AuthService.js) (`getOAuthAuthorizationUrl`), I generate a cryptographically random hex token using `crypto.randomBytes(32).toString('hex')` and cache it in Redis with a 10-minute TTL keyed by provider and state. In `handleOAuthCallback`, the incoming state is validated against Redis and deleted upon consumption to prevent replay attacks.
2. **Provider Normalization & Atomic Account Upsert**:
   - Implemented provider-specific adapter logic in `exchangeCodeForUserInfo` to normalize GitHub and Google payloads into a unified profile structure `{ id, email, name, avatarUrl }`.
   - In `handleOAuthCallback`, executed an atomic PostgreSQL transaction with Sequelize:
     - If the user exists by email, safely associates `oauth_provider` and `oauth_id` while preserving local credentials.
     - If the user is new, automatically creates the user record, assigns the default `GRANTEE` role via the `user_roles` join table, and issues a standard JWT payload containing `userId` and `roles`.

---

### 3. How did you structure your application to follow the Model-View-Controller (MVC) pattern? Point to specific directories or files that represent each component.

The project follows a clean, decoupled MVC pattern with an added **Service Layer** for enterprise maintainability:

| MVC Component | Directory / Files | Responsibility & Role |
|---|---|---|
| **Model** | [`src/models/`](file:///c:/Users/lokes/Desktop/Gpp-41/src/models/)<br>• `User.js`<br>• `Role.js`<br>• `UserRole.js`<br>• `Grant.js`<br>• `Application.js`<br>• `index.js` | Defines the database schema, foreign key associations (e.g., Many-to-Many between `User` and `Role` via `UserRole`), data types, validations, default scopes (excluding `password_hash`), and lifecycle hooks (Bcrypt hashing on password creation/update). |
| **Service (Model Logic)** | [`src/services/`](file:///c:/Users/lokes/Desktop/Gpp-41/src/services/)<br>• `AuthService.js`<br>• `UserService.js`<br>• `GrantService.js`<br>• `ApplicationService.js` | Encapsulates core business rules, database queries, transactions, ownership checks, token generation, and third-party API communication. Keeps controllers thin and testable. |
| **View** | Express JSON Serialization Layer & [`src/utils/ApiError.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/utils/ApiError.js) / [`src/middleware/errorHandler.js`](file:///c:/Users/lokes/Desktop/Gpp-41/src/middleware/errorHandler.js) | In this REST API, the "View" is represented by JSON serialization in controllers and the centralized error handling middleware. Formats consistent outgoing responses `{ success: true, data: ... }` and hides internal stack traces in production. Default Sequelize scopes ensure sensitive fields like passwords are never exposed. |
| **Controller** | [`src/controllers/`](file:///c:/Users/lokes/Desktop/Gpp-41/src/controllers/)<br>• `AuthController.js`<br>• `UserController.js`<br>• `GrantController.js`<br>• `ApplicationController.js` | Handles HTTP requests, extracts params/body, delegates operations to corresponding services, and returns appropriate HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`). |
| **Routes & Middleware** | [`src/routes/`](file:///c:/Users/lokes/Desktop/Gpp-41/src/routes/) & [`src/middleware/`](file:///c:/Users/lokes/Desktop/Gpp-41/src/middleware/) | Connects HTTP endpoints to controllers, applying validation middlewares (`express-validator`) and security filters (`authenticate`, `authorize`). |

---

### 4. Explain your testing strategy. How did you ensure that your security-sensitive features (like RBAC and authentication) were adequately tested?

**Testing Strategy Overview:**
The testing strategy employed a pyramid of **Unit Tests**, **API Integration Tests**, and **End-to-End Workflow Tests** utilizing **Jest** and **Supertest**, achieving **77.29% statement coverage** across all files (exceeding the 70% requirement) with **180 passing tests across 13 test suites**.

**Security-Sensitive Feature Verification:**
1. **Authentication Testing ([`tests/integration/auth.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/auth.test.js), [`tests/unit/authService.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/unit/authService.test.js))**:
   - Tested successful registration and default role assignment (`GRANTEE`).
   - Verified rejection of duplicate emails with `409 Conflict`.
   - Verified that password hashing is enforced and raw passwords are never returned in responses.
   - Tested login with valid and invalid credentials (wrong password, non-existent email returning `401`).
   - Verified JWT payload structure containing `userId`, `roles`, `iat`, and `exp`.
   - Tested token revocation: logout endpoint blacklists the token in Redis, and subsequent requests with that token return `401 Unauthorized`.
2. **RBAC & Authorization Matrix Testing ([`tests/unit/auth.middleware.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/unit/auth.middleware.test.js), [`tests/integration/users.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/users.test.js), [`tests/integration/grants.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/grants.test.js))**:
   - **No Token**: Requests to protected routes without `Authorization: Bearer <token>` return `401 Unauthorized`.
   - **Invalid/Malformed Token**: Requests with corrupted or expired tokens return `401 Unauthorized`.
   - **Role Hierarchy Enforcement**:
     - `GRANTEE` attempting `POST /api/grants` returns `403 Forbidden`.
     - `GRANTEE` attempting `POST /api/users/:id/roles` returns `403 Forbidden`.
     - `GRANTOR` attempting `POST /api/grants/:id/apply` returns `403 Forbidden`.
     - `ADMIN` assigning roles (`POST /api/users/:id/roles`) returns `200 OK`.
3. **Resource Ownership Boundary Testing ([`tests/integration/grants.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/grants.test.js), [`tests/integration/applications.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/applications.test.js))**:
   - Tested that `GRANTOR_B` cannot update or delete a grant owned by `GRANTOR_A` (`403 Forbidden`).
   - Tested that `GRANTOR_B` cannot view applications submitted to `GRANTOR_A`'s grant (`403 Forbidden`).
   - Tested that an applicant can view only their own application, while the grant owner can view all submissions for their grant.
4. **End-to-End Portal Lifecycle Test ([`tests/integration/e2e.test.js`](file:///c:/Users/lokes/Desktop/Gpp-41/tests/integration/e2e.test.js))**:
   - Simulates a full production cycle: Admin login -> User registration -> Admin elevation to Grantor -> Grantor creates opportunity -> Grantee submits proposal -> Grantor reviews & approves -> Grantee views status -> Logout and token invalidation verification.

---

### 5. If this portal needed to scale to handle thousands of concurrent users, what are the first two bottlenecks you would anticipate, and how would you address them?

#### Bottleneck 1: Database Read Contention on Public Grants & Application Statuses
- **The Problem**:
  Endpoints like `GET /api/grants` and `GET /api/grants/:id` are read-heavy and accessed concurrently by thousands of grantees and visitors. Under high concurrency, repeated complex SQL queries joining `users`, `grants`, and `applications` will saturate PostgreSQL connection pools, spike database CPU, and increase latency.
- **How I Would Address It**:
  1. **Cache-Aside Pattern with Redis**: Cache active grant lists and grant details in Redis with a short TTL (e.g., 60–300 seconds).
  2. **Event-Driven Cache Invalidation**: Automatically invalidate or update Redis cache entries whenever a grant is created, updated, or deleted in `GrantService`.
  3. **Read Replicas & Connection Pooling**: Implement read-write connection splitting in Sequelize to route `GET` queries to PostgreSQL read replicas and deploy **PgBouncer** to pool and multiplex database connections efficiently.

#### Bottleneck 2: Single-Node Redis Token Blacklisting & JWT Verification Latency
- **The Problem**:
  In our current implementation, every incoming API request performs a synchronous lookup against Redis (`isTokenBlacklisted`) to verify whether the token was revoked during logout. Under thousands of concurrent requests per second, a single-instance Redis node faces network I/O contention, high TCP overhead, and can become a single point of failure (SPOF) for all authenticated endpoints.
- **How I Would Address It**:
  1. **Asymmetric RS256 Tokens with Short Lifespans**:
     Transition from symmetric HS256 to asymmetric RS256 JWTs with very short lifespans (e.g., 5–15 minutes). The API service verifies signatures in-memory using the public key without querying Redis on standard requests.
  2. **Refresh Token Rotation (RTR) Pattern**:
     Store only long-lived refresh tokens in Redis. Revocations and session invalidations only hit Redis during token refresh events, reducing Redis query volume by up to 95%.
  3. **Redis Cluster / Sentinel with Bloom Filters**:
     Deploy Redis Cluster with read replicas for high availability and use an in-memory Bloom Filter at the API gateway layer to rapidly check if a token ID has been revoked before querying Redis.
