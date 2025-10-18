// Micro-interactions and Accessibility Demo Page
import React, { useState } from 'react';
import { useToastHelpers } from '../../hooks/useToast';
import { useErrorHandler, recognitionSchemas } from '../../hooks/useErrorHandler';
import { FileUpload } from '../../components/FileUpload';
import { FormField, TextInput, TextArea, Button, Form } from '../../components/Form';
import { z } from 'zod';

// Demo form schema
const demoFormSchema = z.object({
  recipient: z.string().min(1, 'Please select a recipient'),
  message: z.string().min(20, 'Message must be at least 20 characters'),
  priority: z.enum(['low', 'medium', 'high']),
});

type DemoFormData = z.infer<typeof demoFormSchema>;

export default function MicroInteractionsDemo(): React.ReactElement {
  const [formData, setFormData] = useState<Partial<DemoFormData>>({
    recipient: '',
    message: '',
    priority: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { showSuccess, showError, showWarning, showInfo } = useToastHelpers();
  const { validateAndHandle, handleError } = useErrorHandler();

  const handleInputChange = (field: keyof DemoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    try {
      // Validate form data
      const validatedData = validateAndHandle(demoFormSchema, formData);
      if (!validatedData) {
        setIsSubmitting(false);
        return;
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Success
      showSuccess(
        'Recognition sent!',
        `Your recognition for ${validatedData.recipient} has been sent successfully.`
      );
      
      // Reset form
      setFormData({ recipient: '', message: '', priority: 'medium' });
      
    } catch (error) {
      handleError(error, 'Submit recognition');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      // Simulate file upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      showSuccess('Files uploaded', `Successfully uploaded ${files.length} file(s)`);
    } catch (error) {
      throw new Error('Upload failed. Please try again.');
    }
  };

  const demoToastTypes = () => {
    showInfo('Info notification', 'This is an informational message with no action required.');
    
    setTimeout(() => {
      showWarning('Warning notification', 'This is a warning message that needs attention.');
    }, 1000);
    
    setTimeout(() => {
      showError(
        'Error with action',
        'This error has an action button for remediation.',
        {
          label: 'Retry',
          onClick: () => showInfo('Retry clicked', 'The retry action was triggered.'),
        }
      );
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Micro-interactions & Accessibility Demo
        </h1>
        
        <div className="space-y-8">
          {/* Toast Notifications Demo */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Toast Notifications with ARIA Live Regions
            </h2>
            <p className="text-gray-600 mb-4">
              Toast notifications with subtle animations, ARIA live regions for screen readers,
              and respect for reduced motion preferences.
            </p>
            
            <div className="space-x-4">
              <Button 
                onClick={() => showSuccess('Success!', 'Operation completed successfully.')}
                variant="primary"
              >
                Show Success
              </Button>
              
              <Button 
                onClick={demoToastTypes}
                variant="secondary"
              >
                Demo All Types
              </Button>
            </div>
          </section>

          {/* Form with Validation Demo */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Accessible Form with Live Validation
            </h2>
            <p className="text-gray-600 mb-4">
              Forms with ARIA labels, live validation feedback, keyboard navigation,
              and actionable error messages.
            </p>

            <Form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <FormField
                  label="Recipient"
                  required
                  error={formErrors.recipient ? { field: 'recipient', message: formErrors.recipient } : undefined}
                  helpText="Select who you want to recognize"
                >
                  <TextInput
                    value={formData.recipient || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('recipient', e.target.value)}
                    placeholder="Start typing a name..."
                    error={!!formErrors.recipient}
                  />
                </FormField>

                <FormField
                  label="Recognition Message"
                  required
                  error={formErrors.message ? { field: 'message', message: formErrors.message } : undefined}
                  helpText="Describe what you're recognizing them for (minimum 20 characters)"
                >
                  <TextArea
                    value={formData.message || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('message', e.target.value)}
                    placeholder="Write your recognition message..."
                    rows={4}
                    error={!!formErrors.message}
                  />
                </FormField>

                <div className="flex space-x-4">
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    variant="primary"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Recognition'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setFormData({ recipient: '', message: '', priority: 'medium' });
                      setFormErrors({});
                    }}
                  >
                    Clear Form
                  </Button>
                </div>
              </div>
            </Form>
          </section>

          {/* File Upload Demo */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              File Upload with Progress & Animations
            </h2>
            <p className="text-gray-600 mb-4">
              Drag-and-drop file upload with progress bars, micro-animations,
              keyboard accessibility, and screen reader announcements.
            </p>

            <FileUpload
              onUpload={handleFileUpload}
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
              multiple
              maxFiles={3}
              maxSize={5 * 1024 * 1024} // 5MB
            />
          </section>

          {/* Keyboard Navigation Demo */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Keyboard Navigation & Focus Management
            </h2>
            <p className="text-gray-600 mb-4">
              All interactive elements are keyboard accessible with visible focus rings
              and logical tab order.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">
                <strong>Try keyboard navigation:</strong>
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Tab</kbd> to navigate between elements</li>
                <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> or <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Space</kbd> to activate buttons</li>
                <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Escape</kbd> to close toast notifications</li>
                <li>• All form fields have proper labels and error announcements</li>
              </ul>
            </div>
          </section>

          {/* Motion Preferences Demo */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Respecting Motion Preferences
            </h2>
            <p className="text-gray-600 mb-4">
              All animations respect the user's motion preferences set in their operating system.
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Current motion preference:</strong>{' '}
                {window.matchMedia('(prefers-reduced-motion: reduce)').matches 
                  ? 'Reduced motion enabled - animations are disabled' 
                  : 'Motion enabled - animations are active'
                }
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}