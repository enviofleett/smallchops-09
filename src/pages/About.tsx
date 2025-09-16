import React from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, Award, Globe } from 'lucide-react';
const About = () => {
  return <div className="min-h-screen bg-background">
      <PublicHeader />
      
      {/* Hero Banner Section */}
      <section className="relative py-20 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">About Starters.</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Revolutionizing the finger food business in Nigeria and West Africa with quality, 
              innovation, and exceptional customer service since 2005.
            </p>
          </div>
        </div>
        
        {/* Banner Image */}
        <div className="absolute inset-0 -z-10">
          <img src="/lovable-uploads/4eaaaa62-bc47-49d0-a366-e4de879be1b3.png" alt="Golden fried finger food balls garnished with microgreens" className="w-full h-full object-cover opacity-10" />
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">How It All Began</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>It was a sunny October day in 2005 when STARTERS first came to life in the buzzing city of Abuja. Our founder, Gwen, had one big dream: to shake up the small chops scene with fresh ideas, bold flavors, and a sprinkle of love.</p>
                  <p>
                    With a knack for business, a deep passion for food, and a heart full of compassion, Gwen wanted to create more than just another finger food brand — she wanted an experience. One that delivers quality in every bite and leaves every customer with a smile (and maybe a craving for seconds!).
                  </p>
                  <p>
                    But it's not just about the food — it's about people. At STARTERS, we invest in our team through education and growth opportunities, believing that empowered staff create extraordinary customer experiences.
                  </p>
                  <p>
                    From the kitchen to your table, we pour our energy into making sure every event feels special. We train and grow our team because happy people make happy food — and trust us, you can taste the difference.
                  </p>
                  <p>
                    Our goal? To be Nigeria's go-to for unforgettable small chops — the kind you remember long after the last bite.
                  </p>
                  <p className="font-medium text-foreground">
                    At STARTERS, we don't just serve food. We serve joy… one delicious plate at a time.
                  </p>
                </div>
              </div>
              <div className="order-2 md:order-1">
                <img src="/lovable-uploads/b0faf90f-366c-461d-9966-d8fb3cd9fd20.png" alt="Golden fried finger food balls on white plate with microgreens" className="w-full rounded-lg shadow-lg object-cover h-64 md:h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Values Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">Our Mission & Values</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Driving innovation in the finger food industry while maintaining the highest 
                standards of quality and customer satisfaction.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="text-center">
                <CardContent className="p-6">
                  <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3">Our Mission</h3>
                  <p className="text-muted-foreground">
                    To revolutionize the finger food business in Nigeria and West Africa, 
                    becoming the number one finger food company through business creativity 
                    and customer feedback.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <Award className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3">Quality Standards</h3>
                  <p className="text-muted-foreground">
                    We maintain the highest standards with 100% fresh, hygienic products 
                    made with care by our team of exceptional culinary experts.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <Globe className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3">Expansion Vision</h3>
                  <p className="text-muted-foreground">
                    From our base in Nigeria's capital cities, we aim to expand throughout 
                    West Africa, bringing quality finger foods to more communities.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-1 md:order-1">
                <img src="/lovable-uploads/4eaaaa62-bc47-49d0-a366-e4de879be1b3.png" alt="Golden fried finger food balls beautifully plated with garnish" className="w-full rounded-lg shadow-lg object-cover h-64 md:h-auto" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">What We Offer</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Retail Services</h3>
                      <p className="text-muted-foreground">
                        Easy access to our fresh finger foods whenever you need them, 
                        available at convenient locations across the city.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Outdoor Event Services</h3>
                      <p className="text-muted-foreground">
                        Professional catering for outdoor events with customized menus 
                        tailored to suit your specific requirements and preferences.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Custom Menu Creation</h3>
                      <p className="text-muted-foreground">
                        Personalized menu planning that adapts to your event size, 
                        dietary requirements, and budget considerations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-8">
              <Users className="h-12 w-12 text-primary mr-4" />
              <h2 className="text-3xl font-bold text-foreground">Our Team</h2>
            </div>
            <p className="text-lg text-muted-foreground mb-8">Founded and led by Gwen, our company is powered by a dedicated team of subject matter experts with exceptional culinary skills. Together, we bring years of experience and passion for creating extraordinary finger food experiences.</p>
            <div className="bg-primary/10 rounded-lg p-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                "Our philosophy is simple: provide amazing food products backed by a unique 
                customer experience characterized by reliability, honesty, and integrity."
              </h3>
              <p className="text-muted-foreground">- Gwen, Founder</p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>;
};
export default About;