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
      var startX = 0;
      var startTime = 0;
      var pulling = false;
      var refreshing = false;

      /**
       * The first DEAD_ZONE pixels of downward travel are ignored outright,
       * and only movement beyond it counts towards THRESHOLD.
       *
       * At the top of a page every downward drag looks like a pull, so
       * without a dead zone the reflex of scrolling up on an already-scrolled
       * -to-top page arms the gesture immediately. That was the main source
       * of accidental refreshes.
       */
      var DEAD_ZONE = 30;
      var THRESHOLD = 140;
      /** A flick is not a deliberate pull, however far it happens to travel. */
      var MIN_DURATION_MS = 200;

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
        startX = e.touches[0].pageX;
        startTime = Date.now();
        pulling = true;
      }, { passive: true });

      function hideIndicator() {
        indicator.style.top = '-50px';
        indicator.style.opacity = '0';
      }

      document.addEventListener('touchmove', function(e) {
        if (!pulling || refreshing) return;
        var mainScroll = window.scrollY || window.pageYOffset || 0;
        if (mainScroll > 1) { pulling = false; hideIndicator(); return; }
        var dy = e.touches[0].pageY - startY;
        var dx = e.touches[0].pageX - startX;
        // Travelling sideways means a swipe — a carousel, a back gesture, a
        // map drag — so abandon the pull rather than competing with it.
        if (Math.abs(dx) > Math.abs(dy)) { pulling = false; hideIndicator(); return; }
        var pulled = dy - DEAD_ZONE;
        if (pulled <= 0) { hideIndicator(); return; }
        var progress = Math.min(pulled / THRESHOLD, 1);
        var pos = Math.min(pulled * 0.35, 60);
        indicator.style.top = (pos - 15) + 'px';
        indicator.style.opacity = '' + progress;
        spinner.style.transform = 'rotate(' + (pulled * 3) + 'deg)';
        spinner.style.animation = 'none';
      }, { passive: true });

      document.addEventListener('touchend', function(e) {
        if (!pulling || refreshing) return;
        var dy = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].pageY : 0) - startY;
        var elapsed = Date.now() - startTime;
        if (dy - DEAD_ZONE >= THRESHOLD && elapsed >= MIN_DURATION_MS) {
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
      /**
       * Schemes the browser serves itself. Anything else on an href names
       * another app, and Android drops such a navigation without an error if
       * the WebView is left to start it — the click then looks completely
       * dead. javascript: and file: sit in this list on purpose: they are not
       * hand-offs, and cancelling a "javascript:void(0)" href would break
       * ordinary links across the web.
       */
      var OWN_SCHEMES = ['http', 'https', 'about', 'data', 'blob', 'javascript', 'file'];

      function isExternalApp(href) {
        var m = /^([a-z][a-z0-9+.-]*):/i.exec(href);
        if (!m) return false;
        return OWN_SCHEMES.indexOf(m[1].toLowerCase()) === -1;
      }

      // Intercept anchor clicks
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.href) {
          try {
            var isBlank = target.target === '_blank';
            // Cancelling here means RN is the only path that opens the URL,
            // so the target app can never be launched twice.
            if (isBlank || isExternalApp(target.href)) {
              e.preventDefault();
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: isBlank ? 'windowOpen' : 'navigationRequest',
              url: target.href
            }));
          } catch(err) {}
        }
      }, true);
    });
  })();
`;

/**
 * Downloads of files the page built itself.
 *
 * A `blob:` or `data:` URL is not a location anything can fetch — it only means
 * something inside the document that produced it. The WebView will not report a
 * navigation to one as a download, and expo-file-system, running outside the
 * WebView entirely, cannot resolve it either. So a "download PDF" button that
 * generates its file in the browser — which is how most of them work now —
 * produced no dialog and no file, just nothing at all.
 *
 * The only place the bytes exist is here, so they are read here and handed to
 * RN as base64 to be written out.
 *
 * Anchors are intercepted two ways because pages use both: a real link the user
 * taps, and the create-anchor-then-click() idiom. The latter frequently never
 * joins the document, so its click never reaches a document listener and only
 * the prototype override catches it.
 */
export const DOWNLOAD_INTERCEPT_JS = `
  (function() {
    if (window.__wmDlInjected) return;
    window.__wmDlInjected = true;

    // Base64 inflates by a third and travels to RN as one postMessage string,
    // so anything large is refused rather than risking the bridge.
    var MAX_BYTES = 16 * 1024 * 1024;

    function post(payload) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e) {}
    }

    function deliver(url, suggestedName) {
      fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(function(blob) {
          if (blob.size > MAX_BYTES) throw new Error('הקובץ גדול מדי (' + Math.round(blob.size / 1048576) + 'MB)');
          return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function() { resolve({ dataUrl: String(reader.result), type: blob.type, size: blob.size }); };
            reader.onerror = function() { reject(new Error('קריאת הקובץ נכשלה')); };
            reader.readAsDataURL(blob);
          });
        })
        .then(function(out) {
          post({
            type: 'inPageDownload',
            filename: suggestedName || '',
            mime: out.type || '',
            size: out.size,
            base64: out.dataUrl.slice(out.dataUrl.indexOf(',') + 1)
          });
        })
        .catch(function(e) {
          post({ type: 'inPageDownloadError', error: String((e && e.message) || e) });
        });
    }

    // Exposed so RN can route a popup aimed at one of these URLs back here.
    window.__wmDeliverDownload = deliver;

    function isPageBuilt(href) {
      return href.slice(0, 5) === 'blob:' || href.slice(0, 5) === 'data:';
    }

    document.addEventListener('click', function(e) {
      var a = e.target;
      while (a && a.tagName !== 'A') a = a.parentElement;
      if (!a || !a.href || !isPageBuilt(a.href)) return;
      e.preventDefault();
      deliver(a.href, a.getAttribute('download') || '');
    }, true);

    try {
      var nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        var href = this.href || '';
        if (isPageBuilt(href)) {
          deliver(href, this.getAttribute('download') || '');
          return;
        }
        return nativeClick.apply(this, arguments);
      };
    } catch(e) {}
  })();
`;

/** Combined script injected AFTER page content loads */
export const INJECTED_JAVASCRIPT = `
  ${PULL_TO_REFRESH_JS}
  ${SCROLL_TRACKING_JS}
  ${FULLSCREEN_FIX_JS}
  ${NAVIGATION_INTERCEPT_JS}
  ${DOWNLOAD_INTERCEPT_JS}
  true;
`;

/**
 * MessagePort proxying, shared by both halves of the popup bridge.
 *
 * `postMessage` can hand the receiver ownership of a MessagePort through its
 * transfer list, and a sign-in popup does exactly that: Google's does not just
 * post its result, it opens a MessageChannel and transfers a port, then talks
 * over the channel. Relaying only the message body drops the port, so the
 * channel is never established and the popup dies on
 * "Illegal state: try to send message before message channel set up."
 *
 * A real port cannot cross between two WebViews, so each side keeps a genuine
 * port and they are stitched together through RN:
 *
 *   sender          this side            RN          other side        receiver
 *   port  ──────►  we hold it   ──────►  relay  ──►  new channel  ──►  port
 *
 * The sending side holds the port it was given and forwards everything it
 * emits; the receiving side creates a fresh MessageChannel, hands one end to
 * the page inside the event, and keeps the other. Each pairing is named by an
 * id, prefixed per side so the two can never collide.
 */
const portBridgeJs = (side: string, relayFn: string) => `
  // A popup tab runs both halves of the bridge, so both copies of this code
  // are present there. The registry therefore lives on window rather than in
  // each copy's scope — otherwise whichever copy defined __wmPortMessage last
  // would be the only one able to find its ports, and the other's would be
  // silently dropped. Either copy can relay: RN routes a port message purely
  // by its id, so it does not matter which side hands it over.
  var __ports = (window.__wmPorts = window.__wmPorts || {});
  var __portSeq = 0;

  function __portRelay(portId, data) {
    ${relayFn}({ type: 'portMessage', portId: portId, message: data });
  }

  function __holdPort(portId, port) {
    __ports[portId] = port;
    port.onmessage = function(ev) { __portRelay(portId, ev.data); };
    try { port.start(); } catch(e) {}
  }

  /** Registers the ports being transferred out and returns their ids. */
  function __registerTransfer(transfer) {
    var ids = [];
    if (!transfer || !transfer.length) return ids;
    for (var i = 0; i < transfer.length; i++) {
      var port = transfer[i];
      if (!port || typeof port.postMessage !== 'function') continue;
      // Ids key a table RN keeps across every tab, so they carry the side, a
      // counter and a random tail rather than trusting the clock alone.
      var id = '${side}' + (++__portSeq) + '-' + Date.now().toString(36) +
               '-' + Math.random().toString(36).slice(2, 8);
      __holdPort(id, port);
      ids.push(id);
    }
    return ids;
  }

  /** Builds this side's end of each transferred port, for event.ports. */
  function __materializePorts(ids) {
    var ports = [];
    if (!ids || !ids.length) return ports;
    for (var i = 0; i < ids.length; i++) {
      var ch = new MessageChannel();
      // We keep port1 and give the page port2: what the page posts arrives on
      // port1 and is relayed on, and what we post on port1 surfaces to the page.
      __holdPort(ids[i], ch.port1);
      ports.push(ch.port2);
    }
    return ports;
  }

  /** Delivers a message that travelled the channel from the other side. */
  if (!window.__wmPortMessage) {
    window.__wmPortMessage = function(portId, data) {
      var p = window.__wmPorts[portId];
      if (p) { try { p.postMessage(data); } catch(e) {} }
    };
  }
`;

/**
 * The child half of the popup bridge, injected only into a tab that was opened
 * by `window.open` — see INJECTED_JS_BEFORE_CONTENT_LOADED for the parent half.
 *
 * A popup here is an ordinary tab, so it starts with no `window.opener` at all.
 * Sign-in popups are built entirely around that handle: they finish by posting
 * the result to `window.opener` and calling `window.close()`. With neither
 * available the authentication succeeded and then had nowhere to go, which is
 * what left the child tab sitting on a blank page.
 *
 * `popupId` is the id of the stub `window.open` returned to the opener, so RN
 * can deliver each message to the handle that page is actually holding.
 */
export const buildOpenerBridgeJs = (popupId: string): string => `
  (function() {
    var POPUP_ID = ${JSON.stringify(popupId)};

    function relay(payload) {
      payload.popupId = POPUP_ID;
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } catch(e) {}
    }

    ${portBridgeJs('p', 'relay')}

    var opener = {
      closed: false,
      postMessage: function(message, targetOrigin, transfer) {
        relay({
          type: 'openerPostMessage',
          message: message,
          targetOrigin: String(targetOrigin == null ? '*' : targetOrigin),
          portIds: __registerTransfer(transfer)
        });
      },
      focus: function() {},
      blur: function() {},
      close: function() {},
      addEventListener: function() {},
      removeEventListener: function() {}
    };

    try {
      Object.defineProperty(window, 'opener', {
        get: function() { return opener; },
        // Pages null out window.opener as a hardening step; honouring that
        // literally would tear down the bridge, so the write is absorbed.
        set: function() {},
        configurable: true
      });
    } catch(e) {
      try { window.opener = opener; } catch(e2) {}
    }

    // A popup ends by closing itself. Nothing native happens for a tab, so the
    // request is handed to RN, which closes it and returns to the opener.
    window.close = function() { relay({ type: 'closePopupTab' }); };

    /** Delivers a message the opener sent to this popup. */
    window.__wmDeliverToPopup = function(data, origin, portIds) {
      try {
        window.dispatchEvent(new MessageEvent('message', {
          data: data,
          origin: origin,
          ports: __materializePorts(portIds)
        }));
      } catch(e) {}
    };

    // Reported so the opener can poll popupHandle.location.href, which is how
    // the OAuth popup flow reads the redirect it finally landed on. This script
    // runs at the start of every document, so each navigation reports itself;
    // in-page URL changes are covered by the two events.
    function reportLocation() { relay({ type: 'popupLocation', href: location.href }); }
    reportLocation();
    window.addEventListener('hashchange', reportLocation);
    window.addEventListener('popstate', reportLocation);
  })();
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
    // YouTube exposes Restricted Mode only as a preference cookie — there is
    // no URL parameter for it, so unlike the search engines it cannot be
    // forced by rewriting the address. f2=8000000 is the flag Restricted Mode
    // sets in YouTube's own PREF cookie.
    try {
      if (/(^|\\.)youtube\\.com$/.test(location.hostname)) {
        document.cookie = 'PREF=f2=8000000; domain=.youtube.com; path=/; max-age=31536000';
      }
    } catch(e) {}
  })();

  (function() {
    // Override window.open so popups are routed through React Native
    // (they are silently swallowed in standalone builds otherwise).
    var __woTimestamps = [];
    var __WO_LIMIT = 8;
    var __WO_WINDOW = 2000;

    /** Live popup stubs by id, so RN can deliver a child tab's news to the right one. */
    var __popups = {};
    var __popupSeq = 0;

    function __post(payload) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      } catch(e) {}
    }

    function __sendWindowOpen(url, popupId) {
      if (!url) return;
      __post({ type: 'windowOpen', url: String(url), popupId: popupId });
    }

    ${portBridgeJs('o', '__post')}

    /**
     * A stand-in for the Window that window.open would have returned.
     *
     * Returning null here used to break checkout outright: payment SDKs almost
     * universally assign to the popup right after opening it, along the lines
     * of 'w = window.open(); w.location = url', and on null that throws a
     * TypeError which kills the whole script. The stub keeps those scripts
     * running and forwards any navigation attempted on the popup back to RN,
     * so it still opens as a new tab.
     *
     * The popup really is a separate tab, so the stub is also the only thing
     * standing in for the opener/child relationship a real browser gives for
     * free. A sign-in popup finishes by talking back through that handle —
     * postMessage, or polling its location for the redirect it landed on — and
     * with a stub that just swallowed both, the login completed in the child
     * tab and its result never reached the page that asked for it. RN keeps
     * this stub fed through the __wmPopup* hooks below.
     */
    function __makePopupStub() {
      var id = 'p' + (++__popupSeq) + '-' + Date.now();
      var href = '';
      function go(u) { href = String(u); __sendWindowOpen(href, id); }

      var stub = {
        __id: id,
        closed: false,
        opener: window,
        close: function() {
          stub.closed = true;
          __post({ type: 'closePopupTab', popupId: id });
        },
        focus: function() {},
        blur: function() {},
        postMessage: function(message, targetOrigin, transfer) {
          __post({
            type: 'popupPostMessage',
            popupId: id,
            message: message,
            targetOrigin: String(targetOrigin == null ? '*' : targetOrigin),
            portIds: __registerTransfer(transfer)
          });
        },
        addEventListener: function() {},
        removeEventListener: function() {},
        document: {
          write: function() {}, writeln: function() {},
          open: function() {}, close: function() {}
        }
      };

      Object.defineProperty(stub, 'location', {
        get: function() {
          return {
            get href() { return href; },
            set href(u) { go(u); },
            assign: go,
            replace: go,
            toString: function() { return href; }
          };
        },
        // Covers the 'w.location = url' shorthand as well as w.location.href
        set: function(u) { go(u); }
      });

      // Set by RN as the child tab navigates, without re-sending it as a
      // request to open yet another popup — which is what go() would do.
      stub.__setHref = function(u) { href = String(u); };

      __popups[id] = stub;
      return stub;
    }

    // ── Hooks RN calls on this page when its child tab reports something ──

    /** Raises the child's postMessage as a real 'message' event on this page. */
    window.__wmPopupEvent = function(popupId, data, origin, portIds) {
      var ev;
      try {
        ev = new MessageEvent('message', {
          data: data,
          origin: origin,
          ports: __materializePorts(portIds)
        });
      } catch(e) {
        return;
      }
      var stub = __popups[popupId];
      // Listeners routinely check 'event.source === theWindowIOpened', so the
      // event has to carry the very handle window.open handed back. The
      // MessageEvent constructor rejects a non-Window source, hence the
      // after-the-fact define.
      if (stub) {
        try { Object.defineProperty(ev, 'source', { value: stub }); } catch(e2) {}
      }
      window.dispatchEvent(ev);
    };

    /** Keeps popupHandle.location.href truthful for flows that poll it. */
    window.__wmPopupLocation = function(popupId, href) {
      var stub = __popups[popupId];
      if (stub) stub.__setHref(href);
    };

    /** The child tab is gone; popupHandle.closed must say so. */
    window.__wmPopupClosed = function(popupId) {
      var stub = __popups[popupId];
      if (stub) {
        stub.closed = true;
        delete __popups[popupId];
      }
    };

    window.open = function(url, target, features) {
      var now = Date.now();
      __woTimestamps = __woTimestamps.filter(function(ts) { return now - ts < __WO_WINDOW; });
      if (__woTimestamps.length >= __WO_LIMIT) {
        console.warn('[WebMatan] window.open rate-limited — blocked:', url);
        // Still a stub, never null — a rate-limited popup must not take the
        // page's own script down with it.
        return __makePopupStub();
      }
      __woTimestamps.push(now);

      var stub = __makePopupStub();
      // A popup opened blank is driven afterwards via w.location; only a real
      // URL is worth forwarding right now.
      if (url && url !== 'about:blank') __sendWindowOpen(url, stub.__id);
      return stub;
    };
  })();
  true;
`;
