import {CartAPI} from "./cart.data-fetcher.js";
import {EVENTS} from "./data-constants.js";
import {CartMapper} from "./cart.data-processor.js";
import {debounce, generateShopifyGid} from "./theme.js";
import CookieParser from "./cookie-parser.js";

class Cart {
    cartId = "";
    cartToken = "";
    cartGid = "";
    checkoutUrl = "";

    initialized = false;

    _cart = {};

    get state() {
        return this._cart;
    }

    set state(state) {
        Object.assign(this._cart, state);
        this.broadcast();
    }

    constructor() {

        this.updatedEvent = new CustomEvent(EVENTS.CART_UPDATED, {details: this._cart});
        this.loadedEvent = new CustomEvent(EVENTS.CART_LOADED, {bubbles: true, details: this._cart});
        this.fetchingStartEvent = new CustomEvent(EVENTS.CART_FETCHING_START);
        this.fetchingEndEvent = new CustomEvent(EVENTS.CART_FETCHING_END);
        this.addedEvent = new CustomEvent(EVENTS.CART_LINE_ADDED);
        this.removedEvent = new CustomEvent(EVENTS.CART_LINE_REMOVED);


        this.setup();

        console.log("release the cart.js cached from Shopify 4")

    }

    async setup() {
        this.rehydrate();

        await this.retrieveCart();

        requestAnimationFrame(() => {
            this.initialized = true;
            document.dispatchEvent(this.loadedEvent);
        });
    }

    broadcast = debounce(() => {
        document.dispatchEvent(this.updatedEvent);
    }, 45);


    parseSSR() {
        const ssrCart = JSON.parse(document.querySelector("#Cart-SSR-JSON").textContent);

        const mappedCart = CartMapper.fromSSR(ssrCart);

        this.refresh(mappedCart);
    }

    /*
     Retrieve current user's cart information, this value exists for every customer session with the webstore.
     @link https://www.shopify.com/legal/cookies
     */
    rehydrate() {
        this.cartId = CookieParser.get("cart");
        this.cartToken = this.cartId;

        this.cartGid = generateShopifyGid("Cart", this.cartId);

        this.checkoutUrl = this.getCheckoutUrl()
    }

    getCheckoutUrl() {
        const locale = location.hostname.includes("qc.") ? "fr" : "en"

        const url = new URL(`/cart/c/${this.cartId}`, location.origin);

        url.searchParams.append("locale", locale);

        return url.toString()
    }

    async query(fn, ...args) {
        document.dispatchEvent(this.fetchingStartEvent);

        if (!this.cartId) this.rehydrate()

        const result = await fn(this.cartGid, ...args);

        this.refresh(result);

        document.dispatchEvent(this.fetchingEndEvent);

        return result;
    }

    async retrieveCart() {
        return this.query(CartAPI.fetch);
    }

    async add(items) {
        if (!items.length) return;

        try {
            const result = await this.query(CartAPI.add, items);

            document.dispatchEvent(this.addedEvent);
            const cartLineIds = items.map(item => +item.id);

            const addedLines = result.lines.filter(({merchandise}) => cartLineIds.includes(+extractIdFromGid(merchandise.id)));

            ShopifyAnalyticsConnector.sendCartAnalytics(addedLines);

            if (
                typeof window.ABTasty !== 'undefined' &&
                typeof window.ABTasty.eventState !== 'undefined' &&
                !!window.ABTasty.eventState['executedCampaign'] &&
                window.ABTasty.eventState['executedCampaign'].status === 'complete' &&
                typeof window.ABTastyClickTracking !== 'undefined'
            ) {
                ABTastyClickTracking?.('product_added_to_cart');
            }

            return result;
        } catch (e) {
            console.error(e)
        }
    };

    async addSingle(id, qty) {
        const payload = {id, quantity: qty};

        return this.add([payload]);
    };

    async update(lines) {
        if (!lines.length) return;

        return this.query(CartAPI.update, lines);
    };

    async updateSingle(line) {
        return this.update([line]);
    };

    async remove(lineIds) {
        if (!lineIds) return;

        const result = await this.query(CartAPI.remove, lineIds);

        document.dispatchEvent(this.removedEvent);

        return result;
    };

    async removeSingle(lineId) {
        return this.remove([lineId]);
    };

    async applyCoupon(codes) {
        if (!codes?.length) return Promise.reject();

        return this.query(CartAPI.discountCodeUpdate, codes);
    }

    async clearCoupon(discountCodes = []) {
        return this.query(CartAPI.discountCodeUpdate, discountCodes);
    }

    deliveryAddressUpdate({province, provinceCode,ward} = {province: "", ward: ""}) {
        const currCartSelectableAddress = this._cart.delivery.addresses[0] || {}

        return this.query(CartAPI.deliveryAddressUpdate, {
            address: {
                deliveryAddress: {
                    ...(province ? {city: province} : {}),
                    ...(ward ? {address2: ward} : {}),
                    countryCode: currCartSelectableAddress.address.countryCode,
                },
            },
            id: currCartSelectableAddress.id,
            oneTimeUse: currCartSelectableAddress.oneTimeUse,
            selected: currCartSelectableAddress.selected,
        });
    }


    async clear() {
        const lineIds = this.state.lines.map(({id}) => id);

        return this.remove(lineIds);
    }

    refresh = (state) => {
        this.state = state;
    };

}

window.Cart = new Cart();

