import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={`rounded-lg border px-3 py-2 text-sm outline-none transition-colors
          focus:ring-2 focus:ring-orange-400 focus:border-orange-400
          ${error ? 'border-red-400' : 'border-gray-300'}
          disabled:bg-gray-50 disabled:cursor-not-allowed ${className}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
