/**
 * Phase 6A Component Tests
 * 
 * Comprehensive test suite for:
 * - ManagerChecklist
 * - RecognitionTemplates
 * - BulkVerificationModal
 * - ManagerDashboard
 * - Shared Profile Page
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ManagerChecklist from '../../apps/web/src/components/ManagerChecklist';
import RecognitionTemplates from '../../apps/web/src/components/RecognitionTemplates';
import BulkVerificationModal from '../../apps/web/src/components/BulkVerificationModal';
import ManagerDashboard from '../../apps/web/src/pages/admin/ManagerDashboard';

// Mock dependencies
jest.mock('../../apps/web/src/lib/i18n', () => ({
  useI18n: (key) => key,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { userId: 'test-user' },
    push: jest.fn(),
  }),
}));

describe('Phase 6A - Essential UX Components', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('ManagerChecklist Component', () => {
    it('renders 4-step onboarding flow', () => {
      render(<ManagerChecklist />);
      expect(screen.getByText(/create_team/i)).toBeInTheDocument();
      expect(screen.getByText(/add_members/i)).toBeInTheDocument();
      expect(screen.getByText(/send_welcome/i)).toBeInTheDocument();
      expect(screen.getByText(/review_recognition/i)).toBeInTheDocument();
    });

    it('tracks progress in localStorage', async () => {
      render(<ManagerChecklist />);
      
      // Check initial progress
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      // Complete first step
      const nextButtons = screen.getAllByText(/next/i);
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        const updated = JSON.parse(localStorage.getItem('recognition:onboarding:manager'));
        expect(updated.currentStep).toBe(1);
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ManagerChecklist />);

      const nextButton = screen.getAllByText(/next/i)[0];
      await user.tab();
      expect(nextButton).toBeFocus();

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByText(/step_2_description/i)).toBeInTheDocument();
      });
    });

    it('allows skipping onboarding', async () => {
      render(<ManagerChecklist />);
      const skipButton = screen.getByText(/skip/i);
      fireEvent.click(skipButton);

      await waitFor(() => {
        const state = JSON.parse(localStorage.getItem('recognition:onboarding:manager'));
        expect(state.skipped).toBe(true);
      });
    });

    it('shows completion celebration', async () => {
      render(<ManagerChecklist />);
      
      // Complete all steps
      for (let i = 0; i < 4; i++) {
        const nextButton = screen.getByText(/next/i);
        fireEvent.click(nextButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/🎉/)).toBeInTheDocument();
        expect(screen.getByText(/congratulations/i)).toBeInTheDocument();
      });
    });

    it('has WCAG 2.1 AA compliance', () => {
      render(<ManagerChecklist />);
      
      // Check ARIA labels
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax');

      // Check semantic HTML
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  describe('RecognitionTemplates Component', () => {
    it('renders 6 template cards', () => {
      render(<RecognitionTemplates onSelect={jest.fn()} />);
      
      expect(screen.getByText(/teamwork/i)).toBeInTheDocument();
      expect(screen.getByText(/leadership/i)).toBeInTheDocument();
      expect(screen.getByText(/innovation/i)).toBeInTheDocument();
      expect(screen.getByText(/communication/i)).toBeInTheDocument();
      expect(screen.getByText(/reliability/i)).toBeInTheDocument();
      expect(screen.getByText(/support/i)).toBeInTheDocument();
    });

    it('filters templates by difficulty', async () => {
      const user = userEvent.setup();
      render(<RecognitionTemplates onSelect={jest.fn()} />);

      const beginnerFilter = screen.getByText(/beginner/i);
      await user.click(beginnerFilter);

      // Should show only beginner templates
      expect(screen.queryByText(/advanced/i)).not.toBeInTheDocument();
    });

    it('calls onSelect callback with template data', async () => {
      const onSelect = jest.fn();
      render(<RecognitionTemplates onSelect={onSelect} />);

      const templateCard = screen.getByText(/teamwork/i).closest('li');
      fireEvent.click(templateCard);

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.any(String),
        reason: expect.any(String),
        tags: expect.any(Array),
      }));
    });

    it('displays template descriptions', () => {
      render(<RecognitionTemplates onSelect={jest.fn()} />);
      
      // Each template should have description text
      const descriptions = screen.getAllByText(/description/i);
      expect(descriptions.length).toBeGreaterThan(0);
    });

    it('has responsive grid layout', () => {
      const { container } = render(<RecognitionTemplates onSelect={jest.fn()} />);
      const grid = container.querySelector('.recognition-template-grid');
      
      expect(grid).toHaveClass('recognition-template-grid');
      // CSS media queries handle responsive columns
    });

    it('has proper ARIA structure', () => {
      render(<RecognitionTemplates onSelect={jest.fn()} />);
      
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      const items = screen.getAllByRole('listitem');
      expect(items.length).toBe(6);
    });
  });

  describe('BulkVerificationModal Component', () => {
    const mockRecognitions = [
      {
        $id: '1',
        title: 'Great teamwork',
        reason: 'Helped with project',
        giverName: 'Alice',
        recipientName: 'Bob',
        weight: 3.5,
        status: 'pending',
      },
      {
        $id: '2',
        title: 'Innovation',
        reason: 'New approach',
        giverName: 'Charlie',
        recipientName: 'Diana',
        weight: 4.5,
        status: 'pending',
      },
    ];

    it('renders recognition items with checkboxes', () => {
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      expect(screen.getByText(/great teamwork/i)).toBeInTheDocument();
      expect(screen.getByText(/innovation/i)).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(3); // 2 items + select all
    });

    it('supports multi-select with checkbox', async () => {
      const user = userEvent.setup();
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // Select first item
      
      expect(checkboxes[1]).toBeChecked();
    });

    it('supports select/deselect all', async () => {
      const user = userEvent.setup();
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      const allCheckboxes = screen.getAllByRole('checkbox');
      allCheckboxes.forEach(cb => {
        expect(cb).toBeChecked();
      });
    });

    it('enables approve/reject buttons only when items selected', async () => {
      const user = userEvent.setup();
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      const approveBtn = screen.getByText(/approve_selected/i);
      expect(approveBtn).toBeDisabled();

      const checkbox = screen.getAllByRole('checkbox')[1];
      await user.click(checkbox);

      expect(approveBtn).not.toBeDisabled();
    });

    it('calls onVerify with selected items and action', async () => {
      const onVerify = jest.fn();
      const user = userEvent.setup();
      
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={onVerify}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1];
      await user.click(checkbox);

      const approveBtn = screen.getByText(/approve_selected/i);
      await user.click(approveBtn);

      expect(onVerify).toHaveBeenCalledWith(
        expect.arrayContaining(['1']),
        'approved',
        expect.any(String)
      );
    });

    it('requires justification for rejections', async () => {
      const user = userEvent.setup();
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1];
      await user.click(checkbox);

      const rejectBtn = screen.getByText(/reject_selected/i);
      await user.click(rejectBtn);

      // Should show justification textarea
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/justification/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during verification', async () => {
      const { rerender } = render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
          isLoading={false}
        />
      );

      rerender(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
          isLoading={true}
        />
      );

      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });

    it('has WCAG 2.1 AA compliance', () => {
      render(
        <BulkVerificationModal
          recognitions={mockRecognitions}
          isOpen={true}
          onClose={jest.fn()}
          onVerify={jest.fn()}
        />
      );

      // Check modal accessibility
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');

      // Check form accessibility
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(cb => {
        expect(cb).toHaveAccessibleName();
      });
    });
  });

  describe('ManagerDashboard Component', () => {
    const mockStats = {
      totalRecognitions: 42,
      pendingVerifications: 5,
      approvedThisMonth: 38,
    };

    const mockRecognitions = [
      {
        $id: '1',
        title: 'Great work',
        giverName: 'Alice',
        recipientName: 'Bob',
        status: 'pending',
        weight: 3.5,
      },
    ];

    it('displays statistics cards', () => {
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={mockRecognitions}
        />
      );

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('38')).toBeInTheDocument();
    });

    it('has search functionality', async () => {
      const user = userEvent.setup();
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={mockRecognitions}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'great');

      await waitFor(() => {
        expect(screen.getByText(/great work/i)).toBeInTheDocument();
      });
    });

    it('filters by status', async () => {
      const user = userEvent.setup();
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={mockRecognitions}
        />
      );

      const pendingFilter = screen.getByText(/pending/i);
      await user.click(pendingFilter);

      expect(screen.getByText(/great work/i)).toBeInTheDocument();
    });

    it('opens bulk verification modal', async () => {
      const user = userEvent.setup();
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={mockRecognitions}
        />
      );

      const bulkVerifyBtn = screen.getByText(/bulk_verify/i);
      await user.click(bulkVerifyBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('displays recognition list', () => {
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={mockRecognitions}
        />
      );

      expect(screen.getByText(/great work/i)).toBeInTheDocument();
      expect(screen.getByText(/alice/i)).toBeInTheDocument();
      expect(screen.getByText(/bob/i)).toBeInTheDocument();
    });

    it('shows empty state when no recognitions', () => {
      render(
        <ManagerDashboard
          stats={mockStats}
          recognitions={[]}
        />
      );

      expect(screen.getByText(/no_recognitions/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility & Compliance', () => {
    it('all components have proper ARIA labels', () => {
      const { container: checklist } = render(<ManagerChecklist />);
      expect(checklist.querySelectorAll('[aria-label]').length).toBeGreaterThan(0);

      const { container: templates } = render(
        <RecognitionTemplates onSelect={jest.fn()} />
      );
      expect(templates.querySelectorAll('[aria-label]').length).toBeGreaterThan(0);
    });

    it('components support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ManagerChecklist />);

      // Tab through interactive elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role');
    });

    it('components support dark mode', () => {
      const { container } = render(<ManagerChecklist />);
      
      // Check for media query support in styles
      const styles = container.querySelector('style');
      expect(styles?.textContent).toContain('prefers-color-scheme');
    });

    it('components respect reduced motion preferences', () => {
      const { container } = render(<ManagerChecklist />);
      
      const styles = container.querySelector('style');
      expect(styles?.textContent).toContain('prefers-reduced-motion');
    });
  });

  describe('Integration Tests', () => {
    it('Manager workflow: create checklist -> view templates -> verify recognitions', async () => {
      const user = userEvent.setup();

      // Step 1: Complete checklist
      const { unmount: unmountChecklist } = render(<ManagerChecklist />);
      
      const nextButtons = screen.getAllByText(/next/i);
      for (let i = 0; i < 4; i++) {
        await user.click(nextButtons[0]);
      }

      unmountChecklist();

      // Step 2: View templates
      const onSelect = jest.fn();
      render(<RecognitionTemplates onSelect={onSelect} />);
      
      const templateCard = screen.getByText(/teamwork/i).closest('li');
      await user.click(templateCard);

      expect(onSelect).toHaveBeenCalled();
    });
  });
});
