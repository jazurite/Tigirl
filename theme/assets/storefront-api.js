const storeFrontPublicAccessToken = "6789c37bf689ac437c3e6681aad6f220";
const storefrontApiVersion = "2025-07";
const storeDomain = "tigirls.com";

const shopifyY = (new RegExp("_shopify_y=([^;]+)", "g")).exec(document.cookie);
const shopifyS = (new RegExp("_shopify_s=([^;]+)", "g")).exec(document.cookie);

const storefrontApi = axios.create({
    baseURL: `https://${storeDomain}/api/${storefrontApiVersion}/graphql`,
    headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Y": shopifyY,
        "Shopify-Storefront-S": shopifyS,
        "X-Shopify-Storefront-Access-Token": storeFrontPublicAccessToken,
    },
});

export default storefrontApi;
