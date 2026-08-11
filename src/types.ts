export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: string;
  market: string;
  city: string;
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string;   // Format: YYYY-MM-DD
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
}

export interface MarketComparison {
  marketName: string;
  total: number;
  availableCount: number;
  missingCount: number;
  items: {
    itemName: string;
    catalogName?: string;
    unit?: string;
    packageValueLabel?: string;
    price: number;
    found: boolean;
    quantity: number;
    subtotal: number;
  }[];
}

export interface OptimizedItem {
  shoppingItemId: string;
  offerId?: string;
  name: string;
  catalogName?: string;
  unit?: string;
  packageValueLabel?: string;
  quantity: number;
  price: number;
  market: string;
  subtotal: number;
  city: string;
  endDate?: string;
  selectedManually?: boolean;
}
