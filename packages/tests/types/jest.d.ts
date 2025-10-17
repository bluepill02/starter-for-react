/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toHaveValue(value: string | number): R;
    toBeVisible(): R;
    toBeChecked(): R;
  }
}