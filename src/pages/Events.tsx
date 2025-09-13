import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { ArrowRight, Heart, Briefcase, TreePine } from 'lucide-react';
import { Link } from 'react-router-dom';
import weddingCatering from '@/assets/wedding-catering.jpg';
import corporateCatering from '@/assets/corporate-catering.jpg';
import memorialCatering from '@/assets/memorial-catering.jpg';

const Events = () => {
  const eventTypes = [
    {
      id: 'weddings',
      title: 'Weddings & Celebrations',
      description: 'Make your special day unforgettable with our elegant wedding catering services. From intimate gatherings to grand celebrations.',
      image: weddingCatering,
      icon: Heart,
      features: ['Custom menu planning', 'Elegant presentation', 'Professional service staff', 'Flexible packages'],
      color: 'from-pink-500/20 to-rose-500/20'
    },
    {
      id: 'corporate',
      title: 'Corporate Events',
      description: 'Impress your clients and colleagues with professional catering for meetings, conferences, and corporate gatherings.',
      image: corporateCatering,
      icon: Briefcase,
      features: ['Business lunch packages', 'Conference catering', 'Executive dining', 'Timely delivery'],
      color: 'from-blue-500/20 to-indigo-500/20'
    },
    {
      id: 'memorial',
      title: 'Memorial Services',
      description: 'Provide comfort during difficult times with our respectful and dignified catering services for memorial gatherings.',
      image: memorialCatering,
      icon: TreePine,
      features: ['Compassionate service', 'Flexible arrangements', 'Comfort food options', 'Respectful presentation'],
      color: 'from-gray-500/20 to-slate-500/20'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Catering for Every Occasion
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            From intimate family gatherings to grand celebrations, we provide exceptional catering services 
            tailored to your unique event needs. Let us make your special moment memorable.
          </p>
        </div>

        {/* Event Types Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {eventTypes.map((event, index) => {
            const IconComponent = event.icon;
            return (
              <Card key={event.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-0 bg-card">
                <div className="relative">
                  <img 
                    src={event.image} 
                    alt={event.title}
                    className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${event.color} transition-opacity duration-300 group-hover:opacity-80`} />
                  <div className="absolute top-4 left-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </div>
                
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {event.title}
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground leading-relaxed">
                    {event.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <ul className="space-y-2 mb-6">
                    {event.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Button asChild className="w-full">
                    <Link to="/booking" state={{ eventType: event.id }}>
                      Get Quote for {event.title}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Plan Your Event?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Contact us today to discuss your catering needs. Our team will work with you to create 
            a customized menu and service plan that perfectly fits your event and budget.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/booking">
                Request Quote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8">
              View Sample Menus
            </Button>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Events;