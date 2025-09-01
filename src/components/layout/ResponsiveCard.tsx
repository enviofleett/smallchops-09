import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  interactive?: boolean;
  loading?: boolean;
  variant?: 'default' | 'elevated' | 'outline' | 'glass';
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  interactive = false,
  loading = false,
  variant = 'default'
}) => {
  const isMobile = useIsMobile();

  const variantClasses = {
    default: 'admin-card',
    elevated: 'admin-card shadow-lg',
    outline: 'border-2 border-border bg-card rounded-xl',
    glass: 'glass-effect'
  };

  return (
    <Card className={cn(
      variantClasses[variant],
      interactive && 'interactive-card',
      loading && 'animate-pulse',
      className
    )}>
      {(title || description) && (
        <CardHeader className={cn(
          isMobile ? "p-4 pb-2" : "p-6 pb-4"
        )}>
          {title && (
            <CardTitle className={cn(
              "text-foreground",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className={cn(
              "text-muted-foreground",
              isMobile ? "text-sm" : "text-base"
            )}>
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}

      <CardContent className={cn(
        isMobile ? "p-4" : "p-6",
        !title && !description && (isMobile ? "pt-4" : "pt-6"),
        contentClassName
      )}>
        {children}
      </CardContent>

      {footer && (
        <CardFooter className={cn(
          "border-t border-border",
          isMobile ? "p-4 pt-4" : "p-6 pt-4"
        )}>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
};