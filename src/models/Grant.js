'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/database');

const Grant = sequelize.define('Grant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 500],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0.01,
      isDecimal: true,
    },
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: true,
    },
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'draft'),
    defaultValue: 'open',
    validate: {
      isIn: [['open', 'closed', 'draft']],
    },
  },
  grantor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'grants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Grant;
