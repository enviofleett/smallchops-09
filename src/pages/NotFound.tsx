import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { BrandedErrorFallback } from "@/components/error/BrandedErrorFallback";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <BrandedErrorFallback
        message="Page not found"
        showDetails={false}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
};

export default NotFound;
