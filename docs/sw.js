/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "style.css",
    "revision": "217415910b6118effbab14cf8352396c"
  }, {
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "qm2025-standalone.html",
    "revision": "4d58d409b83bdeae17c723e99ec887e6"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "ffa2e865b178d36cd9c2c617fd84e235"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d6523c49fae8f117e6973c21eb68b83b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2e21fb3844cf8a77227f6e5436c45f7e"
  }, {
    "url": "index.html",
    "revision": "b436e07746f43cfec634fc7fc500b759"
  }, {
    "url": "icon.svg",
    "revision": "3f60b84d931a21387284e561f9cb7a4a"
  }, {
    "url": "camera.js",
    "revision": "63386ba49572517f0d2cc09b23db5230"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "9870a1feee3a9baa4a44ccbeec427b7b"
  }, {
    "url": "app.js",
    "revision": "501257e2177cf9c5adb62c8f51e060dd"
  }, {
    "url": "assets/index-sfktoWt8.js",
    "revision": null
  }, {
    "url": "assets/index-akfZDMiC.css",
    "revision": null
  }, {
    "url": "assets/aistudio/image_8efee6da.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_423077af.png",
    "revision": null
  }, {
    "url": "assets/aistudio/QM_202_To_n_2e669509.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/QM_2025_CV_1239.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/QM_2025_-_Su__Tin__CN__GDPL_cdd333ca.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/QM_2025_-_NGOAI_NGU_5d10a158.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/QM_2025_-_Ly__Hoa__Sinh__Dia_6a77a214.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/M_n_SINH_H_C_-_L_p_12_-_K__ki_m_tra_KI_M_TRA_CU_I_K__I_-_01-11-26_-_QR_Chung__M__101-104__-_1_-_App_QM_2025_e413d348.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "9870a1feee3a9baa4a44ccbeec427b7b"
  }, {
    "url": "icon.svg",
    "revision": "3f60b84d931a21387284e561f9cb7a4a"
  }, {
    "url": "pwa-192x192.png",
    "revision": "2e21fb3844cf8a77227f6e5436c45f7e"
  }, {
    "url": "pwa-512x512.png",
    "revision": "d6523c49fae8f117e6973c21eb68b83b"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "ffa2e865b178d36cd9c2c617fd84e235"
  }, {
    "url": "manifest.webmanifest",
    "revision": "ccd7b0be7f3eec9ce82acd6211fd4f28"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
