import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, MapPin, Clock, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
const Contact = () => {
  const {
    data: settings,
    isLoading
  } = useBusinessSettings();
  if (isLoading) {
    return <div className="min-h-screen bg-white">
        <PublicHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>;
  }
  return <div className="min-h-screen bg-white">
      <PublicHeader />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-red-50 to-orange-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We'd love to hear from you! Whether you have questions about our delicious small chops, 
            need catering services, or want to place an order, we're here to help.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Contact Details */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Information</h2>
                <p className="text-gray-600 mb-8">
                  Ready to satisfy your cravings? Reach out to us through any of these channels.
                </p>
              </div>

              <div className="space-y-6">
                {/* Address */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <MapPin className="h-6 w-6 text-red-600 mt-1" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Our Location</h3>
                        <p className="text-gray-600">
                          {settings?.address || '2B Close Off 11Crescent Kado Estate, Kado Abuja'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Phone */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Phone className="h-6 w-6 text-red-600 mt-1" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Phone</h3>
                        <p className="text-gray-600">
                          {settings?.phone || '0807 301 1100'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Call us for orders and inquiries
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Email */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Mail className="h-6 w-6 text-red-600 mt-1" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Email</h3>
                        
                        <p className="text-sm text-gray-500 mt-1">
                          Send us an email anytime
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Hours */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Clock className="h-6 w-6 text-red-600 mt-1" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Business Hours</h3>
                        <div className="text-gray-600 space-y-1">
                          {settings?.working_hours ? <p>{settings.working_hours}</p> : <>
                              <p>Open ⋅ Closes 6 pm</p>
                            </>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Send us a Message</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                          Name
                        </label>
                        <input type="text" id="name" name="name" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" placeholder="Your name" />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                          Phone
                        </label>
                        <input type="tel" id="phone" name="phone" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" placeholder="Your phone number" />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input type="email" id="email" name="email" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" placeholder="your.email@example.com" />
                    </div>
                    
                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                        Subject
                      </label>
                      <select id="subject" name="subject" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500">
                        <option value="">Select a subject</option>
                        <option value="order">Place an Order</option>
                        <option value="catering">Catering Services</option>
                        <option value="delivery">Delivery Inquiry</option>
                        <option value="feedback">Feedback</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                        Message
                      </label>
                      <textarea id="message" name="message" rows={5} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" placeholder="Tell us how we can help you..."></textarea>
                    </div>
                    
                    <button type="submit" className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                      Send Message
                    </button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Media */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Follow Us</h2>
          <p className="text-gray-600 mb-8">
            Stay connected with us on social media for the latest updates, special offers, and mouth-watering content!
          </p>
          
          <div className="flex justify-center space-x-6">
            {settings?.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                <Facebook className="h-6 w-6" />
              </a>}
            
            {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-pink-600 text-white rounded-full hover:bg-pink-700 transition-colors">
                <Instagram className="h-6 w-6" />
              </a>}
            
            {settings?.twitter_url && <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-400 text-white rounded-full hover:bg-blue-500 transition-colors">
                <Twitter className="h-6 w-6" />
              </a>}
            
            {settings?.linkedin_url && <a href={settings.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-800 text-white rounded-full hover:bg-blue-900 transition-colors">
                <Linkedin className="h-6 w-6" />
              </a>}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>;
};
export default Contact;