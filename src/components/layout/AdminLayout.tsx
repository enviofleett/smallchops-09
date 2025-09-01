import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from '../AppSidebar';
import TopNav from '../TopNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
              isMobile ? "p-4" : "p-6 lg:p-8"
            )}>
              <div className="admin-container">
                <Outlet />
              </div>
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;