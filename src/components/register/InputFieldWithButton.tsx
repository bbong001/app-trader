import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface FieldError {
  message?: string;
  type?: string;
}

interface Props {
  label: string;
  name: string;
  placeholder: string;
  register: (name: any) => UseFormRegisterReturn;
  error?: FieldError;
  buttonText: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function InputFieldWithButton({
  label,
  name,
  placeholder,
  register,
  error,
  buttonText,
  onClick,
  isLoading = false,
  disabled = false,
}: Props) {
  return (
    <div className="mb-4">
      <label className="block text-white text-sm mb-2">{label}</label>
      <div className="relative flex">
        <input
          type="text"
          {...register(name)}
          placeholder={placeholder}
          className={`flex-1 bg-gray-800 text-white px-4 py-3 rounded-l-lg border ${
            error ? 'border-red-500' : 'border-gray-700'
          } focus:outline-none focus:border-green-400 transition placeholder-gray-500`}
        />
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || isLoading}
          className={`px-4 text-gray-900 font-medium rounded-r-lg transition ${
            disabled || isLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isLoading ? '...' : buttonText}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

