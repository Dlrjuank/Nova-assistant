import { notFound } from 'next/navigation';
import { TestEmailForm } from '@/components/email/TestEmailForm';

export default function PaginaPruebaCorreo() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <TestEmailForm />;
}
