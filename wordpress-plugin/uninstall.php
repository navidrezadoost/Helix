<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('helix_api_url');
delete_option('helix_primary_color');
delete_option('helix_theme');
delete_option('helix_custom_css');
