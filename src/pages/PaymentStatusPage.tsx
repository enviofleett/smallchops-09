import { PublicHeader } from "@/components/layout/PublicHeader";
import { PaymentStatusChecker } from "@/components/payments/PaymentStatusChecker";
import { Helmet } from "react-helmet-async";

export default function PaymentStatusPage() {
  return (
    <>
      <Helmet>
        <title>Payment Status Checker | Starters Small Chops</title>
        <meta name="description" content="Check the status of your payment and recover payment information" />
        <link rel="canonical" href={`${window.location.origin}/payment/status`} />
      </Helmet>
      
      <PublicHeader />
      
      <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Payment Status Checker
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Enter your payment reference to check the status of your transaction and recover payment information
            </p>
          </div>
          
          <PaymentStatusChecker />
        </div>
      </main>
    </>
  );
}