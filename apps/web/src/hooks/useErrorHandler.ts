// Error Handling and Validation System
import { z } from 'zod';
import { useToastHelpers } from './useToast';

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ActionableError {
  title: string;
  message: string;
  code?: string;
  action?: {
    label: string;
    handler: () => void;
  };
  documentation?: {
    label: string;
    url: string;
  };
}

// Common validation schemas
export const commonSchemas = {
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'),
  url: z.string().url('Please enter a valid URL'),
  required: z.string().min(1, 'This field is required'),
} as const;

// Recognition-specific schemas
export const recognitionSchemas = {
  recipient: z.string().min(1, 'Please select a recipient'),
  reason: z.string().min(20, 'Recognition reason must be at least 20 characters to provide meaningful context')
    .max(500, 'Recognition reason must be less than 500 characters'),
  tags: z.array(z.string()).max(3, 'Maximum 3 tags allowed'),
  evidence: z.object({
    type: z.enum(['text', 'file', 'link']),
    content: z.string().optional(),
    fileId: z.string().optional(),
    url: z.string().url().optional(),
  }).optional(),
  privacy: z.enum(['public', 'team', 'private']),
} as const;

// Settings schemas
export const settingsSchemas = {
  profile: z.object({
    displayName: commonSchemas.name,
    email: commonSchemas.email,
    phone: commonSchemas.phone.optional(),
    timezone: z.string().min(1, 'Please select a timezone'),
    language: z.enum(['en', 'ta']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      digest: z.enum(['none', 'daily', 'weekly']),
    }),
  }),
  
  security: z.object({
    currentPassword: commonSchemas.password,
    newPassword: commonSchemas.password,
    confirmPassword: z.string(),
    twoFactorEnabled: z.boolean(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
  
  organization: z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters'),
    domain: z.string().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid domain'),
    dataResidency: z.enum(['us', 'eu', 'ap']),
    complianceMode: z.enum(['standard', 'gdpr', 'hipaa']),
    ssoEnabled: z.boolean(),
    scimEnabled: z.boolean(),
  }),
} as const;

export class ErrorHandler {
  private toastHelpers: ReturnType<typeof useToastHelpers>;

  constructor(toastHelpers: ReturnType<typeof useToastHelpers>) {
    this.toastHelpers = toastHelpers;
  }

  // Handle Zod validation errors
  handleValidationErrors(error: z.ZodError): FieldError[] {
    return error.issues.map((issue: z.ZodIssue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }

  // Handle API errors with actionable messages
  handleApiError(error: unknown, context?: string): ActionableError {
    if (error instanceof Error) {
      return this.createActionableError(error, context);
    }
    
    return {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred. Please try again.',
      action: {
        label: 'Retry',
        handler: () => window.location.reload(),
      },
    };
  }

  private createActionableError(error: Error, context?: string): ActionableError {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        action: {
          label: 'Retry',
          handler: () => window.location.reload(),
        },
        documentation: {
          label: 'Troubleshoot connection issues',
          url: '/docs/troubleshooting#network',
        },
      };
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return {
        title: 'Authentication Required',
        message: 'Your session has expired. Please sign in again.',
        code: 'AUTH_ERROR',
        action: {
          label: 'Sign In',
          handler: () => window.location.href = '/auth/signin',
        },
      };
    }

    // Permission errors
    if (message.includes('forbidden') || message.includes('permission')) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        code: 'PERMISSION_ERROR',
        documentation: {
          label: 'Learn about permissions',
          url: '/docs/permissions',
        },
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        code: 'VALIDATION_ERROR',
      };
    }

    // File upload errors
    if (message.includes('file') || message.includes('upload')) {
      return {
        title: 'Upload Failed',
        message: 'Unable to upload file. Please check the file size and format.',
        code: 'UPLOAD_ERROR',
        documentation: {
          label: 'Supported file formats',
          url: '/docs/file-uploads',
        },
      };
    }

    // Rate limiting
    if (message.includes('rate') || message.includes('limit')) {
      return {
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly. Please wait a moment and try again.',
        code: 'RATE_LIMIT_ERROR',
        documentation: {
          label: 'Understanding rate limits',
          url: '/docs/rate-limits',
        },
      };
    }

    // Server errors
    if (message.includes('server') || message.includes('internal')) {
      return {
        title: 'Server Error',
        message: 'Something went wrong on our end. Our team has been notified.',
        code: 'SERVER_ERROR',
        action: {
          label: 'Contact Support',
          handler: () => window.open('/support', '_blank'),
        },
      };
    }

    // Default error
    return {
      title: context ? `${context} Failed` : 'Error',
      message: error.message || 'An unexpected error occurred.',
      action: {
        label: 'Retry',
        handler: () => window.location.reload(),
      },
    };
  }

  // Show error toast with action
  showError(error: ActionableError): void {
    this.toastHelpers.showError(
      error.title,
      error.message,
      error.action ? {
        label: error.action.label,
        onClick: error.action.handler,
      } : undefined
    );
  }

  // Show validation errors as toast
  showValidationErrors(errors: FieldError[]): void {
    const message = errors.length === 1 
      ? errors[0].message
      : `Please fix ${errors.length} validation errors`;
    
    this.toastHelpers.showError('Validation Error', message);
  }

  // Log error for debugging (without PII)
  logError(error: unknown, context?: string): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      context,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Application Error:', errorInfo);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      // errorTrackingService.captureException(error, { extra: errorInfo });
    }
  }
}

// Custom hook for error handling
export function useErrorHandler() {
  const toastHelpers = useToastHelpers();
  const errorHandler = new ErrorHandler(toastHelpers);

  const handleError = (error: unknown, context?: string) => {
    errorHandler.logError(error, context);
    const actionableError = errorHandler.handleApiError(error, context);
    errorHandler.showError(actionableError);
  };

  const handleValidationError = (error: z.ZodError) => {
    const fieldErrors = errorHandler.handleValidationErrors(error);
    errorHandler.showValidationErrors(fieldErrors);
    return fieldErrors;
  };

  const validateAndHandle = <T>(schema: z.ZodSchema<T>, data: unknown): T | null => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error);
      } else {
        handleError(error, 'Validation');
      }
      return null;
    }
  };

  return {
    handleError,
    handleValidationError,
    validateAndHandle,
    logError: errorHandler.logError.bind(errorHandler),
  };
}

// Utility function for form validation
export function createFormValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: FieldError[] } => {
    try {
      const validData = schema.parse(data);
      return { success: true, data: validData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.issues.map((issue: z.ZodIssue) => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));
        return { success: false, errors: fieldErrors };
      }
      throw error;
    }
  };
}