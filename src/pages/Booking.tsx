import React, { useState } from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, User } from 'lucide-react';
import { toast } from 'sonner';

const Booking = () => {
  const { isAuthenticated } = useCustomerAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available time slots
  const timeSlots = [
    { value: '9-12', label: '9:00 AM - 12:00 PM' },
    { value: '12-3', label: '12:00 PM - 3:00 PM' },
    { value: '3-6', label: '3:00 PM - 6:00 PM' },
    { value: '6-9', label: '6:00 PM - 9:00 PM' },
  ];

  const handleSubmitBooking = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to make a booking');
      navigate('/auth');
      return;
    }

    if (!selectedDate || !selectedTimeSlot) {
      toast.error('Please select both date and time slot');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate booking submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Booking request submitted successfully!');
      setSelectedDate(undefined);
      setSelectedTimeSlot('');
      setDeliveryInstructions('');
    } catch (error) {
      toast.error('Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Schedule Your Delivery
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Book a convenient delivery time slot for your orders. We'll deliver fresh products right to your doorstep.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Booking Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Select Date & Time
                </CardTitle>
                <CardDescription>
                  Choose your preferred delivery date and time slot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Delivery Date
                  </label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date() || date < new Date(new Date().setDate(new Date().getDate() - 1))}
                    className="rounded-md border"
                  />
                </div>

                {/* Time Slot Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Time Slot
                  </label>
                  <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {slot.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Instructions */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Delivery Instructions (Optional)
                  </label>
                  <Textarea
                    placeholder="Any special delivery instructions, location details, or preferences..."
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  onClick={handleSubmitBooking}
                  disabled={isSubmitting || !selectedDate || !selectedTimeSlot}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Book Delivery Slot'}
                </Button>
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="space-y-6">
              {/* Delivery Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Delivery Areas</h4>
                    <p className="text-sm text-muted-foreground">
                      We deliver to all major areas within the city. Delivery fees may vary based on location.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Delivery Times</h4>
                    <p className="text-sm text-muted-foreground">
                      Monday to Saturday: 9:00 AM - 9:00 PM<br />
                      Sunday: 10:00 AM - 6:00 PM
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Booking Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Booking Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Book at least 24 hours in advance</li>
                    <li>• Ensure someone is available during the selected time slot</li>
                    <li>• You'll receive a confirmation call before delivery</li>
                    <li>• Cancellations must be made 12 hours before delivery</li>
                    <li>• Additional charges may apply for failed delivery attempts</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Customer Account Reminder */}
              {!isAuthenticated && (
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                          Account Required
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                          Please sign in to your account to book delivery slots.
                        </p>
                        <Button 
                          onClick={() => navigate('/auth')}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
                        >
                          Sign In
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Booking;