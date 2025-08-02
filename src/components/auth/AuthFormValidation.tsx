import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface ValidationRule {
  test: boolean;
  message: string;
}

interface AuthFormValidationProps {
  password: string;
  email?: string;
  confirmPassword?: string;
  showValidation?: boolean;
}

const AuthFormValidation = ({ password, email, confirmPassword, showValidation = true }: AuthFormValidationProps) => {
  if (!showValidation) return null;

  const passwordRules: ValidationRule[] = [
    { test: password.length >= 6, message: "At least 6 characters" },
    { test: /[A-Z]/.test(password), message: "One uppercase letter" },
    { test: /[a-z]/.test(password), message: "One lowercase letter" },
    { test: /\d/.test(password), message: "One number" },
  ];

  const emailRule: ValidationRule = {
    test: email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : true,
    message: "Valid email format"
  };

  const confirmPasswordRule: ValidationRule = {
    test: confirmPassword ? password === confirmPassword : true,
    message: "Passwords match"
  };

  return (
    <div className="space-y-2">
      {email && (
        <div className="flex items-center space-x-2 text-sm">
          {emailRule.test ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          <span className={emailRule.test ? "text-green-700" : "text-red-700"}>
            {emailRule.message}
          </span>
        </div>
      )}
      
      {password && (
        <>
          <div className="text-sm font-medium text-gray-700 mb-1">Password requirements:</div>
          {passwordRules.map((rule, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              {rule.test ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
              <span className={rule.test ? "text-green-700" : "text-red-700"}>
                {rule.message}
              </span>
            </div>
          ))}
        </>
      )}

      {confirmPassword !== undefined && (
        <div className="flex items-center space-x-2 text-sm">
          {confirmPasswordRule.test ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <X className="h-4 w-4 text-red-500" />
          )}
          <span className={confirmPasswordRule.test ? "text-green-700" : "text-red-700"}>
            {confirmPasswordRule.message}
          </span>
        </div>
      )}
    </div>
  );
};

export default AuthFormValidation;