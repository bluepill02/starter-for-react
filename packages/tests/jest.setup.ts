// Jest setup file
import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_APPWRITE_ENDPOINT = 'https://localhost/v1';
process.env.VITE_APPWRITE_PROJECT_ID = 'test-project';
process.env.VITE_APPWRITE_KEY = 'test-key';