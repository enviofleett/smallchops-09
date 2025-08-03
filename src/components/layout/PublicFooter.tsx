import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import ProductionErrorBoundary from '@/components/ProductionErrorBoundary';
export const PublicFooter = () => {
  return <ProductionErrorBoundary context="PublicFooter" showErrorDetails={false}>
      <PublicFooterContent />
    </ProductionErrorBoundary>;
};
const PublicFooterContent = () => {
  const {
    data: settings,
    error
  } = useBusinessSettings();

  // Graceful degradation
  const businessName = settings?.name || 'Starters';
  const logoUrl = settings?.logo_url || "/lovable-uploads/e95a4052-3128-4494-b416-9d153cf30c5c.png";
  return <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Address */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Address</h3>
            <div className="space-y-2 text-gray-300">
              <div className="font-medium">Headquarters:</div>
              <div>346 Adeoye Ogunlana St, lifecamp, Abuja</div>
              
              
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Services</h3>
            <div className="space-y-2">
              <Link to="/" className="block text-gray-300 hover:text-white transition-colors">Home</Link>
              
              <Link to="/blog" className="block text-gray-300 hover:text-white transition-colors">Blog</Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Company</h3>
            <div className="space-y-2">
              <Link to="/about" className="block text-gray-300 hover:text-white transition-colors">About us</Link>
              <Link to="/blog" className="block text-gray-300 hover:text-white transition-colors">Blog</Link>
              
            </div>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Contact Us</h3>
            <div className="space-y-2 text-gray-300">
              <div>+234 807 3011 100</div>
              <div>+234 908 8388 886</div>
              <div>support@starters.co</div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            {/* Logo and Tagline */}
            <div className="flex items-center space-x-3">
              <img src={logoUrl} alt={`${businessName} Logo`} className="h-8 w-auto" onError={e => {
              e.currentTarget.src = "/lovable-uploads/e95a4052-3128-4494-b416-9d153cf30c5c.png";
            }} />
              <span className="text-gray-400 text-sm">{settings?.tagline || 'SMALL CHOPS'}</span>
            </div>

            {/* Social Media Icons */}
            <div className="flex items-center space-x-4">
              {settings?.facebook_url && <Link to={settings.facebook_url} className="text-gray-400 hover:text-white transition-colors" target="_blank">
                  <Facebook className="w-5 h-5" />
                </Link>}
              {settings?.twitter_url && <Link to={settings.twitter_url} className="text-gray-400 hover:text-white transition-colors" target="_blank">
                  <Twitter className="w-5 h-5" />
                </Link>}
              {settings?.instagram_url && <Link to={settings.instagram_url} className="text-gray-400 hover:text-white transition-colors" target="_blank">
                  <Instagram className="w-5 h-5" />
                </Link>}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-center pt-8">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>;
};