import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

export const PublicFooter = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo and Tagline */}
          <div className="flex items-center space-x-3">
            <img
              src="/lovable-uploads/e95a4052-3128-4494-b416-9d153cf30c5c.png"
              alt="Starters Logo"
              className="h-8 w-auto"
            />
            <span className="text-gray-400 text-sm">SMALL CHOPS</span>
          </div>

          {/* Contact Information */}
          <div className="text-center space-y-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-gray-300">
              <a 
                href="tel:+2348073011100" 
                className="min-h-[44px] flex items-center px-4 py-2 hover:text-white transition-colors"
              >
                +234 807 3011 100
              </a>
              <a 
                href="mailto:support@starters.co" 
                className="min-h-[44px] flex items-center px-4 py-2 hover:text-white transition-colors"
              >
                support@starters.co
              </a>
            </div>
          </div>

          {/* Social Media and Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
            {/* Social Media Icons */}
            <div className="flex items-center space-x-4">
              {settings?.facebook_url && (
                <Link 
                  to={settings.facebook_url} 
                  className="text-gray-400 hover:text-white transition-colors p-2"
                  target="_blank"
                >
                  <Facebook className="w-5 h-5" />
                </Link>
              )}
              {settings?.twitter_url && (
                <Link 
                  to={settings.twitter_url} 
                  className="text-gray-400 hover:text-white transition-colors p-2"
                  target="_blank"
                >
                  <Twitter className="w-5 h-5" />
                </Link>
              )}
              {settings?.instagram_url && (
                <Link 
                  to={settings.instagram_url} 
                  className="text-gray-400 hover:text-white transition-colors p-2"
                  target="_blank"
                >
                  <Instagram className="w-5 h-5" />
                </Link>
              )}
            </div>

            {/* Copyright */}
            <p className="text-gray-400 text-sm text-center">
              © {new Date().getFullYear()} {settings?.name || 'Starters'}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};