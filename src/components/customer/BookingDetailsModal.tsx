import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Users, Mail, Phone, FileText, Clock, DollarSign } from 'lucide-react';

interface CateringBooking {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  event_date: string;
  number_of_guests: number;
  additional_details?: string;
  status: string;
  quote_amount?: number;
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

interface BookingDetailsModalProps {
  booking: CateringBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  booking,
  isOpen,
  onClose,
}) => {
  if (!booking) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      confirmed: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Under Review',
      confirmed: 'Confirmed',
      approved: 'Approved',
      rejected: 'Rejected',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status as keyof typeof labels] || status.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            Catering Booking Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Booking Status */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{booking.full_name}'s Event</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(booking.status)}>
                      {getStatusLabel(booking.status)}
                    </Badge>
                  </div>
                </div>
                {booking.quote_amount && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Quote Amount</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(booking.quote_amount)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Event Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Event Date</p>
                    <p className="font-medium">{formatDate(booking.event_date)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Number of Guests</p>
                    <p className="font-medium">{booking.number_of_guests} people</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Booking Submitted</p>
                    <p className="font-medium">{formatDateTime(booking.created_at)}</p>
                  </div>
                </div>

                {booking.reviewed_at && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Last Reviewed</p>
                      <p className="font-medium">{formatDateTime(booking.reviewed_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{booking.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{booking.phone_number}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details */}
          {booking.additional_details && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Event Details & Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{booking.additional_details}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          {booking.admin_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes from Our Team
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="whitespace-pre-wrap text-blue-900">{booking.admin_notes}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quote Information */}
          {booking.quote_amount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Quote Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-green-800 font-medium">Total Quote Amount</p>
                      <p className="text-sm text-green-600">
                        Based on {booking.number_of_guests} guests
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-800">
                      {formatCurrency(booking.quote_amount)}
                    </p>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-sm text-green-700">
                    This quote is valid for 30 days from the review date. 
                    Final pricing may vary based on menu selections and additional services.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {booking.status === 'pending' && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-amber-800 mb-2">Under Review</h4>
                  <p className="text-sm text-amber-700">
                    Our team is reviewing your booking request. We'll get back to you within 24-48 hours 
                    with a detailed quote and next steps.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {booking.status === 'approved' && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-center py-4">
                  <Calendar className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-green-800 mb-2">Booking Approved!</h4>
                  <p className="text-sm text-green-700">
                    Your catering booking has been approved. Our team will contact you soon to discuss 
                    menu details and finalize arrangements.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};