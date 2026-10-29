import './mongoSafety';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore DNS config errors if running in restricted environments
}

export const connectDB = async (retries = 5, delayMs = 2000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, {
        autoIndex: false,
        autoCreate: false,
        serverSelectionTimeoutMS: 15000,
      });
      await mongoose.connection.db!.command({ ping: 1 });
      console.log(JSON.stringify({ mongo: 'connected', ping: 'ok', autoIndex: false, autoCreate: false }));
      return;
    } catch (error) {
      console.error(JSON.stringify({
        mongo: 'connection_attempt_failed',
        attempt,
        retries,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }));
      if (attempt === retries) {
        console.error(JSON.stringify({ mongo: 'connection_failed', errorType: error instanceof Error ? error.name : 'UnknownError' }));
        throw error;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};
