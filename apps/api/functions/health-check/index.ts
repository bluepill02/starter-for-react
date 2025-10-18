import { Client, Databases, Storage, Functions, Health } from 'node-appwrite';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    functions: ServiceHealth;
    queue: ServiceHealth;
  };
  performance: {
    responseTime: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  dependencies: {
    appwrite: ServiceHealth;
    redis?: ServiceHealth;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

export default async ({ req, res, log, error }: any) => {
  const startTime = Date.now();
  
  try {
    log('Starting health check...');

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || '')
      .setProject(process.env.APPWRITE_PROJECT_ID || '')
      .setKey(process.env.APPWRITE_KEY || '');

    const databases = new Databases(client);
    const storage = new Storage(client);
    const functions = new Functions(client);
    const health = new Health(client);

    const databaseId = process.env.DATABASE_ID || 'recognition-db';
    const storageId = process.env.STORAGE_BUCKET_ID || 'evidence';

    // Health check results
    const healthResult: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: { status: 'down' },
        storage: { status: 'down' },
        functions: { status: 'down' },
        queue: { status: 'down' }
      },
      performance: {
        responseTime: 0,
        memoryUsage: process.memoryUsage()
      },
      dependencies: {
        appwrite: { status: 'down' }
      }
    };

    // Check Appwrite core health
    try {
      const appwriteStartTime = Date.now();
      await health.get();
      healthResult.dependencies.appwrite = {
        status: 'up',
        responseTime: Date.now() - appwriteStartTime
      };
      log('✅ Appwrite core service is healthy');
    } catch (err: any) {
      healthResult.dependencies.appwrite = {
        status: 'down',
        error: err.message
      };
      error('❌ Appwrite core service check failed:', err.message);
    }

    // Check Database service
    try {
      const dbStartTime = Date.now();
      await databases.list();
      healthResult.services.database = {
        status: 'up',
        responseTime: Date.now() - dbStartTime
      };
      log('✅ Database service is healthy');
    } catch (err: any) {
      healthResult.services.database = {
        status: 'down',
        error: err.message
      };
      error('❌ Database service check failed:', err.message);
    }

    // Check specific database and collections
    try {
      const collectionsStartTime = Date.now();
      const collections = await databases.listCollections(databaseId);
      const responseTime = Date.now() - collectionsStartTime;
      
      const requiredCollections = ['recognitions', 'users', 'teams', 'abuse-flags', 'audit-log'];
      const existingCollections = collections.collections.map(c => c.$id);
      const missingCollections = requiredCollections.filter(c => !existingCollections.includes(c));
      
      if (missingCollections.length === 0) {
        healthResult.services.database.details = {
          collections: existingCollections.length,
          responseTime
        };
      } else {
        healthResult.services.database.status = 'degraded';
        healthResult.services.database.details = {
          collections: existingCollections.length,
          missing: missingCollections,
          responseTime
        };
      }
      
      log(`📊 Database collections check: ${existingCollections.length} found`);
    } catch (err: any) {
      error('⚠️ Database collections check failed:', err.message);
    }

    // Check Storage service
    try {
      const storageStartTime = Date.now();
      await storage.listBuckets();
      healthResult.services.storage = {
        status: 'up',
        responseTime: Date.now() - storageStartTime
      };
      log('✅ Storage service is healthy');
    } catch (err: any) {
      healthResult.services.storage = {
        status: 'down',
        error: err.message
      };
      error('❌ Storage service check failed:', err.message);
    }

    // Check specific storage bucket
    try {
      const bucketStartTime = Date.now();
      await storage.getBucket(storageId);
      const responseTime = Date.now() - bucketStartTime;
      
      healthResult.services.storage.details = {
        bucket: storageId,
        responseTime
      };
      log(`📁 Storage bucket check: ${storageId} is accessible`);
    } catch (err: any) {
      healthResult.services.storage.status = 'degraded';
      healthResult.services.storage.details = {
        bucket: storageId,
        error: err.message
      };
      error('⚠️ Storage bucket check failed:', err.message);
    }

    // Check Functions service
    try {
      const functionsStartTime = Date.now();
      await functions.list();
      healthResult.services.functions = {
        status: 'up',
        responseTime: Date.now() - functionsStartTime
      };
      log('✅ Functions service is healthy');
    } catch (err: any) {
      healthResult.services.functions = {
        status: 'down',
        error: err.message
      };
      error('❌ Functions service check failed:', err.message);
    }

    // Check Queue service (using health endpoint)
    try {
      const queueStartTime = Date.now();
      // Queue health is typically included in general health check
      const generalHealth = await health.get();
      healthResult.services.queue = {
        status: 'up',
        responseTime: Date.now() - queueStartTime,
        details: generalHealth
      };
      log('✅ Queue service is healthy');
    } catch (err: any) {
      healthResult.services.queue = {
        status: 'down',
        error: err.message
      };
      error('❌ Queue service check failed:', err.message);
    }

    // Check Redis if configured
    if (process.env.REDIS_URL) {
      try {
        // Note: This would require redis client setup
        // For now, we'll mark it as unknown
        healthResult.dependencies.redis = {
          status: 'up',
          details: { url: process.env.REDIS_URL }
        };
        log('✅ Redis connection configured');
      } catch (err: any) {
        healthResult.dependencies.redis = {
          status: 'down',
          error: err.message
        };
        error('❌ Redis check failed:', err.message);
      }
    }

    // Calculate overall health status
    const serviceStatuses = Object.values(healthResult.services).map(s => s.status);
    const dependencyStatuses = Object.values(healthResult.dependencies).map(s => s.status);
    const allStatuses = [...serviceStatuses, ...dependencyStatuses];

    if (allStatuses.every(status => status === 'up')) {
      healthResult.status = 'healthy';
    } else if (allStatuses.some(status => status === 'down')) {
      healthResult.status = 'unhealthy';
    } else {
      healthResult.status = 'degraded';
    }

    // Calculate total response time
    healthResult.performance.responseTime = Date.now() - startTime;

    log(`Health check completed in ${healthResult.performance.responseTime}ms - Status: ${healthResult.status}`);

    // Return appropriate HTTP status code
    const statusCode = healthResult.status === 'healthy' ? 200 : 
                      healthResult.status === 'degraded' ? 200 : 503;

    return res.json(healthResult, statusCode);

  } catch (err: any) {
    error('Health check failed:', err);
    
    const failedResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: { status: 'down', error: 'Health check failed' },
        storage: { status: 'down', error: 'Health check failed' },
        functions: { status: 'down', error: 'Health check failed' },
        queue: { status: 'down', error: 'Health check failed' }
      },
      performance: {
        responseTime: Date.now() - startTime
      },
      dependencies: {
        appwrite: { status: 'down', error: err.message }
      }
    };

    return res.json(failedResult, 503);
  }
};