/**
 * Seed script: creates 3 Admin + 5 Staff users.
 * Run: npx tsx src/seed.ts
 * Default passwords: admin1, admin2, admin3, staff1, staff2, staff3, staff4, staff5
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from './models/User.js';

dotenv.config();

const ADMINS = [
  { username: 'admin1', password: 'admin1', role: 'admin' as const },
  { username: 'admin2', password: 'admin2', role: 'admin' as const },
  { username: 'admin3', password: 'admin3', role: 'admin' as const },
];
const STAFF = [
  { username: 'staff1', password: 'staff1', role: 'staff' as const },
  { username: 'staff2', password: 'staff2', role: 'staff' as const },
  { username: 'staff3', password: 'staff3', role: 'staff' as const },
  { username: 'staff4', password: 'staff4', role: 'staff' as const },
  { username: 'staff5', password: 'staff5', role: 'staff' as const },
];

async function seed() {
  let mongod: MongoMemoryServer | null = null;
  try {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    
    await mongoose.connect(uri);
    console.log('Connected to in-memory MongoDB');
    
    for (const u of [...ADMINS, ...STAFF]) {
      const existing = await User.findOne({ username: u.username });
      if (!existing) {
        await User.create(u);
        console.log('Created:', u.username, u.role);
      } else {
        console.log('Exists:', u.username);
      }
    }
    console.log('Seed done.');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    (globalThis as any).process?.exit(0);
  }
}

seed().catch((e) => {
  console.error(e);
  (globalThis as any).process?.exit(1);
});
