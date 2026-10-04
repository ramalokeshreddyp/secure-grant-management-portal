# 🏛️ System Architecture Specification
### Secure Grant Management Portal with RBAC & OAuth 2.0

---

## 1. Executive Summary & Objective

The **Secure Grant Management Portal** is an enterprise-tier web backend designed to govern the entire grant lifecycle—from funding opportunity announcement to application submission, review, and status determination. 

The primary architectural challenge is enforcing strict **Role-Based Access Control (RBAC)** across distinct personas (`ADMIN`, `GRANTOR`, `GRANTEE`) while supporting modern decentralized identity authentication via **OAuth 2.0** and maintaining a zero-trust, stateless token lifecycle backed by **Redis token revocation**.

---

## 2. High-Level Architecture

The system is organized around a multi-tier containerized topology orchestrating presentation, application logic, and storage services.

```mermaid
flowchart TB
    subgraph ClientTier["🌐 Presentation & Client Tier"]
        Browser["User Web Browser"]
        APIClient["REST Client / Mobile App"]
    end

    subgraph EdgeTier["🛡️ Edge & Network Tier"]
        Gateway["Reverse Proxy / Port 3000"]
        RateLimit["Rate Limiter (100 req/15min)"]
        HelmetMW["Helmet Security Headers"]
    end

    subgraph AppTier["⚙️ Core Application Tier (Node.js & Express)"]
        Router["Express Routing Engine"]
        
        subgraph SecurityLayer["Security & Auth Pipeline"]
            JWTValidator["JWT Token Signature Validator"]
            RedisBlacklistCheck["Redis Blacklist Verifier"]
            RBACEnforcer["RBAC Permission Evaluator"]
        end

        subgraph MVCLayers["MVC + Service Layer"]
            Controllers["Controllers (Input Validation & Response Serialization)"]
            Services["Service Layer (Business Domain Logic & Rules)"]
            ORM["Sequelize ORM (Data Access Objects)"]
        end
    end

    subgraph StorageTier["💾 Persistence & Cache Tier"]
        PostgreSQL[("🐘 PostgreSQL 15\nRelational Store\n(ACID Compliant)")]
        RedisCache[("⚡ Redis 7 Alpine\nSession & Invalidation Cache")]
    end

    subgraph ExternalTier["🔑 External Identity Providers"]
        GitHubOAuth["GitHub OAuth 2.0 API"]
        GoogleOAuth["Google Identity API"]
    end

    Browser --> Gateway
    APIClient --> Gateway
    Gateway --> RateLimit --> HelmetMW --> Router
    Router --> SecurityLayer
    SecurityLayer --> RedisBlacklistCheck --> RedisCache
    SecurityLayer --> RBACEnforcer
    RBACEnforcer --> Controllers
    Controllers --> Services
    Services --> ExternalTier
    Services --> ORM
    ORM --> PostgreSQL
```

---

## 3. Database Entity-Relationship Diagram

The relational model implements strict foreign key constraints, cascading deletes on dependent relationships, and unique constraints to prevent duplicate applications or duplicate email registrations.

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "categorized"
    USERS ||--o{ GRANTS : "creates (grantor)"
    GRANTS ||--o{ APPLICATIONS : "receives"
    USERS ||--o{ APPLICATIONS : "submits (grantee)"

    USERS {
        uuid id PK "DEFAULT uuid_generate_v4()"
        string name "Full Name"
        string email UK "Unique normalized email"
        string password_hash "Bcrypt hash (cost 12)"
        string oauth_provider "e.g. github, google"
        string oauth_id "Provider Unique UID"
        string avatar_url "Profile photo"
        boolean is_active "Active account flag"
        timestamp created_at
        timestamp updated_at
    }

    ROLES {
        uuid id PK "DEFAULT uuid_generate_v4()"
        string name UK "ADMIN | GRANTOR | GRANTEE"
        string description "Role purpose"
        timestamp created_at
        timestamp updated_at
    }

    USER_ROLES {
        uuid user_id PK, FK "References USERS(id) ON DELETE CASCADE"
        uuid role_id PK, FK "References ROLES(id) ON DELETE CASCADE"
        timestamp created_at
    }

    GRANTS {
        uuid id PK "DEFAULT uuid_generate_v4()"
        string title "Grant title (3-500 chars)"
        text description "Detailed funding scope"
        decimal amount "Funding allocation (> 0)"
        timestamp deadline "Application closing date"
        string status "open | closed | draft"
        uuid grantor_id FK "References USERS(id) ON DELETE CASCADE"
        timestamp created_at
        timestamp updated_at
    }

    APPLICATIONS {
        uuid id PK "DEFAULT uuid_generate_v4()"
        uuid grant_id FK "References GRANTS(id) ON DELETE CASCADE"
        uuid grantee_id FK "References USERS(id) ON DELETE CASCADE"
        text proposal "Applicant proposal body"
        string status "submitted | under_review | approved | rejected"
        text reviewer_notes "Internal review notes"
        timestamp created_at
        timestamp updated_at
    }
```

---

## 4. Security & Authentication Architecture

### 4.1. The Dual Authentication Strategy
The application accommodates two distinct entry modes:

```mermaid
flowchart LR
    subgraph LocalAuth["Standard Local Auth"]
        Creds["Email + Password"] --> BcryptCheck["Bcrypt Compare (Cost 12)"]
        BcryptCheck --> IssueJWT["Generate Signed JWT"]
    end

    subgraph OAuth2Auth["OAuth 2.0 Server-to-Server Flow"]
        Code["Auth Code (GitHub/Google)"] --> TokenExchange["Exchange Code for Access Token"]
        TokenExchange --> FetchProfile["Fetch Provider Profile & Verified Email"]
        FetchProfile --> UpsertUser["Find / Create User with default GRANTEE"]
        UpsertUser --> IssueJWT
    end

    IssueJWT --> TokenOutput["Token Payload:\n{ userId, roles: [...], iss, aud, exp }"]
```

### 4.2. RBAC Policy Enforcement Pipeline

```mermaid
flowchart TD
    Req["Incoming HTTP Request"] --> HasBearer{"Has 'Bearer <token>' in\nAuthorization Header?"}
    
    HasBearer -- No --> Ret401A["401 Unauthorized\n(Token missing)"]
    HasBearer -- Yes --> ExtractToken["Extract Token String"]
    
    ExtractToken --> CheckRedis{"Is Token in Redis\nBlacklist Cache?"}
    CheckRedis -- Yes --> Ret401B["401 Unauthorized\n(Token revoked/logged out)"]
    CheckRedis -- No --> VerifySig{"Verify JWT Signature\n& Expiration Time"}
    
    VerifySig -- Invalid/Expired --> Ret401C["401 Unauthorized\n(Invalid or expired signature)"]
    VerifySig -- Valid --> AttachUser["Attach req.user = { userId, roles }"]
    
    AttachUser --> HasReqRole{"req.user.roles contains\nRequired Endpoint Role?"}
    HasReqRole -- No --> Ret403["403 Forbidden\n(Insufficient permission)"]
    HasReqRole -- Yes --> NextHandler["Invoke Route Controller Handler"]
```

---

## 5. Architectural Patterns & Decisions

### 5.1. Model-View-Controller (MVC) with Service Layer
To maintain clean code separation and prevent fat controllers:
1. **Controllers** ([`src/controllers`](file:///c:/Users/lokes/Desktop/Gpp-41/src/controllers)):
   - Parse HTTP requests, extract parameters/body, and handle response serialization.
   - Catch exceptions and pass them downstream to the centralized [`errorHandler`](file:///c:/Users/lokes/Desktop/Gpp-41/src/middleware/errorHandler.js).
2. **Services** ([`src/services`](file:///c:/Users/lokes/Desktop/Gpp-41/src/services)):
   - Encapsulate all business rules, authorization ownership checks (e.g., verifying that a grant being updated is owned by the requesting grantor), and external API calls.
3. **Models** ([`src/models`](file:///c:/Users/lokes/Desktop/Gpp-41/src/models)):
   - Define data schemas, constraints, field-level validations, and relational associations via Sequelize.

### 5.2. Caching & Session Invalidation with Redis
Traditional stateless JWTs suffer from the inability to be revoked prior to expiration. This architecture solves this via:
- **Token Blacklisting**: On `POST /api/auth/logout`, the JWT is stored in Redis with a TTL matching the token's remaining lifetime.
- **Fast In-Memory Lookup**: Middleware queries Redis in sub-millisecond time on every authenticated request.

---

## 6. Pros & Cons Analysis

### Advantages (Pros)
- **Zero-Trust Security**: No assumptions on user identity; JWT signature, Redis blacklist, and RBAC roles are validated at the route boundary.
- **True Stateless Horizontal Scalability**: Application instances are completely stateless and can scale behind load balancers; Redis handles shared token state.
- **Clean Domain Isolation**: Business rules in services remain completely independent of the Express HTTP transport layer, making testing straightforward.
- **Reproducible Container Ecosystem**: Multi-stage Docker build ensures development, testing, and production parity with minimal attack surface.

### Trade-offs (Cons)
- **Redis Dependency**: The authentication layer requires Redis connectivity for token blacklist checks. *(Mitigated by graceful fallback handling and connection retry strategies).*
- **Relational Overhead**: Many-to-many role joins require eager or lazy loading queries in Sequelize. *(Mitigated by proper indexing on `user_roles(user_id, role_id)`).*

---

## 7. Scalability & Fault Tolerance

```mermaid
graph LR
    subgraph LoadBalancing["Traffic Balancing"]
        LB["Nginx / AWS ALB"]
    end

    subgraph AppInstances["Stateless App Cluster"]
        App1["App Container 1"]
        App2["App Container 2"]
        App3["App Container N"]
    end

    subgraph StateAndStorage["Shared Data Layer"]
        RedisCluster[("⚡ Redis Primary / Replica")]
        PGCluster[("🐘 PostgreSQL Primary + Read Replicas")]
    end

    LB --> App1
    LB --> App2
    LB --> App3
    App1 & App2 & App3 --> RedisCluster
    App1 & App2 & App3 --> PGCluster
```
