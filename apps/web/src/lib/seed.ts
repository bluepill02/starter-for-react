import { Client, Account, Databases, Functions, Storage, ID } from 'appwrite';

interface SeedConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  functionsEndpoint: string;
}

interface SeedResult {
  success: boolean;
  message: string;
  results?: {
    users: { created: number; total: number };
    teams: { created: number; total: number };
    recognitions: { created: number; total: number };
  };
  testAccounts?: Record<string, string>;
  nextSteps?: string[];
  error?: string;
}

export class SeedDataService {
  private client: Client;
  private account: Account;
  private databases: Databases;
  private functions: Functions;
  private storage: Storage;
  private config: SeedConfig;

  constructor(config: SeedConfig) {
    this.config = config;
    this.client = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);
    
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.functions = new Functions(this.client);
    this.storage = new Storage(this.client);
  }

  /**
   * Execute the bootstrap seed function to create test data
   */
  async runBootstrapSeed(): Promise<SeedResult> {
    try {
      console.log('🌱 Starting bootstrap seed process...');
      
      const execution = await this.functions.createExecution(
        'bootstrap-seed',
        JSON.stringify({}),
        false // Not async
      );

      if (execution.status === 'completed') {
        const result = JSON.parse(execution.responseBody || '{}');
        console.log('✅ Bootstrap seed completed successfully');
        return result;
      } else {
        console.error('❌ Bootstrap seed failed:', execution.responseBody);
        return {
          success: false,
          message: 'Bootstrap seed execution failed',
          error: execution.responseBody
        };
      }
    } catch (error: any) {
      console.error('❌ Bootstrap seed error:', error);
      return {
        success: false,
        message: 'Failed to execute bootstrap seed',
        error: error.message
      };
    }
  }

  /**
   * Create additional sample evidence files for testing
   */
  async createSampleEvidenceFiles(): Promise<{ created: number; files: string[] }> {
    const sampleFiles = [
      {
        name: 'performance_metrics.png',
        content: this.createSampleImageData('performance-chart'),
        mimeType: 'image/png'
      },
      {
        name: 'code_review_feedback.pdf',
        content: this.createSamplePDFData('Code Review Feedback'),
        mimeType: 'application/pdf'
      },
      {
        name: 'user_feedback.txt',
        content: 'Excellent work on the new feature! Users love the improved interface.',
        mimeType: 'text/plain'
      },
      {
        name: 'design_mockups.png',
        content: this.createSampleImageData('design-mockup'),
        mimeType: 'image/png'
      }
    ];

    const createdFiles: string[] = [];
    const bucketId = process.env.NEXT_PUBLIC_STORAGE_BUCKET_ID || 'evidence';

    for (const file of sampleFiles) {
      try {
        const fileObject = new File([file.content], file.name, { type: file.mimeType });
        const uploadedFile = await this.storage.createFile(
          bucketId,
          ID.unique(),
          fileObject
        );
        
        createdFiles.push(uploadedFile.$id);
        console.log(`📁 Created sample file: ${file.name}`);
      } catch (error: any) {
        console.warn(`⚠️ Failed to create file ${file.name}:`, error.message);
      }
    }

    return {
      created: createdFiles.length,
      files: createdFiles
    };
  }

  /**
   * Verify seed data integrity
   */
  async verifySeedData(): Promise<{
    valid: boolean;
    checks: Record<string, boolean>;
    issues: string[];
  }> {
    const checks: Record<string, boolean> = {};
    const issues: string[] = [];

    try {
      // Check users collection
      const users = await this.databases.listDocuments(
        this.config.databaseId,
        'users'
      );
      checks.users = users.total >= 5;
      if (!checks.users) {
        issues.push(`Expected at least 5 users, found ${users.total}`);
      }

      // Check teams collection
      const teams = await this.databases.listDocuments(
        this.config.databaseId,
        'teams'
      );
      checks.teams = teams.total >= 2;
      if (!checks.teams) {
        issues.push(`Expected at least 2 teams, found ${teams.total}`);
      }

      // Check recognitions collection
      const recognitions = await this.databases.listDocuments(
        this.config.databaseId,
        'recognitions'
      );
      checks.recognitions = recognitions.total >= 3;
      if (!checks.recognitions) {
        issues.push(`Expected at least 3 recognitions, found ${recognitions.total}`);
      }

      // Check for different user roles
      const managers = users.documents.filter(u => u.role === 'MANAGER');
      const admins = users.documents.filter(u => u.role === 'ADMIN');
      checks.roles = managers.length >= 1 && admins.length >= 1;
      if (!checks.roles) {
        issues.push('Missing required user roles (MANAGER, ADMIN)');
      }

      // Check for verified and pending recognitions
      const verified = recognitions.documents.filter(r => r.status === 'VERIFIED');
      const pending = recognitions.documents.filter(r => r.status === 'PENDING');
      checks.statuses = verified.length >= 1 && pending.length >= 1;
      if (!checks.statuses) {
        issues.push('Missing required recognition statuses (VERIFIED, PENDING)');
      }

    } catch (error: any) {
      issues.push(`Verification failed: ${error.message}`);
    }

    const valid = Object.values(checks).every(check => check) && issues.length === 0;

    return { valid, checks, issues };
  }

  /**
   * Clean up all seed data (for development reset)
   */
  async cleanupSeedData(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧹 Cleaning up seed data...');

      // Delete recognitions
      const recognitions = await this.databases.listDocuments(
        this.config.databaseId,
        'recognitions'
      );
      for (const doc of recognitions.documents) {
        await this.databases.deleteDocument(
          this.config.databaseId,
          'recognitions',
          doc.$id
        );
      }

      // Delete users (this will also clean up authentication)
      const users = await this.databases.listDocuments(
        this.config.databaseId,
        'users'
      );
      for (const doc of users.documents) {
        await this.databases.deleteDocument(
          this.config.databaseId,
          'users',
          doc.$id
        );
      }

      // Delete teams
      const teams = await this.databases.listDocuments(
        this.config.databaseId,
        'teams'
      );
      for (const doc of teams.documents) {
        await this.databases.deleteDocument(
          this.config.databaseId,
          'teams',
          doc.$id
        );
      }

      console.log('✅ Seed data cleanup completed');
      return {
        success: true,
        message: 'Seed data cleaned up successfully'
      };
    } catch (error: any) {
      console.error('❌ Cleanup failed:', error);
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`
      };
    }
  }

  /**
   * Create sample image data for testing
   */
  private createSampleImageData(type: string): string {
    // Create a simple SVG as sample image data
    const svg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f3f4f6"/>
      <text x="200" y="150" font-family="Arial" font-size="16" text-anchor="middle" fill="#374151">
        Sample ${type} Image
      </text>
      <text x="200" y="180" font-family="Arial" font-size="12" text-anchor="middle" fill="#6b7280">
        Generated for development testing
      </text>
    </svg>`;
    
    return svg;
  }

  /**
   * Create sample PDF data for testing
   */
  private createSamplePDFData(title: string): string {
    // Simple text content for PDF-like file
    return `Sample PDF Document: ${title}

This is a sample document created for development testing purposes.

Content:
- Performance metrics and analysis
- Code review feedback and recommendations  
- User feedback and testimonials
- Design mockups and prototypes

Created: ${new Date().toLocaleDateString()}
Generated by: Recognition System Seed Data

This file is for testing evidence upload functionality.`;
  }
}

/**
 * Utility function to initialize and run seed data
 */
export async function initializeSeedData(): Promise<SeedResult> {
  const config: SeedConfig = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost:8080/v1',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'recognition-dev',
    databaseId: process.env.NEXT_PUBLIC_DATABASE_ID || 'recognition-db',
    functionsEndpoint: process.env.NEXT_PUBLIC_FUNCTIONS_ENDPOINT || 'http://localhost:8080/v1/functions'
  };

  const seedService = new SeedDataService(config);
  return await seedService.runBootstrapSeed();
}

/**
 * Utility function to create sample evidence files
 */
export async function createSampleEvidence(): Promise<{ created: number; files: string[] }> {
  const config: SeedConfig = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost:8080/v1',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'recognition-dev',
    databaseId: process.env.NEXT_PUBLIC_DATABASE_ID || 'recognition-db',
    functionsEndpoint: process.env.NEXT_PUBLIC_FUNCTIONS_ENDPOINT || 'http://localhost:8080/v1/functions'
  };

  const seedService = new SeedDataService(config);
  return await seedService.createSampleEvidenceFiles();
}

/**
 * Utility function to verify seed data
 */
export async function verifySeedData(): Promise<{
  valid: boolean;
  checks: Record<string, boolean>;
  issues: string[];
}> {
  const config: SeedConfig = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost:8080/v1',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'recognition-dev',
    databaseId: process.env.NEXT_PUBLIC_DATABASE_ID || 'recognition-db',
    functionsEndpoint: process.env.NEXT_PUBLIC_FUNCTIONS_ENDPOINT || 'http://localhost:8080/v1/functions'
  };

  const seedService = new SeedDataService(config);
  return await seedService.verifySeedData();
}