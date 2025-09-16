import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface RequiredFieldLabelProps {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const RequiredFieldLabel: React.FC<RequiredFieldLabelProps> = ({
  htmlFor,
  required = false,
  children,
  className
}) => {
  return (
    <Label 
      htmlFor={htmlFor} 
      className={cn("flex items-center gap-1 text-sm font-medium", className)}
    >
      {children}
      {required && (
        <span className="text-red-500 text-sm font-bold ml-1" aria-label="required">
          *
        </span>
      )}
      {!required && (
        <span className="text-muted-foreground text-xs font-normal ml-1">
          (optional)
        </span>
      )}
    </Label>
  );
};