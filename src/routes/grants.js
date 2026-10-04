'use strict';

const router = require('express').Router();
const GrantController = require('../controllers/GrantController');
const ApplicationController = require('../controllers/ApplicationController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route POST /api/grants
 * @desc Create a new grant
 * @access GRANTOR only
 */
router.post(
  '/',
  authenticate,
  authorize('GRANTOR'),
  GrantController.createGrantValidation,
  GrantController.createGrant
);

/**
 * @route GET /api/grants
 * @desc List all grants
 * @access Any authenticated user (GRANTEE, GRANTOR, ADMIN)
 */
router.get(
  '/',
  authenticate,
  authorize('GRANTEE', 'GRANTOR', 'ADMIN'),
  GrantController.listGrants
);

/**
 * @route GET /api/grants/:grantId
 * @desc Get a single grant
 * @access Any authenticated user (GRANTEE, GRANTOR, ADMIN)
 */
router.get(
  '/:grantId',
  authenticate,
  authorize('GRANTEE', 'GRANTOR', 'ADMIN'),
  GrantController.getGrant
);

/**
 * @route PUT /api/grants/:grantId
 * @desc Update a grant (only the owning GRANTOR)
 * @access GRANTOR only
 */
router.put(
  '/:grantId',
  authenticate,
  authorize('GRANTOR'),
  GrantController.updateGrantValidation,
  GrantController.updateGrant
);

/**
 * @route DELETE /api/grants/:grantId
 * @desc Delete a grant (owning GRANTOR or ADMIN)
 * @access GRANTOR or ADMIN
 */
router.delete(
  '/:grantId',
  authenticate,
  authorize('GRANTOR', 'ADMIN'),
  GrantController.deleteGrant
);

/**
 * @route POST /api/grants/:grantId/apply
 * @desc Apply for a grant
 * @access GRANTEE only
 */
router.post(
  '/:grantId/apply',
  authenticate,
  authorize('GRANTEE'),
  ApplicationController.applyValidation,
  ApplicationController.applyForGrant
);

/**
 * @route GET /api/grants/:grantId/applications
 * @desc Get applications for a grant (owning GRANTOR only)
 * @access GRANTOR only
 */
router.get(
  '/:grantId/applications',
  authenticate,
  authorize('GRANTOR'),
  GrantController.getGrantApplications
);

module.exports = router;
