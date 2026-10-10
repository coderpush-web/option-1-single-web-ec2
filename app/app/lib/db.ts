import postgres from 'postgres';
import { invoices, customers, revenue } from './placeholder-data';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let sqlClient: any = null;

if (connectionString) {
  try {
    sqlClient = postgres(connectionString, {
      ssl: connectionString.includes('sslmode=require') ? 'require' : false,
      connect_timeout: 4,
      idle_timeout: 10,
      max: 10,
    });
  } catch (e) {
    console.error('Failed to init postgres client:', e);
  }
}

export { sqlClient, invoices, customers, revenue };

