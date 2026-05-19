<?php
/**
 * Plugin Name: Helix Form Builder
 * Plugin URI: https://helix.yourdomain.com
 * Description: Dynamic form builder with DAG-based validation, async cascades, and cross-form rules.
 * Version: 1.0.0
 * Author: Helix Team
 * License: MIT
 * Text Domain: helix-admin
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('HELIX_ADMIN_VERSION', '1.0.0');
define('HELIX_ADMIN_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('HELIX_ADMIN_PLUGIN_URL', plugin_dir_url(__FILE__));
define('HELIX_ADMIN_ASSETS_URL', HELIX_ADMIN_PLUGIN_URL . 'assets/');

class HelixAdminPlugin
{
    private static $instance = null;
    private $api_url = '';
    private $admin_page_slug = 'helix-form-builder';

    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct()
    {
        add_action('init', [$this, 'init']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('plugins_loaded', [$this, 'load_textdomain']);
        add_action('admin_init', [$this, 'register_settings']);
        add_shortcode('helix_form', [$this, 'render_form_shortcode']);
    }

    public function init()
    {
        $this->api_url = get_option('helix_api_url', 'https://api.helix.yourdomain.com');
    }

    public function load_textdomain()
    {
        load_plugin_textdomain('helix-admin', false, dirname(plugin_basename(__FILE__)) . '/languages');
    }

    public function register_settings()
    {
        register_setting('helix_settings_group', 'helix_api_url');
        register_setting('helix_settings_group', 'helix_primary_color');
        register_setting('helix_settings_group', 'helix_theme', [
            'default' => 'light',
        ]);
        register_setting('helix_settings_group', 'helix_custom_css');
    }

    public function add_admin_menu()
    {
        add_menu_page(
            __('Helix Form Builder', 'helix-admin'),
            __('Helix Forms', 'helix-admin'),
            'manage_options',
            $this->admin_page_slug,
            [$this, 'render_admin_page'],
            'dashicons-feedback',
            30
        );

        add_submenu_page(
            $this->admin_page_slug,
            __('Settings', 'helix-admin'),
            __('Settings', 'helix-admin'),
            'manage_options',
            'helix-settings',
            [$this, 'render_settings_page']
        );
    }

    public function render_admin_page()
    {
        echo '<div class="wrap helix-admin-wrapper"><div id="helix-admin-root"></div></div>';
    }

    public function render_settings_page()
    {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Helix Form Builder Settings', 'helix-admin'); ?></h1>
            <form method="post" action="options.php">
                <?php settings_fields('helix_settings_group'); ?>
                <?php do_settings_sections('helix_settings_group'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="helix_api_url"><?php esc_html_e('API URL', 'helix-admin'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="helix_api_url" name="helix_api_url" value="<?php echo esc_url(get_option('helix_api_url', 'https://api.helix.yourdomain.com')); ?>" class="regular-text" />
                            <p class="description"><?php esc_html_e('Your Helix API endpoint URL', 'helix-admin'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="helix_primary_color"><?php esc_html_e('Primary Color', 'helix-admin'); ?></label>
                        </th>
                        <td>
                            <input type="color" id="helix_primary_color" name="helix_primary_color" value="<?php echo esc_attr(get_option('helix_primary_color', '#3b82f6')); ?>" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="helix_theme"><?php esc_html_e('Theme', 'helix-admin'); ?></label>
                        </th>
                        <td>
                            <select id="helix_theme" name="helix_theme">
                                <option value="light" <?php selected(get_option('helix_theme', 'light'), 'light'); ?>><?php esc_html_e('Light', 'helix-admin'); ?></option>
                                <option value="dark" <?php selected(get_option('helix_theme', 'light'), 'dark'); ?>><?php esc_html_e('Dark', 'helix-admin'); ?></option>
                                <option value="auto" <?php selected(get_option('helix_theme', 'light'), 'auto'); ?>><?php esc_html_e('Auto (system preference)', 'helix-admin'); ?></option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="helix_custom_css"><?php esc_html_e('Custom CSS', 'helix-admin'); ?></label>
                        </th>
                        <td>
                            <textarea id="helix_custom_css" name="helix_custom_css" rows="10" class="large-text code"><?php echo esc_textarea(get_option('helix_custom_css', '')); ?></textarea>
                            <p class="description"><?php esc_html_e('Add custom CSS to style the admin panel', 'helix-admin'); ?></p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function enqueue_admin_assets($hook)
    {
        if (strpos($hook, 'helix') === false) {
            return;
        }

        wp_enqueue_style(
            'helix-admin-style',
            HELIX_ADMIN_ASSETS_URL . 'admin-panel.css',
            [],
            HELIX_ADMIN_VERSION
        );

        wp_enqueue_script(
            'helix-admin-script',
            HELIX_ADMIN_ASSETS_URL . 'admin-panel.js',
            [],
            HELIX_ADMIN_VERSION,
            true
        );

        $current_user = wp_get_current_user();

        wp_localize_script('helix-admin-script', 'helixAdminConfig', [
            'apiUrl' => get_option('helix_api_url', 'https://api.helix.yourdomain.com'),
            'primaryColor' => get_option('helix_primary_color', '#3b82f6'),
            'theme' => get_option('helix_theme', 'light'),
            'nonce' => wp_create_nonce('wp_rest'),
            'restUrl' => rest_url('helix/v1'),
            'platform' => 'wordpress',
            'user' => [
                'id' => get_current_user_id(),
                'name' => $current_user->display_name,
                'email' => $current_user->user_email,
                'capabilities' => array_keys($current_user->allcaps),
            ],
            'i18n' => [
                'form_builder' => __('Form Builder', 'helix-admin'),
                'save_draft' => __('Save Draft', 'helix-admin'),
                'publish' => __('Publish', 'helix-admin'),
                'delete' => __('Delete', 'helix-admin'),
                'fields' => __('Fields', 'helix-admin'),
                'rules' => __('Rules', 'helix-admin'),
                'data_sources' => __('Data Sources', 'helix-admin'),
                'global_rules' => __('Global Rules', 'helix-admin'),
                'loading' => __('Loading...', 'helix-admin'),
                'error' => __('An error occurred', 'helix-admin'),
                'success' => __('Success!', 'helix-admin'),
            ],
        ]);

        $custom_css = get_option('helix_custom_css', '');
        if (!empty($custom_css)) {
            wp_add_inline_style('helix-admin-style', $custom_css);
        }
    }

    public function register_rest_routes()
    {
        register_rest_route('helix/v1', '/proxy/(?P<path>.*)', [
            'methods' => ['GET', 'POST', 'PUT', 'DELETE'],
            'callback' => [$this, 'proxy_api_request'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);
    }

    public function check_permissions()
    {
        return current_user_can('manage_options');
    }

    public function proxy_api_request($request)
    {
        $path = $request->get_param('path');
        $method = $request->get_method();
        $body = $request->get_json_params();
        $url = trailingslashit($this->api_url) . ltrim($path, '/');

        $response = wp_remote_request($url, [
            'method' => $method,
            'headers' => [
                'Content-Type' => 'application/json',
                'X-WordPress-Nonce' => wp_create_nonce('wp_rest'),
            ],
            'body' => $body ? wp_json_encode($body) : null,
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            return new WP_REST_Response(['error' => $response->get_error_message()], 500);
        }

        $status = wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);

        return new WP_REST_Response($data, $status);
    }

    public function render_form_shortcode($atts)
    {
        $atts = shortcode_atts([
            'schema_id' => '',
            'version' => '',
            'endpoint' => $this->api_url,
        ], $atts, 'helix_form');

        if (empty($atts['schema_id'])) {
            return '';
        }

        wp_enqueue_script(
            'helix-webcomponents-cdn',
            'https://cdn.helix.com/webcomponents.js',
            [],
            HELIX_ADMIN_VERSION,
            true
        );

        return sprintf(
            '<helix-form schema-id="%s" schema-version="%s" endpoint="%s" platform="wordpress"></helix-form>',
            esc_attr($atts['schema_id']),
            esc_attr($atts['version']),
            esc_url($atts['endpoint'])
        );
    }
}

HelixAdminPlugin::get_instance();
