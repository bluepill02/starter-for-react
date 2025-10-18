#!/usr/bin/env tsx

import { initializeSeedData, createSampleEvidence, verifySeedData } from '../lib/seed';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.development' });

async function main() {
  console.log('🌱 Recognition System - Seed Data Script');
  console.log('=========================================');

  try {
    // Run bootstrap seed
    console.log('\n1️⃣ Running bootstrap seed...');
    const seedResult = await initializeSeedData();
    
    if (!seedResult.success) {
      console.error('❌ Bootstrap seed failed:', seedResult.error);
      process.exit(1);
    }

    console.log('✅ Bootstrap seed completed successfully!');
    console.log('📊 Results:', seedResult.results);
    
    if (seedResult.testAccounts) {
      console.log('\n🔐 Test Accounts:');
      Object.entries(seedResult.testAccounts).forEach(([role, credentials]) => {
        console.log(`   ${role}: ${credentials}`);
      });
    }

    // Create sample evidence files
    console.log('\n2️⃣ Creating sample evidence files...');
    const evidenceResult = await createSampleEvidence();
    console.log(`✅ Created ${evidenceResult.created} sample evidence files`);

    // Verify seed data integrity
    console.log('\n3️⃣ Verifying seed data integrity...');
    const verification = await verifySeedData();
    
    if (verification.valid) {
      console.log('✅ Seed data verification passed!');
    } else {
      console.log('⚠️ Seed data verification issues:');
      verification.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }

    console.log('\n📋 Verification Results:');
    Object.entries(verification.checks).forEach(([check, passed]) => {
      console.log(`   ${check}: ${passed ? '✅' : '❌'}`);
    });

    if (seedResult.nextSteps) {
      console.log('\n🚀 Next Steps:');
      seedResult.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }

    console.log('\n🎉 Seed data setup completed successfully!');
    console.log('You can now start the development servers with: npm run dev:all');

  } catch (error: any) {
    console.error('❌ Seed script failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}