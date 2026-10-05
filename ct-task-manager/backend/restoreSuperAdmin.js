require('dotenv').config({ path: 'c:/Users/student/Desktop/Task-Manager-ctu/ct-task-manager/backend/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function restoreSuperAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DATABASE_NAME || 'ct_task_manager';
    await mongoose.connect(mongoUri, { dbName });
    console.log('Connected to MongoDB:', dbName);

    const User = mongoose.connection.collection('users');
    const VerifiedUser = mongoose.connection.collection('verified_users');

    const superAdminId = new mongoose.Types.ObjectId('6a914bdba3ba571d9a0ad419');
    const universityId = '10001';
    const email = 'arjun.sharma@ctuniversity.in';
    const rawPassword = 'Password@123'; // Wait, let's check what password the user entered: 12345678
    const passwordHash = await bcrypt.hash('12345678', 10);

    // Check if user already exists
    const existing = await User.findOne({ universityId });
    if (existing) {
      console.log('User 10001 already exists:', existing);
      // Update password hash and role to super_admin just in case
      await User.updateOne(
        { universityId },
        {
          $set: {
            role: 'super_admin',
            passwordHash,
            isActive: true,
            updatedAt: new Date()
          }
        }
      );
      console.log('Updated user 10001 with super_admin role and password 12345678.');
    } else {
      const superAdminDoc = {
        _id: superAdminId,
        universityId,
        name: 'Arjun Sharma',
        email,
        phone: '9876500001',
        department: 'Computer Science',
        passwordHash,
        role: 'super_admin',
        isActive: true,
        createdAt: new Date('2026-09-03T14:49:35.076Z'),
        updatedAt: new Date()
      };

      await User.insertOne(superAdminDoc);
      console.log('✅ Successfully restored Super Admin user 10001 (_id: 6a914bdba3ba571d9a0ad419)');
    }

    // Update verified_users
    await VerifiedUser.updateOne(
      { universityId },
      {
        $set: {
          isRegistered: true,
          registeredUserId: superAdminId,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    console.log('✅ Updated verified_users for 10001 with isRegistered: true');

    process.exit(0);
  } catch (err) {
    console.error('Error restoring Super Admin:', err);
    process.exit(1);
  }
}

restoreSuperAdmin();
