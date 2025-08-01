
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
    <div className={`bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-xs md:text-sm font-medium truncate">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-card-foreground mt-1 break-all">{value}</p>
        </div>
        {icon && (
          <div className="p-2 md:p-3 bg-accent rounded-xl shrink-0 ml-2">
            {icon}
          </div>
        )}
      </div>
      
      {change && (
        <div className="flex items-center gap-2">
          <span className={`text-xs md:text-sm font-medium ${
            changeType === 'positive' ? 'text-green-600' : 'text-red-600'
          }`}>
            {changeType === 'positive' ? '+' : ''}{change}
          </span>
          <span className="text-muted-foreground text-xs md:text-sm">vs last month</span>
        </div>
      )}
      
      {children && (
        <div className="mt-3 md:mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
