import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

export const PublicFooter = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <footer className="bg-muted/50 border-t mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo and About */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <img
                src="/lovable-uploads/e95a4052-3128-4494-b416-9d153cf30c5c.png"
                alt="Starters Logo"
                className="h-12 w-auto"
              />
            </div>
            <p className="text-muted-foreground text-sm">
              {settings?.tagline || 'Delicious snacks and treats delivered fresh to your doorstep.'}
            </p>
            <div className="flex space-x-4">
              {settings?.facebook_url && (
                <Link 
                  to={settings.facebook_url} 
                  className="text-muted-foreground hover:text-primary transition-colors"
                  target="_blank"
                >
                  <Facebook className="h-5 w-5" />
                </Link>
              )}
              {settings?.twitter_url && (
                <Link 
                  to={settings.twitter_url} 
                  className="text-muted-foreground hover:text-primary transition-colors"
                  target="_blank"
                >
                  <Twitter className="h-5 w-5" />
                </Link>
              )}
              {settings?.instagram_url && (
                <Link 
                  to={settings.instagram_url} 
                  className="text-muted-foreground hover:text-primary transition-colors"
                  target="_blank"
                >
                  <Instagram className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-muted-foreground hover:text-primary transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/delivery" className="text-muted-foreground hover:text-primary transition-colors">
                  Delivery Info
                </Link>
              </li>
              <li>
                <Link to="/returns" className="text-muted-foreground hover:text-primary transition-colors">
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Contact Info</h3>
            <div className="space-y-3">
              {settings?.email && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{settings.email}</span>
                </div>
              )}
              {settings?.phone && (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">{settings.phone}</span>
                </div>
              )}
              {settings?.address && (
                <div className="flex items-start space-x-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span className="text-sm">{settings.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {settings?.name || 'Starters'}. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link to="/terms" className="text-muted-foreground hover:text-primary text-sm transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-primary text-sm transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};