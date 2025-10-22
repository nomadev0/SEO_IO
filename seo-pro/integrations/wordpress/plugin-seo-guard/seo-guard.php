<?php
/**
 * Plugin Name: SEO Guard (Guardrails + Auto-Fix)
 * Description: Evita noindex accidentales, asegura canonical y X-Robots en staging.
 * Version: 0.1.0
 */

add_action('wp_head', function(){
  if (!is_user_logged_in() && get_option('seoguard_force_canonical', true)){
    $canonical = (is_ssl() ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . strtok($_SERVER['REQUEST_URI'], '?');
    echo '<link rel="canonical" href="' . esc_url($canonical) . '" />';
  }
}, 1);

add_action('send_headers', function(){
  if (defined('WP_ENV') && WP_ENV !== 'production'){
    header('X-Robots-Tag: noindex, nofollow');
  }
});

// Admin setting mínimo
add_action('admin_init', function(){
  register_setting('reading', 'seoguard_force_canonical');
  add_settings_field('seoguard_force_canonical', 'Forzar canonical', function(){
    $v = get_option('seoguard_force_canonical', true);
    echo '<input type="checkbox" name="seoguard_force_canonical" value="1" ' . checked(1, $v, false) . ' />';
  }, 'reading');
});