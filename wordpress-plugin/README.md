# Helix WordPress Plugin

Helix Form Builder embeds the Helix Admin Panel into WordPress and provides a shortcode for rendering Helix forms.

## Features

- WordPress admin menu for the Helix builder
- Settings page for API URL, theme, color, and custom CSS
- REST proxy endpoint for authenticated admin requests
- Shortcode support via `[helix_form schema_id="your-schema"]`
- Translation-ready plugin structure

## Installation

1. Build or package the plugin.
2. Upload the `wordpress-plugin` directory to your WordPress plugins folder.
3. Activate **Helix Form Builder** in WordPress admin.
4. Open **Helix Forms** and configure the API URL in **Settings**.

## Shortcode

Use the shortcode below in posts or pages:

```text
[helix_form schema_id="contact-form" version="1"]
```

## Notes

- The admin wrapper loads the hosted Helix admin bundle from the configured CDN URL in the plugin assets script.
- The frontend shortcode loads the hosted web components bundle.
- Update CDN URLs in [wordpress-plugin/helix-admin.php](wordpress-plugin/helix-admin.php) and [wordpress-plugin/assets/admin-panel.js](wordpress-plugin/assets/admin-panel.js) for your deployment.
