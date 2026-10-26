import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PaymentRequestView from '@/components/Wallet/PaymentRequestView';

export default function PayRequestPage() {
  const router = useRouter();
  const { req } = router.query;

  return (
    <>
      <Head>
        <title>Payment Request | PetChain</title>
        <meta
          name="description"
          content="Review and approve payment for requested funds on Stellar network"
        />
      </Head>
      <main>
        <PaymentRequestView initialReqPayload={typeof req === 'string' ? req : undefined} />
      </main>
    </>
  );
}
