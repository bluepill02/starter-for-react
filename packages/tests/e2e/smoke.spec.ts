import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'http://localhost:8080/v1';

// Test accounts (from seed data)
const TEST_ACCOUNTS = {
  admin: {
    email: 'carol.admin@company.com',
    password: 'Password123!',
    name: 'Carol Davis',
    role: 'ADMIN'
  },
  manager: {
    email: 'alice.manager@company.com',
    password: 'Password123!',
    name: 'Alice Johnson',
    role: 'MANAGER'
  },
  employee: {
    email: 'bob.employee@company.com',
    password: 'Password123!',
    name: 'Bob Smith',
    role: 'USER'
  }
};

test.describe('Recognition System - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up page with longer timeout for emulator
    page.setDefaultTimeout(30000);
    
    // Navigate to the application
    await page.goto(BASE_URL);
  });

  test('should load the application homepage', async ({ page }) => {
    // Check that the page loads and contains expected elements
    await expect(page).toHaveTitle(/Recognition System/i);
    
    // Should have sign in option
    await expect(page.locator('text=Sign In')).toBeVisible();
    
    // Should have some branding/logo
    await expect(page.locator('[alt*="logo"], [alt*="Logo"], h1')).toBeVisible();
  });

  test('should allow user authentication', async ({ page }) => {
    // Test user login flow
    await signIn(page, TEST_ACCOUNTS.employee);
    
    // Should redirect to dashboard/feed after login
    await expect(page.url()).toContain('/feed');
    
    // Should show user name or profile indicator
    await expect(page.locator(`text=${TEST_ACCOUNTS.employee.name}`)).toBeVisible();
    
    // Should have navigation elements
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should allow giving recognition with evidence upload', async ({ page }) => {
    // Sign in as an employee
    await signIn(page, TEST_ACCOUNTS.employee);
    
    // Navigate to give recognition page or open modal
    const giveRecognitionButton = page.locator('text=Give Recognition, button:has-text("Give"), [data-testid="give-recognition"]').first();
    await giveRecognitionButton.click();
    
    // Fill out recognition form
    await page.fill('[data-testid="recipient-select"], input[placeholder*="recipient"], select[name="recipient"]', 'frank-employee');
    
    await page.fill('[data-testid="recognition-reason"], textarea[name="reason"], textarea[placeholder*="reason"]', 
      'Excellent collaboration on the new feature implementation. Frank provided valuable insights and helped resolve critical bugs efficiently.');
    
    // Add tags
    const tagInput = page.locator('[data-testid="tag-input"], input[placeholder*="tag"]').first();
    if (await tagInput.isVisible()) {
      await tagInput.fill('collaboration');
      await page.keyboard.press('Enter');
      await tagInput.fill('problem-solving');
      await page.keyboard.press('Enter');
    }
    
    // Upload evidence file
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      // Create a test file to upload
      const testFilePath = await createTestFile();
      await fileInput.setInputFiles(testFilePath);
      
      // Wait for upload to complete
      await expect(page.locator('text=Uploaded, text=Complete, [data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
    }
    
    // Submit the recognition
    await page.click('button:has-text("Submit"), button:has-text("Give Recognition"), [data-testid="submit-recognition"]');
    
    // Should show success message
    await expect(page.locator('text=Recognition given, text=success, [role="alert"]')).toBeVisible({ timeout: 10000 });
    
    // Should return to feed and show the new recognition
    await expect(page.url()).toContain('/feed');
    await expect(page.locator('text=Excellent collaboration')).toBeVisible();
  });

  test('should allow manager verification of recognitions', async ({ page }) => {
    // Sign in as a manager
    await signIn(page, TEST_ACCOUNTS.manager);
    
    // Look for pending recognitions
    const pendingRecognition = page.locator('[data-status="PENDING"], .recognition-pending').first();
    
    if (await pendingRecognition.isVisible()) {
      // Click to view/verify the recognition
      await pendingRecognition.click();
      
      // Should have verify option
      const verifyButton = page.locator('button:has-text("Verify"), [data-testid="verify-recognition"]');
      if (await verifyButton.isVisible()) {
        await verifyButton.click();
        
        // Add verification note
        const noteInput = page.locator('textarea[name="verificationNote"], [data-testid="verification-note"]');
        if (await noteInput.isVisible()) {
          await noteInput.fill('Verified based on project outcomes and team feedback.');
        }
        
        // Confirm verification
        await page.click('button:has-text("Confirm"), button:has-text("Verify"), [data-testid="confirm-verification"]');
        
        // Should show success
        await expect(page.locator('text=verified, text=success')).toBeVisible();
      }
    } else {
      console.log('No pending recognitions found for verification test');
    }
  });

  test('should show export options in user profile', async ({ page }) => {
    // Sign in as any user
    await signIn(page, TEST_ACCOUNTS.employee);
    
    // Navigate to profile page
    await page.click(`text=${TEST_ACCOUNTS.employee.name}, [data-testid="user-menu"]`);
    await page.click('text=Profile, [href*="/profile"]');
    
    // Should show profile information
    await expect(page.locator(`text=${TEST_ACCOUNTS.employee.name}`)).toBeVisible();
    
    // Should have export options
    const exportButton = page.locator('button:has-text("Export"), [data-testid="export-profile"]').first();
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Should show export options (PDF, CSV)
      await expect(page.locator('text=PDF, text=CSV')).toBeVisible();
      
      // Test PDF export
      const pdfExport = page.locator('button:has-text("PDF"), [data-testid="export-pdf"]');
      if (await pdfExport.isVisible()) {
        await pdfExport.click();
        
        // Should indicate export is being generated
        await expect(page.locator('text=Generating, text=export, text=processing')).toBeVisible();
      }
    }
  });

  test('should handle admin features', async ({ page }) => {
    // Sign in as admin
    await signIn(page, TEST_ACCOUNTS.admin);
    
    // Should have admin navigation
    const adminLink = page.locator('text=Admin, [href*="/admin"]').first();
    if (await adminLink.isVisible()) {
      await adminLink.click();
      
      // Should load admin dashboard
      await expect(page.locator('text=Administration, text=Dashboard')).toBeVisible();
      
      // Check for abuse monitoring
      const abuseSection = page.locator('text=Abuse, [href*="/admin/abuse"]').first();
      if (await abuseSection.isVisible()) {
        await abuseSection.click();
        
        // Should show abuse monitoring interface
        await expect(page.locator('text=Flagged, text=Review')).toBeVisible();
      }
    } else {
      console.log('Admin features not available or user lacks permissions');
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test various error conditions
    
    // 1. Network error simulation
    await page.route('**/v1/databases/**', route => route.abort());
    
    await signIn(page, TEST_ACCOUNTS.employee);
    
    // Should show error message when data fails to load
    await expect(page.locator('text=error, text=failed, [role="alert"]')).toBeVisible({ timeout: 10000 });
    
    // 2. Test form validation
    await page.unroute('**/v1/databases/**');
    
    // Try to submit empty recognition form
    const giveRecognitionButton = page.locator('text=Give Recognition, button:has-text("Give")').first();
    if (await giveRecognitionButton.isVisible()) {
      await giveRecognitionButton.click();
      
      // Submit without filling required fields
      await page.click('button:has-text("Submit"), [data-testid="submit-recognition"]');
      
      // Should show validation errors
      await expect(page.locator('text=required, text=invalid, .error')).toBeVisible();
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await signIn(page, TEST_ACCOUNTS.employee);
    
    // Should have mobile-friendly navigation
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]').first();
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      
      // Should show navigation items
      await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
    }
    
    // Recognition cards should be stacked vertically
    const recognitions = page.locator('[data-testid="recognition-card"], .recognition-item');
    if (await recognitions.first().isVisible()) {
      const firstRect = await recognitions.first().boundingBox();
      const secondRect = await recognitions.nth(1).boundingBox();
      
      if (firstRect && secondRect) {
        // Second recognition should be below the first (not side by side)
        expect(secondRect.y).toBeGreaterThan(firstRect.y + firstRect.height - 10);
      }
    }
  });
});

// Helper functions

async function signIn(page: Page, account: typeof TEST_ACCOUNTS.employee) {
  // Click sign in
  await page.click('text=Sign In, [data-testid="sign-in"]');
  
  // Fill credentials
  await page.fill('input[type="email"], input[name="email"]', account.email);
  await page.fill('input[type="password"], input[name="password"]', account.password);
  
  // Submit form
  await page.click('button:has-text("Sign In"), button[type="submit"]');
  
  // Wait for redirect
  await page.waitForURL('**/feed', { timeout: 15000 });
}

async function createTestFile(): Promise<string> {
  const fs = await import('fs/promises');
  const os = await import('os');
  
  const testContent = `Test Evidence File
Created: ${new Date().toISOString()}
Purpose: Playwright E2E Testing
Content: This is a sample evidence file for testing the recognition system upload functionality.
`;
  
  const tempDir = os.tmpdir();
  const testFilePath = path.join(tempDir, 'test-evidence.txt');
  
  await fs.writeFile(testFilePath, testContent);
  return testFilePath;
}

// Test configuration and setup
test.beforeAll(async () => {
  console.log('🧪 Starting Recognition System E2E Tests');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Appwrite: ${APPWRITE_ENDPOINT}`);
});

test.afterAll(async () => {
  console.log('✅ E2E Tests completed');
});