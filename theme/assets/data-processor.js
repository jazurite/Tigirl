import { allFulfilled, fetchMetaobjects, fetchProduct, fetchVariant } from "./data-fetcher.js";
import {extractIdFromGid} from "./theme.js";

export const productMapper = (product) => {
    const {
        featuredImage: imgSource,
        metafields: baseMetafields = [],
        variants: variantsEntry,
        priceRange: basePriceRange,
        compareAtPriceRange: baseOriginalPriceRange,
        ...rest
    } = product;

    const metafields = metafieldsMapper(baseMetafields);

    const accentuateImg = metafields["isolated_image"];

    const featuredImage = accentuateImg ? `${accentuateImg?.[0]?.src}&transform=resize=720` : imgSource.src + `&width=720`;
    const displayName = metafields["display_name"];
    const trackPostfix = metafields["track_postfix"];

    const priceRange = [+basePriceRange.minVariantPrice.amount, +basePriceRange.maxVariantPrice.amount];
    const originalPriceRange = [+baseOriginalPriceRange?.minVariantPrice.amount ?? 0, +baseOriginalPriceRange?.maxVariantPrice.amount ?? 0];

    const variants = (variantsEntry?.nodes ?? []).map(variantMapper);

    const availableVariants = variants.filter((node) => node.available);
    const firstAvailableVariant = availableVariants[0];
    const hasOnlyDefaultVariant = variants.length === 1;

    return {
        variants,
        availableVariants,
        firstAvailableVariant,
        featuredImage,
        displayName,
        trackPostfix,
        priceRange,
        originalPriceRange,
        hasOnlyDefaultVariant,
        metafields,
        ...rest,
    };
};

export const variantMapper = (variant) => {
    const {
        id: gid,
        price: priceMoney,
        compareAtPrice,
        metafields: baseMetafields = [],
        product,
        availableForSale,
        ...rest
    } = variant;

    const metafields = metafieldsMapper(baseMetafields);

    const price = parseFloat(priceMoney?.amount ?? 0);

    const originalPrice = parseFloat(compareAtPrice?.amount ?? 0) || price;
    const totalSaved = Math.max(0, originalPrice - price);

    return {
        id: extractIdFromGid(gid),
        available: availableForSale,
        price,
        originalPrice,
        totalSaved,
        gid,
        metafields,
        ...(product ? { product: productMapper(product) } : {}),
        ...rest,
    };
};

export const metafieldsMapper = (metafields = null) => {
    return !metafields ? null : metafields.reduce((r, node) => {
        if (!!node) {
            let value = node.value;

            switch (node.type) {
                case "list.metaobject_reference":
                case "json_string":
                case "list.variant_reference":
                    value = JSON.parse(node.value ?? null);
                    break;
            }

            r[node.key] = value;
        }

        return r;
    }, {});
};

export const metaobjectMapper = (metaobject) => {
    const { fields: baseFields, ...rest } = metaobject;

    const fields = baseFields.reduce((r, { key, value, type }) => {
        switch (type) {
            case "variant_reference":
                key = "variantId";
                break;
            case "product_reference":
                key = "productId";
                break;
        }

        r[key] = value;
        return r;
    }, {});

    return {
        ...fields,
        ...rest,
    };
};


export const productLiquidMapper = (product) => {
    const {
        variants: variantsEntry,

        ...rest
    } = product;


    const variants = variantsEntry.map(variant => variantLiquidMapper(_.mapKeys(variant, (val, k) => _.camelCase(k))));

    const availableVariants = variants.filter((node) => node.available);
    const firstAvailableVariant = availableVariants[0];
    const hasOnlyDefaultVariant = variants.length === 1;

    return {
        variants,
        availableVariants,
        firstAvailableVariant,
        hasOnlyDefaultVariant,
        ...rest,
    };
};

export const variantLiquidMapper = (variant) => {
    const {
        price: wholePrice,
        compareAtPrice: wholeCompareAtPrice,
        ...rest
    } = variant;

    const price = wholePrice / 100,
        compareAtPrice = wholeCompareAtPrice / 100,
        originalPrice = compareAtPrice || price,
        totalSaved = Math.max(0, originalPrice - price);

    return {
        price,
        compareAtPrice,
        originalPrice,
        totalSaved,
        ...rest,
    };
};


export const metaobjectIdsMapper = async (metaobjectIds) => {
  if (!metaobjectIds) {
    return [];
  }

  const metaobjects = await fetchMetaobjects(metaobjectIds);

  return allFulfilled(
    metaobjects.map(async (metaobject) => {
      const variant = await fetchVariant(metaobject.variantId);

      return {
        title: metaobject.title,
        variant,
        parent: await fetchProduct(metaobject.productId || variant.product.id),
        qty: metaobject.qty,
      };
    }),
  );
}
