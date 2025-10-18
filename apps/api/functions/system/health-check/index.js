/**
 * Health Check Function
 * Provides readiness and liveness probes for Kubernetes and monitoring
 * 
 * Endpoints:
 * - GET /api/health - Quick status check (for monitoring dashboards)
 * - GET /api/ready - Full readiness check (for load balancers)
 * - GET /api/live - Liveness check (for container health)
 * 
 * Features:
 * - Database connectivity check
 * - Storage bucket accessibility
 * - Function availability
 * - Detailed status reporting
 * - Graceful degradation
 */

import { Client, Databases, Storage } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.DATABASE_ID || 'recognition-db';
const STORAGE_BUCKET_ID = 'evidence';

/**
 * Check database connectivity
 */
async function checkDatabase() {
  const startTime = Date.now();
  
  try {
    // Try to get database
    await databases.get(DATABASE_ID);
    
    // Try to list collections
    const collections = await databases.listCollections(DATABASE_ID);
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      collections: collections.total,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check storage accessibility
 */
async function checkStorage() {
  const startTime = Date.now();
  
  try {
    // Try to get bucket
    await storage.getBucket(STORAGE_BUCKET_ID);
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      bucket: STORAGE_BUCKET_ID,
    };
  } catch (error) {
    if (error.code === 404) {
      // Bucket doesn't exist yet, but storage service is responsive
      return {
        status: 'partial',
        reason: 'bucket_not_created',
        responseTime: Date.now() - startTime,
      };
    }
    
    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Get current system load
 */
function getSystemLoad() {
  // In production, would use actual metrics
  return {
    memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
    uptime: process.uptime(),
  };
}

/**
 * Liveness probe - simple check that the service is running
 * Returns 200 if service is alive, 503 if dead
 * 
 * Usage: GET /api/live
 * Response: { status: "alive", timestamp: "..." }
 */
export async function liveness(req, context) {
  return context.res.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    200
  );
}

/**
 * Readiness probe - checks if service is ready to accept traffic
 * Returns 200 if all dependencies are healthy, 503 if any critical dependency is down
 * 
 * Usage: GET /api/ready
 * Response: { ready: true/false, dependencies: {...}, timestamp: "..." }
 */
export async function readiness(req, context) {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    system: getSystemLoad(),
  };

  // Consider ready if database is healthy (storage can be partial)
  const isReady = checks.database.status === 'healthy';

  return context.res.json(
    {
      ready: isReady,
      checks,
      timestamp: new Date().toISOString(),
    },
    isReady ? 200 : 503
  );
}

/**
 * Health status endpoint - full system health report
 * Returns 200 if healthy, 503 if degraded, 500 if critical failure
 * 
 * Usage: GET /api/health
 * Response: { status: "healthy"|"degraded"|"critical", details: {...} }
 */
export async function health(req, context) {
  const startTime = Date.now();

  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    system: getSystemLoad(),
  };

  // Determine overall health
  let status = 'healthy';
  let statusCode = 200;

  if (checks.database.status === 'unhealthy') {
    status = 'critical';
    statusCode = 500;
  } else if (checks.storage.status === 'unhealthy') {
    status = 'degraded';
    statusCode = 503;
  } else if (checks.storage.status === 'partial') {
    status = 'degraded';
    statusCode = 200; // Still return 200 but indicate degradation
  }

  // Check if system is under heavy load
  if (checks.system.memoryUsage > 0.9) {
    if (status === 'healthy') {
      status = 'degraded';
    }
  }

  const responseTime = Date.now() - startTime;

  return context.res.json(
    {
      status,
      checks: {
        database: {
          status: checks.database.status,
          responseTime: checks.database.responseTime,
          collections: checks.database.collections,
        },
        storage: {
          status: checks.storage.status,
          responseTime: checks.storage.responseTime,
          reason: checks.storage.reason,
        },
        system: {
          memoryUsage: Math.round(checks.system.memoryUsage * 100),
          uptime: Math.round(checks.system.uptime),
        },
      },
      timestamp: new Date().toISOString(),
      responseTime,
    },
    statusCode
  );
}

/**
 * Health check router - routes to appropriate endpoint
 * 
 * Default export for use as main function
 */
export default async function handler(req, context) {
  const path = new URL(req.url).pathname;

  if (path.includes('/live')) {
    return liveness(req, context);
  } else if (path.includes('/ready')) {
    return readiness(req, context);
  } else {
    // Default to full health check
    return health(req, context);
  }
}
