import { metaobjectMapper, productMapper, variantMapper } from "./data-processor.js";
import API from "./storefront-api.js";
import { METAFIELD } from "./data-constants.js";

export const fetchMetaobjects = (metaobjectIds) => {
    return allFulfilled(metaobjectIds.map((id) => fetchMetaObject(id)));
};

export const fetchMetaObject = (gid) => {
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `query getMetaObject($id: ID!) {
    metaobject(id: $id) {
        id
        type
        updatedAt
        handle
        fields {
            key
            value
            type
        }
        fields {
            key
            value
            type
        }
    }
}`,
            variables: {
                id: gid,
            },
        }),
    }).then((res) => metaobjectMapper(res.data.data.metaobject));
};

export const fetchVariant = (gid) => {
    const metafildsQuery = composeMetafieldsQuery([
        METAFIELD.CROSS_SELLING_PRODUCT,
        METAFIELD.CONFIGURABLE_ITEM,
        METAFIELD.FREEBIE_PRODUCT_VARIANT
    ]);

    return API({
        method: "POST",
        data: JSON.stringify({
            query: `query getVariantById($id: ID!) {
    node(id: $id) {
        ... on ProductVariant {
            id
            title
            availableForSale
            sku
            quantityAvailable
            price {
                amount
            }
            compareAtPrice {
                amount
            }
            ${metafildsQuery}
            product {
                id
                handle
                onlineStoreUrl
                title
                featuredImage {
                    id
                    src
                    width
                    height
                }
                availableForSale
                priceRange {
                    minVariantPrice {
                        amount
                    }
                    maxVariantPrice {
                        amount
                    }
                }
                compareAtPriceRange {
                    minVariantPrice {
                        amount
                    }
                    maxVariantPrice {
                        amount
                    }
                }
                variants(first: 10) {
                    nodes {
                        ... on ProductVariant {
                            id
                            title
                            sku
                            quantityAvailable
                            price {
                                amount
                                currencyCode
                            }
                        }
                    }
                }
                metafields(
                    identifiers: [
                        { namespace: "accentuate", key: "isolated_image" },
                        { namespace: "accentuate", key: "featured_image" },
                        { namespace: "accentuate", key: "display_name" },
                        { namespace: "accentuate", key: "track_postfix" },
                        { namespace: "accentuate", key: "bundle_quantity" },
                        { namespace: "accentuate", key: "cross_selling_promotion_badge" },
                        { namespace: "accentuate", key: "cross_selling_promotion_text" }
                    ]
                ) {
                    value
                    id
                    key
                    namespace
                    type
                }
            }
        }
    }
}
`,
            variables: {
                id: gid,
            },
        }),
    }).then((res) => variantMapper(res.data.data.node));
};

export const fetchProduct = (gid) => {
    const metafildsQuery = composeMetafieldsQuery([
        METAFIELD.CROSS_SELLING_PRODUCT,
        "isolated_image",
        "featured_image",
        "display_name",
        "track_postfix",
        "bundle_quantity"
    ]);
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `query getProductById($id: ID!) {
    node(id: $id) {
        ... on Product {
            id
            title
            description
            featuredImage {
                id
                src
                width
                height
            }
            priceRange {
                minVariantPrice {
                    amount
                }
                maxVariantPrice {
                    amount
                }
            }
            compareAtPriceRange {
                minVariantPrice {
                    amount
                }
                maxVariantPrice {
                    amount
                }
            }
            variants(first: 10) {
                nodes {
                    id
                    title
                    sku
                    availableForSale
                    quantityAvailable
                    price {
                       amount
                    }
                    compareAtPrice {
                       amount
                    }
                }
            }
            ${metafildsQuery}
        }
    }
}
`,
            variables: {
                id: gid,
            },
        }),
    }).then((res) => productMapper(res.data.data.node));
};

export const onResponse = async (res) => {
    const result = res.data;

    if (!!result.errors) {
        throw result.errors;
    }

    return result.data;
};

export const allFulfilled = async (promisedArr) => {
    const results = await Promise.allSettled(promisedArr);

    return results.filter((x) => x.status === "fulfilled").map((x) => x.value);
};

export const composeMetafieldsQuery = (metafieldKeys = []) => {
    const metafields = metafieldKeys.map(key => ({ namespace: "accentuate", key }));

    const formatted = metafields.reduce((r, m, i) => {
        const isFirst = i === 0,
            isLast = i === metafields.length - 1;

        r += `${isFirst ? "[" : ""}{
    namespace: "${m.namespace}",
    key: "${m.key}"
    }${isLast ? "]" : ","}`;

        return r;
    }, "");


    return metafields.length ? `
        metafields(
                identifiers: [${formatted.substring(1, formatted.length - 1)}]
            ) {
                value
                id
                key
                namespace
                type
            }
    ` : "";
};
