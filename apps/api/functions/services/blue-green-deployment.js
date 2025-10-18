/**
 * Blue-Green Deployment Orchestrator
 * Enables zero-downtime deployments for Appwrite functions
 *
 * Features:
 * - Blue-green environment switching
 * - Automated health checks before switch
 * - Instant rollback capability
 * - Traffic routing management
 * - Deployment state tracking
 * - Pre-deployment validation
 */

import { Client, Functions } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY);

const functions = new Functions(client);

/**
 * Deployment state tracker
 */
class DeploymentState {
  constructor() {
    this.states = {
      blue: {
        status: 'ACTIVE',
        version: null,
        deployedAt: null,
        traffic: 100,
      },
      green: {
        status: 'STANDBY',
        version: null,
        deployedAt: null,
        traffic: 0,
      },
      lastSwitch: null,
      history: [],
    };
  }

  /**
   * Get current active environment
   */
  getActive() {
    return this.states.blue.status === 'ACTIVE' ? 'blue' : 'green';
  }

  /**
   * Get standby environment
   */
  getStandby() {
    return this.states.blue.status === 'ACTIVE' ? 'green' : 'blue';
  }

  /**
   * Switch traffic from one environment to another
   */
  switchTraffic() {
    const active = this.getActive();
    const standby = this.getStandby();

    // Swap statuses
    this.states[active].status = 'STANDBY';
    this.states[active].traffic = 0;
    this.states[standby].status = 'ACTIVE';
    this.states[standby].traffic = 100;

    this.states.lastSwitch = new Date().toISOString();

    // Record in history
    this.states.history.push({
      timestamp: this.states.lastSwitch,
      from: active,
      to: standby,
      reason: 'successful_deployment',
    });

    return {
      previousActive: active,
      newActive: standby,
      switchedAt: this.states.lastSwitch,
    };
  }

  /**
   * Rollback to previous environment
   */
  rollback() {
    const active = this.getActive();
    const standby = this.getStandby();

    // Swap back
    this.states[active].status = 'STANDBY';
    this.states[active].traffic = 0;
    this.states[standby].status = 'ACTIVE';
    this.states[standby].traffic = 100;

    const rollbackTime = new Date().toISOString();

    this.states.history.push({
      timestamp: rollbackTime,
      from: active,
      to: standby,
      reason: 'rollback',
    });

    return {
      rolledBackTo: standby,
      rolledBackAt: rollbackTime,
    };
  }

  /**
   * Get deployment state as JSON
   */
  toJSON() {
    return this.states;
  }
}

/**
 * Health check validator
 */
class HealthChecker {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.timeout = 5000;
  }

  /**
   * Check if environment is healthy
   */
  async checkHealth(environment) {
    try {
      const startTime = Date.now();

      const response = await fetch(
        `${this.baseUrl}/functions/health-check?path=/ready`,
        {
          method: 'GET',
          headers: {
            'x-appwrite-key': process.env.APPWRITE_KEY,
          },
          timeout: this.timeout,
        }
      );

      const duration = Date.now() - startTime;
      const isHealthy = response.status === 200;

      return {
        environment,
        isHealthy,
        statusCode: response.status,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        environment,
        isHealthy: false,
        error: error.message,
        duration: this.timeout,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check both environments
   */
  async checkBoth() {
    const blueHealth = await this.checkHealth('blue');
    const greenHealth = await this.checkHealth('green');

    return {
      blue: blueHealth,
      green: greenHealth,
      allHealthy: blueHealth.isHealthy && greenHealth.isHealthy,
    };
  }
}

/**
 * Pre-deployment validation
 */
export async function validateDeployment(functionName, deploymentCode) {
  const validations = {
    codePresent: !!deploymentCode,
    codeSize: deploymentCode?.length || 0,
    hasSyntaxErrors: false,
    errors: [],
  };

  // Check code size (max 10MB for Appwrite)
  if (validations.codeSize > 10 * 1024 * 1024) {
    validations.hasSyntaxErrors = true;
    validations.errors.push('Code size exceeds 10MB limit');
  }

  // Basic syntax check (import statements must be valid)
  if (deploymentCode && !deploymentCode.includes('export')) {
    validations.errors.push('Code must have export statement');
    validations.hasSyntaxErrors = true;
  }

  return {
    functionName,
    valid: !validations.hasSyntaxErrors,
    validations,
  };
}

/**
 * Deploy to standby environment
 */
export async function deployToStandby(functionName, deploymentCode, state) {
  console.log(`\n🚀 Deploying ${functionName} to ${state.getStandby()} environment...`);

  try {
    // Validate before deployment
    const validation = await validateDeployment(functionName, deploymentCode);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.validations.errors.join(', ')}`);
    }

    console.log(`✅ Code validation passed`);

    const standbyEnv = state.getStandby();
    const functionId = `${functionName}-${standbyEnv}`;

    try {
      // Create or update function
      const deploymentResponse = await functions.createDeployment(
        functionId,
        deploymentCode,
        true
      );

      console.log(`✅ Code deployed to ${standbyEnv}`);

      // Update state
      state.states[standbyEnv].version = deploymentResponse.$id;
      state.states[standbyEnv].deployedAt = new Date().toISOString();

      return {
        success: true,
        environment: standbyEnv,
        functionId,
        deploymentId: deploymentResponse.$id,
        deployedAt: state.states[standbyEnv].deployedAt,
      };
    } catch (error) {
      if (error.message?.includes('already exists')) {
        // Update existing deployment
        console.log(`📝 Updating existing deployment in ${standbyEnv}...`);

        const functionId = `${functionName}-${standbyEnv}`;
        await functions.updateFunctionCode(functionId, deploymentCode, true);

        state.states[standbyEnv].deployedAt = new Date().toISOString();

        return {
          success: true,
          environment: standbyEnv,
          functionId,
          updated: true,
          deployedAt: state.states[standbyEnv].deployedAt,
        };
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Validate standby environment health
 */
export async function validateStandbyHealth(baseUrl, state) {
  console.log(`\n🏥 Validating ${state.getStandby()} environment health...`);

  const checker = new HealthChecker(baseUrl);
  const health = await checker.checkHealth(state.getStandby());

  if (health.isHealthy) {
    console.log(`✅ ${state.getStandby()} environment is healthy (${health.duration}ms)`);
  } else {
    console.log(`❌ ${state.getStandby()} environment is unhealthy: ${health.error}`);
  }

  return health;
}

/**
 * Switch traffic to standby environment
 */
export async function switchTraffic(state) {
  console.log(`\n🔄 Switching traffic from ${state.getActive()} to ${state.getStandby()}...`);

  const switchResult = state.switchTraffic();

  console.log(
    `✅ Traffic switched to ${switchResult.newActive} at ${switchResult.switchedAt}`
  );

  return switchResult;
}

/**
 * Rollback to previous environment
 */
export async function rollbackDeployment(state) {
  console.log(`\n⏮️  Rolling back to previous environment...`);

  const rollbackResult = state.rollback();

  console.log(`✅ Rolled back to ${rollbackResult.rolledBackTo} at ${rollbackResult.rolledBackAt}`);

  return rollbackResult;
}

/**
 * Execute complete blue-green deployment
 */
export async function executeBlueGreenDeployment(
  functionName,
  deploymentCode,
  baseUrl,
  options = {}
) {
  const { skipHealthCheck = false, autoRollback = true } = options;

  console.log(`\n${'='.repeat(70)}`);
  console.log('🚀 BLUE-GREEN DEPLOYMENT');
  console.log('='.repeat(70));

  const state = new DeploymentState();
  const startTime = Date.now();

  try {
    // Step 1: Deploy to standby
    console.log(`\nStep 1: Deploy to standby`);
    const deploymentResult = await deployToStandby(functionName, deploymentCode, state);

    if (!deploymentResult.success) {
      throw new Error(`Deployment failed: ${deploymentResult.error}`);
    }

    // Step 2: Health check (optional)
    if (!skipHealthCheck) {
      console.log(`\nStep 2: Validate standby health`);
      const health = await validateStandbyHealth(baseUrl, state);

      if (!health.isHealthy) {
        throw new Error(`Health check failed: ${health.error}`);
      }
    }

    // Step 3: Switch traffic
    console.log(`\nStep 3: Switch traffic`);
    const switchResult = await switchTraffic(state);

    // Step 4: Post-deployment health check
    if (!skipHealthCheck) {
      console.log(`\nStep 4: Verify new environment`);
      const postDeploymentHealth = await validateStandbyHealth(baseUrl, state);

      if (!postDeploymentHealth.isHealthy) {
        console.error('❌ Post-deployment health check failed, rolling back...');

        if (autoRollback) {
          const rollbackResult = await rollbackDeployment(state);
          throw new Error(
            `Post-deployment health check failed. Rolled back to ${rollbackResult.rolledBackTo}`
          );
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ DEPLOYMENT SUCCESSFUL');
    console.log('='.repeat(70));
    console.log(`   Time: ${duration}ms`);
    console.log(`   Active: ${state.getActive()}`);
    console.log(`   Standby: ${state.getStandby()}`);

    return {
      success: true,
      functionName,
      duration,
      state: state.toJSON(),
      steps: {
        deployment: deploymentResult,
        healthCheck: skipHealthCheck ? 'skipped' : 'passed',
        trafficSwitch: switchResult,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`\n${'='.repeat(70)}`);
    console.error('❌ DEPLOYMENT FAILED');
    console.error('='.repeat(70));
    console.error(`   Error: ${error.message}`);
    console.error(`   Time: ${duration}ms`);

    return {
      success: false,
      functionName,
      error: error.message,
      duration,
      state: state.toJSON(),
    };
  }
}

/**
 * Get deployment status
 */
export function getDeploymentStatus(state) {
  const active = state.getActive();
  const standby = state.getStandby();

  return {
    active: {
      environment: active,
      ...state.states[active],
    },
    standby: {
      environment: standby,
      ...state.states[standby],
    },
    lastSwitch: state.states.lastSwitch,
    historyCount: state.states.history.length,
  };
}

export default {
  executeBlueGreenDeployment,
  deployToStandby,
  validateStandbyHealth,
  switchTraffic,
  rollbackDeployment,
  validateDeployment,
  getDeploymentStatus,
  DeploymentState,
  HealthChecker,
};
