export interface TransactionLineInput {
	category_id?: number | null;
	description?: string | null;
	amount_cents: number;
	// Multi-currency support - all in smallest currency unit
	original_amount_cents?: number | null;
	original_currency?: string | null;
	// Exchange rate as thousandths (e.g., 0.055 = 55)
	exchange_rate_thousandths?: number | null;
}

export class AccountingService {
	validateTransactionTotal(
		lines: TransactionLineInput[],
		totalCents: number,
		receiptTotalCents?: number | null,
		receiptCurrency?: string | null,
		exchangeRateThousandths?: number | null
	): { valid: boolean; error?: string } {
		if (lines.length < 1) {
			return { valid: false, error: 'Transaction must have at least 1 line' };
		}

		// Check if this is a multi-currency transaction based on transaction-level fields
		const hasMultiCurrency = receiptCurrency && receiptCurrency.trim() && receiptTotalCents && exchangeRateThousandths;

		if (hasMultiCurrency) {
			// Validate that line amounts sum to receipt total
			const lineSum = lines.reduce((sum, line) => sum + (line.amount_cents || 0), 0);

			if (lineSum !== receiptTotalCents) {
				return {
					valid: false,
					error: `Transaction lines sum (${(lineSum / 100).toFixed(2)} ${receiptCurrency}) does not match receipt total (${(receiptTotalCents / 100).toFixed(2)} ${receiptCurrency})`
				};
			}
		} else {
			// For same-currency transactions, validate line amounts sum to total
			const lineSum = lines.reduce((sum, line) => sum + (line.amount_cents || 0), 0);

			if (lineSum !== totalCents) {
				return {
					valid: false,
					error: `Transaction lines sum ($${(lineSum / 100).toFixed(2)}) does not match total ($${(totalCents / 100).toFixed(2)})`
				};
			}
		}

		return { valid: true };
	}

	/**
	 * Calculate exchange rate in thousandths
	 * @param originalAmountCents - Original amount in smallest currency unit (e.g., centavos for MXN)
	 * @param usdAmountCents - USD amount in cents
	 * @returns Exchange rate as thousandths (e.g., 0.055 = 55)
	 */
	calculateExchangeRate(originalAmountCents: number, usdAmountCents: number): number {
		if (originalAmountCents === 0) {
			throw new Error('Original amount cannot be zero');
		}
		// (usdAmountCents / originalAmountCents) * 1,000
		return Math.round((usdAmountCents / originalAmountCents) * 1_000);
	}

	/**
	 * Convert amount using exchange rate
	 * @param amountCents - Amount in smallest currency unit
	 * @param exchangeRateThousandths - Exchange rate as thousandths
	 * @returns Converted amount in cents
	 */
	convertCurrency(amountCents: number, exchangeRateThousandths: number): number {
		return Math.round((amountCents * exchangeRateThousandths) / 1_000);
	}
}
