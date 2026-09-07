import type { Product } from '../types';
export const CUSTOMER_PRICING_INSTRUCTIONS: string;
export function readCustomerPrices(item: unknown): Pick<Product, 'regularPrice' | 'specialPrice' | 'specialOnly' | 'specialCondition'>;
export function resolveCustomerPrice(product: Product, eligible: boolean): Product | null;
