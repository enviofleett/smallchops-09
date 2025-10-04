import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface EnhancedInputFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  success?: boolean;
  helperText?: string;
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
  validate?: (value: string) => { valid: boolean; message?: string };
  showPasswordToggle?: boolean;
}

export function EnhancedInputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  required = false,
  disabled = false,
  error,
  success,
  helperText,
  maxLength,
  minLength,
  autoComplete,
  validate,
  showPasswordToggle = false,
}: EnhancedInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationState, setValidationState] = useState<{ valid: boolean; message?: string } | null>(null);

  const inputType = type === 'password' && showPasswordToggle && showPassword ? 'text' : type;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (validate && touched) {
      const result = validate(newValue);
      setValidationState(result);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (validate && value) {
      const result = validate(value);
      setValidationState(result);
    }
  };

  const hasError = touched && (error || (validationState && !validationState.valid));
  const hasSuccess = touched && !hasError && (success || (validationState && validationState.valid));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-3 text-muted-foreground">
            {icon}
          </div>
        )}
        
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`
            ${icon ? 'pl-10' : ''}
            ${showPasswordToggle || hasError || hasSuccess ? 'pr-10' : ''}
            ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}
            ${hasSuccess ? 'border-green-500 focus-visible:ring-green-500' : ''}
          `}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={autoComplete}
        />

        <div className="absolute right-3 top-3 flex items-center gap-1">
          {hasError && <X className="h-4 w-4 text-destructive" />}
          {hasSuccess && <Check className="h-4 w-4 text-green-600" />}
          
          {showPasswordToggle && type === 'password' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>

      {(hasError || hasSuccess || helperText) && (
        <p className={`text-xs ${
          hasError ? 'text-destructive' : 
          hasSuccess ? 'text-green-600' : 
          'text-muted-foreground'
        }`}>
          {hasError ? (error || validationState?.message) : 
           hasSuccess ? 'Looks good!' : 
           helperText}
        </p>
      )}
    </div>
  );
}
