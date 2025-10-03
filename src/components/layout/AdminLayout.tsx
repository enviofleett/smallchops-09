import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from '../AppSidebar';
import TopNav from '../TopNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ProductionErrorBoundary } from '@/components/admin/ProductionErrorBoundary';

const AdminLayout = () => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Sidebar - Collapsible on mobile */}
        <AppSidebar />
        
        {/* Main Content Area */}
        <SidebarInset className="flex-1 min-w-0">
          <div className="flex flex-col min-h-screen w-full">
            {/* Top Navigation */}
            <TopNav />
            
            {/* Main Content with Responsive Padding */}
            <main className={cn(
              "flex-1 w-full transition-all duration-200 ease-in-out",
              "overflow-x-hidden", // Prevent horizontal scroll
              isMobile 
                ? "px-3 py-4 space-y-4" 
                : "px-4 py-6 space-y-6 sm:px-6 lg:px-8 lg:py-8"
            )}>
              {/* Content Container with Max Width */}
              <div className={cn(
                "w-full mx-auto",
                "max-w-[2000px]", // Max width for ultra-wide screens
              )}>
                <ProductionErrorBoundary>
                  <Outlet />
                </ProductionErrorBoundary>
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;