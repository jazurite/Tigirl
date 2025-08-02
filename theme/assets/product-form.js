var __typeError = (msg) => {
    throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);


// js/common/product/product-form.js
var _abortController7, _ProductForm_instances, form_get2, onSubmit_fn;
var ProductForm = class extends HTMLElement {
    constructor() {
        super(...arguments);
        __privateAdd(this, _ProductForm_instances);
        __privateAdd(this, _abortController7);
    }

    connectedCallback() {
        __privateSet(this, _abortController7, new AbortController());
        if (__privateGet(this, _ProductForm_instances, form_get2)) {
            __privateGet(this, _ProductForm_instances, form_get2).addEventListener("submit", __privateMethod(this, _ProductForm_instances, onSubmit_fn).bind(this), {signal: __privateGet(this, _abortController7).signal});
            __privateGet(this, _ProductForm_instances, form_get2).id.disabled = false;
        }
    }

    disconnectedCallback() {
        __privateGet(this, _abortController7).abort();
    }


};

const  /**
 * Check if cart total exceeds 1 million and add special product if needed
 * @param {object} cartData - The current cart data
 * @returns {Promise<void>}
 */ checkCartTotalAndAddSpecialProduct = async (original_line_price) => {
    // Check if cart total exceeds 1 million
    if(!original_line_price) return

    if (original_line_price / 100 >= 1000000) {
        const cartContent = await (await fetch(`${Shopify.routes.root}cart.js`)).json();


        const specialProductId = 7257497894983;
        const specialProductExists = cartContent.items.some(item => item.id === specialProductId || item.product_id === specialProductId);

        // Add special product if it doesn't exist
        if (!specialProductExists) {
            try {
                await fetch('/cart/add.js', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "form_type": "product",
                        id: 41857750827079,
                        "product-id": specialProductId,
                        quantity: 1
                    })
                });
                // Refresh the cart sections to reflect changes
                document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', {
                    bubbles: true
                }));
            } catch (error) {
                console.error('Error adding special product to cart:', error);
            }
        }
    }
}

_abortController7 = new WeakMap();
_ProductForm_instances = new WeakSet();
form_get2 = function () {
    return this.querySelector('form[action*="/cart/add"]');
};
onSubmit_fn = async function (event) {
    event.preventDefault();
    if (event.submitter?.getAttribute("aria-busy") === "true") {
        return;
    }
    if (!__privateGet(this, _ProductForm_instances, form_get2).checkValidity()) {
        __privateGet(this, _ProductForm_instances, form_get2).reportValidity();
        return;
    }
    const showLoadingBar = event.submitter?.querySelector("button-content") === null;
    const submitButtons = Array.from(__privateGet(this, _ProductForm_instances, form_get2).elements).filter((button) => button.type === "submit");
    submitButtons.forEach((submitButton) => {
        submitButton.setAttribute("aria-busy", "true");
    });
    let sectionsToBundle = /* @__PURE__ */ new Set();
    document.documentElement.dispatchEvent(new CustomEvent("cart:prepare-bundled-sections", {
        bubbles: true,
        detail: {sections: sectionsToBundle}
    }));
    const formData = new FormData(__privateGet(this, _ProductForm_instances, form_get2));

    formData.set("sections", [...sectionsToBundle].join(","));
    console.log("%c 1 --> Line: 3153||theme.js\n formData: ", "color:#f0f;", formData);


    if (showLoadingBar) {
        document.documentElement.dispatchEvent(new CustomEvent("theme:loading:start", {bubbles: true}));
    }
    const response = await fetch(`${Shopify.routes.root}cart/add.js`, {
        body: formData,
        method: "POST",
        headers: {
            "X-Requested-With": "XMLHttpRequest"
            // Needed for Shopify to check inventory
        }
    });
    submitButtons.forEach((submitButton) => {
        submitButton.removeAttribute("aria-busy");
    });
    const responseJson = await response.json();

    // After successful add to cart, fetch cart data and check total
    try {
        await checkCartTotalAndAddSpecialProduct(responseJson.original_line_price);
    } catch (error) {
        console.error('Error fetching cart data:', error);
    }


    if (showLoadingBar) {
        document.documentElement.dispatchEvent(new CustomEvent("theme:loading:end", {bubbles: true}));
    }

    if (response.ok) {
        if (window.themeVariables.settings.cartType === "page" || window.themeVariables.settings.pageType === "cart") {
            return window.location.href = `${Shopify.routes.root}cart`;
        }
        const cartContent = await (await fetch(`${Shopify.routes.root}cart.js`)).json();
        console.log("%c 1 --> Line: 123||product-form.js\n cartContent: ","color:#f0f;", cartContent);



        cartContent["sections"] = responseJson["sections"];
        const items = responseJson.hasOwnProperty("items") ? responseJson["items"] : [responseJson];
        __privateGet(this, _ProductForm_instances, form_get2).dispatchEvent(new CustomEvent("variant:add", {
            bubbles: true,
            detail: {
                items,
                cart: cartContent
            }
        }));
        document.documentElement.dispatchEvent(new CustomEvent("cart:change", {
            bubbles: true,
            detail: {
                baseEvent: "variant:add",
                cart: cartContent
            }
        }));
        if (window.themeVariables.settings.cartType === "message") {
            document.dispatchEvent(new CustomEvent("toast:show", {
                detail: {
                    message: window.themeVariables.strings.addedToCart.replace("{{product_title}}", items?.[0]?.title)
                }
            }));
        }
    } else {
        __privateGet(this, _ProductForm_instances, form_get2).dispatchEvent(new CustomEvent("cart:error", {
            bubbles: true,
            detail: {
                error: responseJson["message"]
            }
        }));
        document.dispatchEvent(new CustomEvent("toast:show", {
            detail: {
                message: responseJson["message"],
                tone: "error"
            }
        }));
        document.documentElement.dispatchEvent(new CustomEvent("cart:refresh", {bubbles: true}));
    }
};
if (!window.customElements.get("product-form")) {
    window.customElements.define("product-form", ProductForm);
}
