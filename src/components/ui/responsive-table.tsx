import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveTableProps {
  children: React.ReactNode;
  mobileComponent: React.ReactNode;
  className?: string;
}

export const ResponsiveTable = ({ children, mobileComponent, className = "" }: ResponsiveTableProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <div className={className}>{mobileComponent}</div>;
  }

  return <div className={className}>{children}</div>;
};

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const MobileCard = ({ children, className = "", onClick }: MobileCardProps) => {
  return (
    <div 
      className={`bg-background rounded-lg border border-border p-4 mb-3 shadow-sm ${onClick ? 'cursor-pointer hover:bg-accent/50' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface MobileCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileCardHeader = ({ children, className = "" }: MobileCardHeaderProps) => {
  return (
    <div className={`flex items-center justify-between mb-3 pb-3 border-b border-border/50 ${className}`}>
      {children}
    </div>
  );
};

interface MobileCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileCardContent = ({ children, className = "" }: MobileCardContentProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {children}
    </div>
  );
};

interface MobileCardRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const MobileCardRow = ({ label, value, className = "" }: MobileCardRowProps) => {
  return (
    <div className={`flex justify-between items-center text-sm ${className}`}>
      <span className="text-muted-foreground font-medium">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
};

interface MobileCardActionsProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileCardActions = ({ children, className = "" }: MobileCardActionsProps) => {
  return (
    <div className={`flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/50 ${className}`}>
      {children}
    </div>
  );
};