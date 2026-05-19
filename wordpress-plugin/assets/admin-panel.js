(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('helix-admin-root');
    if (!root || typeof helixAdminConfig === 'undefined') {
      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdn.helix.com/admin-panel.js';
    script.onload = function () {
      if (window.HelixAdmin) {
        window.HelixAdmin.init({
          container: '#helix-admin-root',
          apiUrl: helixAdminConfig.apiUrl,
          platform: 'wordpress',
          theme: helixAdminConfig.theme,
          primaryColor: helixAdminConfig.primaryColor,
          user: helixAdminConfig.user,
          translations: helixAdminConfig.i18n,
          onError: function (error) {
            console.error('Helix Admin Error:', error);
          }
        });
      }
    };
    document.head.appendChild(script);

    if (helixAdminConfig.primaryColor && helixAdminConfig.primaryColor !== '#3b82f6') {
      var style = document.createElement('style');
      style.textContent = ':root { --helix-primary: ' + helixAdminConfig.primaryColor + '; }';
      document.head.appendChild(style);
    }
  });
})();
