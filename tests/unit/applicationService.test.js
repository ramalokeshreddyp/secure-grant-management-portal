'use strict';

/**
 * Unit tests for ApplicationService
 */

const { createMockApplication, createMockGrant, createMockUser } = require('../helpers');

jest.mock('../../src/models', () => ({
  Application: {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  Grant: {
    findByPk: jest.fn(),
  },
  User: {},
  Role: {},
  UserRole: {},
}));

const ApplicationService = require('../../src/services/ApplicationService');
const { Application, Grant } = require('../../src/models');

describe('ApplicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitApplication', () => {
    it('should throw 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      await expect(
        ApplicationService.submitApplication('grant-id', 'grantee-id', 'proposal text')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if grant is not open', async () => {
      Grant.findByPk.mockResolvedValue(createMockGrant({ status: 'closed' }));

      await expect(
        ApplicationService.submitApplication('grant-id', 'grantee-id', 'proposal text')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 409 if already applied', async () => {
      Grant.findByPk.mockResolvedValue(createMockGrant({ status: 'open' }));
      Application.findOne.mockResolvedValue(createMockApplication());

      await expect(
        ApplicationService.submitApplication('grant-id', 'grantee-id', 'proposal text')
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should create application successfully', async () => {
      Grant.findByPk.mockResolvedValue(createMockGrant({ status: 'open' }));
      Application.findOne.mockResolvedValue(null);

      const newApp = createMockApplication();
      Application.create.mockResolvedValue(newApp);
      Application.findByPk.mockResolvedValue(newApp);

      const result = await ApplicationService.submitApplication(
        'grant-uuid-1234',
        'grantee-uuid-1234',
        'My detailed proposal for this grant'
      );

      expect(Application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grant_id: 'grant-uuid-1234',
          grantee_id: 'grantee-uuid-1234',
          status: 'submitted',
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('getApplicationById', () => {
    it('should throw 404 if application not found', async () => {
      Application.findByPk.mockResolvedValue(null);

      await expect(
        ApplicationService.getApplicationById('non-existent', 'user-id', ['GRANTEE'])
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should allow grantee who submitted it to view', async () => {
      const granteeId = 'grantee-uuid-1234';
      const mockApp = createMockApplication({ grantee_id: granteeId });
      Application.findByPk.mockResolvedValue(mockApp);

      const result = await ApplicationService.getApplicationById('app-id', granteeId, ['GRANTEE']);
      expect(result).toEqual(mockApp);
    });

    it('should allow grantor of the parent grant to view', async () => {
      const grantorId = 'grantor-uuid-1234';
      const mockApp = createMockApplication();
      mockApp.grant.grantor_id = grantorId;
      Application.findByPk.mockResolvedValue(mockApp);

      const result = await ApplicationService.getApplicationById('app-id', grantorId, ['GRANTOR']);
      expect(result).toEqual(mockApp);
    });

    it('should allow ADMIN to view any application', async () => {
      const mockApp = createMockApplication();
      Application.findByPk.mockResolvedValue(mockApp);

      const result = await ApplicationService.getApplicationById('app-id', 'admin-user-id', ['ADMIN']);
      expect(result).toEqual(mockApp);
    });

    it('should throw 403 if user is not grantee, grantor, or admin', async () => {
      const mockApp = createMockApplication({
        grantee_id: 'grantee-uuid-1234',
      });
      mockApp.grant.grantor_id = 'grantor-uuid-1234';
      Application.findByPk.mockResolvedValue(mockApp);

      await expect(
        ApplicationService.getApplicationById('app-id', 'random-user', ['GRANTEE'])
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('listMyApplications', () => {
    it('should return applications for the grantee', async () => {
      const apps = [createMockApplication(), createMockApplication({ id: 'app-2' })];
      Application.findAll.mockResolvedValue(apps);

      const result = await ApplicationService.listMyApplications('grantee-id');
      expect(result).toHaveLength(2);
      expect(Application.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { grantee_id: 'grantee-id' } })
      );
    });
  });

  describe('updateApplicationStatus', () => {
    it('should throw 404 if application not found', async () => {
      Application.findByPk.mockResolvedValue(null);

      await expect(
        ApplicationService.updateApplicationStatus('app-id', 'approved', 'user-id')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if not the grant owner', async () => {
      const mockApp = createMockApplication();
      mockApp.grant.grantor_id = 'actual-grantor-id';
      Application.findByPk.mockResolvedValue(mockApp);

      await expect(
        ApplicationService.updateApplicationStatus('app-id', 'approved', 'other-user')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 400 if status is invalid', async () => {
      const mockApp = createMockApplication();
      mockApp.grant.grantor_id = 'grantor-uuid-1234';
      Application.findByPk.mockResolvedValue(mockApp);

      await expect(
        ApplicationService.updateApplicationStatus('app-id', 'invalid_status', 'grantor-uuid-1234')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should update status successfully', async () => {
      const grantorId = 'grantor-uuid-1234';
      const mockApp = createMockApplication();
      mockApp.grant.grantor_id = grantorId;
      Application.findByPk
        .mockResolvedValueOnce(mockApp)
        .mockResolvedValueOnce({ ...mockApp, status: 'approved' });

      const result = await ApplicationService.updateApplicationStatus(
        'app-id', 'approved', grantorId, 'Approved!'
      );
      expect(mockApp.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      );
    });
  });
});
