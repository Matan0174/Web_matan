/**
 * Scripts injected into the WebView.
 *
 * IMPORTANT — Expo Go vs Standalone APK difference:
 * In Expo Go (debug) the JS is injected at the right time because Metro
 * re-evaluates on every reload.  In a **release APK** the injected script
 * may run BEFORE the DOM is ready, which causes `document.body.appendChild`
 * to fail silently.
 *
 * Fix: Every script below checks `document.readyState` and defers to
 * the `DOMContentLoaded` event when necessary.
 */

/** Helper that runs `fn` as soon as the DOM is interactive. */
const DOM_READY_WRAPPER = `
function __whenDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}
`;

export const PULL_TO_REFRESH_JS = `
  (function() {
    if (window.__ptrInjected) return;
    window.__ptrInjected = true;

    ${DOM_READY_WRAPPER}

    __whenDomReady(function() {
      // Create pull-to-refresh indicator element
      var indicator = document.createElement('div');
      indicator.style.cssText = 'position:fixed;top:-50px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;z-index:2147483647;transition:top 0.2s ease-out,opacity 0.2s;pointer-events:none;opacity:0;';
      var spinner = document.createElement('div');
      spinner.style.cssText = 'width:18px;height:18px;border:2.5px solid #e0e0e0;border-top-color:#4285f4;border-radius:50%;';
      indicator.appendChild(spinner);
      document.body.appendChild(indicator);

      var styleEl = document.createElement('style');
      styleEl.textContent = '@keyframes __ptrSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(styleEl);

      var startY = 0;
      var pulling = false;
      var refreshing = false;
      var THRESHOLD = 80;

      function findScrolledParent(el) {
        while (el && el !== document.body && el !== document.documentElement && el !== document) {
          try {
            var cs = window.getComputedStyle(el);
            var ov = cs.overflowY || cs.overflow || '';
            if ((ov === 'auto' || ov === 'scroll' || ov === 'overlay') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) {
              return el;
            }
          } catch(e) {}
          el = el.parentElement;
        }
        return null;
      }

      function isPageAtTop(target) {
        var mainScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (mainScroll > 1) return false;
        if (findScrolledParent(target)) return false;
        return true;
      }

      document.addEventListener('touchstart', function(e) {
        if (refreshing || e.touches.length !== 1) return;
        if (!isPageAtTop(e.touches[0].target)) { pulling = false; return; }
        startY = e.touches[0].pageY;
        pulling = true;
      }, { passive: true });

      document.addEventListener('touchmove', function(e) {
        if (!pulling || refreshing) return;
        var mainScroll = window.scrollY || window.pageYOffset || 0;
        if (mainScroll > 1) { pulling = false; indicator.style.top = '-50px'; indicator.style.opacity = '0'; return; }
        var dy = e.touches[0].pageY - startY;
        if (dy <= 0) { indicator.style.top = '-50px'; indicator.style.opacity = '0'; return; }
        var progress = Math.min(dy / THRESHOLD, 1);
        var pos = Math.min(dy * 0.35, 60);
        indicator.style.top = (pos - 15) + 'px';
        indicator.style.opacity = '' + progress;
        spinner.style.transform = 'rotate(' + (dy * 3) + 'deg)';
        spinner.style.animation = 'none';
      }, { passive: true });

      document.addEventListener('touchend', function(e) {
        if (!pulling || refreshing) return;
        var dy = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].pageY : 0) - startY;
        if (dy >= THRESHOLD) {
          refreshing = true;
          indicator.style.top = '18px';
          indicator.style.opacity = '1';
          spinner.style.transform = '';
          spinner.style.animation = '__ptrSpin 0.6s linear infinite';
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'refresh' }));
          setTimeout(function() {
            indicator.style.top = '-50px';
            indicator.style.opacity = '0';
            spinner.style.animation = 'none';
            refreshing = false;
          }, 1000);
        } else {
          indicator.style.top = '-50px';
          indicator.style.opacity = '0';
        }
        pulling = false;
      }, { passive: true });
    });
  })();
`;

export const SCROLL_TRACKING_JS = `
  (function() {
    if (window.__scrollTrackInjected) return;
    window.__scrollTrackInjected = true;

    ${DOM_READY_WRAPPER}

    __whenDomReady(function() {
      var __scrollTimer = null;
      window.addEventListener('scroll', function() {
        if (__scrollTimer) clearTimeout(__scrollTimer);
        __scrollTimer = setTimeout(function() {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'scrollPosition',
              x: window.scrollX || window.pageXOffset || 0,
              y: window.scrollY || window.pageYOffset || 0
            }));
          } catch(e) {}
        }, 150);
      }, { passive: true });
    });
  })();
`;

export const FULLSCREEN_FIX_JS = `
  (function() {
    if (window.__fullscreenFixInjected) return;
    window.__fullscreenFixInjected = true;

    ${DOM_READY_WRAPPER}

    __whenDomReady(function() {
      // Ensure all iframes have fullscreen permissions
      function fixIframes() {
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          var iframe = iframes[i];
          if (!iframe.hasAttribute('allowfullscreen')) {
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('webkitallowfullscreen', 'true');
          }
          var allow = iframe.getAttribute('allow') || '';
          if (allow.indexOf('fullscreen') === -1) {
            iframe.setAttribute('allow', allow + (allow ? '; ' : '') + 'fullscreen');
          }
        }
      }

      // Run immediately and on every DOM change
      fixIframes();
      if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(function() { fixIframes(); })
          .observe(document.documentElement, { childList: true, subtree: true });
      }
    });
  })();
`;

/**
 * Intercept link clicks and form submissions at the JS level.
 * This acts as a **backup** for `onShouldStartLoadWithRequest` which
 * is unreliable on Android release builds (it may not fire for
 * client-side navigations, meta-refresh, or window.location changes).
 *
 * Whenever a navigation is detected we send the target URL to RN
 * via postMessage so the native side can verify / block it.
 */
export const NAVIGATION_INTERCEPT_JS = `
  (function() {
    if (window.__navInterceptInjected) return;
    window.__navInterceptInjected = true;

    ${DOM_READY_WRAPPER}

    __whenDomReady(function() {
      // Intercept anchor clicks
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.href) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'navigationRequest',
              url: target.href
            }));
          } catch(err) {}
        }
      }, true);
    });
  })();
`;

/** Combined script injected AFTER page content loads */
export const INJECTED_JAVASCRIPT = `
  ${PULL_TO_REFRESH_JS}
  ${SCROLL_TRACKING_JS}
  ${FULLSCREEN_FIX_JS}
  ${NAVIGATION_INTERCEPT_JS}
  true;
`;

/**
 * Script injected BEFORE page content loads.
 * Runs immediately when the WebView starts loading a page, before
 * the DOM is available.  Use this for things that need to happen early
 * (e.g. overriding window.open, intercepting navigation at the
 * earliest possible moment).
 */
export const INJECTED_JS_BEFORE_CONTENT_LOADED = `
  (function() {
    // Override window.open so popups are caught by React Native
    // instead of being silently swallowed in standalone builds.
    var originalOpen = window.open;
    window.open = function(url, target, features) {
      if (url) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'windowOpen',
            url: url
          }));
        } catch(e) {}
      }
      // Return null to prevent the popup (we handle it in RN)
      return null;
    };
  })();
  true;
`;
