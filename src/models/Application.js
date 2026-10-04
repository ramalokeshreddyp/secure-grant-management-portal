'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/database');

const Application = sequelize.define('Application', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  grant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'grants',
      key: 'id',
    },
  },
  grantee_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  proposal: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [10, 50000],
    },
  },
  status: {
    type: DataTypes.ENUM('submitted', 'under_review', 'approved', 'rejected'),
    defaultValue: 'submitted',
    validate: {
      isIn: [['submitted', 'under_review', 'approved', 'rejected']],
    },
  },
  reviewer_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'applications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['grant_id', 'grantee_id'] },
  ],
});

module.exports = Application;
