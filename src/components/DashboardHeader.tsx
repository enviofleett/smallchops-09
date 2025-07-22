
import React from 'react';


const DashboardHeader = () => {
  return (
    <div className="mb-8">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">D</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome to DotCrafts</h1>
          <p className="text-gray-600">Here's what's happening with your business today</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
