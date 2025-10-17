
/// <reference types="vite/client" />

import { Client, Account, Databases, Storage, Functions, Locale } from 'appwrite';

// Configuration from environment variables
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
  throw new Error('Missing required Appwrite environment variables. Please check VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID.');
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Note: API keys are not used on the client-side for security reasons
// Server-side functions should use the Appwrite server SDK with API keys

// Initialize services
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);
const locale = new Locale(client);

// Helper functions
export const getAccount = () => account;
export const getDatabase = () => databases;
export const getStorage = () => storage;
export const getFunctions = () => functions;
export const getLocale = () => locale;

// Export client and services
export { client, account, databases, storage, functions, locale };
export default client;