import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, Settings, Building2, MessageCircle } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import ProductionErrorBoundary from '@/components/ProductionErrorBoundary';
import startersLogo from '@/assets/starters-logo-christmas.png';
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
  const logoUrl = settings?.logo_url || startersLogo;
  return <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Address */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Address
            </h3>
            <div className="space-y-2 text-gray-300">
              <div className="font-medium">Headquarters:</div>
              <div>2B Close Off 11 Crescent Kado Estate, Abuja</div>
              
              
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Services
            </h3>
            <div className="space-y-2">
              <Link to="/" className="block text-gray-300 hover:text-white transition-colors">Catering services</Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Company
            </h3>
            <div className="space-y-2">
              <Link to="/about" className="block text-gray-300 hover:text-white transition-colors">About us</Link>
              
              
            </div>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Contact Us
            </h3>
            <div className="space-y-2 text-gray-300">
              <a 
                href="https://wa.me/2348073011100" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.386"/>
                </svg>
                +234 807 3011 100
              </a>
              
              <a 
                href="https://wa.me/2349088388886" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.386"/>
                </svg>
                +234 908 838 8886
              </a>
              
              <a 
                href="mailto:support@startersmallchops.com"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4" />
                support@startersmallchops.com
              </a>
              
              <a 
                href="https://www.instagram.com/startersmallchops/" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Instagram className="w-4 h-4" />
                @startersmallchops
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            {/* Logo and Tagline */}
            <div className="flex items-center space-x-3">
              <img src={logoUrl} alt={`${businessName} Logo`} className="h-8 w-auto" onError={e => {
              e.currentTarget.src = startersLogo;
            }} />
              <span className="text-gray-400 text-sm"></span>
            </div>

            {/* Social Media Icons */}
            <div className="flex items-center space-x-4">
              {settings?.facebook_url && <Link to={settings.facebook_url} className="text-gray-400 hover:text-white transition-colors" target="_blank">
                  <Facebook className="w-5 h-5" />
                </Link>}
              {settings?.twitter_url && <Link to={settings.twitter_url} className="text-gray-400 hover:text-white transition-colors" target="_blank">
                  <Twitter className="w-5 h-5" />
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