
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const DashboardCard = ({ 
  title, 
  value, 
  change, 
  changeType, 
  icon, 
  children, 
  className = '' 
}: DashboardCardProps) => {
  return (
    <div className={`bg-card rounded-xl shadow-sm border border-border p-5 hover:shadow-md transition-all duration-200 w-full ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{value}</p>
        </div>
        {icon && (
          <div className="p-3 bg-primary/10 rounded-lg ml-4 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
      
      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${
            changeType === 'positive' ? 'text-green-600' : 'text-destructive'
          }`}>
            {changeType === 'positive' ? '++' : ''}{change}
          </span>
          <span className="text-muted-foreground text-sm">vs last month</span>
        </div>
      )}
      
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
