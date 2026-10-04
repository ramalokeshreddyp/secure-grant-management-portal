'use strict';

/**
 * Unit tests for ApiError utility
 */

const ApiError = require('../../src/utils/ApiError');

describe('ApiError', () => {
  describe('Constructor', () => {
    it('should create an error with message and status code', () => {
      const error = new ApiError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should default to 500 if no status code provided', () => {
      const error = new ApiError('Test error');
      expect(error.statusCode).toBe(500);
    });

    it('should store errors array', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const error = new ApiError('Validation failed', 400, errors);
      expect(error.errors).toEqual(errors);
    });
  });

  describe('Static factory methods', () => {
    it('badRequest should return 400 error', () => {
      const error = ApiError.badRequest('Bad request');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
    });

    it('badRequest should include errors array', () => {
      const errors = [{ field: 'name', message: 'Required' }];
      const error = ApiError.badRequest('Validation failed', errors);
      expect(error.errors).toEqual(errors);
    });

    it('unauthorized should return 401 error', () => {
      const error = ApiError.unauthorized('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('unauthorized should use default message', () => {
      const error = ApiError.unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('forbidden should return 403 error', () => {
      const error = ApiError.forbidden('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('notFound should return 404 error', () => {
      const error = ApiError.notFound('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
    });

    it('notFound should use default message', () => {
      const error = ApiError.notFound();
      expect(error.message).toBe('Resource not found');
    });

    it('conflict should return 409 error', () => {
      const error = ApiError.conflict('Conflict');
      expect(error.statusCode).toBe(409);
    });

    it('internal should return 500 error', () => {
      const error = ApiError.internal('Internal error');
      expect(error.statusCode).toBe(500);
    });

    it('internal should use default message', () => {
      const error = ApiError.internal();
      expect(error.message).toBe('Internal server error');
    });
  });
});
