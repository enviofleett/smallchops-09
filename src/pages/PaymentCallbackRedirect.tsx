import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function PaymentCallbackRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const search = location.search;
    navigate(`/payment/callback${search}`, { replace: true });
  }, [location.search, navigate]);

  return null;
}
