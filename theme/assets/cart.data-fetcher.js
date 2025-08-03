import API from "./storefront-api.js";
import {cartLinesTransformer, CartMapper} from "./cart.data-processor.js";
import {onResponse} from "./data-fetcher.js";

const PRODUCT_VARIANT_FRAGMENT = `
    id
    title
    
    availableForSale
    compareAtPrice {
        amount
        currencyCode
    }
    price {
        amount
        currencyCode
    }
    image {
        id
        url
        width
        height
        altText
    }
`;

const DISCOUNT_ALLOCATION_FRAGMENT = `
    discountAllocations {
        ... on CartAutomaticDiscountAllocation {
                title
        }
         ... on CartCodeDiscountAllocation {
                code
        }
        discountApplication {
            allocationMethod
            targetSelection
            targetType  
            value {
                ... on MoneyV2 {
                    amount
                    currencyCode
                }
            }
        }
        discountedAmount {
            amount
            currencyCode
        }
        targetType      
    }
`;

const BASE_CART_LINE_FRAGMENT = `
    id
    quantity
    cost {
        amountPerQuantity {
            amount
            currencyCode
        }
        compareAtAmountPerQuantity {
            amount
            currencyCode
        }
        subtotalAmount {
            amount
            currencyCode
        }
        totalAmount {
            amount
            currencyCode
        }
    }
    
    merchandise {
        ... on ProductVariant {
                ${PRODUCT_VARIANT_FRAGMENT}
                product {
                    id
                    title
                    description
                    handle
                    onlineStoreUrl
                    vendor
                    productType
                    metafields(
                        identifiers: [
                            { namespace: "accentuate", key: "bundle_show_composite_message" },
                            { namespace: "accentuate", key: "optin_primary_mattress_name" },
                            { namespace: "accentuate", key: "bundle_quantity" }
                        ]
                    ) {
                        value
                        id
                        key
                        namespace
                        type
                    }
                }
                metafields(
                    identifiers: [
                        {
                            namespace: "custom",
                            key: "bundle_items"
                        },
                        {
                            namespace: "accentuate",
                            key: "optin_bundle_item"
                        },
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
`
const CART_LINE_FRAGMENT = `
    ${BASE_CART_LINE_FRAGMENT}
    ${DISCOUNT_ALLOCATION_FRAGMENT}
    attributes {
        key
        value
    }
`;

const CART_ADDRESS_FRAGMENT = `
    firstName
    lastName
    name
    phone
    address1
    address2
    city
    company
    formatted
    formattedArea
    latitude
    longitude
    
    provinceCode
    zip
`

const MAILING_ADDRESS_FRAGMENT = `
    id
    countryCodeV2
    province
    ${CART_ADDRESS_FRAGMENT}
`

const CART_DELIVERY_ADDRESS_FRAGMENT = `
    ... on CartDeliveryAddress {
        ${CART_ADDRESS_FRAGMENT}
        countryCode
    }
`

const BUYER_IDENTITY_FRAGMENT = `
    buyerIdentity {
        countryCode
        customer {
            acceptsMarketing
            addresses (first: 50) {
                nodes {
                     ${MAILING_ADDRESS_FRAGMENT}
                }
            }
            defaultAddress {
                ${MAILING_ADDRESS_FRAGMENT}
            }
        }
    }
`

const DELIVERY_FRAGMENT = `
    delivery {
        addresses {
            ... on CartSelectableAddress {
                id  
                oneTimeUse
                selected
                address {
                    ${CART_DELIVERY_ADDRESS_FRAGMENT}
                }
            }
        }
    }
`

const CART_FRAGMENT = `
    id
    totalQuantity
    lines(first: 10) {
        edges {
            node {
                ${CART_LINE_FRAGMENT}
                 ... on ComponentizableCartLine {
                     lineComponents {
                         ${CART_LINE_FRAGMENT} 
                    } 
                }
            }
        }
    }
    attributes {
        key
        value
    }
    cost {
        totalAmount {
            amount
            currencyCode
        }
        subtotalAmount {
            amount
            currencyCode
        }
        checkoutChargeAmount {
            amount
            currencyCode
        }
        subtotalAmountEstimated
        totalAmountEstimated
    }
    ${DISCOUNT_ALLOCATION_FRAGMENT}
    discountCodes {
        code
        applicable
    }
    ${BUYER_IDENTITY_FRAGMENT}
    ${DELIVERY_FRAGMENT}
`;


const fetchCart = (gid) => {
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `query retrieveCart($id: ID!) {
                        cart(id: $id) {
                            ${CART_FRAGMENT}
                        }
                    }`,
            variables: {
                id: gid,
            },
        }),
    }).then(onResponse).then((res) => CartMapper.fromDTO(res.cart));
};

const addToCart = (gid, items) => {
    const lines = cartLinesTransformer(items);

    return API({
        method: "POST",
        data: JSON.stringify({
            query: `mutation ($id: ID!, $lines: [CartLineInput!]!) {
                      cartLinesAdd(cartId: $id, lines: $lines) {
                        cart {
                          ${CART_FRAGMENT}
                        }
                        userErrors {
                          field
                          message
                          code
                        }
                        warnings {
                          target
                          message
                          code
                        }
                      }
                    }`,
            variables: {
                id: gid,
                lines,
            },
        }),
    }).then(onResponse).then((res) => CartMapper.fromDTO(res.cartLinesAdd.cart));
};

const updateCart = (gid, lines) => {

    return API({
        method: "POST",
        data: JSON.stringify({
            query: `mutation ($id: ID!, $lines: [CartLineUpdateInput!]!) {
                      cartLinesUpdate(cartId: $id, lines: $lines) {
                        cart {
                          ${CART_FRAGMENT}
                        }
                        userErrors {
                          field
                          message
                          code
                        }
                        warnings {
                          target
                          message
                          code
                        }
                      }
                    }`,
            variables: {
                id: gid,
                lines,
            },
        }),
    }).then((res) => CartMapper.fromDTO(res.data.data.cartLinesUpdate.cart));
};

const removeFromCart = (gid, lineIds) => {
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `mutation ($id: ID!, $lineIds: [ID!]!) {
                      cartLinesRemove(cartId: $id, lineIds: $lineIds) {
                        cart {
                          ${CART_FRAGMENT}
                        }
                        userErrors {
                          field
                          message
                          code
                        }
                        warnings {
                          target
                          message
                          code
                        }
                      }
                    }`,
            variables: {
                id: gid,
                lineIds,
            },
        }),
    }).then((res) => CartMapper.fromDTO(res.data.data.cartLinesRemove.cart));
};

const discountCodeUpdate = (gid, discountCodes = []) => {
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `mutation ($id: ID!, $discountCodes: [String!]) {
                      cartDiscountCodesUpdate(cartId: $id, discountCodes: $discountCodes) {
                        cart {
                          ${CART_FRAGMENT}
                        }
                         userErrors {
                          field
                          message
                          code
                        }
                        warnings {
                          target
                          message
                          code
                        }
                      }
                    }`,
            variables: {
                id: gid,
                discountCodes: discountCodes || [],
            },
        }),
    }).then((res) => CartMapper.fromDTO(res.data.data.cartDiscountCodesUpdate.cart));
};

const deliveryAddressUpdate = (gid, payload) => {
    return API({
        method: "POST",
        data: JSON.stringify({
            query: `mutation CartDeliveryAddressesUpdate($id: ID!, $addresses: [CartSelectableAddressUpdateInput!]!) {
                      cartDeliveryAddressesUpdate(cartId: $id, addresses: $addresses) {
                        userErrors {
                          message
                          code
                          field
                        }
                        warnings {
                          message
                          code
                          target
                        }
                        cart {
                          id
                          delivery {
                            addresses {
                              id
                              selected
                              oneTimeUse
                              address {
                                ... on CartDeliveryAddress {
                                  firstName
                                  lastName
                                  company
                                  address1
                                  address2
                                  city
                                  provinceCode
                                  zip
                                  countryCode
                                }
                              }
                            }
                          }
                        }
                      }
                    }
            `,
            variables: {
                id: gid,
                "addresses": [
                    payload
                ]
            },
        })
    })
}


const CartAPI = {
    fetch: fetchCart,
    add: addToCart,
    update: updateCart,
    remove: removeFromCart,
    discountCodeUpdate: discountCodeUpdate,
    deliveryAddressUpdate: deliveryAddressUpdate,
};

export {CartAPI, CART_FRAGMENT};
