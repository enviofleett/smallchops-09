
import React, { useState } from 'react';
import { Search, Bell, User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBusinessSettings } from '../hooks/useBusinessSettings';


interface TopNavProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
}

const TopNav = ({ onMenuClick, isMobile }: TopNavProps) => {
  const { user, logout } = useAuth();
  const { data: settings } = useBusinessSettings();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <header className="bg-card border-b border-border px-4 py-3 lg:px-6 lg:py-4 sticky top-0 z-30 w-full">
      <div className="flex items-center justify-between gap-3 w-full max-w-none">
        {/* Left side - Mobile menu and branding */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Mobile menu button */}
          {isMobile && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground lg:hidden flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          {/* Business name - only show on desktop or when no mobile menu */}
          {!isMobile && (
            <div className="flex items-center">
              <h1 className="text-lg font-semibold text-foreground hidden sm:block truncate">
                {settings?.name || 'DotCrafts'}
              </h1>
            </div>
          )}
          
          {/* Search bar */}
          <div className="flex-1 max-w-xs sm:max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder={isMobile ? "Search..." : "Search orders, customers..."}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right side - Notifications and User menu */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Notifications */}
          <button 
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              3
            </span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              {!isMobile && (
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-foreground truncate max-w-20">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border border-border py-2 z-50">
                <button className="w-full px-4 py-2 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </button>
                <hr className="my-2 border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-destructive hover:bg-destructive/10 flex items-center gap-2 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
