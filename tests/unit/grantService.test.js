'use strict';

/**
 * Unit tests for GrantService
 */

const { createMockGrant, createMockApplication } = require('../helpers');

jest.mock('../../src/models', () => ({
  Grant: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  User: {},
  Application: {
    findAll: jest.fn(),
  },
  Role: {},
  UserRole: {},
}));

const GrantService = require('../../src/services/GrantService');
const { Grant, Application } = require('../../src/models');

describe('GrantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGrant', () => {
    it('should create a grant and return it', async () => {
      const mockGrant = createMockGrant();
      Grant.create.mockResolvedValue(mockGrant);
      Grant.findByPk.mockResolvedValue(mockGrant);

      const data = {
        title: 'Test Grant',
        description: 'A test grant',
        amount: 10000,
      };

      const result = await GrantService.createGrant(data, 'grantor-id');
      expect(Grant.create).toHaveBeenCalled();
      expect(result).toEqual(mockGrant);
    });
  });

  describe('listGrants', () => {
    it('should return all grants', async () => {
      const grants = [createMockGrant(), createMockGrant({ id: 'grant-2' })];
      Grant.findAll.mockResolvedValue(grants);

      const result = await GrantService.listGrants();
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      Grant.findAll.mockResolvedValue([]);
      await GrantService.listGrants({ status: 'open' });
      expect(Grant.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'open' } })
      );
    });

    it('should not include status in where if not provided', async () => {
      Grant.findAll.mockResolvedValue([]);
      await GrantService.listGrants({});
      expect(Grant.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });
  });

  describe('getGrantById', () => {
    it('should return a grant by ID', async () => {
      const mockGrant = createMockGrant();
      Grant.findByPk.mockResolvedValue(mockGrant);

      const result = await GrantService.getGrantById('grant-uuid-1234');
      expect(result).toEqual(mockGrant);
    });

    it('should throw 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      await expect(GrantService.getGrantById('non-existent')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('updateGrant', () => {
    it('should throw 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      await expect(
        GrantService.updateGrant('non-existent', { title: 'New' }, 'user-id')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if user is not the owner', async () => {
      const mockGrant = createMockGrant({ grantor_id: 'other-grantor' });
      Grant.findByPk.mockResolvedValue(mockGrant);

      await expect(
        GrantService.updateGrant('grant-id', { title: 'New' }, 'requesting-user-id')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should update grant if user is the owner', async () => {
      const grantorId = 'grantor-uuid-1234';
      const mockGrant = createMockGrant({ grantor_id: grantorId });
      mockGrant.update = jest.fn().mockResolvedValue(true);
      Grant.findByPk
        .mockResolvedValueOnce(mockGrant)  // first call for ownership check
        .mockResolvedValueOnce({ ...mockGrant, title: 'Updated Title' }); // second call for getGrantById

      const result = await GrantService.updateGrant('grant-uuid-1234', { title: 'Updated Title' }, grantorId);
      expect(mockGrant.update).toHaveBeenCalled();
    });
  });

  describe('deleteGrant', () => {
    it('should throw 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      await expect(
        GrantService.deleteGrant('non-existent', 'user-id', ['GRANTOR'])
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if not owner and not admin', async () => {
      const mockGrant = createMockGrant({ grantor_id: 'other-user' });
      Grant.findByPk.mockResolvedValue(mockGrant);

      await expect(
        GrantService.deleteGrant('grant-id', 'requesting-user', ['GRANTOR'])
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should allow deletion by owner GRANTOR', async () => {
      const ownerId = 'owner-grantor-id';
      const mockGrant = createMockGrant({ grantor_id: ownerId });
      Grant.findByPk.mockResolvedValue(mockGrant);

      const result = await GrantService.deleteGrant('grant-id', ownerId, ['GRANTOR']);
      expect(mockGrant.destroy).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('should allow deletion by ADMIN', async () => {
      const mockGrant = createMockGrant({ grantor_id: 'other-grantor' });
      Grant.findByPk.mockResolvedValue(mockGrant);

      const result = await GrantService.deleteGrant('grant-id', 'admin-user-id', ['ADMIN']);
      expect(mockGrant.destroy).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });
  });

  describe('getGrantApplications', () => {
    it('should throw 404 if grant not found', async () => {
      Grant.findByPk.mockResolvedValue(null);

      await expect(
        GrantService.getGrantApplications('non-existent', 'user-id')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 if requesting user is not the grant owner', async () => {
      const mockGrant = createMockGrant({ grantor_id: 'other-grantor' });
      Grant.findByPk.mockResolvedValue(mockGrant);

      await expect(
        GrantService.getGrantApplications('grant-id', 'another-user')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should return applications for the grant owner', async () => {
      const grantorId = 'grantor-uuid-1234';
      const mockGrant = createMockGrant({ grantor_id: grantorId });
      Grant.findByPk.mockResolvedValue(mockGrant);

      const apps = [createMockApplication(), createMockApplication({ id: 'app-2' })];
      Application.findAll.mockResolvedValue(apps);

      const result = await GrantService.getGrantApplications('grant-id', grantorId);
      expect(result).toHaveLength(2);
    });
  });
});
