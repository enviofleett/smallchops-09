
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { Outlet } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {isMobile && mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden on mobile by default */}
      <Sidebar 
        isCollapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={isMobile}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
      />
      
      {/* Main content - full width on mobile */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        <TopNav 
          onMenuClick={() => setMobileSidebarOpen(true)}
          isMobile={isMobile}
        />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 w-full overflow-x-hidden">
          <div className="w-full max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
