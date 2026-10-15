import { router } from 'expo-router';
import { useState } from 'react';
import { CustomerForm } from '@/components/CustomerForm';
import { useStore } from '@/lib/store';

export default function AddCustomerScreen() {
  const { addCustomer } = useStore();
  // Bumped after saving to remount the form empty for the next customer.
  const [formKey, setFormKey] = useState(0);

  return (
    <CustomerForm
      key={formKey}
      submitLabel="Save customer"
      allowFirstOrder
      onSubmit={(values) => {
        const customer = addCustomer(values);
        setFormKey((k) => k + 1);
        router.push({ pathname: '/customer/[id]', params: { id: customer.id } });
      }}
    />
  );
}
