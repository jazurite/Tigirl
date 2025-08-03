class CookieParserFactory {

    get(name) {
        if (typeof document === "undefined" || (arguments.length && !name)) {
            return;
        }

        // To prevent the for loop in the first place assign an empty array
        // in case there are no cookies at all.
        const cookies = document.cookie ? document.cookie.split("; ") : [];
        const jar = {};
        for (let i = 0; i < cookies.length; i++) {
            const parts = cookies[i].split("=");
            const value = parts.slice(1).join("=");

            try {
                const found = decodeURIComponent(parts[0]);
                if (!(found in jar)) jar[found] = this.read(value);
                if (name === found) {
                    break;
                }
            } catch {
                // Do nothing...
            }
        }

        return name ? jar[name] : jar;

    }

    read(value) {
        if (value[0] === "\"") {
            value = value.slice(1, -1);
        }
        return value.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    }
}

const CookieParser = new CookieParserFactory();

window.CookieParser = CookieParser


export default CookieParser;
