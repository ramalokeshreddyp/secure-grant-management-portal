'use strict';

const { Grant, User, Application, Role } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * GrantService - Business logic for grant management
 */
class GrantService {
  /**
   * Create a new grant (GRANTOR only)
   * @param {object} data - { title, description, amount, deadline, status }
   * @param {string} grantorId - The logged-in grantor's user ID
   * @returns {object} Created grant
   */
  async createGrant({ title, description, amount, deadline, status }, grantorId) {
    const grant = await Grant.create({
      title,
      description,
      amount,
      deadline: deadline || null,
      status: status || 'open',
      grantor_id: grantorId,
    });

    logger.info(`Grant created: ${grant.id} by grantor ${grantorId}`);

    return this.getGrantById(grant.id);
  }

  /**
   * List all grants
   * @param {object} filters - Optional filters (status, etc.)
   * @returns {Array} List of grants with grantor info
   */
  async listGrants(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;

    return Grant.findAll({
      where,
      include: [
        {
          model: User,
          as: 'grantor',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Get a single grant by ID
   * @param {string} grantId
   * @returns {object} Grant with grantor info
   */
  async getGrantById(grantId) {
    const grant = await Grant.findByPk(grantId, {
      include: [
        {
          model: User,
          as: 'grantor',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!grant) {
      throw ApiError.notFound('Grant not found.');
    }

    return grant;
  }

  /**
   * Update a grant (only by the owning GRANTOR)
   * @param {string} grantId
   * @param {object} data - Fields to update
   * @param {string} requestingUserId - The user making the request
   * @returns {object} Updated grant
   */
  async updateGrant(grantId, data, requestingUserId) {
    const grant = await Grant.findByPk(grantId);

    if (!grant) {
      throw ApiError.notFound('Grant not found.');
    }

    // Ownership check
    if (grant.grantor_id !== requestingUserId) {
      throw ApiError.forbidden('You do not have permission to update this grant. Only the grant owner can update it.');
    }

    const allowedFields = ['title', 'description', 'amount', 'deadline', 'status'];
    const updateData = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    await grant.update(updateData);

    logger.info(`Grant updated: ${grantId} by ${requestingUserId}`);

    return this.getGrantById(grantId);
  }

  /**
   * Delete a grant (only the owner GRANTOR or ADMIN)
   * @param {string} grantId
   * @param {string} requestingUserId
   * @param {Array} requestingUserRoles
   */
  async deleteGrant(grantId, requestingUserId, requestingUserRoles) {
    const grant = await Grant.findByPk(grantId);

    if (!grant) {
      throw ApiError.notFound('Grant not found.');
    }

    const isAdmin = requestingUserRoles.includes('ADMIN');
    const isOwner = grant.grantor_id === requestingUserId;

    if (!isAdmin && !isOwner) {
      throw ApiError.forbidden('You do not have permission to delete this grant.');
    }

    await grant.destroy();
    logger.info(`Grant deleted: ${grantId} by ${requestingUserId}`);

    return { message: 'Grant deleted successfully.' };
  }

  /**
   * Get all applications for a grant (GRANTOR who owns the grant only)
   * @param {string} grantId
   * @param {string} requestingUserId
   * @returns {Array} Applications
   */
  async getGrantApplications(grantId, requestingUserId) {
    const grant = await Grant.findByPk(grantId);

    if (!grant) {
      throw ApiError.notFound('Grant not found.');
    }

    // Ownership check
    if (grant.grantor_id !== requestingUserId) {
      throw ApiError.forbidden('You do not have permission to view applications for this grant.');
    }

    return Application.findAll({
      where: { grant_id: grantId },
      include: [
        {
          model: User,
          as: 'grantee',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }
}

module.exports = new GrantService();
