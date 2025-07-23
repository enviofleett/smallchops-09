
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
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        {icon && (
          <div className="p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
            {icon}
          </div>
        )}
      </div>
      
      {change && (
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${
            changeType === 'positive' ? 'text-green-600' : 'text-red-600'
          }`}>
            {changeType === 'positive' ? '+' : ''}{change}
          </span>
          <span className="text-gray-500 text-sm">vs last month</span>
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
