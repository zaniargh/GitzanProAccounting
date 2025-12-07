
import { Transaction } from "@/types"

interface BalanceResult {
    cashDebts: { [currencyId: string]: number }
    productDebts: { [productTypeId: string]: number }
}

export const calculateCustomerBalance = (
    customerId: string,
    transactions: Transaction[],
    baseWeightUnit: string = "ton"
): BalanceResult => {
    const cashDebts: { [currencyId: string]: number } = {}
    const productDebts: { [key: string]: number } = {}

    // Robust Weight Conversion setup
    const baseUnit = baseWeightUnit.toLowerCase()
    const toGrams: Record<string, number> = {
        mg: 0.001, g: 1, kg: 1000, ton: 1000000, lb: 453.592,
        "milligram (mg)": 0.001, "gram (g)": 1, "kilogram (kg)": 1000, "pound (lb)": 453.592
    };
    const baseFactor = toGrams[baseUnit] || 1000000;

    transactions.forEach((transaction) => {
        if (transaction.isMainDocument) return

        // Logic for Inventory (Warehouse)
        if (customerId === "default-warehouse") {
            if ((transaction.type === "product_in" || transaction.type === "income") && transaction.productTypeId) {
                let amount = transaction.quantity || transaction.weight || 0
                if (transaction.weight) {
                    const u = (transaction.weightUnit as string || "ton").toLowerCase();
                    const txFactor = toGrams[u] || 1000000;
                    amount = (amount * txFactor) / baseFactor;
                }
                productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) + amount
            } else if ((transaction.type === "product_out" || transaction.type === "expense") && transaction.productTypeId) {
                let amount = transaction.quantity || transaction.weight || 0
                if (transaction.weight) {
                    const u = (transaction.weightUnit as string || "ton").toLowerCase();
                    const txFactor = toGrams[u] || 1000000;
                    amount = (amount * txFactor) / baseFactor;
                }
                productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) - amount
            }
            return
        }

        // Logic for Regular Customers
        const isRelevant = transaction.customerId === customerId || transaction.accountId === customerId
        if (isRelevant) {
            const currencyId = transaction.currencyId || "default"
            const currentDebt = cashDebts[currencyId] || 0

            let amount = transaction.quantity || transaction.weight || 0
            if (transaction.weight) {
                const u = (transaction.weightUnit as string || "ton").toLowerCase();
                const txFactor = toGrams[u] || 1000000;
                amount = (amount * txFactor) / baseFactor;
            }

            switch (transaction.type) {
                case "product_purchase":
                    if (transaction.customerId === customerId) {
                        // Purchase -> Receivable -> Positive (Debt increases)
                        if (transaction.productTypeId) productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) + amount
                        cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
                    }
                    break
                case "product_sale":
                    if (transaction.customerId === customerId) {
                        // Sale -> Payable -> Negative (Credit increases)
                        if (transaction.productTypeId) productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) - amount
                        cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
                    }
                    break
                case "product_in":
                    if (transaction.customerId === customerId && transaction.productTypeId) {
                        // In -> Credit (Customer gave goods) -> Negative
                        productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) - amount
                    }
                    break
                case "product_out":
                    if (transaction.customerId === customerId && transaction.productTypeId) {
                        // Out -> Debt (Customer took goods) -> Positive
                        productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) + amount
                    }
                    break
                case "cash_in":
                    if (customerId === transaction.customerId) cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
                    if (transaction.accountId === customerId) cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
                    break
                case "cash_out":
                    if (customerId === transaction.customerId) cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
                    if (transaction.accountId === customerId) cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
                    break
                case "expense":
                    if (transaction.accountId === customerId) cashDebts[currencyId] = currentDebt - (transaction.amount || 0)
                    break
                case "income":
                    if (transaction.accountId === customerId) cashDebts[currencyId] = currentDebt + (transaction.amount || 0)
                    break
                case "receivable":
                    if (transaction.customerId === customerId) {
                        if (transaction.productTypeId) {
                            // Receivable -> Positive (Debt)
                            productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) + amount
                        }
                        if (transaction.amount) cashDebts[currencyId] = currentDebt + transaction.amount
                    }
                    break
                case "payable":
                    if (transaction.customerId === customerId) {
                        if (transaction.productTypeId) {
                            // Payable -> Negative (Credit)
                            productDebts[transaction.productTypeId] = (productDebts[transaction.productTypeId] || 0) - amount
                        }
                        if (transaction.amount) cashDebts[currencyId] = currentDebt + transaction.amount
                    }
                    break
            }
        }
    })

    return { cashDebts, productDebts }
}
