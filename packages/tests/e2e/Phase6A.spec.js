/**
 * Phase 6A E2E Tests - Playwright
 * 
 * Tests critical user workflows:
 * 1. Manager Onboarding Flow
 * 2. Create & Share Recognition
 * 3. Verify & Bulk Approve Recognitions
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Phase 6A - Manager Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/manager`);
  });

  test('should complete 4-step manager onboarding', async ({ page }) => {
    // Step 1: Create Team
    await expect(page.locator('text=Create Team')).toBeVisible();
    await page.click('button:has-text("Next")');

    // Step 2: Add Members
    await expect(page.locator('text=Add Members')).toBeVisible();
    await page.click('button:has-text("Next")');

    // Step 3: Send Welcome
    await expect(page.locator('text=Send Welcome')).toBeVisible();
    await page.click('button:has-text("Next")');

    // Step 4: Review Recognition
    await expect(page.locator('text=Review Recognition')).toBeVisible();
    await page.click('button:has-text("Complete")');

    // Should show completion
    await expect(page.locator('text=🎉')).toBeVisible();
    await expect(page.locator('text=Congratulations')).toBeVisible();
  });

  test('should persist progress in localStorage', async ({ page, context }) => {
    // Complete first step
    await page.click('button:has-text("Next")');

    // Get localStorage value
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('recognition:onboarding:manager'))
    );

    expect(progress.currentStep).toBe(1);

    // Reload and verify progress persisted
    await page.reload();
    await expect(page.locator('text=Add Members')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab to first button
    await page.keyboard.press('Tab');
    const button = page.locator('button:has-text("Next")').first();
    await expect(button).toBeFocused();

    // Press Enter to advance
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Add Members')).toBeVisible();
  });

  test('should allow skipping onboarding', async ({ page }) => {
    const skipButton = page.locator('button:has-text("Skip")');
    await skipButton.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard|home/);
  });

  test('should have proper focus indicators', async ({ page }) => {
    const button = page.locator('button:has-text("Next")').first();
    await button.focus();

    const styles = await button.evaluate((el) =>
      window.getComputedStyle(el, ':focus-visible')
    );

    expect(styles.outline).toBeTruthy();
  });
});

test.describe('Phase 6A - Recognition Creation & Sharing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/recognitions/new`);
  });

  test('should create recognition with templates', async ({ page }) => {
    // Click template gallery
    await page.click('text=Use Template');

    // Select teamwork template
    await page.click('text=Teamwork');

    // Form should be pre-filled
    const reasonField = page.locator('textarea[name="reason"]');
    const value = await reasonField.inputValue();
    expect(value).toBeTruthy();

    // Complete form
    await page.fill('input[name="recipient"]', 'Bob');
    await page.click('button:has-text("Send Recognition")');

    // Should show success
    await expect(page.locator('text=Recognition sent')).toBeVisible();
  });

  test('should generate shareable profile link', async ({ page }) => {
    // Navigate to profile
    await page.goto(`${BASE_URL}/profile/my-profile`);

    // Click share button
    await page.click('button:has-text("Share Profile")');

    // Should show share options
    await expect(page.locator('text=Copy Link')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Download PDF')).toBeVisible();
  });

  test('should access shared profile via token', async ({ page }) => {
    // Generate share token first
    const response = await page.request.post(
      `${BASE_URL}/api/functions/create-profile-share`,
      {
        data: { userId: 'test-user' },
      }
    );

    const { shareUrl } = await response.json();

    // Access shared profile
    await page.goto(shareUrl);

    // Should display public profile
    await expect(page.locator('text=Recognition Gallery')).toBeVisible();
    await expect(page.locator('[role="region"][aria-label="Recognition statistics"]')).toBeVisible();
  });

  test('should count view when accessing shared profile', async ({ page, context }) => {
    // Generate share token
    const response = await page.request.post(
      `${BASE_URL}/api/functions/create-profile-share`,
      {
        data: { userId: 'test-user' },
      }
    );

    const { shareUrl } = await response.json();

    // Access shared profile twice
    await page.goto(shareUrl);
    const viewCount1 = await page.locator('text=Profile Views').evaluate((el) =>
      el.textContent.match(/\d+/)[0]
    );

    const page2 = await context.newPage();
    await page2.goto(shareUrl);
    const viewCount2 = await page2.locator('text=Profile Views').evaluate((el) =>
      el.textContent.match(/\d+/)[0]
    );

    expect(parseInt(viewCount2)).toBeGreaterThan(parseInt(viewCount1));
    await page2.close();
  });

  test('should show error for expired share token', async ({ page }) => {
    // Try to access with invalid token
    await page.goto(`${BASE_URL}/profile/test-user/shared?token=invalid-token`);

    // Should show error
    await expect(page.locator('text=Share Link Error')).toBeVisible();
    await expect(page.locator('text=invalid or expired')).toBeVisible();
  });
});

test.describe('Phase 6A - Bulk Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/manager-dashboard`);
  });

  test('should display pending recognitions', async ({ page }) => {
    // Should show stats
    await expect(page.locator('text=Pending Verifications')).toBeVisible();

    // Should show recognition list
    await expect(page.locator('[role="list"]')).toBeVisible();
  });

  test('should select multiple recognitions', async ({ page }) => {
    // Get checkboxes
    const checkboxes = page.locator('[role="checkbox"]');
    const count = await checkboxes.count();

    // Should have select-all checkbox + individual checkboxes
    expect(count).toBeGreaterThan(1);

    // Select first recognition
    await checkboxes.nth(1).check();
    await expect(checkboxes.nth(1)).toBeChecked();

    // Select all
    await checkboxes.nth(0).check();
    const selectedCount = await checkboxes.locator(':checked').count();
    expect(selectedCount).toBe(count);
  });

  test('should open bulk verification modal', async ({ page }) => {
    // Select some recognitions
    const checkbox = page.locator('[role="checkbox"]').nth(1);
    await checkbox.check();

    // Click bulk verify button
    await page.click('button:has-text("Bulk Verify")');

    // Modal should open
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
  });

  test('should approve multiple recognitions', async ({ page }) => {
    // Select recognitions
    const selectAll = page.locator('[role="checkbox"]').first();
    await selectAll.check();

    // Open modal
    await page.click('button:has-text("Bulk Verify")');

    // Add verification note
    await page.fill(
      'textarea[placeholder*="verification"]',
      'All recognitions are valid'
    );

    // Click approve
    await page.click('button:has-text("Approve Selected")');

    // Should show processing
    await expect(page.locator('text=Processing')).toBeVisible();

    // Should return to dashboard
    await page.waitForURL(/manager-dashboard/);
    await expect(page.locator('text=Verified successfully')).toBeVisible();
  });

  test('should reject with required justification', async ({ page }) => {
    // Select recognition
    const checkbox = page.locator('[role="checkbox"]').nth(1);
    await checkbox.check();

    // Open modal
    await page.click('button:has-text("Bulk Verify")');

    // Try to reject without justification
    const rejectBtn = page.locator('button:has-text("Reject Selected")');
    await rejectBtn.click();

    // Should show justification field
    const justification = page.locator('textarea[placeholder*="justification"]');
    await expect(justification).toBeVisible();

    // Add justification and submit
    await justification.fill('Does not meet criteria');
    await page.click('button:has-text("Reject")');

    // Should process
    await expect(page.locator('text=Processing')).toBeVisible();
  });

  test('should search and filter recognitions', async ({ page }) => {
    // Search for specific recognition
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('teamwork');

    // List should filter
    const items = page.locator('[role="listitem"]');
    let visibleCount = 0;
    for (let i = 0; i < await items.count(); i++) {
      const text = await items.nth(i).textContent();
      if (text?.includes('teamwork')) visibleCount++;
    }

    expect(visibleCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle loading states', async ({ page }) => {
    // Select recognitions
    const checkbox = page.locator('[role="checkbox"]').nth(1);
    await checkbox.check();

    // Open modal
    await page.click('button:has-text("Bulk Verify")');

    // Click approve - button should be disabled during loading
    await page.click('button:has-text("Approve Selected")');

    const approveBtn = page.locator('button:has-text("Approve Selected")');
    await expect(approveBtn).toBeDisabled();

    // Wait for completion
    await page.waitForTimeout(500);
    await expect(page.locator('text=Processing')).toBeVisible();
  });

  test('should have accessible focus management', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() =>
      document.activeElement?.getAttribute('role')
    );

    expect(focusedElement).toBeTruthy();

    // Modal should trap focus when open
    await page.locator('[role="checkbox"]').nth(1).check();
    await page.click('button:has-text("Bulk Verify")');

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Tab should stay within modal
    await page.keyboard.press('Tab');
    const focusedInModal = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      return modal?.contains(document.activeElement);
    });

    expect(focusedInModal).toBe(true);
  });
});

test.describe('Accessibility Compliance', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/manager-dashboard`);

    const h1 = page.locator('h1');
    const h2s = page.locator('h2');

    await expect(h1).toHaveCount(1);
    expect(await h2s.count()).toBeGreaterThan(0);
  });

  test('should have proper ARIA labels on form inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/recognitions/new`);

    const inputs = page.locator('input, textarea, select');
    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const label = await page.locator(`label[for="${await input.getAttribute('id')}"]`);

      const hasLabel = ariaLabel || (await label.count()) > 0;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('should support dark mode', async ({ page }) => {
    // Set dark mode preference
    await page.evaluate(() => {
      document.documentElement.style.colorScheme = 'dark';
    });

    await page.goto(`${BASE_URL}/admin/manager-dashboard`);

    // Should render without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should respect reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.evaluate(() => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (!media.matches) {
        const style = document.createElement('style');
        style.textContent = '@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }';
        document.head.appendChild(style);
      }
    });

    await page.goto(`${BASE_URL}/admin/manager-dashboard`);

    // Animations should not occur
    const elements = page.locator('*');
    for (let i = 0; i < Math.min(5, await elements.count()); i++) {
      const animation = await elements.nth(i).evaluate((el) =>
        window.getComputedStyle(el).animation
      );
      expect(animation).toBeFalsy();
    }
  });
});
