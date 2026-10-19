# Virtual Try-On: Integration Guide

Add a "Try it on" button to any online store. The shopper uploads or takes a photo, and the AI shows them wearing the product.

Live demo and hosted files: https://try-on-library.vercel.app

---

## 1. Quick start (hosted script, about 5 minutes)

Our backend and script are already live, so a new site only needs two things.

### Step 1: Add the script
Put this before `</body>` on the page (or in the site-wide layout):

```html
<script src="https://try-on-library.vercel.app/tryon.umd.js"
        data-accent="#5B2A4E" data-locale="en" async></script>
```

- The backend is detected automatically from the script's host.
- `data-locale="ur"` switches the interface to Roman Urdu.
- `data-accent` is the store's brand colour for buttons.

### Step 2: Add the button on product pages

```html
<button type="button"
        data-tryon-product="https://store.com/images/product.jpg"
        data-tryon-id="SKU-123"
        data-tryon-name="Cotton co-ord set"
        data-tryon-price="Rs 3,983"
        data-tryon-sizes="S,M,L"
        data-tryon-category="upper_body">
  Try it on
</button>
```

| Attribute | Required | Meaning |
| --- | --- | --- |
| `data-tryon-product` | Yes | Public URL of the product photo |
| `data-tryon-id` | No | SKU or product id |
| `data-tryon-name` | No | Product name (also sent to the AI as a description) |
| `data-tryon-price` | No | Shown in the window |
| `data-tryon-sizes` | No | Comma-separated sizes, shown for Add to cart |
| `data-tryon-category` | No | `upper_body`, `lower_body` or `dresses` |

Buttons added later (for example when a shopper changes colour) work too. Change the data attributes and the next click uses the new values.

### Step 3: Connect Add to cart
The window has an "Add to cart" button. Listen for it and call the store's own cart:

```js
window.addEventListener('tryon:addToCart', (e) => {
  const { product, size, imageUrl } = e.detail;
  myStore.cart.add(product.id, size);
});
```

Other events: `tryon:open`, `tryon:photo`, `tryon:result`, `tryon:error`, `tryon:close`.

---

## 2. Platform recipes

### Shopify
In the product template (for example `sections/main-product.liquid`):

```liquid
<script src="https://try-on-library.vercel.app/tryon.umd.js" async></script>

<button type="button"
  data-tryon-product="https:{{ product.featured_image | image_url: width: 1000 }}"
  data-tryon-id="{{ product.selected_or_first_available_variant.id }}"
  data-tryon-name="{{ product.title | escape }}"
  data-tryon-price="{{ product.price | money }}"
  data-tryon-sizes="{{ product.options_with_values[0].values | join: ',' }}">
  Try it on
</button>

<script>
  window.addEventListener('tryon:addToCart', function (e) {
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: e.detail.product.id, quantity: 1 }] })
    }).then(function () { window.location = '/cart'; });
  });
</script>
```
The size is a variant option on Shopify, so pick the variant that matches `e.detail.size` if needed.

### WordPress / WooCommerce
In the theme's `functions.php`:

```php
add_action('wp_footer', function () {
  echo '<script src="https://try-on-library.vercel.app/tryon.umd.js" async></script>';
});

add_action('woocommerce_single_product_summary', function () {
  global $product;
  $img = wp_get_attachment_url($product->get_image_id());
  printf(
    '<button type="button" data-tryon-product="%s" data-tryon-id="%s" data-tryon-name="%s">Try it on</button>',
    esc_url($img), esc_attr($product->get_id()), esc_attr($product->get_name())
  );
}, 35);
```

### React / Next.js

```tsx
import Script from 'next/script';

export function TryOn({ image, id, name }: { image: string; id: string; name: string }) {
  return (
    <>
      <Script src="https://try-on-library.vercel.app/tryon.umd.js" strategy="afterInteractive" />
      <button data-tryon-product={image} data-tryon-id={id} data-tryon-name={name}>
        Try it on
      </button>
    </>
  );
}
```

Or open it from code:

```js
window.VirtualTryOn.open({ image, id, name, price, sizes: ['S', 'M', 'L'] });
```

### Plain HTML
Use the two snippets from the quick start. Nothing else is needed.

---

## 3. Optional settings

Put them as `data-` attributes on the script tag.

| Attribute | Values | Default |
| --- | --- | --- |
| `data-accent` | any colour, such as `#5B2A4E` | teal |
| `data-locale` | `en`, `ur` | `en` |
| `data-theme` | `auto`, `light`, `dark` | `auto` |
| `data-compare` | `auto`, `side`, `slider` | `auto` |
| `data-api-key` | key issued for the store | none |
| `data-endpoint` | backend URL (only if different from the script host) | script host |
| `data-mock` | `true` to test the UI without a backend | off |

JavaScript API (instead of attributes):

```js
VirtualTryOn.init({ accent: '#5B2A4E', locale: 'ur', apiKey: 'pk_live_xxx' });
```

---

## 4. Running your own backend (optional)

Use this when you do not want to depend on `try-on-library.vercel.app`.

1. Clone `https://github.com/umarchaanda/try-on-library`.
2. Import it into your own Vercel account (or run `npx vercel deploy --prod`).
3. Set environment variables (Vercel dashboard, or `npx vercel env add NAME production`):

| Variable | Purpose |
| --- | --- |
| `HF_TOKEN` | Free Hugging Face token. Gives a bigger free quota. Recommended. |
| `GEMINI_API_KEY` | Google Gemini. Needs billing enabled, free tier has no image quota. |
| `REPLICATE_API_TOKEN` | Paid Replicate, more reliable. |
| `TRYON_PROVIDER` | Force `hf`, `gemini` or `replicate`. |
| `TRYON_API_KEYS` | Comma-separated keys. Requests without a valid `X-Api-Key` are rejected. |
| `ALLOWED_ORIGINS` | Comma-separated store origins, for example `https://store.com`. Default `*`. |

4. Point stores at your domain: `<script src="https://YOUR-DOMAIN/tryon.umd.js">`.

Models used (in order): Gemini (only if it has quota), then Kolors Virtual Try-On, then IDM-VTON as a fallback.

On Windows PowerShell use `npx.cmd` instead of `npx`, because `npx.ps1` is blocked by the default execution policy.

---

## 5. Requirements and checklist

- [ ] The product image is a public JPEG, PNG or WebP URL (not behind a login).
- [ ] The site uses HTTPS (the camera does not work on plain HTTP).
- [ ] If the site has a Content-Security-Policy, allow the try-on host in `script-src` and `connect-src`.
- [ ] Add-to-cart event is connected to the store's cart.
- [ ] Tested with one real photo on mobile and desktop.

---

## 6. Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| Button does nothing | Script not loaded (check the Network tab) or `data-tryon-product` is empty. |
| "Could not reach the server" | Network or CORS problem. Check `ALLOWED_ORIGINS` and the endpoint. |
| Takes 30 to 60 seconds | Free GPU is slow when busy. A paid provider is faster. |
| "Too many requests" / rate limited | Free GPU quota is used up. Add `HF_TOKEN` or use a paid provider. |
| "Photo not suitable" | The model could not find a person. Use a clear, front-facing photo with the upper body visible. |
| Garment looks wrong | Use a clear product photo (model or mannequin, plain background) as `data-tryon-product`. |
| Script blocked | The site's Content-Security-Policy blocks external scripts. Allow the try-on host. |

---

## 7. Current limitations

- Free models are shared and can be slow or hit their daily quota. Use a paid provider for real traffic.
- Very tightly cropped or zoomed-in photos cannot be extended by the free models.
- The hosted backend currently has no per-store keys or rate limits. Add `TRYON_API_KEYS` and `ALLOWED_ORIGINS` before a public launch.
- The shopper's photo is sent straight to the AI model and is not stored by this backend.
