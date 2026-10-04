'use strict';

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../db/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255],
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  oauth_provider: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  oauth_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['oauth_provider', 'oauth_id'], where: { oauth_provider: { [require('sequelize').Op.ne]: null } } },
  ],
  defaultScope: {
    attributes: { exclude: ['password_hash'] },
  },
  scopes: {
    withPassword: {
      attributes: { include: ['password_hash'] },
    },
    active: {
      where: { is_active: true },
    },
  },
});

/**
 * Instance Methods
 */
User.prototype.verifyPassword = async function (password) {
  if (!this.password_hash) return false;
  return bcrypt.compare(password, this.password_hash);
};

User.prototype.toPublicJSON = function () {
  const { password_hash, ...publicData } = this.toJSON();
  return publicData;
};

/**
 * Static Methods
 */
User.hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

module.exports = User;
