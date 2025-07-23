
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
    <div className={`bg-card rounded-xl sm:rounded-2xl shadow-sm border border-border p-4 sm:p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 break-words">{value}</p>
        </div>
        {icon && (
          <div className="p-2 sm:p-3 bg-primary/10 rounded-lg sm:rounded-xl ml-3 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
      
      {change && (
        <div className="flex items-center space-x-2">
          <span className={`text-xs sm:text-sm font-medium ${
            changeType === 'positive' ? 'text-green-600' : 'text-destructive'
          }`}>
            {changeType === 'positive' ? '++' : ''}{change}
          </span>
          <span className="text-muted-foreground text-xs sm:text-sm">vs last month</span>
        </div>
      )}
      
      {children && (
        <div className="mt-3 sm:mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
