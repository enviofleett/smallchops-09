import React from 'react';
import { useCustomerBookings } from '@/hooks/useCustomerBookings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingDetailsModal } from './BookingDetailsModal';
import { 
  Calendar, 
  Users, 
  Phone, 
  Mail, 
  MessageSquare, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/lib/formatCurrency';
import { useNavigate } from 'react-router-dom';

// Loading skeleton component
const BookingSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    ))}
  </div>
);

export function CustomerBookingsSection() {
  const { data: bookingsData, isLoading, error, refetch } = useCustomerBookings();
  const navigate = useNavigate();
  const [selectedBooking, setSelectedBooking] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const bookings = bookingsData?.bookings || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Catering Bookings</h2>
          <p className="text-gray-500">Your event catering requests and quotes</p>
        </div>
        <BookingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Catering Bookings</h2>
          <p className="text-gray-500">Your event catering requests and quotes</p>
        </div>
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to load bookings</h3>
          <p className="text-gray-500 mb-4">We couldn't fetch your booking information.</p>
          <Button onClick={() => refetch()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Catering Bookings</h2>
          <p className="text-gray-500">Your event catering requests and quotes</p>
        </div>
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No catering bookings yet</h3>
          <p className="text-gray-500 mb-6">
            Start planning your perfect event with our catering services.
          </p>
          <Button onClick={() => navigate('/booking')}>
            Request Catering Quote
          </Button>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'quoted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'quoted':
        return <DollarSign className="w-4 h-4" />;
      case 'confirmed':
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return 'We\'re reviewing your request and will contact you within 24 hours.';
      case 'quoted':
        return 'We\'ve prepared a custom quote for your event. Please review and confirm.';
      case 'confirmed':
        return 'Your catering is confirmed! We\'ll be in touch with final details.';
      case 'completed':
        return 'Thank you for choosing our catering services for your event!';
      case 'cancelled':
        return 'This booking has been cancelled. Contact us if you have questions.';
      default:
        return 'Status unknown. Please contact us for updates.';
    }
  };

  // Calculate summary stats
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const totalValue = bookings
    .filter(b => b.quote_amount && b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.quote_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Catering Bookings</h2>
          <p className="text-gray-500">Your event catering requests and quotes</p>
        </div>
        <Button onClick={() => navigate('/booking')}>
          New Booking Request
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{confirmedBookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {bookings.map((booking) => (
          <Card 
            key={booking.id} 
            className="border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            onClick={() => {
              setSelectedBooking(booking);
              setIsModalOpen(true);
            }}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Event on {format(new Date(booking.event_date), 'MMMM dd, yyyy')}</CardTitle>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {booking.number_of_guests} guests
                    </span>
                    <span className="text-xs text-gray-400">
                      Requested {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
                    </span>
                  </CardDescription>
                </div>
                <Badge className={`flex items-center gap-1 ${getStatusColor(booking.status)}`}>
                  {getStatusIcon(booking.status)}
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Message */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-700">{getStatusMessage(booking.status)}</p>
              </div>

              {/* Quote Information */}
              {booking.quote_amount && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">Quote Amount</span>
                    <span className="text-lg font-bold text-green-800">
                      {formatCurrency(booking.quote_amount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Event Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Contact Information</label>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {booking.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3 h-3 text-gray-400" />
                      {booking.phone_number}
                    </div>
                  </div>
                </div>
                
                {booking.additional_details && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Special Requests</label>
                    <div className="mt-1">
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        {booking.additional_details}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              {booking.admin_notes && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <label className="text-sm font-medium text-blue-800">Message from our team</label>
                      <p className="text-sm text-blue-700 mt-1">{booking.admin_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
                {booking.status === 'quoted' && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    Contact us to Confirm
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => navigate('/booking')}>
                  Request Another Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBooking(null);
        }}
      />
    </div>
  );
}