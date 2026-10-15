import { router, useLocalSearchParams } from 'expo-router';
import { CustomerForm } from '@/components/CustomerForm';
import { EmptyState } from '@/components/ui';
import { useStore } from '@/lib/store';

export default function EditCustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomer, updateCustomer } = useStore();
  const customer = getCustomer(id);

  if (!customer) {
    return <EmptyState icon="person-outline" title="Customer not found" message="This customer may have been deleted." />;
  }

  return (
    <CustomerForm
      initial={customer}
      submitLabel="Save changes"
      onSubmit={(values) => {
        updateCustomer(customer.id, values);
        router.back();
      }}
    />
  );
}
