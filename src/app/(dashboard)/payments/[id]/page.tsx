import ProtectedPage from '@/components/ProtectedPage';
import { PaymentDetailsPage } from '@/components/payments/PaymentDetailsPage';

export default function PaymentDetailRoute() {
  return (
    <ProtectedPage>
      <PaymentDetailsPage />
    </ProtectedPage>
  );
}