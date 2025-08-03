import { metafieldsMapper } from "./data-processor.js";
import { calculateCost, calculateMoney, costSchema, sumMoney } from "./price.processor.js";
import {extractIdFromGid} from "./theme.js";

export const CartMapper = {
    fromDTO: function(cartDTO) {
        if (!cartDTO) return;

        const { id, discountAllocations, lines: linesDTO, cost: { totalAmount }, ...rest } = cartDTO;

        const lines = linesDTO.edges.map(({ node }) => this.mapLine(node));

        const cost = this.computeCartCosts(lines, totalAmount);
        const discount = this.computeCartDiscounts(lines, discountAllocations);

        return {
            gid: id,
            lines,
            cost,
            discount,
            ...rest,
        };
    },

    mapLine: function(lineDTO) {
        const baseCartLine = this.mapLineMetadata(lineDTO);

        const lineComponents = lineDTO.lineComponents?.map(this.mapLine.bind(this)) ?? null;
//         // const note = await composeLineNote(merchandise.title, baseCartLine.metafields, baseCartLine.merchandise.metafields);

        const cost = this.computeLineCosts(lineDTO);
        const discount = this.computeLineDiscounts(lineDTO.discountAllocations, cost);

        const type = lineComponents?.length ? "composite" : "single";

        return {
            ...baseCartLine,
            type,
            cost,
            discount,
            ...(!!lineComponents?.length && { lineComponents }),
        };
    },
    mapLineMetadata: function(lineDTO) {
        const {
            merchandise: merchandiseDTO,
            quantity,
            id: gid,
            attributes: attributesDTO,
            ...rest
        } = lineDTO;

        const pickedProps = Object.entries(merchandiseDTO).reduce((acc, [key, value]) => {
            const selectors = [
                "handle", "id", "key", "sku", "taxable", "title", "url", "vendor", "compareAtPrice", "price",
            ];

            if (selectors.includes(key)) acc[key] = value;
            return acc;
        }, {});


        const { image, metafields: metafieldsDTO, product: productDTO } = merchandiseDTO;
        const { metafields: productMetafieldsDTO, onlineStoreUrl, ...restProductDTO } = productDTO;

        const productMetafields = metafieldsMapper(productMetafieldsDTO);

        const merchandise = {
            featuredImage: image,
            product: { metafields: productMetafields, url: onlineStoreUrl, ...restProductDTO },
            ...pickedProps,
        };

        const id = extractIdFromGid(gid);

        const variantMetafields = metafieldsMapper(metafieldsDTO);

        const attributes = attributesDTO.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});

        const currency = lineDTO?.cost?.totalAmount?.currencyCode;

        return {
            attributes,
            id,
            gid,
            merchandise,
            quantity,
            metafields: variantMetafields,
            currency,
            ...rest,
        };
    },
    computeLineCosts: function(lineDTO) {
        const components = lineDTO.lineComponents ? lineDTO.lineComponents : [lineDTO];

        return components.reduce((costAcc, lineDTO) => {
            const { cost: costDTO, quantity, merchandise: { compareAtPrice, price } } = lineDTO;
            const compareAtAmountPerQuantity = !!parseFloat(compareAtPrice?.amount ?? 0) ? compareAtPrice : price;

            const cost = calculateCost({
                cost: {
                    amountPerQuantity: costDTO.amountPerQuantity,
                    totalAmount: costDTO.totalAmount,
                },
                compareAtAmountPerQuantity,
                quantity,
            });

            return Object.entries(costAcc).reduce((acc, [key, value]) => {
                acc[key] = sumMoney([value, cost[key]]);
                return acc;
            }, {});

        }, costSchema);

    },
    computeLineDiscounts: function(allocationsDTO = [], cost) {
        const { originalPrice, price } = cost;

        const saleDiscountAmount = Math.max((originalPrice?.amount ?? 0) - (price?.amount ?? 0), 0);
        const saleDiscount = calculateMoney(saleDiscountAmount);

        const allocations = mapDiscountAllocations(allocationsDTO);

        // const couponDiscount = parseDiscount(allocations);

        const totalDiscountAmount = (saleDiscount?.amount || 0);
        const totalDiscount = calculateMoney(totalDiscountAmount);

        return {
            allocations,
            saleDiscount,
            // couponDiscount,
            totalDiscount,
        };
    },
    computeCartCosts: function(lines, totalAmount) {
        const total = calculateMoney(totalAmount);

        const subtotalAmount = lines.reduce((acc, { cost: { subtotal } }) => acc += subtotal?.amount || 0, 0),
            subtotal = calculateMoney(subtotalAmount);

        return {
            subtotal,
            total,
        };
    },
    computeCartDiscounts: function(lines, discountAllocations) {
        const saleDiscountAmount = lines.reduce((acc, { discount: { saleDiscount } }) => acc += saleDiscount?.amount || 0, 0),
            saleDiscount = calculateMoney(saleDiscountAmount);

        const allLineLevelDiscountAllocations = lines.reduce((acc, { discount: { allocations } }) => acc.concat(allocations), []);

        const orderDiscountAllocations = mapDiscountAllocations(discountAllocations);

        const totalAllocations = groupDiscountAllocations(orderDiscountAllocations.concat(allLineLevelDiscountAllocations));

        const couponDiscountAmount = totalAllocations.reduce((acc, allocation) => acc += allocation.discountedAmount.amount, 0),
            couponDiscount = calculateMoney(couponDiscountAmount);

        // The total amount of all discounts (the amount saved) for the car
        const totalDiscountAmount = saleDiscountAmount + couponDiscountAmount,
            totalDiscount = calculateMoney(totalDiscountAmount);


        return {
            allocations: totalAllocations,
            saleDiscount,
            couponDiscount,
            totalDiscount,
        };
    },


    // SSR
    fromSSR: function(cartSSR) {
        const {
            total_price,
            item_count,
            attributes,
            items,
            discountAllocations,
        } = cartSSR;

        const lines = items.map(this.mapSSRItem.bind(this));
        const cost = this.computeCartCosts(lines, total_price);

        const discountCodes = discountAllocations.map(rest => ({ ...rest, applicable: true }));

        const discount = this.computeCartDiscounts(lines, discountAllocations);

        return {
            attributes,
            cost,
            discount,
            totalQuantity: item_count,
            lines,
        };
    },

    mapSSRItem: function(itemDTO) {
        const {
            price,
            compare_at_price,
            final_price,
            final_line_price,
            quantity,
            discounts,
            discounted_price,
            original_line_price,
            product,
            title,
            variant,

            image,
            discountAllocations,
            attributes: attributesDTO,
            ...rest
        } = itemDTO;
        const lineComponents = itemDTO.lineComponents?.map(this.mapSSRItem.bind(this)) ?? null;

        const cost = this.computeSSRItemCosts(itemDTO);
        const discount = this.computeLineDiscounts(discountAllocations, cost);
        const type = lineComponents?.length ? "composite" : "single";
        const attributes = attributesDTO.reduce((acc, [key, value]) => {
            acc[key] = value
            return acc
        }, {});

        return {
            attributes,
            type,
            cost,
            discount,
            ...(!!lineComponents?.length && { lineComponents }),
            merchandise: {
                title: variant.title,
                product,
                featuredImage: image,
                ...rest,
            },
            title,
            quantity,
        };
    },

    computeSSRItemCosts: function(itemDTO) {
        const components = itemDTO.lineComponents?.length ? itemDTO.lineComponents : [itemDTO];

        return components.reduce((costAcc, item) => {
            const { quantity, original_line_price, price, compare_at_price } = item;
            const compareAtAmountPerQuantity = !!parseFloat(compare_at_price ?? 0) ? compare_at_price : price;

            const cost = calculateCost({
                cost: {
                    amountPerQuantity: price,
                    totalAmount: original_line_price,
                },
                compareAtAmountPerQuantity,
                quantity,
            });

            return Object.entries(costAcc).reduce((acc, [key, value]) => {
                acc[key] = sumMoney([value, cost[key]]);
                return acc;
            }, {});

        }, costSchema);
    },
};


export const cartLinesTransformer = (items) => items.map((item) => {
    const { quantity, id, ...rest } = item;

    return {
        quantity: +quantity || 1,
        merchandiseId: generateShopifyGid("ProductVariant", id),
        ...rest,
    };
});
export const cartLineUpdateTransformer = (line) => {
    const { gid, quantity } = line;

    return { id: gid, quantity };
};


async function composeLineNote(variantTitle, variantMetafields, productMetafields) {
    let note = "";

    const { bundle_items: metaobjectIds } = variantMetafields;

    const bundleItems = await metaobjectIdsMapper(metaobjectIds);

    const { bundle_show_composite_message, optin_primary_mattress_name } = productMetafields;

    if (bundle_show_composite_message) {
        note += `Your purchase includes our ${optin_primary_mattress_name} mattress (${variantTitle})${bundleItems.length === 1 ? " and" : ", "}`;
    }

    const bundleSize = bundleItems.length;

    note += bundleItems.reduce((acc, bundleItem, i) => {
        const { qty = 1, variant: { title: variantTitle }, parent: product } = bundleItem;
        const metafields = product.metafields || {};

        const displayName = metafields.display_name || product.title;

        let output = `${displayName}`;

        // Add 's' for plural if qty > 1
        if (qty > 1) output += "s";

        // Append variant title in parentheses if it's not "Default Title"
        if (variantTitle !== "Default Title") output += ` (${variantTitle})`;

        const isLast = i === bundleSize - 1;

        const rindex0 = bundleSize - 1 - i;

        const separator = rindex0 === 1 ? " and " : ", ";

        if (!isLast) output += separator;

        return acc += output;
    }, "");

    return note;
}

const groupDiscountAllocations = allocations => {
    return allocations.reduce((acc, allocation) => {
        const foundIndex = acc.findIndex(({ name }) => name === allocation.name);

        if (foundIndex > -1) {
            acc[foundIndex].discountedAmount = sumMoney([allocation.discountedAmount, acc[foundIndex].discountedAmount]);
        } else {
            acc.push({ ...allocation });
        }
        return acc;
    }, []);
};

const mapDiscountAllocations = allocations => {
    return allocations.reduce((acc, allocation) => {
        const {
            title,
            code,
            discountedAmount: allocatedAmount,
            targetType,
            discountApplication: { allocationMethod, targetSelection },
        } = allocation;
        const type = title ? "automatic" : "discount_code";
        const name = title || code;

        const discountedAmount = calculateMoney(allocatedAmount);

        const allocationLevel = (allocationMethod === "ACROSS" || targetSelection === "ALL") ? "ORDER" : "LINE";

        acc.push({ type, name, discountedAmount, allocationLevel, targetType, allocationMethod, targetSelection });

        return acc;
    }, []);

};
