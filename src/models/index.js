'use strict';

/**
 * Models index - sets up all associations and exports all models
 */

const { sequelize } = require('../db/database');
const User = require('./User');
const Role = require('./Role');
const UserRole = require('./UserRole');
const Grant = require('./Grant');
const Application = require('./Application');

// ============================================
// Associations
// ============================================

// User <-> Role (Many-to-Many via UserRole)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id',
  as: 'roles',
});

Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id',
  as: 'users',
});

// Grant -> User (Grantor)
Grant.belongsTo(User, {
  foreignKey: 'grantor_id',
  as: 'grantor',
});

User.hasMany(Grant, {
  foreignKey: 'grantor_id',
  as: 'grants',
});

// Application -> Grant
Application.belongsTo(Grant, {
  foreignKey: 'grant_id',
  as: 'grant',
});

Grant.hasMany(Application, {
  foreignKey: 'grant_id',
  as: 'applications',
});

// Application -> User (Grantee)
Application.belongsTo(User, {
  foreignKey: 'grantee_id',
  as: 'grantee',
});

User.hasMany(Application, {
  foreignKey: 'grantee_id',
  as: 'applications',
});

module.exports = {
  sequelize,
  User,
  Role,
  UserRole,
  Grant,
  Application,
};
