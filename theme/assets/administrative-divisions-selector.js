import {EVENTS} from "./data-constants.js";

if (!customElements.get("administrative-divisions-selector")) {
    customElements.define("administrative-divisions-selector", class extends HTMLElement {
        constructor() {
            super();

            this.innerHTML = `
                    <select id="province"></select>
                
                    <select id="ward" disabled></select>
            `
        }

        connectedCallback() {
            this.provinceSelect = this.querySelector("#province");
            this.$provinceSelect = $(this.provinceSelect)
            this.wardSelect = this.querySelector("#ward");
            this.$wardSelect = $(this.wardSelect)

            const type = this.getAttribute('type')
            const outlet = type === "cart-page" ? $('body') : $(`cart-drawer [slot="footer"]`)

            this.$provinceSelect.select2({
                dropdownParent: outlet
            });
            this.$wardSelect.select2({
                dropdownParent: outlet
            });
            if (!Cart.initialized) {
                document.addEventListener(EVENTS.CART_LOADED, this.init.bind(this))
            } else {
                this.init();
            }
        }

        async init() {
            await this.fetchAdministrativeDivisions();

            this.$provinceSelect.on("change", (e) => {
                const $selectedOption = $(e.target.querySelector("option:checked"));
                const provinceCode = $selectedOption.val();
                const provinceName = $selectedOption.data("name");

                this.selectedProvince = provinceName
                this.populateWards(provinceCode);
            });

            this.$wardSelect.on("change", (e) => {

                if (!this.selectedProvince) return;

                const $selectedOption = $(e.target.querySelector("option:checked"));
                const wardName = $selectedOption.data("name");

                this.selectedWard = wardName

                window.Cart.deliveryAddressUpdate({
                    province: this.selectedProvince,
                    ward: this.selectedWard,
                })
            })

            this.populateProvinces();

            const currCartSelectableAddress = this.getCurrentAddress();
            // console.log("%c 1 --> Line: 63||administrative-divisions-selector.js\n currCartSelectableAddress: ", "color:#f0f;", currCartSelectableAddress);

            const defaultProvince = currCartSelectableAddress?.city ?? "",
                defaultWard = currCartSelectableAddress?.address2 ?? "";
            // console.log("%c 1 --> Line: 65||administrative-divisions-selector.js\n defaultProvince: ", "color:#f0f;", defaultProvince);

            const provinceFound = this.data.find(p => this.normalizeUnicode(p.name) === this.normalizeUnicode(defaultProvince));
            // console.log("%c 1 --> Line: 67||administrative-divisions-selector.js\n provinceFound: ", "color:#f0f;", provinceFound);

            if (provinceFound) {
                this.$provinceSelect.val(provinceFound.province_code);
                this.$provinceSelect.trigger('change');

                const wardFound = provinceFound.wards.find(w => this.normalizeUnicode(w.name) === this.normalizeUnicode(defaultWard));
                // console.log("%c 1 --> Line: 73||administrative-divisions-selector.js\n wardFound: ", "color:#f0f;", wardFound);

                if (wardFound) {
                    this.$wardSelect.val(wardFound.ward_code);
                }
            }


        }

        async fetchAdministrativeDivisions() {
            const response = await fetch(`${window.Shop.fileUrl}vietnam-administrative-divisions.json`);

            if (response.ok) {
                const vietnamAdministrativeDivisions = await response.json();

                this.data = vietnamAdministrativeDivisions;
            } else {
                this.data = []
            }
        }

        getCurrentAddress() {
            let address = null;

            const deliveryAddress = Cart._cart.delivery?.addresses[0]?.address
            const mailingAddress = Cart._cart.buyerIdentity?.customer?.defaultAddress

            address = deliveryAddress || mailingAddress;


            return address
        }

        populateProvinces() {

            if (!this.data?.length) return

            this.provinceSelect.innerHTML = '<option value="">Tỉnh / Thành Phố</option>' +
                this.data.map((p, i) => `<option value="${p.province_code}" data-name="${p.name}">${`${i + 1}`.padStart(2, "0")} ${p.name}</option>`).join('');

        }

        populateWards(provinceCode, filter = '') {
            if (!this.data?.length) return

            const province = this.data.find(p => p.province_code === provinceCode);
            const wards = province ? province.wards : [];

            this.wardSelect.innerHTML = '<option value="">Phường / Xã</option>' +
                wards.map(w => `<option value="${w.ward_code}" data-name="${w.name}">${w.name}</option>`).join('');
            this.wardSelect.disabled = !wards.length;
        }

        normalizeUnicode(str) {
            return str
                .normalize('NFD') // Decompose Unicode characters
                .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                .toLowerCase();
        }
    });
}
