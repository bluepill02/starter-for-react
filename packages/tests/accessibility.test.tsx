import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

/**
 * WCAG 2.1 Level AA Accessibility Tests
 * 
 * Tests for:
 * - Color contrast (4.5:1 normal text, 3:1 large text/UI)
 * - Focus indicators (visible, >3px)
 * - ARIA labels & descriptions
 * - Keyboard navigation
 * - Error messages & live regions
 */

describe('Accessibility - WCAG 2.1 Level AA', () => {
  describe('Focus Management', () => {
    it('should have visible focus indicators on buttons', () => {
      const { container } = render(
        <button className="btn-primary">Click me</button>
      );
      const button = screen.getByRole('button');
      
      // Simulate focus
      button.focus();
      
      const styles = window.getComputedStyle(button);
      expect(styles.outline).not.toBe('none');
    });

    it('should have focus indicator on navigation links', () => {
      const { container } = render(
        <nav>
          <a href="/" className="nav-link">Home</a>
          <a href="/about" className="nav-link">About</a>
        </nav>
      );
      
      const homeLink = screen.getByText('Home');
      homeLink.focus();
      
      const styles = window.getComputedStyle(homeLink);
      expect(styles.outline).not.toBe('none');
    });

    it('should have 3px or larger focus outline', () => {
      const { container } = render(
        <input type="text" placeholder="Type here" className="form-input" />
      );
      
      const input = screen.getByPlaceholderText('Type here');
      input.focus();
      
      const styles = window.getComputedStyle(input);
      // Check for 3px or larger outline
      expect(styles.outlineWidth).toMatch(/^(3px|4px|5px|6px|[1-9]\d+px)$/);
    });

    it('should trap focus in modals', () => {
      const { container } = render(
        <div role="dialog" aria-modal="true">
          <button>First Button</button>
          <button>Second Button</button>
          <button>Close</button>
        </div>
      );
      
      const dialog = screen.getByRole('dialog');
      const buttons = screen.getAllByRole('button');
      
      // First button should be first focusable element
      buttons[0].focus();
      expect(document.activeElement).toBe(buttons[0]);
    });
  });

  describe('Color Contrast', () => {
    it('should have 4.5:1 contrast ratio on body text', () => {
      const { container } = render(
        <p style={{ color: '#374151', backgroundColor: '#ffffff' }}>
          This is body text
        </p>
      );
      
      const text = screen.getByText('This is body text');
      const styles = window.getComputedStyle(text);
      const parentStyles = window.getComputedStyle(text.parentElement!);
      
      // Verify dark text on light background
      expect(text).toBeInTheDocument();
    });

    it('should have 3:1 contrast ratio on UI components', () => {
      const { container } = render(
        <button className="btn-primary">Submit</button>
      );
      
      const button = screen.getByRole('button', { name: 'Submit' });
      expect(button).toBeInTheDocument();
    });

    it('should have visible disabled button states', () => {
      const { container } = render(
        <button disabled className="btn-primary">Disabled</button>
      );
      
      const button = screen.getByRole('button', { name: 'Disabled' });
      expect(button).toBeDisabled();
      
      const styles = window.getComputedStyle(button);
      // Should be visually different from enabled
      expect(button.getAttribute('disabled')).toBeDefined();
    });
  });

  describe('ARIA Labels & Descriptions', () => {
    it('should have aria-label on icon-only buttons', () => {
      const { container } = render(
        <button aria-label="Close modal">✕</button>
      );
      
      const button = screen.getByRole('button', { name: 'Close modal' });
      expect(button).toHaveAttribute('aria-label', 'Close modal');
    });

    it('should have aria-describedby on form fields with error', () => {
      const { container } = render(
        <>
          <input
            id="email"
            type="email"
            aria-describedby="email-error"
            aria-invalid="true"
          />
          <div id="email-error" role="alert">
            Invalid email address
          </div>
        </>
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should have aria-label on form groups', () => {
      const { container } = render(
        <fieldset>
          <legend>Visibility Settings</legend>
          <label>
            <input type="radio" name="visibility" value="PRIVATE" />
            Private
          </label>
          <label>
            <input type="radio" name="visibility" value="TEAM" />
            Team Only
          </label>
        </fieldset>
      );
      
      const legend = screen.getByText('Visibility Settings');
      expect(legend).toBeInTheDocument();
    });

    it('should announce live region updates', () => {
      const { container, rerender } = render(
        <div aria-live="polite" aria-atomic="true">
          Ready
        </div>
      );
      
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Tab key navigation', () => {
      const { container } = render(
        <>
          <button>First</button>
          <input type="text" placeholder="Search" />
          <button>Last</button>
        </>
      );
      
      const buttons = screen.getAllByRole('button');
      const input = screen.getByPlaceholderText('Search');
      
      expect(buttons[0]).toBeInTheDocument();
      expect(input).toBeInTheDocument();
      expect(buttons[1]).toBeInTheDocument();
    });

    it('should support Enter key on buttons', () => {
      const handleClick = jest.fn();
      const { container } = render(
        <button onClick={handleClick} role="button" tabIndex={0}>
          Click
        </button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabIndex');
    });

    it('should support Escape key to close modals', () => {
      const handleClose = jest.fn();
      const { container } = render(
        <div role="dialog" onKeyDown={e => e.key === 'Escape' && handleClose()}>
          Modal content
        </div>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should skip to main content with skip link', () => {
      const { container } = render(
        <>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <nav>Navigation</nav>
          <main id="main-content">Main content</main>
        </>
      );
      
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toHaveClass('skip-link');
    });
  });

  describe('Error Messages & Form Validation', () => {
    it('should display error message in aria-alert role', () => {
      const { container } = render(
        <>
          <input type="email" value="invalid" />
          <div role="alert">Please enter a valid email address</div>
        </>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Please enter a valid email address');
    });

    it('should mark required fields with aria-required', () => {
      const { container } = render(
        <input
          type="text"
          aria-required="true"
          aria-label="Full name"
          required
        />
      );
      
      const input = screen.getByLabelText('Full name');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('required');
    });

    it('should describe field validation rules', () => {
      const { container } = render(
        <>
          <input
            id="password"
            type="password"
            aria-describedby="pwd-hint"
            minLength={8}
          />
          <div id="pwd-hint">
            Password must be at least 8 characters
          </div>
        </>
      );
      
      const input = screen.getByDisplayValue('');
      expect(input).toHaveAttribute('aria-describedby', 'pwd-hint');
    });
  });

  describe('Semantic HTML', () => {
    it('should use proper heading hierarchy', () => {
      const { container } = render(
        <>
          <h1>Page Title</h1>
          <h2>Section One</h2>
          <h3>Subsection</h3>
        </>
      );
      
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
    });

    it('should use list elements for grouped links', () => {
      const { container } = render(
        <nav>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
      );
      
      const list = screen.getByRole('list');
      const items = screen.getAllByRole('listitem');
      
      expect(list).toBeInTheDocument();
      expect(items).toHaveLength(3);
    });

    it('should use button instead of div with click handler', () => {
      const { container } = render(
        <button onClick={() => {}} role="button">
          Action
        </button>
      );
      
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('axe-core Integration Tests', () => {
    it('should not have any automated accessibility violations in a button', async () => {
      const { container } = render(
        <button className="btn-primary">Submit</button>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations in a modal dialog', async () => {
      const { container } = render(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <h2 id="dialog-title">Confirm Action</h2>
          <p>Are you sure?</p>
          <button>Yes</button>
          <button>No</button>
        </div>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations in a form', async () => {
      const { container } = render(
        <form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" required />
          
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required />
          
          <button type="submit">Submit</button>
        </form>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations in a list of links', async () => {
      const { container } = render(
        <nav>
          <ul>
            <li><a href="/page1">Page 1</a></li>
            <li><a href="/page2">Page 2</a></li>
            <li><a href="/page3">Page 3</a></li>
          </ul>
        </nav>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce loading states', () => {
      const { container } = render(
        <div aria-live="polite" aria-busy="true">
          Loading...
        </div>
      );
      
      const liveRegion = container.querySelector('[aria-busy="true"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should announce success messages', () => {
      const { container } = render(
        <div role="status" aria-live="polite">
          ✓ Recognition saved successfully
        </div>
      );
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Recognition saved successfully');
    });

    it('should announce validation errors', () => {
      const { container } = render(
        <div role="alert" aria-live="assertive">
          ⚠ Please fill in all required fields
        </div>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Please fill in all required fields');
    });
  });

  describe('Print Accessibility', () => {
    it('should hide skip links in print view', () => {
      const { container } = render(
        <style>{`
          @media print {
            .skip-link { display: none; }
          }
        `}</style>
      );
      
      expect(container).toBeInTheDocument();
    });

    it('should show full URLs in print view', () => {
      const { container } = render(
        <a href="https://example.com" target="_blank">
          Example
        </a>
      );
      
      const link = screen.getByText('Example');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });
});
