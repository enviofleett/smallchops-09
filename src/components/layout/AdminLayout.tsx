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
      <div className="flex min-h-screen w-full">
        {/* Sidebar - Collapsible on mobile */}
        <AppSidebar />
        
        {/* Main Content Area with Refined Layout */}
        <SidebarInset className="flex-1 min-w-0 bg-gradient-to-br from-background via-background to-muted/20">
          <div className="flex flex-col min-h-screen w-full">
            {/* Top Navigation - Sticky with blur effect */}
            <TopNav />
            
            {/* Main Content with Perfect Spacing & Typography */}
            <main className={cn(
              "flex-1 w-full transition-all duration-300 ease-in-out",
              "overflow-x-hidden overflow-y-auto",
              isMobile 
                ? "px-4 py-5 space-y-5" 
                : "px-6 py-7 space-y-7 lg:px-10 lg:py-9 lg:space-y-9"
            )}>
              {/* Content Container with Refined Max Width */}
              <div className={cn(
                "w-full mx-auto",
                "max-w-[1920px]", // Optimal max width for readability
                "animate-in fade-in-50 duration-500" // Smooth entrance animation
              )}>
                <ProductionErrorBoundary>
                  <Outlet />
                </ProductionErrorBoundary>
              </div>
            </main>
            
            {/* Footer with subtle styling */}
            <footer className={cn(
              "border-t border-border/50 bg-background/95 backdrop-blur-sm",
              "px-6 py-4 text-center",
              isMobile ? "text-xs" : "text-sm"
            )}>
              <p className="text-muted-foreground">
                © 2025 Starters. All rights reserved.
              </p>
            </footer>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;