'use strict';

/**
 * Database Seed Script
 * Seeds the database with initial roles and admin user.
 * Run via: node src/db/seed.js or automatically via init.sql on Docker startup.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./database');
const { User, Role, UserRole } = require('../models');
const logger = require('../utils/logger');

const seedRoles = async () => {
  const roles = [
    { name: 'ADMIN', description: 'System administrator with full access' },
    { name: 'GRANTOR', description: 'Can create and manage grant opportunities' },
    { name: 'GRANTEE', description: 'Can view grants and submit applications' },
  ];

  const createdRoles = {};
  for (const role of roles) {
    const [instance] = await Role.findOrCreate({
      where: { name: role.name },
      defaults: role,
    });
    createdRoles[role.name] = instance;
    logger.info(`Role seeded: ${role.name}`);
  }
  return createdRoles;
};

const seedAdminUser = async (roles) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@grantportal.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const [adminUser, created] = await User.findOrCreate({
    where: { email: adminEmail },
    defaults: {
      name: adminName,
      email: adminEmail,
      password_hash: passwordHash,
      is_active: true,
    },
  });

  if (created) {
    logger.info(`Admin user created: ${adminEmail}`);
  } else {
    logger.info(`Admin user already exists: ${adminEmail}`);
  }

  // Assign admin role
  if (roles.ADMIN) {
    await UserRole.findOrCreate({
      where: {
        user_id: adminUser.id,
        role_id: roles.ADMIN.id,
      },
    });
    logger.info(`Admin role assigned to ${adminEmail}`);
  }

  return adminUser;
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connected to database for seeding...');

    // Sync models (don't force in production)
    await sequelize.sync({ alter: false });

    const roles = await seedRoles();
    await seedAdminUser(roles);

    logger.info('Database seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seed();
