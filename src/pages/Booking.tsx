import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';
const Booking = () => {
  const location = useLocation();
  const eventType = location.state?.eventType;
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    numberOfGuests: '',
    additionalDetails: '',
    eventType: '',
    isCompanyOrder: false,
    companyName: ''
  });
  const [eventDate, setEventDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  useEffect(() => {
    if (eventType) {
      const eventTypeNames = {
        weddings: 'Weddings & Celebrations',
        corporate: 'Corporate Events',
        memorial: 'Memorial Services'
      };
      const eventName = eventTypeNames[eventType as keyof typeof eventTypeNames];
      if (eventName) {
        setFormData(prev => ({
          ...prev,
          additionalDetails: `Event Type: ${eventName}\n\n`
        }));
      }
    }
  }, [eventType]);
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleSubmitBooking = async () => {
    // Comprehensive validation
    const errors = [];
    if (!formData.fullName?.trim()) {
      errors.push('Full name is required');
    }
    if (!formData.email?.trim()) {
      errors.push('Email address is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.push('Please enter a valid email address');
    }
    if (!formData.phoneNumber?.trim()) {
      errors.push('Phone number is required');
    } else if (!/^[\d\s\+\-\(\)]+$/.test(formData.phoneNumber.trim())) {
      errors.push('Please enter a valid phone number');
    }
    if (!formData.eventType) {
      errors.push('Please select an event type');
    }
    if (!eventDate) {
      errors.push('Event date is required');
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(eventDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errors.push('Event date cannot be in the past');
      }

      // Check if event is too far in the future (optional business rule)
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2);
      if (selectedDate > maxDate) {
        errors.push('Please select an event date within the next 2 years');
      }
    }
    if (!formData.numberOfGuests?.trim()) {
      errors.push('Number of guests is required');
    } else {
      const guestCount = parseInt(formData.numberOfGuests);
      if (isNaN(guestCount) || guestCount < 1) {
        errors.push('Number of guests must be at least 1');
      } else if (guestCount > 10000) {
        errors.push('Please contact us directly for events over 10,000 guests');
      }
    }
    if (formData.isCompanyOrder && !formData.companyName?.trim()) {
      errors.push('Company name is required for company orders');
    }

    // Display all validation errors
    if (errors.length > 0) {
      toast.error('Please fix the following issues:\n• ' + errors.join('\n• '));
      return;
    }
    setIsSubmitting(true);
    try {
      const bookingData = {
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phoneNumber.trim(),
        event_date: format(eventDate!, 'yyyy-MM-dd'),
        number_of_guests: parseInt(formData.numberOfGuests),
        additional_details: formData.additionalDetails?.trim() || null,
        event_type: formData.eventType,
        is_company_order: formData.isCompanyOrder,
        company_name: formData.isCompanyOrder ? formData.companyName?.trim() : null
      };
      const {
        data: booking,
        error
      } = await supabase.from('catering_bookings').insert(bookingData).select().single();
      if (error) {
        console.error('Database error:', error);
        throw new Error('Failed to save booking. Please try again.');
      }

      // Send WhatsApp notification (non-blocking)
      try {
        await supabase.functions.invoke('send-whatsapp-booking', {
          body: {
            booking: bookingData
          }
        });
      } catch (whatsappError) {
        console.error('WhatsApp notification failed:', whatsappError);
        // Don't fail the main submission if WhatsApp fails
      }
      setIsSubmitted(true);
      toast.success('🎉 Catering request submitted successfully! We\'ll contact you within 24 hours.');

      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        numberOfGuests: '',
        additionalDetails: '',
        eventType: '',
        isCompanyOrder: false,
        companyName: ''
      });
      setEventDate(undefined);
    } catch (error: any) {
      console.error('Error submitting catering request:', error);
      toast.error(error.message || 'Failed to submit request. Please check your connection and try again.');
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
            <h1 className="text-4xl font-bold text-foreground mb-6">Planning an event?<br /></h1>
We’ve got you covered.

            <div className="text-lg text-muted-foreground space-y-6 max-w-3xl mx-auto leading-relaxed">
              <p className="text-left">From weddings to birthdays, corporate meetings to intimate gatherings - we bring the taste that makes your event unforgettable. 
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
              <div>
                <label className="block text-sm font-medium mb-2">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <Select value={formData.eventType} onValueChange={value => handleInputChange('eventType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weddings">Weddings</SelectItem>
                    <SelectItem value="office_event">Office Event</SelectItem>
                    <SelectItem value="funerals">Funerals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="company-order" checked={formData.isCompanyOrder} onCheckedChange={checked => {
                  setFormData(prev => ({
                    ...prev,
                    isCompanyOrder: checked === true,
                    companyName: checked === true ? prev.companyName : ''
                  }));
                }} />
                  <label htmlFor="company-order" className="text-sm font-medium">
                    This is a company order
                  </label>
                </div>

                {formData.isCompanyOrder && <div>
                    <label className="block text-sm font-medium mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <Input value={formData.companyName} onChange={e => handleInputChange('companyName', e.target.value)} placeholder="Enter company name" />
                  </div>}
              </div>

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
                    <PopoverContent className="w-auto p-0 bg-popover border shadow-lg" align="start">
                      <Calendar mode="single" selected={eventDate} onSelect={setEventDate} disabled={date => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }} initialFocus className="p-3 pointer-events-auto" numberOfMonths={1} classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      day_range_end: "day-range-end",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible"
                    }} />
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
                {isSubmitting ? <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Submitting Request...
                  </> : 'Submit Catering Request'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>;
};
export default Booking;