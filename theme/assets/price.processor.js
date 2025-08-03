import {isNumber, Currency} from "./theme.js";

export const formatMoney = (amount) => {
    const formatted = Currency.format(amount);

    return {
        amount,
        formatted,
    };
};

export const calculateMoney = (moneyOrAmount, quantity) => {
    if (!moneyOrAmount) return null;

    let rawAmount;

    rawAmount = isNumber(moneyOrAmount) ? moneyOrAmount : moneyOrAmount?.amount || 0;

    const amountPerQuantity = parseFloat(rawAmount);
    const amount = amountPerQuantity * (quantity || 1);

    const formatted = Currency.format(amount);

    return {
        amount,
        formatted,
        ...((isNumber(quantity)) && {quantity, amountPerQuantity}),
    };

};


export const parseDiscount = allocations => {
    const allocation = allocations?.[0];

    if (allocation) {
        const {title, code, discountedAmount, ...rest} = allocation;
        const type = title ? "automatic" : "code";
        const name = title || code;

        return {
            type,
            name,
            discountedAmount: calculateMoney(discountedAmount),
            ...rest,
        };
    }
};

export const costSchema = {
    subtotal: null,
    total: null,

    price: null,
    originalPrice: null,
};


export const calculateCost = ({
                                  cost,
                                  compareAtAmountPerQuantity,
                                  quantity = 1,
                              }) => {

    if (!cost) return null;

    const {
        amountPerQuantity,
        totalAmount,
    } = cost;

    const price = calculateMoney(amountPerQuantity, quantity);

    const originalPrice = calculateMoney(compareAtAmountPerQuantity, quantity);

    const subtotal = (!!originalPrice?.amount) ? originalPrice : price;

    // The final cost
    const total = calculateMoney(totalAmount);

    return {
        subtotal,
        total,

        price,
        originalPrice,

    };
};


export const calculateGroupedCost = (lineComponents) => {


};

export const sumMoney = (moneys = []) => {
    if (!moneys.length) return null;

    return moneys.reduce((acc, money) => {
        const sumAmount = (acc?.amount ?? 0) + (money?.amount ?? 0);
        return calculateMoney(sumAmount);
    }, {});
};
