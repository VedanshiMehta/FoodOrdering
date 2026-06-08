export const EXCHANGE_RATES: Record<string, number> = {
  IN: 83, // 1 USD = 83 INR
  // Add more as needed
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  IN: "₹",
  US: "$",
};

export const getCurrencySymbol = (countryCode?: string | null): string => {
  const code = countryCode?.toUpperCase() || "IN";
  return CURRENCY_SYMBOLS[code] || "₹";
};

/**
 * Formats a given price (in USD) to the target country's currency.
 * @param priceInUsd The base price in USD
 * @param countryCode The ISO country code (e.g., 'IN', 'US')
 * @returns Formatted currency string
 */
export const formatPrice = (
  priceInUsd: number,
  countryCode?: string | null
): string => {
  const code = countryCode?.toUpperCase() || "IN";
  const rate = EXCHANGE_RATES[code] || 83;
  const symbol = CURRENCY_SYMBOLS[code] || "₹";

  const convertedAmount = priceInUsd * rate;
  return `${symbol}${convertedAmount.toFixed(2)}`;
};

/**
 * Returns the converted numeric amount (useful for payments).
 */
export const getConvertedAmount = (
  priceInUsd: number,
  countryCode?: string | null
): number => {
  const code = countryCode?.toUpperCase() || "IN";
  const rate = EXCHANGE_RATES[code] || 83;
  return priceInUsd * rate;
};

/**
 * Returns the currency ISO string (e.g. 'inr', 'usd') for Stripe.
 */
export const getCurrencyCode = (countryCode?: string | null): string => {
  const code = countryCode?.toUpperCase() || "IN";
  if (code === "US") return "usd";
  return "inr";
};

/**
 * Returns the base USD amount for a given local price.
 * Useful for saving a locally inputted price to the database in USD.
 */
export const getUsdAmount = (
  localPrice: number,
  countryCode?: string | null
): number => {
  const code = countryCode?.toUpperCase() || "IN";
  const rate = EXCHANGE_RATES[code] || 83;
  return localPrice / rate;
};

/**
 * Returns the currency name (e.g. 'INR', 'USD').
 */
export const getCurrencyName = (countryCode?: string | null): string => {
  const code = countryCode?.toUpperCase() || "IN";
  if (code === "US") return "USD";
  return "INR";
};
