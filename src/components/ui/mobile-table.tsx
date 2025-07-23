import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileTableProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

interface MobileFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const MobileTable = ({ children, className }: MobileTableProps) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {children}
      </div>
    );
  }
  
  return (
    <div className={cn("bg-card rounded-2xl shadow-sm border border-border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
};

export const MobileRow = ({ children, onClick, className }: MobileRowProps) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div 
        className={cn(
          "bg-card rounded-xl border border-border p-4 space-y-3 shadow-sm",
          onClick && "cursor-pointer hover:bg-accent/50",
          className
        )}
        onClick={onClick}
      >
        {children}
      </div>
    );
  }
  
  return (
    <tr 
      className={cn("border-b border-border hover:bg-accent/50 transition-colors", className)}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export const MobileField = ({ label, children, className }: MobileFieldProps) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <div className={cn("flex justify-between items-center", className)}>
        <span className="text-sm font-medium text-muted-foreground">{label}:</span>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    );
  }
  
  return <td className={cn("py-4 px-6", className)}>{children}</td>;
};

export const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return null; // Headers are not shown in mobile view
  }
  
  return (
    <thead className="bg-muted/50 border-b border-border">
      <tr>{children}</tr>
    </thead>
  );
};

export const MobileHeaderCell = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <th className={cn("text-left py-4 px-6 font-medium text-muted-foreground", className)}>{children}</th>;
};

export const MobileBody = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return <>{children}</>;
  }
  
  return <tbody>{children}</tbody>;
};