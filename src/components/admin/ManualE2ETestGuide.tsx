import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertTriangle, ShoppingCart, CreditCard, ArrowRight, ExternalLink } from 'lucide-react';

interface TestStep {
  id: string;
  title: string;
  description: string;
  action: string;
  expectedResult: string;
  completed: boolean;
  notes?: string;
}

const ManualE2ETestGuide = () => {
  const { toast } = useToast();
  
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    {
      id: 'step1',
      title: 'Navigate to Store',
      description: 'Start the user journey from the homepage',
      action: 'Click "Shop" in the navigation or "Order Now & Enjoy!" button',
      expectedResult: 'Should navigate to products page showing available items',
      completed: false
    },
    {
      id: 'step2',
      title: 'Browse Products',
      description: 'View available products and categories',
      action: 'Browse the product catalog, view different categories',
      expectedResult: 'Products load correctly with images, prices, and descriptions',
      completed: false
    },
    {
      id: 'step3',
      title: 'Add Items to Cart',
      description: 'Add multiple items to shopping cart',
      action: 'Click "Add to Cart" on 2-3 different products',
      expectedResult: 'Cart icon shows item count, success messages appear',
      completed: false
    },
    {
      id: 'step4',
      title: 'View Cart',
      description: 'Review items in cart',
      action: 'Click the cart icon in the header',
      expectedResult: 'Cart modal opens showing added items with correct quantities and prices',
      completed: false
    },
    {
      id: 'step5',
      title: 'Proceed to Checkout',
      description: 'Start the checkout process',
      action: 'Click "Proceed to Checkout" in the cart',
      expectedResult: 'Checkout modal opens with customer information form',
      completed: false
    },
    {
      id: 'step6',
      title: 'Fill Customer Details',
      description: 'Complete customer information',
      action: 'Fill in: Name, Email, Phone, and delivery/pickup preferences',
      expectedResult: 'Form accepts input without validation errors',
      completed: false
    },
    {
      id: 'step7',
      title: 'Select Delivery/Pickup',
      description: 'Choose fulfillment method',
      action: 'Select either delivery (with address) or pickup point',
      expectedResult: 'Appropriate fields appear based on selection',
      completed: false
    },
    {
      id: 'step8',
      title: 'Review Order Summary',
      description: 'Verify order details and pricing',
      action: 'Review items, quantities, delivery fee, and total amount',
      expectedResult: 'All details are correct and total calculation is accurate',
      completed: false
    },
    {
      id: 'step9',
      title: 'Proceed to Payment',
      description: 'Initiate payment process',
      action: 'Click "Proceed to Payment" button',
      expectedResult: 'Should NOT show "Payment system configuration issue" error',
      completed: false
    },
    {
      id: 'step10',
      title: 'Payment Initialization',
      description: 'Paystack payment should initialize',
      action: 'Wait for payment processing',
      expectedResult: 'Should either redirect to Paystack or open payment popup/modal',
      completed: false
    },
    {
      id: 'step11',
      title: 'Complete Payment (Test)',
      description: 'Use Paystack test card details',
      action: 'Use test card: 4084084084084081, CVV: 408, Expiry: 12/25, PIN: 0000',
      expectedResult: 'Payment should process successfully in test mode',
      completed: false
    },
    {
      id: 'step12',
      title: 'Payment Callback',
      description: 'Return to application after payment',
      action: 'Complete payment flow and return to app',
      expectedResult: 'Should redirect to success page or show confirmation',
      completed: false
    },
    {
      id: 'step13',
      title: 'Order Confirmation',
      description: 'Verify order was created successfully',
      action: 'Check for order confirmation message/email',
      expectedResult: 'Order should be visible in system with "paid" status',
      completed: false
    }
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [testNotes, setTestNotes] = useState('');

  const markStepCompleted = (stepId: string, completed: boolean) => {
    setTestSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed } : step
    ));

    if (completed) {
      const currentIndex = testSteps.findIndex(step => step.id === stepId);
      if (currentIndex === currentStepIndex) {
        setCurrentStepIndex(currentIndex + 1);
      }
    }
  };

  const resetTest = () => {
    setTestSteps(prev => prev.map(step => ({ ...step, completed: false })));
    setCurrentStepIndex(0);
    setTestNotes('');
    toast({
      title: "Test Reset",
      description: "Manual E2E test has been reset. You can start over.",
    });
  };

  const generateTestReport = () => {
    const completedSteps = testSteps.filter(step => step.completed).length;
    const totalSteps = testSteps.length;
    const passRate = Math.round((completedSteps / totalSteps) * 100);

    const report = {
      testDate: new Date().toISOString(),
      completedSteps,
      totalSteps,
      passRate,
      status: passRate === 100 ? 'PASS' : passRate >= 80 ? 'PARTIAL' : 'FAIL',
      failedSteps: testSteps.filter(step => !step.completed).map(step => step.title),
      notes: testNotes
    };

    console.log('E2E Test Report:', report);
    
    toast({
      title: "Test Report Generated",
      description: `${passRate}% completion rate. Check console for detailed report.`,
      variant: passRate >= 80 ? "default" : "destructive"
    });

    return report;
  };

  const completedCount = testSteps.filter(step => step.completed).length;
  const progressPercentage = Math.round((completedCount / testSteps.length) * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Manual End-to-End Test Guide
          </CardTitle>
          <CardDescription>
            Step-by-step guide to manually test the complete Paystack integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{testSteps.length} steps completed
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Quick Action Links */}
          <Alert>
            <ExternalLink className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Quick Links for Testing:</div>
              <div className="space-y-1 text-sm">
                <p>• <a href="/products" target="_blank" className="text-blue-600 hover:underline">Products Page</a> - Start shopping</p>
                <p>• <a href="/cart" target="_blank" className="text-blue-600 hover:underline">Cart Page</a> - View cart contents</p>
                <p>• <a href="/purchase-history" target="_blank" className="text-blue-600 hover:underline">Order History</a> - Check completed orders</p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Current Step Highlight */}
          {currentStepIndex < testSteps.length && (
            <Alert>
              <ArrowRight className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Next Step: {testSteps[currentStepIndex].title}</div>
                <p className="text-sm">{testSteps[currentStepIndex].action}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Test Steps */}
          <div className="space-y-3">
            {testSteps.map((step, index) => (
              <div 
                key={step.id} 
                className={`p-4 border rounded-lg transition-all ${
                  step.completed 
                    ? 'border-green-200 bg-green-50' 
                    : index === currentStepIndex 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={step.completed}
                    onCheckedChange={(checked) => markStepCompleted(step.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {index + 1}. {step.title}
                      </h4>
                      {step.completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <div className="space-y-1">
                      <p className="text-sm"><strong>Action:</strong> {step.action}</p>
                      <p className="text-sm"><strong>Expected:</strong> {step.expectedResult}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Test Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Notes (Optional)</label>
            <textarea
              value={testNotes}
              onChange={(e) => setTestNotes(e.target.value)}
              placeholder="Add any observations, issues, or notes about the test..."
              className="w-full p-3 border rounded-lg resize-none h-24"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex gap-4">
            <Button onClick={resetTest} variant="outline" className="flex-1">
              Reset Test
            </Button>
            <Button onClick={generateTestReport} className="flex-1">
              Generate Report
            </Button>
          </div>

          {/* Important Test Information */}
          <Alert>
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Paystack Test Card Details:</div>
              <div className="text-sm space-y-1 font-mono">
                <p>Card Number: 4084084084084081</p>
                <p>CVV: 408</p>
                <p>Expiry: 12/25</p>
                <p>PIN: 0000</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use these details when testing payment to avoid real charges
              </p>
            </AlertDescription>
          </Alert>

          {/* Success Criteria */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Test Success Criteria:</div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>No "Payment system configuration issue" error appears</li>
                <li>Payment initialization redirects to Paystack successfully</li>
                <li>Test payment processes without errors</li>
                <li>User is redirected back to the app after payment</li>
                <li>Order is created with correct status and details</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManualE2ETestGuide;
