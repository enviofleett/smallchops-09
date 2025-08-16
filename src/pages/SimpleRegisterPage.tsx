import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SimpleRegistration } from '@/components/registration/SimpleRegistration';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SimpleRegisterPage = () => {
  const navigate = useNavigate();

  const handleRegistrationComplete = () => {
    // Navigate to login or home after successful registration
    setTimeout(() => {
      navigate('/auth?view=customer-login');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Button>
        </div>
        
        <SimpleRegistration onComplete={handleRegistrationComplete} />
      </div>
    </div>
  );
};

export default SimpleRegisterPage;