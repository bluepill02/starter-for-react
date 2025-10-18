// Accessible Form Components with ARIA and Error Handling
import React, { useState, useId } from 'react';
import { FieldError } from '../hooks/useErrorHandler';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: FieldError;
  helpText?: string;
  children: React.ReactElement;
}

export function FormField({ label, required = false, error, helpText, children }: FormFieldProps): React.ReactElement {
  const fieldId = useId();
  const errorId = useId();
  const helpId = useId();

  // Clone child element with necessary props
  const childWithProps = React.cloneElement(children, {
    id: fieldId,
    'aria-describedby': [
      error ? errorId : undefined,
      helpText ? helpId : undefined,
    ].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  });

  return (
    <div className="space-y-1">
      <label 
        htmlFor={fieldId}
        className={`
          block text-sm font-medium text-gray-700
          ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
        `}
      >
        {label}
      </label>
      
      {childWithProps}
      
      {helpText && (
        <p id={helpId} className="text-sm text-gray-500">
          {helpText}
        </p>
      )}
      
      {error && (
        <p 
          id={errorId} 
          className="text-sm text-red-600" 
          role="alert"
          aria-live="polite"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function TextInput({ error, className = '', ...props }: TextInputProps): React.ReactElement {
  return (
    <input
      type="text"
      className={`
        block w-full rounded-md border-gray-300 shadow-sm
        focus:border-indigo-500 focus:ring-indigo-500
        disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function TextArea({ error, className = '', ...props }: TextAreaProps): React.ReactElement {
  return (
    <textarea
      className={`
        block w-full rounded-md border-gray-300 shadow-sm
        focus:border-indigo-500 focus:ring-indigo-500
        disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({ error, options, placeholder, className = '', ...props }: SelectProps): React.ReactElement {
  return (
    <select
      className={`
        block w-full rounded-md border-gray-300 shadow-sm
        focus:border-indigo-500 focus:ring-indigo-500
        disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
        ${error ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}
      `}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option 
          key={option.value} 
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: FieldError;
}

export function Checkbox({ label, description, error, className = '', ...props }: CheckboxProps): React.ReactElement {
  const checkboxId = useId();
  const errorId = useId();
  const descriptionId = useId();

  return (
    <div className="relative flex items-start">
      <div className="flex items-center h-5">
        <input
          id={checkboxId}
          type="checkbox"
          className={`
            h-4 w-4 text-indigo-600 border-gray-300 rounded
            focus:ring-indigo-500 focus:ring-offset-0
            disabled:cursor-not-allowed disabled:text-gray-400
            ${error ? 'border-red-300 focus:ring-red-500' : ''}
            ${className}
          `}
          aria-describedby={[
            description ? descriptionId : undefined,
            error ? errorId : undefined,
          ].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? 'true' : 'false'}
          {...props}
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={checkboxId} className="font-medium text-gray-700">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-gray-500">
            {description}
          </p>
        )}
        {error && (
          <p 
            id={errorId} 
            className="text-red-600 mt-1" 
            role="alert"
            aria-live="polite"
          >
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}

interface RadioGroupProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  error?: FieldError;
  required?: boolean;
}

export function RadioGroup({ 
  name, 
  label, 
  value, 
  onChange, 
  options, 
  error, 
  required = false 
}: RadioGroupProps): React.ReactElement {
  const groupId = useId();
  const errorId = useId();

  return (
    <fieldset>
      <legend className={`
        text-sm font-medium text-gray-700 mb-3
        ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}
      `}>
        {label}
      </legend>
      
      <div 
        className="space-y-3"
        role="radiogroup"
        aria-labelledby={groupId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id={optionId}
                  name={name}
                  type="radio"
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  className={`
                    h-4 w-4 text-indigo-600 border-gray-300
                    focus:ring-indigo-500 focus:ring-offset-0
                    ${error ? 'border-red-300 focus:ring-red-500' : ''}
                  `}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor={optionId} className="font-medium text-gray-700">
                  {option.label}
                </label>
                {option.description && (
                  <p className="text-gray-500">{option.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {error && (
        <p 
          id={errorId} 
          className="mt-2 text-sm text-red-600" 
          role="alert"
          aria-live="polite"
        >
          {error.message}
        </p>
      )}
    </fieldset>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props 
}: ButtonProps): React.ReactElement {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200';
  
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      
      {!loading && leftIcon && (
        <span className="mr-2" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      
      {children}
      
      {!loading && rightIcon && (
        <span className="ml-2" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
}

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  errors?: FieldError[];
  onSubmit: (e: React.FormEvent) => void;
}

export function Form({ errors = [], onSubmit, children, ...props }: FormProps): React.ReactElement {
  const hasErrors = errors.length > 0;

  return (
    <form 
      onSubmit={onSubmit}
      noValidate
      {...props}
    >
      {hasErrors && (
        <div 
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md"
          role="alert"
          aria-live="polite"
        >
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Please fix the following {errors.length === 1 ? 'error' : 'errors'}:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc space-y-1 pl-5">
                  {errors.map((error, index) => (
                    <li key={`${error.field}-${index}`}>
                      <strong>{error.field}:</strong> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {children}
    </form>
  );
}