import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AdaptiveDialogProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const AdaptiveDialog: React.FC<AdaptiveDialogProps> = ({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  className,
  size = 'md'
}) => {
  const isMobile = useIsMobile();

  const sizeClasses = {
    sm: 'max-w-sm sm:max-w-md',
    md: 'max-w-full sm:max-w-2xl',
    lg: 'max-w-full sm:max-w-4xl',
    xl: 'max-w-full sm:max-w-6xl lg:max-w-7xl',
    full: 'max-w-full'
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && (
          <SheetTrigger asChild>
            {trigger}
          </SheetTrigger>
        )}
        <SheetContent 
          side="bottom" 
          className={cn(
            "max-h-[90vh] min-h-[50vh] overflow-y-auto rounded-t-lg",
            "w-full mx-auto",
            className
          )}
        >
          <SheetHeader className="text-left pb-4">
            <SheetTitle>{title}</SheetTitle>
            {description && (
              <SheetDescription>{description}</SheetDescription>
            )}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className={cn(
        sizeClasses[size],
        "max-h-[90vh] overflow-y-auto",
        "w-[95vw] sm:w-auto",
        "mx-auto p-0",
        className
      )}>
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold leading-none tracking-tight">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="px-6 pb-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};