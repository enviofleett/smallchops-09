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
    <SidebarProvider className="min-h-screen">
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <div className="flex flex-col min-h-screen">
            <TopNav />
            <main className={cn(
              "flex-1 admin-content transition-all duration-200",
              "p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8",
              "min-h-0" // Prevent flex overflow issues
            )}>
              <div className="admin-container">
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