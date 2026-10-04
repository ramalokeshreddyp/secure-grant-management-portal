'use strict';

/**
 * Full End-to-End (E2E) Integration Flow Test
 * 
 * Simulates complete real-world scenarios:
 * 1. Admin Login & Authentication
 * 2. User Registration (Default GRANTEE)
 * 3. Admin elevates User to GRANTOR role
 * 4. GRANTOR creates a Grant Opportunity
 * 5. GRANTEE discovers Grant and submits a Proposal
 * 6. GRANTOR inspects applications and approves Proposal
 * 7. GRANTEE verifies updated status
 * 8. Security/RBAC violation checks across unauthorized actors
 * 9. Logout & Token Invalidation check
 */

// Mock database connection
jest.mock('../../src/db/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
  },
  connectDB: jest.fn().mockResolvedValue(true),
}));

// In-memory data store for full E2E simulation (prefixed with mock for Jest)
const mockDb = {
  users: new Map(),
  roles: new Map(),
  userRoles: new Map(),
  grants: new Map(),
  applications: new Map(),
};

// Initialize seed roles
const ROLE_ADMIN = { id: '00000000-0000-4000-8000-000000000001', name: 'ADMIN' };
const ROLE_GRANTOR = { id: '00000000-0000-4000-8000-000000000002', name: 'GRANTOR' };
const ROLE_GRANTEE = { id: '00000000-0000-4000-8000-000000000003', name: 'GRANTEE' };

mockDb.roles.set('ADMIN', ROLE_ADMIN);
mockDb.roles.set('GRANTOR', ROLE_GRANTOR);
mockDb.roles.set('GRANTEE', ROLE_GRANTEE);

const bcrypt = require('bcryptjs');

// Mock Sequelize models backed by the in-memory mockDb store
jest.mock('../../src/models', () => {
  const { v4: uuidv4 } = require('uuid');

  const User = {
    scope: jest.fn().mockReturnValue({
      findOne: jest.fn(async ({ where }) => {
        for (const user of mockDb.users.values()) {
          if (user.email === where.email) {
            const userRoles = mockDb.userRoles.get(user.id) || [];
            return {
              ...user,
              roles: userRoles.map((rId) => Array.from(mockDb.roles.values()).find((r) => r.id === rId)),
              verifyPassword: async (pwd) => require('bcryptjs').compare(pwd, user.password_hash),
            };
          }
        }
        return null;
      }),
    }),
    findOne: jest.fn(async ({ where }) => {
      for (const user of mockDb.users.values()) {
        if (where.email && user.email === where.email) return user;
      }
      return null;
    }),
    findByPk: jest.fn(async (id) => {
      const user = mockDb.users.get(id);
      if (!user) return null;
      const userRoles = mockDb.userRoles.get(id) || [];
      return {
        ...user,
        roles: userRoles.map((rId) => Array.from(mockDb.roles.values()).find((r) => r.id === rId)),
        update: async (data) => Object.assign(user, data),
      };
    }),
    create: jest.fn(async (data) => {
      const id = data.id || uuidv4();
      const record = { id, ...data, is_active: true, created_at: new Date().toISOString() };
      mockDb.users.set(id, record);
      return record;
    }),
    hashPassword: async (pwd) => require('bcryptjs').hash(pwd, 10),
  };

  const Role = {
    findOne: jest.fn(async ({ where }) => mockDb.roles.get(where.name) || null),
  };

  const UserRole = {
    create: jest.fn(async ({ user_id, role_id }) => {
      const roles = mockDb.userRoles.get(user_id) || [];
      if (!roles.includes(role_id)) roles.push(role_id);
      mockDb.userRoles.set(user_id, roles);
      return { user_id, role_id };
    }),
    findOne: jest.fn(async ({ where }) => {
      const roles = mockDb.userRoles.get(where.user_id) || [];
      return roles.includes(where.role_id) ? { user_id: where.user_id, role_id: where.role_id } : null;
    }),
    destroy: jest.fn(async ({ where }) => {
      const roles = mockDb.userRoles.get(where.user_id) || [];
      const idx = roles.indexOf(where.role_id);
      if (idx !== -1) {
        roles.splice(idx, 1);
        mockDb.userRoles.set(where.user_id, roles);
        return 1;
      }
      return 0;
    }),
  };

  const Grant = {
    create: jest.fn(async (data) => {
      const id = data.id || uuidv4();
      const record = {
        id,
        ...data,
        status: data.status || 'open',
        created_at: new Date().toISOString(),
        update: async function (u) { Object.assign(this, u); mockDb.grants.set(id, this); return this; },
        destroy: async function () { mockDb.grants.delete(id); return true; },
      };
      mockDb.grants.set(id, record);
      return record;
    }),
    findByPk: jest.fn(async (id) => mockDb.grants.get(id) || null),
    findAll: jest.fn(async () => Array.from(mockDb.grants.values())),
  };

  const Application = {
    create: jest.fn(async (data) => {
      const id = data.id || uuidv4();
      const record = {
        id,
        ...data,
        status: data.status || 'submitted',
        created_at: new Date().toISOString(),
        update: async function (u) { Object.assign(this, u); mockDb.applications.set(id, this); return this; },
      };
      mockDb.applications.set(id, record);
      return record;
    }),
    findOne: jest.fn(async ({ where }) => {
      for (const app of mockDb.applications.values()) {
        if (app.grant_id === where.grant_id && app.grantee_id === where.grantee_id) return app;
      }
      return null;
    }),
    findByPk: jest.fn(async (id) => {
      const app = mockDb.applications.get(id);
      if (!app) return null;
      const grant = mockDb.grants.get(app.grant_id);
      const grantee = mockDb.users.get(app.grantee_id);
      return {
        ...app,
        grant,
        grantee,
        update: async function (u) { Object.assign(app, u); return this; },
      };
    }),
    findAll: jest.fn(async ({ where }) => {
      const results = [];
      for (const app of mockDb.applications.values()) {
        if (where.grant_id && app.grant_id === where.grant_id) results.push(app);
        else if (where.grantee_id && app.grantee_id === where.grantee_id) results.push(app);
      }
      return results;
    }),
  };

  return { User, Role, UserRole, Grant, Application };
});

const request = require('supertest');
const app = require('../../src/app');

describe('Full End-to-End (E2E) Portal Lifecycle', () => {
  let adminToken;
  let grantorToken;
  let granteeToken;
  let unauthorizedGrantorToken;
  let grantorUserId;
  let granteeUserId;
  let unauthorizedGrantorUserId;
  let createdGrantId;
  let createdAppId;

  beforeAll(async () => {
    // Seed default admin in memory store
    const adminId = '11111111-1111-4000-8000-111111111111';
    const adminHash = await bcrypt.hash('Admin@123456', 10);
    mockDb.users.set(adminId, {
      id: adminId,
      name: 'System Administrator',
      email: 'admin@grantportal.com',
      password_hash: adminHash,
      is_active: true,
    });
    mockDb.userRoles.set(adminId, [ROLE_ADMIN.id]);
  });

  // Step 1: Login as Admin
  it('Step 1: Admin should login successfully and receive a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@grantportal.com', password: 'Admin@123456' })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.roles).toContain('ADMIN');
    adminToken = res.body.accessToken;
  });

  // Step 2: Register Organization User (Default GRANTEE)
  it('Step 2: Should register a new user (Future Grantor)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Tech Foundation',
        email: 'foundation@grantorg.org',
        password: 'Password123!',
      })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.email).toBe('foundation@grantorg.org');
    grantorUserId = res.body.data.id;
  });

  // Step 3: Admin assigns GRANTOR role
  it('Step 3: Admin should elevate the user to GRANTOR role', async () => {
    const res = await request(app)
      .post(`/api/users/${grantorUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleName: 'GRANTOR' })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.message).toContain('GRANTOR');
  });

  // Step 4: Login as newly elevated GRANTOR
  it('Step 4: Elevated user logs in and obtains GRANTOR JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'foundation@grantorg.org', password: 'Password123!' })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.user.roles).toContain('GRANTOR');
    grantorToken = res.body.accessToken;
  });

  // Step 5: GRANTOR creates a Grant Opportunity
  it('Step 5: GRANTOR creates a new funding opportunity', async () => {
    const res = await request(app)
      .post('/api/grants')
      .set('Authorization', `Bearer ${grantorToken}`)
      .send({
        title: 'Open Source AI Innovation Grant 2026',
        description: 'Funding developer projects creating impactful open source AI tooling.',
        amount: 75000.00,
        deadline: '2026-12-31T23:59:59Z',
        status: 'open',
      })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.title).toBe('Open Source AI Innovation Grant 2026');
    createdGrantId = res.body.data.id;
  });

  // Step 6: Register Applicant (GRANTEE)
  it('Step 6: Register an applicant user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Developer',
        email: 'alice@devstudio.io',
        password: 'Password123!',
      })
      .expect(201);

    expect(res.body.status).toBe('success');
    granteeUserId = res.body.data.id;

    // Login as GRANTEE
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@devstudio.io', password: 'Password123!' })
      .expect(200);

    granteeToken = loginRes.body.accessToken;
    expect(loginRes.body.user.roles).toContain('GRANTEE');
  });

  // Step 7: GRANTEE browses grants and submits Proposal
  it('Step 7: GRANTEE views available grants and submits application', async () => {
    // 7.1 Browse grants
    const listRes = await request(app)
      .get('/api/grants')
      .set('Authorization', `Bearer ${granteeToken}`)
      .expect(200);

    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // 7.2 Submit proposal
    const applyRes = await request(app)
      .post(`/api/grants/${createdGrantId}/apply`)
      .set('Authorization', `Bearer ${granteeToken}`)
      .send({
        proposal: 'We plan to build a decentralized neural network model index and benchmarking suite.',
      })
      .expect(201);

    expect(applyRes.body.status).toBe('success');
    expect(applyRes.body.data.status).toBe('submitted');
    createdAppId = applyRes.body.data.id;
  });

  // Step 8: Security Check - Duplicate submission blocked
  it('Step 8: Security - Duplicate application attempt should return 409 Conflict', async () => {
    await request(app)
      .post(`/api/grants/${createdGrantId}/apply`)
      .set('Authorization', `Bearer ${granteeToken}`)
      .send({
        proposal: 'Second attempt with modified proposal...',
      })
      .expect(409);
  });

  // Step 9: GRANTOR reviews submissions and updates status to 'approved'
  it('Step 9: GRANTOR reviews submissions and updates application status', async () => {
    // 9.1 View submissions for owned grant
    const appsRes = await request(app)
      .get(`/api/grants/${createdGrantId}/applications`)
      .set('Authorization', `Bearer ${grantorToken}`)
      .expect(200);

    expect(appsRes.body.data.length).toBeGreaterThanOrEqual(1);

    // 9.2 Update status to approved
    const patchRes = await request(app)
      .patch(`/api/applications/${createdAppId}/status`)
      .set('Authorization', `Bearer ${grantorToken}`)
      .send({
        status: 'approved',
        reviewer_notes: 'Exceptional proposal with clear open-source milestones.',
      })
      .expect(200);

    expect(patchRes.body.status).toBe('success');
    expect(patchRes.body.data.status).toBe('approved');
  });

  // Step 10: GRANTEE tracks application status
  it('Step 10: GRANTEE checks own application status and sees approval', async () => {
    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${granteeToken}`)
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].status).toBe('approved');
  });

  // Step 11: Security & RBAC Isolation Checks
  describe('Step 11: Security & RBAC Isolation Verification', () => {
    beforeAll(async () => {
      // Register a second Grantor (Unauthorized for Grant X)
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Other Grantor',
          email: 'bob@otherfoundation.org',
          password: 'Password123!',
        });
      unauthorizedGrantorUserId = res.body.data.id;

      await request(app)
        .post(`/api/users/${unauthorizedGrantorUserId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleName: 'GRANTOR' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bob@otherfoundation.org', password: 'Password123!' });

      unauthorizedGrantorToken = loginRes.body.accessToken;
    });

    it('Unauthorized GRANTOR cannot edit another GRANTOR\'s grant', async () => {
      await request(app)
        .put(`/api/grants/${createdGrantId}`)
        .set('Authorization', `Bearer ${unauthorizedGrantorToken}`)
        .send({ title: 'Hijacked Title' })
        .expect(403);
    });

    it('Unauthorized GRANTOR cannot view applications for another GRANTOR\'s grant', async () => {
      await request(app)
        .get(`/api/grants/${createdGrantId}/applications`)
        .set('Authorization', `Bearer ${unauthorizedGrantorToken}`)
        .expect(403);
    });

    it('GRANTEE cannot create grants (403 Forbidden)', async () => {
      await request(app)
        .post('/api/grants')
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ title: 'Illegal Grant', description: 'desc', amount: 1000 })
        .expect(403);
    });

    it('Non-admin cannot assign roles (403 Forbidden)', async () => {
      await request(app)
        .post(`/api/users/${granteeUserId}/roles`)
        .set('Authorization', `Bearer ${granteeToken}`)
        .send({ roleName: 'ADMIN' })
        .expect(403);
    });

    it('Unauthenticated requests are rejected with 401 Unauthorized', async () => {
      await request(app).get('/api/grants').expect(401);
      await request(app).post('/api/grants').send({}).expect(401);
      await request(app).get('/api/users').expect(401);
    });
  });

  // Step 12: Logout & Token Blacklist Invalidation
  it('Step 12: Logout blacklists token and subsequent calls with it return 401', async () => {
    // Logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${granteeToken}`)
      .expect(200);

    // Try using the logged out token
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${granteeToken}`)
      .expect(401);
  });
});
