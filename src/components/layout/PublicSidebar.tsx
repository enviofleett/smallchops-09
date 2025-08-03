import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { getCategories } from '@/api/categories';

interface PublicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicSidebar = ({ isOpen, onClose }: PublicSidebarProps) => {
  const navigate = useNavigate();
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-white z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:relative lg:translate-x-0 lg:w-64 lg:z-0`}>
        <div className="h-full overflow-y-auto">
          <div className="p-6">
            {/* Main Navigation */}
            <div className="space-y-2 mb-8">
              <div 
                onClick={() => handleNavigation('/')}
                className="flex items-center justify-between p-4 hover:bg-orange-50 rounded-lg cursor-pointer transition-colors group"
              >
                <span className="text-lg font-medium text-red-600">Home</span>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-red-600" />
              </div>
              
              <div 
                onClick={() => handleNavigation('/customer-profile')}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
              >
                <span className="text-lg font-medium text-gray-800">Account</span>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
              </div>
              
              <div 
                onClick={() => handleNavigation('/products')}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
              >
                <span className="text-lg font-medium text-gray-800">Shop</span>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
              </div>
              
              <div 
                onClick={() => handleNavigation('/blog')}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
              >
                <span className="text-lg font-medium text-gray-800">Blog</span>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
              </div>
              
              <div 
                onClick={() => handleNavigation('/about')}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
              >
                <span className="text-lg font-medium text-gray-800">About Us</span>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Categories Section */}
            <div>
              <h3 className="text-xl font-bold text-red-600 mb-4">Categories</h3>
              <div className="space-y-1">
                <div 
                  onClick={() => handleNavigation('/')}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="text-lg font-medium text-red-600">All</span>
                </div>
                
                {/* Static categories based on screenshot */}
                <div 
                  onClick={() => handleNavigation('/category/platters')}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="text-lg text-gray-800">Platters</span>
                </div>
                
                <div 
                  onClick={() => handleNavigation('/category/packs')}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="text-lg text-gray-800">Packs</span>
                </div>
                
                <div 
                  onClick={() => handleNavigation('/category/lunchboxes')}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="text-lg text-gray-800">Lunchboxes</span>
                </div>
                
                <div 
                  onClick={() => handleNavigation('/category/customization')}
                  className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="text-lg text-gray-800">Customization</span>
                </div>

                {/* Dynamic categories from database */}
                {categories.map((category) => (
                  <div 
                    key={category.id}
                    onClick={() => handleNavigation(`/category/${category.id}`)}
                    className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <span className="text-lg text-gray-800">{category.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};