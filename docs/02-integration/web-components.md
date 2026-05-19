# Web Components Integration (Vanilla JS)

## Installation

```html
<!-- CDN (recommended) -->
<script type="module">
  import 'https://cdn.helix.com/helix-webcomponents@1.0.0.js';
</script>

<!-- Or self-hosted -->
<script type="module" src="/node_modules/@helix/webcomponents/dist/index.js"></script>
```

## Basic Usage

```html
<helix-form
  schema-id="contact-form"
  schema-version="1"
  endpoint="https://api.helix.com"
  platform="web"
  enable-prefetch="true"
></helix-form>
```

## Event Handling

```javascript
const form = document.querySelector('helix-form');

form.addEventListener('submit-success', (event) => {
  console.log('Submission successful:', event.detail);
  showToast('Form saved!');
});

form.addEventListener('submit-error', (event) => {
  console.error('Submission failed:', event.detail.error);
  showError(event.detail.error);
});
```

## Async Select Component

```html
<helix-async-select
  field-id="states"
  prefetch-on-focus="true"
  show-cache="true"
  auto-retry-ms="30000"
></helix-async-select>
```

## Styling with CSS Variables

```css
helix-form {
  --helix-primary-color: #3b82f6;
  --helix-error-color: #dc2626;
  --helix-border-radius: 8px;
  --helix-font-family: system-ui, sans-serif;
}
```

## Dynamic Form Creation

```javascript
const container = document.getElementById('form-container');
const form = document.createElement('helix-form');

form.setAttribute('schema-id', 'dynamic-form');
form.setAttribute('endpoint', 'https://api.helix.com');
form.addEventListener('submit-success', handleSuccess);

container.appendChild(form);
```

## Shopify Storefront Example

```liquid
<!-- sections/helix-custom-form.liquid -->
<div id="helix-root"></div>

<script type="module">
  import 'https://cdn.helix.com/helix-webcomponents.js';
  
  const form = document.createElement('helix-form');
  form.setAttribute('schema-id', '{{ section.settings.schema_id }}');
  form.setAttribute('endpoint', '{{ shop.metafields.helix.api_endpoint }}');
  form.setAttribute('platform', 'shopify-storefront');
  
  document.getElementById('helix-root').appendChild(form);
</script>

{% schema %}
{
  "name": "Helix Form",
  "settings": [
    {
      "type": "text",
      "id": "schema_id",
      "label": "Form Schema ID",
      "default": "contact-form"
    }
  ]
}
{% endschema %}
```
