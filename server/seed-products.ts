import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({ query: "name:'Demand Letter'" });
  if (existing.data.length > 0) {
    console.log('Demand Letter product already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    if (prices.data.length > 0) {
      console.log('Price already exists:', prices.data[0].id, '$' + (prices.data[0].unit_amount! / 100));
    }
    return;
  }

  const product = await stripe.products.create({
    name: 'Demand Letter',
    description: 'AI-generated demand letter for security deposit recovery. Includes 4-agent legal analysis, violation detection, penalty calculation, and professionally drafted demand letter with electronic signature.',
    metadata: {
      type: 'one_time',
      category: 'legal_service',
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 2900,
    currency: 'usd',
  });

  console.log('Created product:', product.id);
  console.log('Created price:', price.id, '- $29.00');
}

createProducts().catch(console.error);
