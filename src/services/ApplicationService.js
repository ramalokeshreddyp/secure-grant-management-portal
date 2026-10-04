'use strict';

const { Application, Grant, User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * ApplicationService - Business logic for grant applications
 */
class ApplicationService {
  /**
   * Submit an application for a grant (GRANTEE only)
   * @param {string} grantId
   * @param {string} granteeId
   * @param {string} proposal
   * @returns {object} Created application
   */
  async submitApplication(grantId, granteeId, proposal) {
    // Check grant exists and is open
    const grant = await Grant.findByPk(grantId);
    if (!grant) {
      throw ApiError.notFound('Grant not found.');
    }

    if (grant.status !== 'open') {
      throw ApiError.badRequest('This grant is not accepting applications.');
    }

    // Check for duplicate application
    const existing = await Application.findOne({
      where: { grant_id: grantId, grantee_id: granteeId },
    });

    if (existing) {
      throw ApiError.conflict('You have already submitted an application for this grant.');
    }

    const application = await Application.create({
      grant_id: grantId,
      grantee_id: granteeId,
      proposal,
      status: 'submitted',
    });

    logger.info(`Application submitted: ${application.id} for grant ${grantId} by grantee ${granteeId}`);

    return this.getApplicationById(application.id, granteeId, null);
  }

  /**
   * Get an application by ID
   * Access restricted to: the grantee who submitted it, or the grantor of the parent grant
   * @param {string} applicationId
   * @param {string} requestingUserId
   * @param {Array|null} requestingUserRoles
   * @returns {object} Application
   */
  async getApplicationById(applicationId, requestingUserId, requestingUserRoles) {
    const application = await Application.findByPk(applicationId, {
      include: [
        {
          model: Grant,
          as: 'grant',
          include: [{ model: User, as: 'grantor', attributes: ['id', 'name', 'email'] }],
        },
        {
          model: User,
          as: 'grantee',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!application) {
      throw ApiError.notFound('Application not found.');
    }

    // Authorization check
    const isGrantee = application.grantee_id === requestingUserId;
    const isGrantor = application.grant && application.grant.grantor_id === requestingUserId;
    const isAdmin = requestingUserRoles && requestingUserRoles.includes('ADMIN');

    if (!isGrantee && !isGrantor && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to view this application.');
    }

    return application;
  }

  /**
   * List all applications submitted by a grantee
   * @param {string} granteeId
   * @returns {Array} Applications
   */
  async listMyApplications(granteeId) {
    return Application.findAll({
      where: { grantee_id: granteeId },
      include: [
        {
          model: Grant,
          as: 'grant',
          attributes: ['id', 'title', 'amount', 'status'],
          include: [{ model: User, as: 'grantor', attributes: ['id', 'name'] }],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Update application status (Grantor of the grant)
   * @param {string} applicationId
   * @param {string} status - New status
   * @param {string} requestingUserId
   * @param {string} reviewerNotes - Optional notes
   * @returns {object} Updated application
   */
  async updateApplicationStatus(applicationId, status, requestingUserId, reviewerNotes) {
    const application = await Application.findByPk(applicationId, {
      include: [{ model: Grant, as: 'grant' }],
    });

    if (!application) {
      throw ApiError.notFound('Application not found.');
    }

    // Only grantor can update status
    if (application.grant.grantor_id !== requestingUserId) {
      throw ApiError.forbidden('Only the grant owner can update application status.');
    }

    const validStatuses = ['submitted', 'under_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    await application.update({
      status,
      reviewer_notes: reviewerNotes || application.reviewer_notes,
    });

    logger.info(`Application ${applicationId} status updated to ${status}`);

    return this.getApplicationById(applicationId, requestingUserId, null);
  }
}

module.exports = new ApplicationService();
