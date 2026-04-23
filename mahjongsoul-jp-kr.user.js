// ==UserScript==
// @name         Mahjong Soul JP Korean UI Patch
// @namespace    local.mjs.jp-kr
// @version      0.2.0
// @description  Keep Mahjong Soul JP server/auth while loading Korean UI resources.
// @author       local
// @match        https://game.mahjongsoul.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      game.mahjongsoul.com
// @connect      mahjongsoul.game.yo-star.com
// @connect      jp-sdk-api.yostarplat.com
// @noframes
// ==/UserScript==

(function userscript() {
  'use strict';

  const BRIDGE = `mjs-jp-kr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
  const active = new Map();

  function post(payload) {
    window.postMessage(Object.assign({ bridge: BRIDGE }, payload), location.origin);
  }

  function finish(id, payload) {
    active.delete(id);
    post(Object.assign({ type: 'gm-response', id }, payload));
  }

  function handleRequest(id, details) {
    if (!gm) {
      finish(id, { ok: false, error: 'GM_xmlhttpRequest is not available' });
      return;
    }

    const request = {
      method: details.method || 'GET',
      url: String(details.url || ''),
      responseType: details.responseType || 'text',
      headers: details.headers || undefined,
      timeout: details.timeout || 30000,
      anonymous: details.anonymous !== false,
      onload(response) {
        finish(id, {
          ok: true,
          response: {
            status: response.status || 0,
            statusText: response.statusText || '',
            finalUrl: response.finalUrl || request.url,
            responseHeaders: response.responseHeaders || '',
            response: response.response,
            responseText: response.responseText || ''
          }
        });
      },
      onerror(error) {
        finish(id, { ok: false, error: error && (error.statusText || error.error || error.message) || 'GM request error' });
      },
      ontimeout(error) {
        finish(id, { ok: false, error: error && (error.statusText || error.message) || 'GM request timeout' });
      },
      onabort() {
        finish(id, { ok: false, error: 'GM request aborted' });
      }
    };

    try {
      const handle = gm(request);
      if (handle && typeof handle.abort === 'function') active.set(id, handle);
    } catch (error) {
      finish(id, { ok: false, error: error && error.message || String(error) });
    }
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.bridge !== BRIDGE) return;
    if (data.type === 'gm-request') handleRequest(data.id, data.details || {});
    if (data.type === 'gm-abort' && active.has(data.id)) {
      try {
        active.get(data.id).abort();
      } finally {
        active.delete(data.id);
      }
    }
  });

  function inject() {
    const parent = document.documentElement || document.head || document.body;
    if (!parent) {
      document.addEventListener('readystatechange', inject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.textContent = `(${pagePatch.toString()})(${JSON.stringify(BRIDGE)});`;
    parent.appendChild(script);
    script.remove();
  }

  if (document.documentElement) inject();
  else document.addEventListener('readystatechange', inject, { once: true });

  function pagePatch(BRIDGE) {
    'use strict';

    const JP = 'https://game.mahjongsoul.com';
    const GLOBAL = 'https://mahjongsoul.game.yo-star.com';
    const LANG = 'kr';
    const SDK_PREFIX = 'v0.11.221.w';
    const SDK_PLATFORM = 21;
    const FONT = 'NotoSansKR, kr_solmoe_1, Arial, sans-serif';

    const nativeFetch = window.fetch.bind(window);
    const NativeXHR = window.XMLHttpRequest;
    const nativeSetAttribute = Element.prototype.setAttribute;
    const nativeAppendChild = Node.prototype.appendChild;
    const nativeInsertBefore = Node.prototype.insertBefore;
    const nativeImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');

    const state = {
      manifest: null,
      manifestPromise: null,
      version: null,
      stats: {
        clientLanguage: 0,
        uiKrPatched: 0,
        urlRewrites: 0,
        gmRequests: 0,
        blobImages: 0,
        sdkFontFixes: 0,
        layaFontRewrites: 0
      }
    };

    const bridge = { seq: 0, pending: new Map() };
    const blobCache = new Map();

    function gmRequest(details) {
      const id = `${Date.now()}-${++bridge.seq}`;
      const timeout = Number(details.timeout) || 30000;
      let timer = null;

      const promise = new Promise((resolve, reject) => {
        bridge.pending.set(id, { resolve, reject });
        timer = setTimeout(() => {
          bridge.pending.delete(id);
          reject(new Error('GM request timeout'));
        }, timeout);
      });

      window.postMessage({
        bridge: BRIDGE,
        type: 'gm-request',
        id,
        details: Object.assign({ method: 'GET', responseType: 'text', timeout, anonymous: true }, details)
      }, location.origin);

      promise.abort = () => {
        clearTimeout(timer);
        bridge.pending.delete(id);
        window.postMessage({ bridge: BRIDGE, type: 'gm-abort', id }, location.origin);
      };

      return promise.finally(() => clearTimeout(timer));
    }

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.bridge !== BRIDGE || data.type !== 'gm-response') return;
      const pending = bridge.pending.get(data.id);
      if (!pending) return;
      bridge.pending.delete(data.id);
      if (data.ok) pending.resolve(data.response);
      else pending.reject(new Error(data.error || 'GM request failed'));
    });

    function urlOf(value) {
      try {
        return new URL(value instanceof Request ? value.url : String(value), location.href);
      } catch {
        return null;
      }
    }

    function stripVersion(pathname) {
      return pathname.replace(/^\//, '').replace(/^v[\d.]+\.w\//, '');
    }

    function prefixOf(pathname) {
      const match = pathname.match(/^\/(v[\d.]+\.w)\//);
      return match ? match[1] : null;
    }

    function versionOf(url) {
      const prefix = prefixOf(url.pathname);
      if (prefix) return prefix.slice(1);
      const match = url.pathname.match(/resversion([\d.]+\.w)\.json$/);
      return match && match[1];
    }

    function canonical(path) {
      const solmoe = path.match(/^bitmapfont\/kr\/kr_solmoe(?:_([0-4]))?\.png$/i);
      if (solmoe) return `res/atlas/bitmapfont/kr${solmoe[1] && solmoe[1] !== '0' ? solmoe[1] : ''}.png`;
      if (/^res\/proto\/uiconfig\/ui_[a-z_]+\.json$/i.test(path)) return path.replace(/^res\/proto\//, '');
      if (/^res\/bitmapfont\//i.test(path)) return path.replace(/^res\//, '');
      return path;
    }

    function manifest() {
      const current = window.GameConfig && window.GameConfig.manifest;
      const res = current && (current.res || current);
      if (res && typeof res === 'object') state.manifest = res;
      return state.manifest;
    }

    function rememberJson(url, json) {
      if (/\/version\.json$/.test(url.pathname)) {
        state.version = json.version || state.version;
        if (!state.version && typeof json.code === 'string') {
          const match = json.code.match(/v([\d.]+\.w)\//);
          if (match) state.version = match[1];
        }
      }
      if (/\/resversion[\d.]+\.w\.json$/.test(url.pathname)) {
        state.manifest = json.res || json;
      }
    }

    async function ensureManifest(versionHint) {
      if (manifest()) return state.manifest;
      if (state.manifestPromise) return state.manifestPromise;
      const version = versionHint || state.version;
      if (!version) return null;

      state.manifestPromise = nativeFetch(`${JP}/resversion${version}.json`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(`manifest HTTP ${response.status}`)))
        .then((json) => {
          state.manifest = json.res || json;
          return state.manifest;
        })
        .catch((error) => {
          state.manifestPromise = null;
          throw error;
        });

      return state.manifestPromise;
    }

    function manifestPrefix(path, fallback) {
      const map = manifest();
      if (!map) return fallback || null;

      const key = canonical(path);
      const candidates = [path, key, key.startsWith('res/') ? key.slice(4) : `res/${key}`];
      for (const candidate of candidates) {
        if (map[candidate] && map[candidate].prefix) return map[candidate].prefix;
      }
      return fallback || null;
    }

    function resourceUrl(origin, path, fallbackPrefix) {
      const key = canonical(path);
      const prefix = manifestPrefix(key, fallbackPrefix);
      return prefix ? `${origin}/${prefix}/${key}` : `${origin}/${key}`;
    }

    function isClientLanguage(url) {
      return /(^|\/)client_language\.txt$/.test(url.pathname);
    }

    function isUiKr(url) {
      return /(^|\/)uiconfig\/ui_kr\.json$/.test(url.pathname);
    }

    function isLocalized(path) {
      return (
        path.startsWith(`${LANG}/`) ||
        path.includes(`/${LANG}/`) ||
        path.includes('/en_kr/') ||
        path.includes(`bitmapfont/${LANG}`) ||
        path.includes(`uiconfig/ui_${LANG}.json`)
      );
    }

    function rewrite(value) {
      const url = urlOf(value);
      if (!url) return value;

      if (/^(?:en|kr)-sdk-api/.test(url.hostname)) {
        url.hostname = 'jp-sdk-api.yostarplat.com';
        state.stats.urlRewrites++;
        return url.href;
      }

      const path = stripVersion(url.pathname);
      const fallback = prefixOf(url.pathname);

      if (/(^|\/)yostar_sdk\/(?:kr|en)\//.test(path)) {
        state.stats.urlRewrites++;
        return resourceUrl(JP, path.replace(/(^|\/)yostar_sdk\/(?:kr|en)\//, '$1yostar_sdk/jp/'), SDK_PREFIX) + url.search + url.hash;
      }

      if (url.hostname !== 'game.mahjongsoul.com') return value;

      if (path.startsWith(`${LANG}/extendRes/title/`)) {
        state.stats.urlRewrites++;
        return resourceUrl(JP, path.replace(`${LANG}/`, 'jp/'), fallback) + url.search + url.hash;
      }

      if (isLocalized(path)) {
        state.stats.urlRewrites++;
        return resourceUrl(GLOBAL, path, fallback) + url.search + url.hash;
      }

      return value;
    }

    function needsProxy(originalUrl, rewrittenUrl) {
      const original = urlOf(originalUrl);
      const rewritten = urlOf(rewrittenUrl);
      if (!original || !rewritten) return false;
      if (isClientLanguage(original) || isUiKr(original) || isUiKr(rewritten)) return true;
      if (rewritten.hostname === 'mahjongsoul.game.yo-star.com' && isLocalized(canonical(stripVersion(rewritten.pathname)))) return true;
      return original.hostname === 'game.mahjongsoul.com' && rewritten.hostname !== 'game.mahjongsoul.com' && isLocalized(canonical(stripVersion(original.pathname)));
    }

    function headersToObject(headersText) {
      const headers = new Headers();
      String(headersText || '').split(/\r?\n/).forEach((line) => {
        const index = line.indexOf(':');
        if (index > 0) headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
      });
      return headers;
    }

    function header(headersText, name) {
      const key = String(name).toLowerCase();
      for (const line of String(headersText || '').split(/\r?\n/)) {
        const index = line.indexOf(':');
        if (index > 0 && line.slice(0, index).trim().toLowerCase() === key) return line.slice(index + 1).trim();
      }
      return '';
    }

    function textOf(body) {
      if (typeof body === 'string') return body;
      if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
      if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body.buffer);
      return body == null ? '' : String(body);
    }

    function bodyForType(body, responseType, contentType) {
      const type = String(responseType || '').toLowerCase();
      if (type === 'arraybuffer') {
        if (body instanceof ArrayBuffer) return body;
        if (ArrayBuffer.isView(body)) return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
        return new TextEncoder().encode(textOf(body)).buffer;
      }
      if (type === 'blob') return body instanceof Blob ? body : new Blob([body], { type: contentType || '' });
      if (type === 'json') {
        try {
          return typeof body === 'string' ? JSON.parse(body) : body;
        } catch {
          return null;
        }
      }
      return textOf(body);
    }

    function patchFonts(json) {
      let count = 0;
      const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.font === 'string' && /^(SimHei|Simhei|Microsoft YaHei)$/i.test(node.font)) {
          node.font = 'NotoSansKR';
          count++;
        }
        Object.values(node).forEach(visit);
      };
      visit(json);
      state.stats.uiKrPatched += count;
      return json;
    }

    async function gmLoad(url, responseType) {
      const target = urlOf(url);
      if (target) {
        const version = versionOf(target);
        if (version) {
          state.version = state.version || version;
          await ensureManifest(version).catch(() => null);
        }
      }

      const finalUrl = rewrite(url);
      state.stats.gmRequests++;
      const response = await gmRequest({ url: finalUrl, responseType: responseType || 'text' });
      let body = response.response == null && typeof response.responseText === 'string' ? response.responseText : response.response;

      const final = urlOf(response.finalUrl || finalUrl);
      if ((target && isUiKr(target) || final && isUiKr(final)) && response.status >= 200 && response.status < 300) {
        body = JSON.stringify(patchFonts(JSON.parse(textOf(body))));
      }

      return {
        status: response.status || 0,
        statusText: response.statusText || '',
        finalUrl: response.finalUrl || finalUrl,
        headers: response.responseHeaders || '',
        body
      };
    }

    async function patchedUiText(originalUrl) {
      const url = urlOf(originalUrl);
      if (url) await ensureManifest(versionOf(url)).catch(() => null);

      const path = url ? canonical(stripVersion(url.pathname)) : 'uiconfig/ui_kr.json';
      const fallback = url ? prefixOf(url.pathname) : null;
      const candidates = [
        resourceUrl(JP, path, fallback),
        rewrite(originalUrl),
        resourceUrl(GLOBAL, path, fallback),
        url && url.href
      ].filter(Boolean);

      let lastError = null;
      for (const candidate of [...new Set(candidates)]) {
        try {
          const response = await nativeFetch(candidate, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return JSON.stringify(patchFonts(JSON.parse(await response.text())));
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('ui_kr.json fetch failed');
    }

    function fetchInput(input, rewritten, init) {
      if (!(input instanceof Request)) return [rewritten, init];
      if (rewritten === input.url) return [input, init];
      return [new Request(rewritten, Object.assign({
        method: input.method,
        headers: input.headers,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        integrity: input.integrity,
        keepalive: input.keepalive,
        signal: input.signal
      }, init || {})), undefined];
    }

    window.fetch = async function patchedFetch(input, init) {
      const url = urlOf(input);
      if (url && isClientLanguage(url)) {
        state.stats.clientLanguage++;
        return new Response(LANG, { status: 200, headers: { 'content-type': 'text/plain;charset=utf-8' } });
      }
      if (url && isUiKr(url)) {
        return new Response(await patchedUiText(url.href), { status: 200, headers: { 'content-type': 'application/json;charset=utf-8' } });
      }

      const rewritten = rewrite(url ? url.href : input);
      if (url && needsProxy(url.href, rewritten)) {
        const response = await gmLoad(url.href, 'arraybuffer');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headersToObject(response.headers)
        });
      }

      const [nextInput, nextInit] = fetchInput(input, rewritten, init);
      const response = await nativeFetch(nextInput, nextInit);
      const responseUrl = urlOf(response.url || rewritten);
      if (responseUrl && response.ok && /\/(?:version|resversion[\d.]+\.w)\.json$/.test(responseUrl.pathname)) {
        response.clone().json().then((json) => rememberJson(responseUrl, json)).catch(() => {});
      }
      return response;
    };

    class PatchedXHR {
      constructor() {
        this._native = new NativeXHR();
        this._listeners = new Map();
        this._headers = '';
        this._readyState = 0;
        this._status = 0;
        this._statusText = '';
        this._response = null;
        this._responseText = '';
        this._responseType = '';
        this._responseURL = '';
        this._proxy = false;
        this._url = '';
        this._target = '';
        this._aborted = false;

        ['readystatechange', 'loadstart', 'progress', 'abort', 'error', 'load', 'timeout', 'loadend'].forEach((type) => {
          this[`on${type}`] = null;
          this._native.addEventListener(type, (event) => {
            if ((type === 'readystatechange' && this._native.readyState === 4) || type === 'load') this._rememberNative();
            this._emit(type, event);
          });
        });
      }

      _rememberNative() {
        const url = urlOf(this._native.responseURL || this._target || this._url);
        if (!url || this._native.status < 200 || this._native.status >= 300) return;
        if (/\/(?:version|resversion[\d.]+\.w)\.json$/.test(url.pathname)) {
          try {
            rememberJson(url, JSON.parse(this._native.responseText));
          } catch {
            // Ignore non-JSON or incomplete native responses.
          }
        }
      }

      _emit(type, source) {
        const event = {
          type,
          target: this,
          currentTarget: this,
          lengthComputable: Boolean(source && source.lengthComputable),
          loaded: source && typeof source.loaded === 'number' ? source.loaded : 0,
          total: source && typeof source.total === 'number' ? source.total : 0
        };

        const handler = this[`on${type}`];
        if (typeof handler === 'function') handler.call(this, event);

        for (const item of [...(this._listeners.get(type) || [])]) {
          if (typeof item.listener === 'function') item.listener.call(this, event);
          else if (item.listener && typeof item.listener.handleEvent === 'function') item.listener.handleEvent(event);
          if (item.once) this.removeEventListener(type, item.listener);
        }
      }

      _setResponse(response) {
        const contentType = header(response.headers, 'content-type');
        this._status = response.status;
        this._statusText = response.statusText;
        this._headers = response.headers;
        this._responseURL = response.finalUrl;
        this._response = bodyForType(response.body, this._responseType, contentType);
        this._responseText = /^(|text|json)$/i.test(this._responseType) ? textOf(response.body) : '';
      }

      open(method, url, async, user, password) {
        this._url = String(url);
        this._target = rewrite(this._url);
        this._proxy = needsProxy(this._url, this._target);
        this._readyState = 1;
        this._status = 0;
        this._response = null;
        this._responseText = '';
        this._aborted = false;

        if (this._proxy) {
          this._emit('readystatechange');
          return;
        }
        return this._native.open(method, this._target, async !== false, user, password);
      }

      send(body) {
        if (!this._proxy) return this._native.send(body);

        const clientLanguage = urlOf(this._url) && isClientLanguage(urlOf(this._url));
        const complete = (response) => {
          if (this._aborted) return;
          this._setResponse(response);
          this._readyState = 2;
          this._emit('readystatechange');
          this._readyState = 3;
          this._emit('readystatechange');
          this._readyState = 4;
          this._emit('readystatechange');
          this._emit(this._status >= 200 && this._status < 400 ? 'load' : 'error');
          this._emit('loadend');
        };

        if (clientLanguage) {
          state.stats.clientLanguage++;
          setTimeout(() => complete({
            status: 200,
            statusText: 'OK',
            finalUrl: this._url,
            headers: 'content-type: text/plain;charset=utf-8\r\n',
            body: LANG
          }), 0);
          return;
        }

        this._emit('loadstart');
        gmLoad(this._url, this._responseType || 'text')
          .then(complete)
          .catch((error) => {
            if (this._aborted) return;
            this._readyState = 4;
            this._status = 0;
            this._statusText = error && error.message || 'error';
            this._emit('readystatechange');
            this._emit('error');
            this._emit('loadend');
          });
      }

      abort() {
        this._aborted = true;
        if (!this._proxy) return this._native.abort();
        this._readyState = 4;
        this._status = 0;
        this._emit('readystatechange');
        this._emit('abort');
        this._emit('loadend');
      }

      setRequestHeader(name, value) {
        if (!this._proxy) return this._native.setRequestHeader(name, value);
      }

      getResponseHeader(name) {
        return this._proxy ? header(this._headers, name) || null : this._native.getResponseHeader(name);
      }

      getAllResponseHeaders() {
        return this._proxy ? this._headers : this._native.getAllResponseHeaders();
      }

      overrideMimeType(mimeType) {
        if (!this._proxy) return this._native.overrideMimeType(mimeType);
      }

      addEventListener(type, listener, options) {
        if (!listener) return;
        const list = this._listeners.get(type) || [];
        list.push({ listener, once: Boolean(options && typeof options === 'object' && options.once) });
        this._listeners.set(type, list);
      }

      removeEventListener(type, listener) {
        this._listeners.set(type, (this._listeners.get(type) || []).filter((item) => item.listener !== listener));
      }

      dispatchEvent(event) {
        this._emit(event && event.type || String(event), event);
        return true;
      }

      get readyState() { return this._proxy ? this._readyState : this._native.readyState; }
      get status() { return this._proxy ? this._status : this._native.status; }
      get statusText() { return this._proxy ? this._statusText : this._native.statusText; }
      get response() { return this._proxy ? this._response : this._native.response; }
      get responseText() { return this._proxy ? this._responseText : this._native.responseText; }
      get responseXML() { return this._proxy ? null : this._native.responseXML; }
      get responseURL() { return this._proxy ? this._responseURL : this._native.responseURL; }
      get upload() { return this._native.upload; }
      get responseType() { return this._proxy ? this._responseType : this._native.responseType; }
      set responseType(value) {
        this._responseType = value || '';
        if (!this._proxy) this._native.responseType = value;
      }
      get timeout() { return this._proxy ? 0 : this._native.timeout; }
      set timeout(value) { if (!this._proxy) this._native.timeout = value; }
      get withCredentials() { return this._proxy ? false : this._native.withCredentials; }
      set withCredentials(value) { if (!this._proxy) this._native.withCredentials = value; }
    }

    Object.assign(PatchedXHR, { UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 });
    Object.assign(PatchedXHR.prototype, { UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 });
    window.XMLHttpRequest = PatchedXHR;

    function imageBlobUrl(url) {
      if (blobCache.has(url)) return blobCache.get(url);
      const promise = gmLoad(url, 'arraybuffer').then((response) => {
        if (response.status < 200 || response.status >= 300) throw new Error(`image HTTP ${response.status}`);
        const type = header(response.headers, 'content-type') || (/\.webp/i.test(url) ? 'image/webp' : /\.jpe?g/i.test(url) ? 'image/jpeg' : 'image/png');
        state.stats.blobImages++;
        return URL.createObjectURL(new Blob([response.body], { type }));
      }).catch((error) => {
        blobCache.delete(url);
        throw error;
      });
      blobCache.set(url, promise);
      return promise;
    }

    function setImage(element, value, nativeSetter) {
      const rewritten = rewrite(value);
      const url = urlOf(rewritten);
      if (!url || url.hostname !== 'mahjongsoul.game.yo-star.com' || !isLocalized(canonical(stripVersion(url.pathname))) || !/\.(png|jpe?g|webp)$/i.test(url.pathname)) {
        return nativeSetter.call(element, rewritten);
      }

      const marker = {};
      element.__mjsKrPendingImage = marker;
      imageBlobUrl(rewritten)
        .then((blobUrl) => {
          if (element.__mjsKrPendingImage === marker) nativeSetter.call(element, blobUrl);
        })
        .catch(() => {
          if (element.__mjsKrPendingImage === marker) nativeSetter.call(element, rewritten);
        });
    }

    function patchUrlProperty(proto, prop) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.get || !desc.set) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set(value) {
          return desc.set.call(this, rewrite(value));
        }
      });
    }

    if (nativeImageSrc) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: nativeImageSrc.enumerable,
        get: nativeImageSrc.get,
        set(value) {
          return setImage(this, value, nativeImageSrc.set);
        }
      });
    }
    patchUrlProperty(HTMLScriptElement.prototype, 'src');
    patchUrlProperty(HTMLLinkElement.prototype, 'href');
    if (window.HTMLSourceElement) patchUrlProperty(HTMLSourceElement.prototype, 'src');

    function patchElement(element) {
      if (!element || !element.tagName) return element;
      const tag = element.tagName.toUpperCase();
      if (tag === 'SCRIPT' && element.src) element.src = rewrite(element.src);
      if (tag === 'IMG' && element.src) element.src = element.src;
      if (tag === 'LINK' && element.href) element.href = rewrite(element.href);
      if (tag === 'SOURCE' && element.src) element.src = rewrite(element.src);
      return element;
    }

    Element.prototype.setAttribute = function patchedSetAttribute(name, value) {
      const key = String(name).toLowerCase();
      if (key === 'src' && this instanceof HTMLImageElement && nativeImageSrc) return setImage(this, value, nativeImageSrc.set);
      if (key === 'src' || key === 'href') return nativeSetAttribute.call(this, name, rewrite(value));
      return nativeSetAttribute.call(this, name, value);
    };
    Node.prototype.appendChild = function patchedAppendChild(child) {
      return nativeAppendChild.call(this, patchElement(child));
    };
    Node.prototype.insertBefore = function patchedInsertBefore(child, reference) {
      return nativeInsertBefore.call(this, patchElement(child), reference);
    };

    function installFonts() {
      const css = [
        "@font-face{font-family:NotoSansKR;src:url('/v0.11.48.w/fonts/NotoSansKR.ttf') format('truetype');font-display:block;}",
        "@font-face{font-family:kr_solmoe_1;src:url('/v0.10.261.w/fonts/kr_solmoe_1.ttf') format('truetype');font-display:block;}",
        `#web-sdk-root,#web-sdk-root *{font-family:${FONT}!important;}`
      ].join('\n');

      const install = () => {
        const parent = document.head || document.documentElement;
        if (!parent) return setTimeout(install, 0);
        if (document.querySelector('style[data-mjs-kr-font]')) return;
        const style = document.createElement('style');
        style.dataset.mjsKrFont = '1';
        style.textContent = css;
        parent.appendChild(style);
        if (document.fonts) {
          document.fonts.load('16px NotoSansKR').catch(() => {});
          document.fonts.load('16px kr_solmoe_1').catch(() => {});
        }
      };
      install();
    }

    function patchWebSdkFonts() {
      const root = document.getElementById('web-sdk-root');
      if (!root) return;
      root.querySelectorAll('*').forEach((element) => element.style && element.style.setProperty('font-family', FONT, 'important'));
      root.style.setProperty('font-family', FONT, 'important');
      state.stats.sdkFontFixes++;
    }

    function patchLayaFont() {
      const proto = window.Laya && window.Laya.Text && window.Laya.Text.prototype;
      if (!proto || proto.__mjsKrFontPatched) return;
      const desc = Object.getOwnPropertyDescriptor(proto, 'font');
      if (!desc || !desc.get || !desc.set) return;
      Object.defineProperty(proto, 'font', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set(value) {
          if (typeof value === 'string' && /^(SimHei|Simhei|Microsoft YaHei)$/i.test(value)) {
            value = 'NotoSansKR';
            state.stats.layaFontRewrites++;
          }
          return desc.set.call(this, value);
        }
      });
      proto.__mjsKrFontPatched = true;
    }

    function forceJpSdkPlatform() {
      const entrance = window.uiscript && window.uiscript.UI_Entrance;
      if (!entrance) return;
      try {
        Object.defineProperty(entrance, 'yostarPlatformType', { value: SDK_PLATFORM, writable: true, configurable: true });
      } catch {
        entrance.yostarPlatformType = SDK_PLATFORM;
      }
    }

    function runtimePatch() {
      manifest();
      if (window.GameConfig) window.GameConfig.client_language = LANG;
      patchLayaFont();
      forceJpSdkPlatform();
      patchWebSdkFonts();
    }

    installFonts();
    const observe = () => new MutationObserver(patchWebSdkFonts).observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    if (document.documentElement) observe();
    else document.addEventListener('DOMContentLoaded', observe, { once: true });

    setInterval(runtimePatch, 250);
    window.__mjsJpKrPatch = {
      version: '0.2.0',
      stats: state.stats,
      resolve: rewrite,
      manifest
    };
  }
})();
