
import React from 'react';

const OrdersHeader = () => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Orders</h1>
        <p className="text-gray-600 mt-2">Manage and track all your orders</p>
      </div>
      <button className="mt-4 sm:mt-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all">
        Export Orders
      </button>
    </div>
  );
};

export default OrdersHeader;
