
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
    <header className="bg-card border-b border-border px-3 sm:px-4 lg:px-6 py-3 lg:py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3">
        {/* Mobile menu button */}
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-accent-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        {/* Business branding and search */}
        <div className="flex items-center space-x-3 sm:space-x-6 flex-1 min-w-0">
          {!isMobile && (
            <div className="flex items-center space-x-3">
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">
                {settings?.name || 'DotCrafts'}
              </h1>
            </div>
          )}
          
          <div className="flex-1 max-w-sm sm:max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 sm:h-5 sm:w-5" />
              <input
                type="text"
                placeholder={isMobile ? "Search..." : "Search orders, customers, products..."}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notifications */}
          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-xs">
              3
            </span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 rounded-xl hover:bg-accent transition-colors"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
              {!isMobile && (
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-popover rounded-xl shadow-lg border border-border py-2 z-50">
                <button className="w-full px-4 py-2 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </button>
                <hr className="my-2 border-border" />
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-destructive hover:bg-destructive/10 flex items-center space-x-2"
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
