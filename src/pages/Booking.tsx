import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
const Booking = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    numberOfGuests: '',
    additionalDetails: ''
  });
  const [eventDate, setEventDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleSubmitBooking = async () => {
    // Validation
    if (!formData.fullName || !formData.email || !formData.phoneNumber || !eventDate || !formData.numberOfGuests) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (parseInt(formData.numberOfGuests) < 1) {
      toast.error('Number of guests must be at least 1');
      return;
    }
    setIsSubmitting(true);
    try {
      const {
        error
      } = await supabase.from('catering_bookings').insert({
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        event_date: format(eventDate, 'yyyy-MM-dd'),
        number_of_guests: parseInt(formData.numberOfGuests),
        additional_details: formData.additionalDetails || null
      });
      if (error) throw error;
      setIsSubmitted(true);
      toast.success('Catering request submitted successfully!');

      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        numberOfGuests: '',
        additionalDetails: ''
      });
      setEventDate(undefined);
    } catch (error) {
      console.error('Error submitting catering request:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  if (isSubmitted) {
    return <div className="min-h-screen bg-background">
        <PublicHeader />
        
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-foreground mb-4">Request Submitted!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Thank you for choosing Starters for your event catering. Our team will review your request and contact you within 24 hours with a custom quote and menu options.
            </p>
            <Button onClick={() => setIsSubmitted(false)} variant="outline">
              Submit Another Request
            </Button>
          </div>
        </main>

        <PublicFooter />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-6">
              Hosting an Event? We've Got You Covered.
            </h1>
            <div className="text-lg text-muted-foreground space-y-6 max-w-3xl mx-auto leading-relaxed">
              <p className="text-center">From weddings to birthdays, corporate meetings to intimate gatherings- we bring the taste that makes your event unforgettable. 
Fill out the form below and we will get back to you with the perfect smallchops package.</p>

              <p className="font-semibold text-foreground text-left">
                Submit your request to receive a custom quote
              </p>
            </div>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Event Catering Request</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you with a custom quote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input value={formData.fullName} onChange={e => handleInputChange('fullName', e.target.value)} placeholder="Enter your full name" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <Input type="email" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} placeholder="Enter your email" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <Input type="tel" value={formData.phoneNumber} onChange={e => handleInputChange('phoneNumber', e.target.value)} placeholder="Enter your phone number" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Event Date <span className="text-red-500">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDate ? format(eventDate, "PPP") : "Select event date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={eventDate} onSelect={setEventDate} disabled={date => date < new Date()} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Number of Guests Expected <span className="text-red-500">*</span>
                </label>
                <Input type="number" min="1" value={formData.numberOfGuests} onChange={e => handleInputChange('numberOfGuests', e.target.value)} placeholder="Enter expected number of guests" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Additional Details or Requests
                </label>
                <Textarea value={formData.additionalDetails} onChange={e => handleInputChange('additionalDetails', e.target.value)} placeholder="Please include any dietary restrictions, preferred menu styles, budget considerations, or special requests..." rows={4} />
              </div>

              <Button onClick={handleSubmitBooking} disabled={isSubmitting} className="w-full" size="lg">
                {isSubmitting ? 'Submitting Request...' : 'Submit Catering Request'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>;
};
export default Booking;