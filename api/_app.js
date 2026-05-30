var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/index.tsx
var import_serverless = require("@neondatabase/serverless");
var GOOGLE_PLACES_KEY = "AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY";
var DB_URL = "postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";
var getDb = () => (0, import_serverless.neon)(DB_URL);
var app = new Hono2();
var PLATFORM = {
  whatsapp: "8201058947690",
  // 운영자 왓츠앱 번호 (국가코드 포함, +없이)
  name: "SEOUL BEAUTY TRIP",
  instagram: "seoulbeautytrip",
  commission: "10~20%"
};
function rowToShop(r) {
  return {
    id: String(r.id),
    name: r.name,
    slug: r.slug || "",
    category: r.category || "",
    location: r.location || "",
    address: r.address || "",
    googleMapUrl: r.google_map_url || "",
    googleMapEmbed: r.google_map_embed || "",
    lat: r.lat || "",
    lng: r.lng || "",
    priceRange: r.price_range || "",
    hours: r.hours || "",
    services: r.services || [],
    servicePrices: r.service_prices || [],
    description: r.description || "",
    rating: r.rating || 5,
    reviewCount: r.review_count || 0,
    thumbnail: r.thumbnail || "",
    photos: r.photos || [],
    commission: r.commission || 15,
    active: r.active !== false,
    createdAt: r.created_at || "",
    reviews: (() => {
      if (!r.reviews) return [];
      if (Array.isArray(r.reviews)) return r.reviews;
      try {
        return JSON.parse(r.reviews);
      } catch {
        return [];
      }
    })(),
    googlePlaceId: r.google_place_id || "",
    metaDescription: r.meta_description || "",
    seoKeywords: r.seo_keywords || "",
    menuItems: (() => {
      if (!r.menu_items) return [];
      if (Array.isArray(r.menu_items)) return r.menu_items;
      try {
        return JSON.parse(r.menu_items);
      } catch {
        return [];
      }
    })()
  };
}
function cloudinaryThumb(videoUrl) {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return "";
  return videoUrl.replace("/video/upload/", "/video/upload/so_0,w_600,h_1066,c_fill,q_auto/").replace(/\.mp4$/, ".jpg");
}
function cleanVideoTitle(title, shopName) {
  if (!title) return shopName || "Video";
  const isFilename = /^[a-zA-Z0-9_.-]{8,}$/.test(title.trim());
  return isFilename ? shopName || title : title;
}
function rowToVideo(r) {
  const videoUrl = r.video_url || "";
  const rawThumb = r.thumbnail || "";
  const thumb = rawThumb || cloudinaryThumb(videoUrl);
  const shopName = r.shop_name || "";
  return {
    id: String(r.id),
    shopId: String(r.shop_id),
    title: cleanVideoTitle(r.title || "", shopName),
    description: r.description || "",
    videoUrl,
    thumbnail: thumb,
    tags: r.tags || [],
    views: r.views || 0,
    likes: r.likes || 0,
    createdAt: r.created_at || ""
  };
}
function rowToBooking(r) {
  return {
    id: r.id,
    shopId: r.shop_id,
    shopName: r.shop_name || "",
    videoId: "",
    name: r.name || "",
    email: r.email || "",
    phone: r.phone || "",
    date: r.date || "",
    people: r.people || "1",
    service: r.service || "",
    message: r.message || "",
    status: r.status || "new",
    commissionRate: r.commission_rate || 10,
    estimatedAmount: r.estimated_amount || "",
    createdAt: r.created_at || ""
  };
}
var shops = [
  {
    id: "s1",
    name: "Gangnam Glow Skin Clinic",
    slug: "gangnam-skin-clinic",
    category: "skincare",
    location: "Gangnam, Seoul",
    address: "123 Gangnam-daero, Gangnam-gu, Seoul",
    googleMapUrl: "https://maps.google.com/?q=Gangnam+Seoul+South+Korea",
    googleMapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3165.4!2d127.0276!3d37.4979!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca157b8d5b8c3%3A0x4b5a1e5f!2sGangnam%2C+Seoul!5e0!3m2!1sen!2skr!4v1",
    priceRange: "\u20A980,000~\u20A9200,000",
    hours: "10:00~20:00 (Mon~Sat)",
    services: ["Deep Cleansing Facial", "Hydra Facial", "Korean Glass Skin", "Anti-aging Treatment"],
    servicePrices: [{ name: "Deep Cleansing Facial", price: "\u20A980,000" }, { name: "Hydra Facial", price: "\u20A9120,000" }, { name: "Korean Glass Skin", price: "\u20A9150,000" }, { name: "Anti-aging Treatment", price: "\u20A9200,000" }],
    description: "Premium skin clinic in the heart of Gangnam. Specializing in Korean beauty techniques with certified dermatologists.",
    rating: 4.9,
    reviewCount: 234,
    thumbnail: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop",
    commission: 15,
    active: true,
    createdAt: "2024-01-01"
  },
  {
    id: "s2",
    name: "Hongdae Beauty Studio",
    slug: "hongdae-makeup-studio",
    category: "makeup",
    location: "Hongdae, Seoul",
    address: "45 Wausan-ro, Mapo-gu, Seoul",
    googleMapUrl: "https://maps.google.com/?q=Hongdae+Seoul+South+Korea",
    googleMapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3162.7!2d126.9244!3d37.5564!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c98f1e36ef2b7%3A0x4b5a1e5f!2sHongdae%2C+Seoul!5e0!3m2!1sen!2skr!4v1",
    priceRange: "\u20A950,000~\u20A9120,000",
    hours: "11:00~21:00 (Tue~Sun)",
    services: ["K-pop Makeup", "Glass Skin Makeup", "Bridal Makeup", "Natural Makeup"],
    servicePrices: [{ name: "K-pop Makeup", price: "\u20A960,000" }, { name: "Glass Skin Makeup", price: "\u20A970,000" }, { name: "Bridal Makeup", price: "\u20A9120,000" }, { name: "Natural Makeup", price: "\u20A950,000" }],
    description: "Trendy makeup studio in Hongdae loved by K-pop idols and beauty influencers. Get your Korean beauty look here!",
    rating: 4.8,
    reviewCount: 187,
    thumbnail: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=300&fit=crop",
    commission: 10,
    active: true,
    createdAt: "2024-01-05"
  },
  {
    id: "s3",
    name: "Sinchon Hair Lab",
    slug: "sinchon-hair-salon",
    category: "hair",
    location: "Sinchon, Seoul",
    address: "78 Sinchon-ro, Seodaemun-gu, Seoul",
    googleMapUrl: "https://maps.google.com/?q=Sinchon+Seoul+South+Korea",
    googleMapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3162.1!2d126.9367!3d37.5596!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c98b1e36ef2b7%3A0x4b5a1e5f!2sSinchon%2C+Seoul!5e0!3m2!1sen!2skr!4v1",
    priceRange: "\u20A960,000~\u20A9180,000",
    hours: "10:00~20:00 (Mon~Sat)",
    services: ["Balayage", "K-pop Hair Color", "Perm", "Hair Treatment"],
    servicePrices: [{ name: "Balayage", price: "\u20A9150,000" }, { name: "K-pop Hair Color", price: "\u20A9120,000" }, { name: "Perm", price: "\u20A9100,000" }, { name: "Hair Treatment", price: "\u20A960,000" }],
    description: "Seoul's most popular hair lab for K-pop inspired styles. Our stylists have worked with top Korean celebrities.",
    rating: 4.7,
    reviewCount: 312,
    thumbnail: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=300&fit=crop",
    commission: 12,
    active: true,
    createdAt: "2024-01-10"
  },
  {
    id: "s4",
    name: "Itaewon Nail Bar",
    slug: "itaewon-nail-art",
    category: "nail",
    location: "Itaewon, Seoul",
    address: "22 Itaewon-ro, Yongsan-gu, Seoul",
    googleMapUrl: "https://maps.google.com/?q=Itaewon+Seoul+South+Korea",
    googleMapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3163.5!2d126.9947!3d37.5347!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca21f3c0b5a6d%3A0x4b5a1e5f!2sItaewon%2C+Seoul!5e0!3m2!1sen!2skr!4v1",
    priceRange: "\u20A940,000~\u20A9100,000",
    hours: "11:00~20:00 (Mon~Sun)",
    services: ["K-pop Nail Art", "Gel Nails", "Nail Extension", "Nail Removal"],
    servicePrices: [{ name: "K-pop Nail Art", price: "\u20A970,000" }, { name: "Gel Nails", price: "\u20A950,000" }, { name: "Nail Extension", price: "\u20A9100,000" }, { name: "Nail Removal", price: "\u20A940,000" }],
    description: "The most creative nail bar in Seoul! Known for unique K-pop inspired nail art designs.",
    rating: 4.9,
    reviewCount: 421,
    thumbnail: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop",
    commission: 10,
    active: true,
    createdAt: "2024-01-15"
  },
  {
    id: "s5",
    name: "Apgujeong Derma Lab",
    slug: "apgujeong-derma-clinic",
    category: "clinic",
    location: "Apgujeong, Seoul",
    address: "156 Apgujeong-ro, Gangnam-gu, Seoul",
    googleMapUrl: "https://maps.google.com/?q=Apgujeong+Seoul+South+Korea",
    googleMapEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3165.2!2d127.0367!3d37.5247!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca21f3c0b5a6d%3A0x4b5a1e5f!2sApgujeong%2C+Seoul!5e0!3m2!1sen!2skr!4v1",
    priceRange: "\u20A9150,000~\u20A9500,000",
    hours: "10:00~18:00 (Mon~Fri)",
    services: ["Laser Treatment", "Skin Brightening", "Anti-aging", "Botox", "Filler"],
    servicePrices: [{ name: "Laser Treatment", price: "\u20A9300,000" }, { name: "Skin Brightening", price: "\u20A9200,000" }, { name: "Anti-aging", price: "\u20A9250,000" }, { name: "Botox", price: "\u20A9200,000" }, { name: "Filler", price: "\u20A9500,000" }],
    description: "World-class dermatology clinic in prestigious Apgujeong. Board-certified dermatologists with 20+ years experience.",
    rating: 5,
    reviewCount: 156,
    thumbnail: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop",
    commission: 20,
    active: true,
    createdAt: "2024-01-20"
  }
];
var videos = [
  { id: "v1", shopId: "s1", title: "Gangnam Luxury Facial Treatment", description: "Experience the famous Korean skincare at Gangnam top skin clinic. Deep cleansing, hydration boost and glow-up guaranteed!", videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4", thumbnail: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=700&fit=crop", tags: ["#KoreanSkincare", "#Gangnam", "#FacialTreatment"], views: 12400, likes: 892, createdAt: "2024-01-15" },
  { id: "v2", shopId: "s2", title: "Korean Glass Skin Makeup", description: "Learn the iconic Korean glass skin makeup from a professional artist in Hongdae. K-beauty at its finest!", videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnail: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=700&fit=crop", tags: ["#GlassSkin", "#KBeauty", "#Makeup"], views: 8900, likes: 674, createdAt: "2024-01-16" },
  { id: "v3", shopId: "s3", title: "Korean Hair Salon Balayage", description: "Get the hottest K-pop inspired hair color at Seoul most popular hair salon. Balayage, highlights and more!", videoUrl: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4", thumbnail: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=700&fit=crop", tags: ["#KoreanHair", "#Balayage", "#HairSalon"], views: 6700, likes: 521, createdAt: "2024-01-17" },
  { id: "v4", shopId: "s4", title: "Nail Art K-pop Designs", description: "Stunning K-pop inspired nail art at Seoul trendiest nail studio. Unique designs every time!", videoUrl: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4", thumbnail: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=700&fit=crop", tags: ["#NailArt", "#Kpop", "#SeoulNails"], views: 15200, likes: 1243, createdAt: "2024-01-18" },
  { id: "v5", shopId: "s5", title: "Apgujeong Derma Laser Treatment", description: "The most advanced derma clinic in Apgujeong. Laser treatments, skin brightening and anti-aging solutions.", videoUrl: "https://media.w3.org/2010/05/sintel/trailer.mp4", thumbnail: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=700&fit=crop", tags: ["#DermaClinic", "#LaserTreatment", "#KoreanBeauty"], views: 9800, likes: 743, createdAt: "2024-01-19" },
  { id: "v6", shopId: "s1", title: "Myeongdong Spa Body Treatment", description: "Relax with a full body spa in the heart of Myeongdong. Korean herbal therapy included!", videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", thumbnail: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=700&fit=crop", tags: ["#KoreanSpa", "#Myeongdong", "#BodyTreatment"], views: 7300, likes: 589, createdAt: "2024-01-20" }
];
async function initDb() {
  const sql = getDb();
  try {
    await sql`CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, category TEXT,
      location TEXT, address TEXT, google_map_url TEXT, google_map_embed TEXT,
      price_range TEXT, hours TEXT, services JSONB DEFAULT '[]',
      service_prices JSONB DEFAULT '[]', description TEXT,
      rating REAL DEFAULT 5.0, review_count INTEGER DEFAULT 0,
      thumbnail TEXT, photos JSONB DEFAULT '[]', commission INTEGER DEFAULT 15,
      active BOOLEAN DEFAULT true, created_at TEXT
    )`;
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS lat TEXT DEFAULT ''`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS lng TEXT DEFAULT ''`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_place_id TEXT DEFAULT ''`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS meta_description TEXT DEFAULT ''`;
    } catch (e) {
    }
    try {
      await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS seo_keywords TEXT DEFAULT ''`;
    } catch (e) {
    }
    await sql`CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY, shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
      title TEXT, description TEXT, video_url TEXT, thumbnail TEXT,
      tags JSONB DEFAULT '[]', views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0, created_at TEXT
    )`;
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, shop_id TEXT, shop_name TEXT, name TEXT,
      email TEXT, phone TEXT, service TEXT, people TEXT DEFAULT '1',
      date TEXT, message TEXT, status TEXT DEFAULT 'new',
      commission_rate INTEGER DEFAULT 10, estimated_amount TEXT, created_at TEXT
    )`;
    const cnt = await sql`SELECT COUNT(*) as c FROM shops`;
    if (Number(cnt[0].c) === 0) {
      for (const s of shops) {
        await sql`INSERT INTO shops VALUES (
          ${s.id},${s.name},${s.slug},${s.category},${s.location},${s.address},
          ${s.googleMapUrl},${s.googleMapEmbed},${s.priceRange},${s.hours},
          ${JSON.stringify(s.services)},${JSON.stringify(s.servicePrices)},
          ${s.description},${s.rating},${s.reviewCount},${s.thumbnail},
          ${s.commission},${s.active},${s.createdAt}
        ) ON CONFLICT (id) DO NOTHING`;
      }
      for (const v of videos) {
        await sql`INSERT INTO videos VALUES (
          ${v.id},${v.shopId},${v.title},${v.description},${v.videoUrl},
          ${v.thumbnail},${JSON.stringify(v.tags)},${v.views},${v.likes},${v.createdAt}
        ) ON CONFLICT (id) DO NOTHING`;
      }
    }
  } catch (e) {
    console.error("initDb error:", e);
  }
}
var _dbInited = false;
async function ensureDb() {
  if (_dbInited) return;
  _dbInited = true;
  await initDb();
}
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/api/videos", async (c) => {
  await ensureDb();
  const sql = getDb();
  const cat = c.req.query("category");
  const rows = cat && cat !== "all" ? await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.category=${cat} ORDER BY RANDOM()` : await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY RANDOM()`;
  const result = rows.map((r) => ({
    ...rowToVideo(r),
    shop: { id: r.shop_id, name: r.shop_name, category: r.shop_cat, location: r.shop_location, thumbnail: r.shop_thumb }
  }));
  return c.json({ videos: result });
});
app.get("/api/shops", async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT * FROM shops ORDER BY created_at DESC`;
  return c.json({ shops: rows.map(rowToShop) });
});
app.get("/api/shops/:id", async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT * FROM shops WHERE id=${c.req.param("id")}`;
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  const vidRows = await sql`SELECT * FROM videos WHERE shop_id=${c.req.param("id")} ORDER BY created_at DESC`;
  return c.json({ shop: rowToShop(rows[0]), videos: vidRows.map(rowToVideo) });
});
app.post("/api/resolve-gmap", async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "no url" }, 400);
    const areaMap = [
      // 한국어 키워드
      ["\uC555\uAD6C\uC815", "Apgujeong, Seoul"],
      ["\uCCAD\uB2F4", "Cheongdam, Seoul"],
      ["\uAC00\uB85C\uC218\uAE38", "Sinsa, Seoul"],
      ["\uC2E0\uC0AC", "Sinsa, Seoul"],
      ["\uC5ED\uC0BC", "Gangnam, Seoul"],
      ["\uC120\uB989", "Gangnam, Seoul"],
      ["\uAC15\uB0A8", "Gangnam, Seoul"],
      ["\uC11C\uCD08", "Seocho, Seoul"],
      ["\uD64D\uB300", "Hongdae, Seoul"],
      ["\uD569\uC815", "Hapjeong, Seoul"],
      ["\uC0C1\uC218", "Hapjeong, Seoul"],
      ["\uC2E0\uCD0C", "Sinchon, Seoul"],
      ["\uB9C8\uD3EC", "Mapo, Seoul"],
      ["\uC774\uD0DC\uC6D0", "Itaewon, Seoul"],
      ["\uD55C\uB0A8", "Itaewon, Seoul"],
      ["\uC6A9\uC0B0", "Yongsan, Seoul"],
      ["\uBA85\uB3D9", "Myeongdong, Seoul"],
      ["\uC911\uAD6C", "Myeongdong, Seoul"],
      ["\uC885\uB85C", "Jongno, Seoul"],
      ["\uC778\uC0AC\uB3D9", "Jongno, Seoul"],
      ["\uB3D9\uB300\uBB38", "Dongdaemun, Seoul"],
      ["\uC131\uC218", "Seongsu, Seoul"],
      ["\uC131\uB3D9", "Seongsu, Seoul"],
      ["\uAC74\uB300", "Konkuk, Seoul"],
      ["\uC7A0\uC2E4", "Jamsil, Seoul"],
      ["\uC1A1\uD30C", "Songpa, Seoul"],
      ["\uAC15\uB3D9", "Songpa, Seoul"],
      ["\uC5EC\uC758\uB3C4", "Yeouido, Seoul"],
      ["\uC601\uB4F1\uD3EC", "Yeouido, Seoul"],
      ["\uAC15\uC11C", "Gangseo, Seoul"],
      ["\uBAA9\uB3D9", "Gangseo, Seoul"],
      ["\uB178\uC6D0", "Nowon, Seoul"],
      ["\uC740\uD3C9", "Eunpyeong, Seoul"],
      // 영어 키워드 (Nominatim 결과 대응)
      ["apgujeong", "Apgujeong, Seoul"],
      ["cheongdam", "Cheongdam, Seoul"],
      ["sinsa", "Sinsa, Seoul"],
      ["gangnam", "Gangnam, Seoul"],
      ["seocho", "Seocho, Seoul"],
      ["hongdae", "Hongdae, Seoul"],
      ["hapjeong", "Hapjeong, Seoul"],
      ["sinchon", "Sinchon, Seoul"],
      ["mapo", "Mapo, Seoul"],
      ["itaewon", "Itaewon, Seoul"],
      ["hannam", "Itaewon, Seoul"],
      ["yongsan", "Yongsan, Seoul"],
      ["myeongdong", "Myeongdong, Seoul"],
      ["jongno", "Jongno, Seoul"],
      ["insadong", "Jongno, Seoul"],
      ["dongdaemun", "Dongdaemun, Seoul"],
      ["seongsu", "Seongsu, Seoul"],
      ["seongdong", "Seongsu, Seoul"],
      ["jamsil", "Jamsil, Seoul"],
      ["songpa", "Songpa, Seoul"],
      ["yeouido", "Yeouido, Seoul"],
      ["gangseo", "Gangseo, Seoul"],
      ["nowon", "Nowon, Seoul"],
      ["eunpyeong", "Eunpyeong, Seoul"],
      // 광역시/도시
      ["\uBD80\uC0B0", "Busan"],
      ["\uD574\uC6B4\uB300", "Busan"],
      ["\uC11C\uBA74", "Busan"],
      ["busan", "Busan"],
      ["haeundae", "Busan"],
      ["\uC81C\uC8FC", "Jeju"],
      ["jeju", "Jeju"],
      ["\uC778\uCC9C", "Incheon"],
      ["incheon", "Incheon"],
      ["\uB300\uAD6C", "Daegu"],
      ["daegu", "Daegu"],
      ["\uB300\uC804", "Daejeon"],
      ["daejeon", "Daejeon"],
      ["\uAD11\uC8FC", "Gwangju"],
      ["gwangju", "Gwangju"],
      ["\uC218\uC6D0", "Suwon"],
      ["suwon", "Suwon"]
    ];
    const findArea = (text) => {
      const t = text.toLowerCase();
      for (const [kw, val] of areaMap) {
        if (t.indexOf(kw.toLowerCase()) !== -1) return val;
      }
      return "";
    };
    const extractCoords = (u) => {
      const m1 = u.match(/!3d([-\d.]+)!4d([-\d.]+)/);
      if (m1) return { lat: m1[1], lon: m1[2] };
      const m2 = u.match(/@([-\d.]+),([-\d.]+)/);
      if (m2) return { lat: m2[1], lon: m2[2] };
      const m3 = u.match(/[?&]q=([-\d.]+),([-\d.]+)/);
      if (m3) return { lat: m3[1], lon: m3[2] };
      return null;
    };
    const reverseGeocode = async (lat, lon) => {
      try {
        const r = await fetch(
          "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lon + "&accept-language=en",
          { headers: { "User-Agent": "SeoulBeautyTrip/1.0" } }
        );
        const d = await r.json();
        if (d && d.display_name) {
          const addr = d.display_name;
          const loc = findArea(addr) || findArea(d.address?.suburb || "") || findArea(d.address?.city_district || "") || findArea(d.address?.borough || "");
          return { address: addr, location: loc };
        }
      } catch {
      }
      return null;
    };
    let resolved = url;
    if (url.indexOf("goo.gl") !== -1 || url.indexOf("maps.app") !== -1) {
      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch(resolved, { method: "GET", redirect: "manual" });
          const loc = r.headers.get("location");
          if (!loc) break;
          resolved = loc.startsWith("http") ? loc : resolved;
          if (resolved.indexOf("/maps/place/") !== -1 || resolved.indexOf("maps.google.com") !== -1) break;
        } catch {
          break;
        }
      }
    }
    const callPlacesApi = async (textQuery) => {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.regularOpeningHours,places.rating,places.userRatingCount,places.reviews,places.photos,places.internationalPhoneNumber,places.websiteUri,places.location,places.editorialSummary,places.primaryType,places.types"
        },
        body: JSON.stringify({ textQuery, languageCode: "en" })
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.places?.[0] || null;
    };
    const placeDetailsById = async (pid) => {
      const fieldMask = "id,displayName,formattedAddress,addressComponents,regularOpeningHours,rating,userRatingCount,reviews,photos,internationalPhoneNumber,websiteUri,location,editorialSummary,primaryType,types";
      const r = await fetch(`https://places.googleapis.com/v1/places/${pid}?languageCode=en`, {
        headers: { "X-Goog-Api-Key": GOOGLE_PLACES_KEY, "X-Goog-FieldMask": fieldMask }
      });
      if (!r.ok) return null;
      return r.json();
    };
    const placeToJson = (place) => {
      if (!place) return null;
      const comps = place.addressComponents || [];
      const isKor = (s) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
      const stripKor = (s) => s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g, "").replace(/\s{2,}/g, " ").trim();
      const get = (...types) => {
        const c2 = comps.find((x) => types.some((t) => x.types?.includes(t)));
        if (!c2) return "";
        return !isKor(c2.longText || "") ? c2.longText || "" : !isKor(c2.shortText || "") ? c2.shortText || "" : "";
      };
      const street = [get("street_number"), get("route")].filter(Boolean).join(" ") || [get("sublocality_level_4"), get("sublocality_level_3"), get("sublocality_level_2")].filter(Boolean).join(" ");
      const sub1 = get("sublocality_level_1");
      const district = get("administrative_area_level_2", "locality");
      const province = get("administrative_area_level_1");
      let address = [street, sub1, district, province, "South Korea"].filter(Boolean).join(", ");
      if (isKor(address)) address = stripKor(place.formattedAddress || "") || "Seoul, South Korea";
      const rawName = place.displayName?.text || "";
      const nameParts = rawName.split(/[|\uff5c]/).map((s) => s.trim()).filter(Boolean);
      const engName = nameParts.find((s) => !isKor(s) && s.length > 0) || (() => {
        const stripped = stripKor(rawName);
        return stripped.length > 1 ? stripped : "";
      })() || rawName;
      const sub1Text = comps.find((x) => x.types?.includes("sublocality_level_1"))?.longText || "";
      const sub2Text = comps.find((x) => x.types?.includes("sublocality_level_2"))?.longText || "";
      const location = findArea(sub2Text) || findArea(sub1Text) || findArea(address) || findArea(place.formattedAddress || "") || "Seoul";
      const weekdays = place.regularOpeningHours?.weekdayDescriptions || [];
      const rawReviews = place.reviews || [];
      const enRevs = rawReviews.filter((r) => r.text?.languageCode === "en" && (r.text?.text?.length || 0) > 20);
      const otherRevs = rawReviews.filter((r) => r.text?.languageCode !== "en" && (r.text?.text?.length || 0) > 20);
      const reviews = [...enRevs, ...otherRevs].slice(0, 5).map((r) => ({
        author: r.authorAttribution?.displayName || "Guest",
        rating: r.rating || 5,
        text: r.text?.text || "",
        time: r.relativePublishTimeDescription || ""
      }));
      const photos = (place.photos || []).slice(0, 10).map((p) => `/api/photo?name=${encodeURIComponent(p.name || "")}`);
      const lat = place.location?.latitude?.toString() || "";
      const lng = place.location?.longitude?.toString() || "";
      const description = place.editorialSummary?.text || "";
      const allTypes = [place.primaryType || "", ...place.types || []].map((t) => t.toLowerCase());
      let suggestedCategory = "";
      if (allTypes.some((t) => ["beauty_salon", "hair_care", "hair_salon", "barber_shop"].includes(t))) suggestedCategory = "hair";
      else if (allTypes.some((t) => ["nail_salon"].includes(t))) suggestedCategory = "nail";
      else if (allTypes.some((t) => ["spa", "massage", "sauna"].includes(t))) suggestedCategory = "spa";
      else if (allTypes.some((t) => ["doctor", "hospital", "medical_lab", "physiotherapist", "skin_care", "plastic_surgeon", "dermatologist"].includes(t))) suggestedCategory = "clinic";
      else if (allTypes.some((t) => ["makeup_artist"].includes(t))) suggestedCategory = "makeup";
      return {
        placeId: place.id || "",
        name: engName,
        address,
        location,
        phone: place.internationalPhoneNumber || "",
        website: place.websiteUri || "",
        hours: weekdays.join(" | "),
        weekdayDescriptions: weekdays,
        description,
        suggestedCategory,
        rating: place.rating || 0,
        reviewCount: place.userRatingCount || 0,
        reviews,
        photos,
        lat,
        lng,
        _fromPlaces: true
        // Places API로 가져왔음을 admin에서 인식
      };
    };
    const placeIdMatch = resolved.match(/[?&;/]([0-9a-f]{16,}:[0-9a-f]{16,})/i) || resolved.match(/place_id[:=]([A-Za-z0-9_-]+)/);
    if (placeIdMatch) {
      const pid = placeIdMatch[1];
      const hexMatch = pid.match(/^([0-9a-f]+):([0-9a-f]+)$/i);
      if (!hexMatch) {
        const pd = await placeDetailsById(pid);
        const result = placeToJson(pd);
        if (result) return c.json(result);
      }
    }
    const placeIdx = resolved.indexOf("/place/");
    if (placeIdx !== -1) {
      const afterPlace = resolved.slice(placeIdx + 7);
      const rawName = afterPlace.split("/")[0].split("?")[0].split("@")[0];
      let shopName = "";
      try {
        shopName = decodeURIComponent(rawName.split("+").join(" ")).trim();
      } catch {
        shopName = rawName.trim();
      }
      const isKor = (s) => /[\uAC00-\uD7A3]/.test(s);
      const engPart = shopName.split("|").map((s) => s.trim()).find((s) => !isKor(s) && s.length > 2) || shopName;
      const coords = extractCoords(resolved);
      const latStr = coords?.lat || "";
      const lngStr = coords?.lon || "";
      const searchQ = engPart + " Seoul Korea";
      const place = await callPlacesApi(searchQ);
      const result = placeToJson(place);
      if (result) {
        if (latStr && !result.lat) result.lat = latStr;
        if (lngStr && !result.lng) result.lng = lngStr;
        if (!result.location || result.location === "Seoul") {
          const locFromName = findArea(shopName);
          if (locFromName) result.location = locFromName;
        }
        return c.json(result);
      }
      const geo = coords ? await reverseGeocode(coords.lat, coords.lon) : null;
      return c.json({
        name: engPart,
        address: geo?.address || "",
        location: geo?.location || findArea(shopName),
        lat: latStr,
        lng: lngStr
      });
    }
    const qMatch = resolved.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      let qVal = "";
      try {
        qVal = decodeURIComponent(qMatch[1].split("+").join(" "));
      } catch {
        qVal = qMatch[1];
      }
      const coordsFromQ = extractCoords(resolved);
      if (coordsFromQ) {
        const geo = await reverseGeocode(coordsFromQ.lat, coordsFromQ.lon);
        if (geo) return c.json({ name: "", address: geo.address, location: geo.location, lat: coordsFromQ.lat, lng: coordsFromQ.lon });
      }
      const place = await callPlacesApi(qVal + " Seoul Korea");
      const result = placeToJson(place);
      if (result) return c.json(result);
      return c.json({ name: "", address: qVal, location: findArea(qVal), lat: "", lng: "" });
    }
    const coordsOnly = extractCoords(resolved);
    if (coordsOnly) {
      const geo = await reverseGeocode(coordsOnly.lat, coordsOnly.lon);
      if (geo) return c.json({ name: "", address: geo.address, location: geo.location, lat: coordsOnly.lat, lng: coordsOnly.lon });
    }
    return c.json({ address: "", location: "", name: "", lat: "", lng: "" });
  } catch (e) {
    return c.json({ error: e.message || "failed" }, 500);
  }
});
var CLD = { KEY: "221647295675392", SECRET: "g10Q4wv2UzDEAGV35QluPCYz4Ms", NAME: "dc0ouozcd" };
async function makeSign(folder) {
  const timestamp = Math.floor(Date.now() / 1e3).toString();
  const strToSign = "folder=" + folder + "&timestamp=" + timestamp + CLD.SECRET;
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-1", enc.encode(strToSign));
  const signature = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { cloudName: CLD.NAME, apiKey: CLD.KEY, timestamp, signature, folder };
}
app.get("/api/upload-sign", async (c) => {
  try {
    return c.json(await makeSign("seoul-beauty"));
  } catch (e) {
    return c.json({ error: e.message || "Sign failed" }, 500);
  }
});
app.get("/api/upload-sign-image", async (c) => {
  try {
    return c.json(await makeSign("seoul-beauty-photos"));
  } catch (e) {
    return c.json({ error: e.message || "Sign failed" }, 500);
  }
});
async function makeShopSlug(sql, name, location) {
  let base = "";
  for (let i = 0; i < name.length; i++) {
    const ch = name[i].toLowerCase();
    base += ch >= "a" && ch <= "z" || ch >= "0" && ch <= "9" ? ch : "-";
  }
  base = base.replace(/-+/g, "-").replace(/^-|-$/g, "") || "shop";
  const areaRaw = (location || "").split(",")[0].trim();
  let area = "";
  for (let i = 0; i < areaRaw.length; i++) {
    const ch = areaRaw[i].toLowerCase();
    area += ch >= "a" && ch <= "z" ? ch : "-";
  }
  area = area.replace(/-+/g, "-").replace(/^-|-$/g, "");
  const candidate = area ? `${base}-${area}` : base;
  const existing = await sql`SELECT slug FROM shops WHERE slug LIKE ${candidate + "%"}`;
  const existingSlugs = new Set(existing.map((r) => r.slug));
  if (!existingSlugs.has(candidate)) return candidate;
  for (let n = 2; n <= 99; n++) {
    const s = `${candidate}-${n}`;
    if (!existingSlugs.has(s)) return s;
  }
  return `${candidate}-${Date.now().toString().slice(-4)}`;
}
async function autoGenSeo(body, apiKey) {
  if (!apiKey || !body.name) return null;
  try {
    const catKeywords = {
      skincare: "Korean skincare Seoul, facial treatment Seoul, glass skin Seoul, K-beauty facial, skin clinic Seoul foreigners",
      makeup: "Korean makeup Seoul, K-beauty makeup artist, Korean beauty look, makeup studio Seoul foreigners",
      hair: "Korean hair salon Seoul, K-pop hairstyle Seoul, hair coloring Seoul foreigners, balayage Seoul",
      headspa: "head spa Seoul, Korean head spa foreigners, scalp treatment Seoul, Korean scalp massage",
      nail: "Korean nail art Seoul, nail salon Seoul foreigners, K-pop nail design, gel nails Seoul English",
      clinic: "Korean dermatology Seoul, skin clinic Seoul foreigners, laser treatment Seoul, aesthetic clinic Korea",
      spa: "Korean spa Seoul, body treatment Seoul foreigners, Korean massage Seoul, relaxation spa Seoul English"
    };
    const area = (body.location || "Seoul").split(",")[0].trim();
    const catKeyword = catKeywords[body.category] || "Korean beauty Seoul, K-beauty";
    const serviceList = Array.isArray(body.services) ? body.services.join(", ") : body.services || "beauty services";
    const brandVariants = `${body.name} Seoul, ${body.name} ${body.category}, ${body.name} booking, ${body.name} review, ${body.name} foreigner, ${body.name} English, ${body.name} price`;
    const ratingInfo = body.rating ? `- Google Rating: ${body.rating}/5 (${body.reviewCount || 0} reviews)` : "";
    const prompt = `You are an SEO expert for a Korean beauty booking platform targeting foreign tourists in Seoul.

The shop "${body.name}" is a real ${body.category} salon in ${area}, Seoul.
Create SEO content capturing BOTH brand searches (people who know "${body.name}") AND generic searches (foreigners looking for ${body.category} in Seoul).

Shop details:
- Name: ${body.name}
- Area: ${area}, Seoul
- Category: ${body.category}
- Services: ${serviceList}
- Price Range: ${body.priceRange || "contact for pricing"}
${ratingInfo}
- Brand variants: ${brandVariants}
- Category keywords: ${catKeyword}

Rules:
1. titleSuffix: max 40 chars, format "${body.name} | ${area} ${body.category} Seoul"
2. metaDescription: 140-155 chars, start with "${body.name}", include area + category + English-friendly + Book via WhatsApp
3. description: 2-3 sentences (180-240 chars), mention shop name, area, what makes it special for foreigners
4. keywords: exactly 8 strings \u2014 4 brand keywords (${body.name} Seoul, ${body.name} booking, ${body.name} review, ${body.name} foreigners) + 4 generic (best ${body.category} ${area} Seoul, ${body.category} Seoul English, ${body.category} Seoul foreigners, Korean ${body.category} Seoul)
5. No quotes or markdown inside values

Return ONLY valid JSON:
{"titleSuffix":"...","metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6","k7","k8"]}`;
    const res = await fetch("https://www.genspark.ai/api/llm_proxy/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 1e3 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}
app.post("/api/shops", async (c) => {
  const sql = getDb();
  const body = await c.req.json();
  const newId = "s" + Date.now();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let description = body.description || "";
  let metaDescription = body.metaDescription || "";
  let seoKeywords = body.seoKeywords || "";
  if (!description) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || "";
    const seo = await autoGenSeo(body, apiKey);
    if (seo) {
      description = seo.description || "";
      metaDescription = seo.metaDescription || "";
      seoKeywords = Array.isArray(seo.keywords) ? seo.keywords.join(", ") : "";
    }
  }
  const slug = await makeShopSlug(sql, body.name || "", body.location || "");
  await sql`INSERT INTO shops (id,name,slug,category,location,address,google_map_url,google_map_embed,lat,lng,price_range,hours,services,service_prices,description,meta_description,seo_keywords,rating,review_count,thumbnail,photos,commission,active,created_at) VALUES (
    ${newId},${body.name || ""},${slug},${body.category || ""},${body.location || ""},${body.address || ""},
    ${body.googleMapUrl || ""},${body.googleMapEmbed || ""},${body.lat || ""},${body.lng || ""},
    ${body.priceRange || ""},${body.hours || ""},
    ${JSON.stringify(body.services || [])},${JSON.stringify(body.servicePrices || [])},
    ${description},${metaDescription},${seoKeywords},
    ${body.rating || 5},${body.reviewCount || 0},${body.thumbnail || ""},
    ${JSON.stringify(body.photos || [])},${body.commission || 15},true,${today}
  ) ON CONFLICT DO NOTHING`;
  return c.json({ ok: true, id: newId, seoGenerated: !body.description });
});
app.put("/api/shops/:id", async (c) => {
  const sql = getDb();
  const body = await c.req.json();
  let description = body.description || "";
  let metaDescription = body.metaDescription || "";
  let seoKeywords = body.seoKeywords || "";
  if (!description || body.regenerateSeo) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || "";
    const seo = await autoGenSeo(body, apiKey);
    if (seo) {
      description = description || seo.description || "";
      metaDescription = metaDescription || seo.metaDescription || "";
      seoKeywords = seoKeywords || (Array.isArray(seo.keywords) ? seo.keywords.join(", ") : "");
    }
  }
  const slugVal = body.slug || await makeShopSlug(sql, body.name || "", body.location || "");
  await sql`UPDATE shops SET
    name=${body.name || ""},
    slug=${slugVal},
    category=${body.category || ""},
    location=${body.location || ""},
    address=${body.address || ""},
    google_map_url=${body.googleMapUrl || ""},
    google_map_embed=${body.googleMapEmbed || ""},
    lat=${body.lat || ""},
    lng=${body.lng || ""},
    price_range=${body.priceRange || ""},
    hours=${body.hours || ""},
    services=${JSON.stringify(body.services || [])},
    service_prices=${JSON.stringify(body.servicePrices || [])},
    description=${description},
    meta_description=${metaDescription},
    seo_keywords=${seoKeywords},
    rating=${body.rating || 5},
    review_count=${body.reviewCount || 0},
    thumbnail=${body.thumbnail || ""},
    photos=${JSON.stringify(body.photos || [])},
    commission=${body.commission || 15},
    active=${body.active !== false},
    reviews=${JSON.stringify(body.reviews || [])},
    google_place_id=${body.googlePlaceId || ""},
    menu_items=${JSON.stringify(body.menuItems || [])}
    WHERE id=${c.req.param("id")}`;
  return c.json({ ok: true, seoGenerated: !body.description || !!body.regenerateSeo });
});
app.delete("/api/shops/:id", async (c) => {
  const sql = getDb();
  await sql`DELETE FROM shops WHERE id=${c.req.param("id")}`;
  return c.json({ ok: true });
});
app.post("/api/videos", async (c) => {
  const sql = getDb();
  const body = await c.req.json();
  const newId = "v" + Date.now();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  await sql`INSERT INTO videos (id,shop_id,title,description,video_url,thumbnail,tags,views,likes,created_at) VALUES (
    ${newId},${body.shopId || ""},${body.title || ""},${body.description || ""},${body.videoUrl || ""},
    ${body.thumbnail || ""},${JSON.stringify(body.tags || [])},0,0,${today}
  )`;
  return c.json({ ok: true, id: newId });
});
app.delete("/api/videos/:id", async (c) => {
  const sql = getDb();
  await sql`DELETE FROM videos WHERE id=${c.req.param("id")}`;
  return c.json({ ok: true });
});
app.put("/api/videos/:id", async (c) => {
  const sql = getDb();
  const body = await c.req.json();
  if (body.titleOnly) {
    await sql`UPDATE videos SET title=${body.title || ""} WHERE id=${c.req.param("id")}`;
  } else {
    await sql`UPDATE videos SET
      title=${body.title || ""},
      description=${body.description || ""},
      thumbnail=${body.thumbnail || ""},
      tags=${JSON.stringify(body.tags || [])}
      WHERE id=${c.req.param("id")}`;
  }
  return c.json({ ok: true });
});
app.post("/api/videos/:id/view", async (c) => {
  const sql = getDb();
  await sql`UPDATE videos SET views=views+1 WHERE id=${c.req.param("id")}`;
  return c.json({ ok: true });
});
app.get("/api/bookings", async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`;
  return c.json({ bookings: rows.map(rowToBooking) });
});
app.post("/api/bookings", async (c) => {
  const sql = getDb();
  const body = await c.req.json();
  const shopRows = await sql`SELECT name, commission FROM shops WHERE id=${body.shopId || ""}`;
  const shop = shopRows[0];
  const newId = "b" + Date.now();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  await sql`INSERT INTO bookings (id,shop_id,shop_name,name,email,phone,service,people,date,message,status,commission_rate,estimated_amount,created_at) VALUES (
    ${newId},${body.shopId || ""},${shop?.name || body.shopName || ""},${body.name || ""},${body.email || ""},
    ${body.phone || ""},${body.service || ""},${body.people || "1"},${body.date || ""},${body.message || ""},
    'new',${shop?.commission || 10},${body.estimatedAmount || ""},${today}
  )`;
  return c.json({ ok: true });
});
app.put("/api/bookings/:id/status", async (c) => {
  const sql = getDb();
  const { status } = await c.req.json();
  await sql`UPDATE bookings SET status=${status} WHERE id=${c.req.param("id")}`;
  return c.json({ ok: true });
});
app.get("/api/stats", async (c) => {
  const sql = getDb();
  const [vStats] = await sql`SELECT COALESCE(SUM(views),0) as total_views, COUNT(*) as total FROM videos`;
  const [bStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='new') as new_cnt, COUNT(*) FILTER (WHERE status='confirmed') as confirmed_cnt, COUNT(*) FILTER (WHERE status='contacted') as contacted_cnt FROM bookings`;
  const [sStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active=true) as active_cnt FROM shops`;
  const topRows = await sql`SELECT v.*, s.name as shop_name FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY v.views DESC LIMIT 5`;
  const catRows = await sql`SELECT category, COUNT(*) as cnt FROM shops WHERE active=true GROUP BY category ORDER BY cnt DESC`;
  const shopViewRows = await sql`SELECT s.name, s.category, COALESCE(SUM(v.views),0) as total_views FROM shops s LEFT JOIN videos v ON v.shop_id=s.id GROUP BY s.id, s.name, s.category ORDER BY total_views DESC LIMIT 5`;
  const recentBookings = await sql`SELECT DATE(created_at) as day, COUNT(*) as cnt FROM bookings WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`;
  return c.json({
    totalViews: Number(vStats.total_views),
    totalBookings: Number(bStats.total),
    newBookings: Number(bStats.new_cnt),
    confirmedBookings: Number(bStats.confirmed_cnt),
    contactedBookings: Number(bStats.contacted_cnt),
    totalShops: Number(sStats.total),
    activeShops: Number(sStats.active_cnt),
    topVideos: topRows.map((r) => ({ ...rowToVideo(r), shop: { name: r.shop_name } })),
    categoryStats: catRows.map((r) => ({ category: r.category, count: Number(r.cnt) })),
    shopViewStats: shopViewRows.map((r) => ({ name: r.name, category: r.category, views: Number(r.total_views) })),
    recentBookings: recentBookings.map((r) => ({ day: r.day, count: Number(r.cnt) }))
  });
});
app.get("/api/platform", (c) => c.json(PLATFORM));
app.post("/api/ai-seo", async (c) => {
  try {
    const body = await c.req.json();
    const { name, location, category, services, priceRange, hours, placeId, rating, reviewCount } = body;
    if (!name) return c.json({ error: "name required" }, 400);
    const catKeywords = {
      skincare: "Korean skincare Seoul, facial treatment Seoul, glass skin Seoul, K-beauty facial, skin clinic Seoul foreigners",
      makeup: "Korean makeup Seoul, K-beauty makeup artist, Korean beauty look, makeup studio Seoul foreigners",
      hair: "Korean hair salon Seoul, K-pop hairstyle Seoul, hair coloring Seoul foreigners, balayage Seoul, Korean hair dyeing",
      headspa: "head spa Seoul, Korean head spa foreigners, scalp treatment Seoul, Korean scalp massage, head spa Seoul English",
      nail: "Korean nail art Seoul, nail salon Seoul foreigners, K-pop nail design, gel nails Seoul English, nail salon Seoul English speaking",
      clinic: "Korean dermatology Seoul, skin clinic Seoul foreigners, laser treatment Seoul, aesthetic clinic Korea, Korean skin care clinic",
      spa: "Korean spa Seoul, body treatment Seoul foreigners, Korean massage Seoul, relaxation spa Seoul English"
    };
    const catKeyword = catKeywords[category] || "Korean beauty Seoul, K-beauty";
    const area = (location || "Seoul").split(",")[0].trim();
    const brandVariants = [
      `${name} Seoul`,
      `${name} ${category}`,
      `${name} booking`,
      `${name} review`,
      `${name} foreigner`,
      `${name} English`,
      `${name} price`,
      `${name} ${area}`
    ].join(", ");
    const ratingInfo = rating ? `- Google Rating: ${rating}/5 (${reviewCount || 0} reviews)` : "";
    const serviceList = Array.isArray(services) ? services.join(", ") : services || "beauty services";
    const prompt = `You are an SEO expert for a Korean beauty booking platform targeting foreign tourists in Seoul.

The shop "${name}" is a real, well-known ${category} salon in ${area}, Seoul.
Some tourists already search for this shop by name (brand searches).
Your job is to create SEO content that captures BOTH:
1. Brand searches: people who already know "${name}" and search for it
2. Generic searches: people looking for "best ${category} ${area} Seoul foreigners"

Shop details:
- Name: ${name}
- Area: ${area}, Seoul, South Korea
- Category: ${category}
- Services: ${serviceList}
- Price Range: ${priceRange || "contact for pricing"}
${ratingInfo}
- Brand keyword variations: ${brandVariants}
- Category keywords: ${catKeyword}

Rules:
1. title (titleSuffix): max 40 chars \u2014 use format like "${name} | ${area} ${category} Seoul" \u2014 must include shop name
2. metaDescription: 140-155 chars \u2014 start with shop name, include area + category + "English-friendly" + "Book via WhatsApp"
3. description: 2-3 natural sentences (180-240 chars) \u2014 mention shop name naturally, include area, category, what makes it special for foreigners
4. keywords: exactly 8 strings \u2014 mix of brand keywords (${name} Seoul, ${name} booking, ${name} review) AND generic keywords (best ${category} ${area} Seoul, ${category} Seoul foreigners, English speaking ${category} Seoul)
5. No quotes inside text values, no markdown, no special characters

Return ONLY valid JSON:
{"titleSuffix":"...","metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6","k7","k8"]}`;
    const OPENAI_KEY = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || "";
    if (!OPENAI_KEY) return c.json({ error: "API key not configured" }, 500);
    const res = await fetch("https://www.genspark.ai/api/llm_proxy/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3e3
      })
    });
    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: "AI API error", detail: err }, 500);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    if (!text) return c.json({ error: "empty response from AI" }, 500);
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return c.json({ error: "parse error", raw: text }, 500);
    const result = JSON.parse(jsonMatch[0]);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
app.post("/api/places-fetch", async (c) => {
  try {
    const body = await c.req.json();
    const { query, placeId: directPlaceId } = body;
    const isKorean = (s) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
    const stripKorean = (s) => s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g, "").replace(/\s{2,}/g, " ").trim();
    const areaMap = [
      ["apgujeong", "Apgujeong"],
      ["\uC555\uAD6C\uC815", "Apgujeong"],
      ["cheongdam", "Cheongdam"],
      ["\uCCAD\uB2F4", "Cheongdam"],
      ["sinsa", "Sinsa"],
      ["\uC2E0\uC0AC", "Sinsa"],
      ["\uAC00\uB85C\uC218\uAE38", "Sinsa"],
      ["gangnam", "Gangnam"],
      ["\uAC15\uB0A8", "Gangnam"],
      ["\uC5ED\uC0BC", "Gangnam"],
      ["\uC120\uB989", "Gangnam"],
      ["seocho", "Seocho"],
      ["\uC11C\uCD08", "Seocho"],
      ["hongdae", "Hongdae"],
      ["\uD64D\uB300", "Hongdae"],
      ["hapjeong", "Hapjeong"],
      ["\uD569\uC815", "Hapjeong"],
      ["\uC0C1\uC218", "Hapjeong"],
      ["mapo", "Mapo"],
      ["\uB9C8\uD3EC", "Mapo"],
      ["itaewon", "Itaewon"],
      ["\uC774\uD0DC\uC6D0", "Itaewon"],
      ["\uD55C\uB0A8", "Itaewon"],
      ["yongsan", "Yongsan"],
      ["\uC6A9\uC0B0", "Yongsan"],
      ["myeongdong", "Myeongdong"],
      ["\uBA85\uB3D9", "Myeongdong"],
      ["jongno", "Jongno"],
      ["\uC885\uB85C", "Jongno"],
      ["\uC778\uC0AC\uB3D9", "Jongno"],
      ["dongdaemun", "Dongdaemun"],
      ["\uB3D9\uB300\uBB38", "Dongdaemun"],
      ["seongsu", "Seongsu"],
      ["\uC131\uC218", "Seongsu"],
      ["\uC131\uB3D9", "Seongsu"],
      ["jamsil", "Jamsil"],
      ["\uC7A0\uC2E4", "Jamsil"],
      ["songpa", "Songpa"],
      ["\uC1A1\uD30C", "Songpa"],
      ["yeouido", "Yeouido"],
      ["\uC5EC\uC758\uB3C4", "Yeouido"],
      ["sinchon", "Sinchon"],
      ["\uC2E0\uCD0C", "Sinchon"]
    ];
    const detectLocation = (text) => {
      const t = text.toLowerCase();
      for (const [kw, val] of areaMap) {
        if (t.includes(kw.toLowerCase())) return `${val}, Seoul`;
      }
      return "Seoul";
    };
    const buildEngAddress = (comps2, fallbackAddr) => {
      const get = (...types) => {
        const c2 = comps2.find((x) => types.some((t) => x.types?.includes(t)));
        if (!c2) return "";
        const lt = c2.longText || "", st = c2.shortText || "";
        return !isKorean(lt) ? lt : !isKorean(st) ? st : "";
      };
      const streetNum = get("street_number");
      const route = get("route");
      const sub4 = get("sublocality_level_4");
      const sub3 = get("sublocality_level_3");
      const sub2 = get("sublocality_level_2");
      const sub1 = get("sublocality_level_1");
      const district = get("administrative_area_level_2", "locality");
      const province = get("administrative_area_level_1");
      const street = [streetNum, route].filter(Boolean).join(" ") || [sub4, sub3, sub2].filter(Boolean).join(" ");
      const neighborhood = sub1;
      const parts = [street, neighborhood, district, province, "South Korea"].filter(Boolean);
      const candidate = parts.join(", ");
      if (isKorean(candidate)) {
        const stripped = stripKorean(fallbackAddr);
        return stripped || "Seoul, South Korea";
      }
      return candidate || stripKorean(fallbackAddr) || "Seoul, South Korea";
    };
    const FIELD_MASK_DETAILS = [
      "id",
      "displayName",
      "formattedAddress",
      "shortFormattedAddress",
      "addressComponents",
      "regularOpeningHours",
      "rating",
      "userRatingCount",
      "reviews",
      "photos",
      "websiteUri",
      "internationalPhoneNumber",
      "editorialSummary",
      "primaryType",
      "types"
    ].join(",");
    const FIELD_MASK_SEARCH = FIELD_MASK_DETAILS.split(",").map((f) => "places." + f).join(",");
    const fetchPlaceById = async (pid) => {
      const r = await fetch(`https://places.googleapis.com/v1/places/${pid}?languageCode=en`, {
        headers: { "X-Goog-Api-Key": GOOGLE_PLACES_KEY, "X-Goog-FieldMask": FIELD_MASK_DETAILS }
      });
      if (!r.ok) throw new Error("Place Details error: " + r.status);
      return r.json();
    };
    const detectCategory = (primaryType, types) => {
      const all = [primaryType, ...types || []].map((t) => t.toLowerCase());
      if (all.some((t) => ["beauty_salon", "hair_care", "hair_salon", "barber_shop"].includes(t))) return "hair";
      if (all.some((t) => ["nail_salon"].includes(t))) return "nail";
      if (all.some((t) => ["spa", "massage", "sauna"].includes(t))) return "spa";
      if (all.some((t) => ["doctor", "hospital", "medical_lab", "physiotherapist", "skin_care", "plastic_surgeon", "dermatologist"].includes(t))) return "clinic";
      if (all.some((t) => ["makeup_artist"].includes(t))) return "makeup";
      return "";
    };
    let place;
    if (directPlaceId) {
      place = await fetchPlaceById(directPlaceId);
    } else {
      if (!query) return c.json({ error: "query or placeId required" }, 400);
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": FIELD_MASK_SEARCH
        },
        body: JSON.stringify({ textQuery: query, languageCode: "en" })
      });
      if (!searchRes.ok) {
        const err = await searchRes.text();
        return c.json({ error: "Places API error", detail: err }, 500);
      }
      const sd = await searchRes.json();
      place = sd.places?.[0];
      if (!place) return c.json({ error: "No place found" }, 404);
    }
    const rawDisplayName = place.displayName?.text || "";
    const nameParts = rawDisplayName.split(/[|｜]/).map((s) => s.trim()).filter(Boolean);
    const engName = nameParts.find((s) => !isKorean(s) && s.length > 0) || (() => {
      const stripped = stripKorean(rawDisplayName);
      return stripped.length > 1 ? stripped : "";
    })() || rawDisplayName;
    const comps = place.addressComponents || [];
    const engAddress = buildEngAddress(comps, place.formattedAddress || "");
    const sub1Comp = comps.find((x) => x.types?.includes("sublocality_level_1"));
    const sub2Comp = comps.find((x) => x.types?.includes("sublocality_level_2"));
    const sub1Text = sub1Comp?.longText || sub1Comp?.shortText || "";
    const sub2Text = sub2Comp?.longText || sub2Comp?.shortText || "";
    const location = detectLocation(sub2Text) !== "Seoul" ? detectLocation(sub2Text) : detectLocation(sub1Text) !== "Seoul" ? detectLocation(sub1Text) : detectLocation(engAddress) !== "Seoul" ? detectLocation(engAddress) : detectLocation(place.formattedAddress || "");
    const weekdays = place.regularOpeningHours?.weekdayDescriptions || [];
    const hoursStr = weekdays.join(" | ");
    const description = place.editorialSummary?.text || "";
    const suggestedCategory = detectCategory(place.primaryType || "", place.types || []);
    const rawReviews = place.reviews || [];
    const enReviews = rawReviews.filter((r) => r.text?.languageCode === "en" && (r.text?.text?.length || 0) > 20);
    const otherReviews = rawReviews.filter((r) => r.text?.languageCode !== "en" && (r.text?.text?.length || 0) > 20);
    const reviews = [...enReviews, ...otherReviews].slice(0, 5).map((r) => ({
      author: r.authorAttribution?.displayName || "Guest",
      rating: r.rating || 5,
      text: r.text?.text || "",
      time: r.relativePublishTimeDescription || ""
    }));
    const rawPhotos = place.photos || [];
    const photos = rawPhotos.slice(0, 10).map((p) => {
      const name = encodeURIComponent(p.name || "");
      return `/api/photo?name=${name}`;
    });
    return c.json({
      placeId: place.id || "",
      name: engName,
      address: engAddress,
      location,
      phone: place.internationalPhoneNumber || "",
      website: place.websiteUri || "",
      hours: hoursStr,
      weekdayDescriptions: weekdays,
      description,
      suggestedCategory,
      primaryType: place.primaryType || "",
      rating: place.rating || 0,
      reviewCount: place.userRatingCount || 0,
      reviews,
      photos
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
app.post("/api/places-photos", async (c) => {
  try {
    const { placeId } = await c.req.json();
    if (!placeId) return c.json({ error: "placeId required" }, 400);
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "photos"
      }
    });
    if (!res.ok) return c.json({ error: "Places API error" }, 500);
    const data = await res.json();
    const rawPhotos = data.photos || [];
    const photos = rawPhotos.slice(0, 6).map((p) => {
      const name = encodeURIComponent(p.name || "");
      return `/api/photo?name=${name}`;
    });
    return c.json({ photos });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
app.get("/api/photo", async (c) => {
  const name = c.req.query("name") || "";
  if (!name) return c.text("name required", 400);
  const cleanName = name.replace(/\/media$/, "");
  const apiUrl = `https://places.googleapis.com/v1/${cleanName}/media?key=${GOOGLE_PLACES_KEY}&maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true`;
  try {
    const res = await fetch(apiUrl);
    const ct = res.headers.get("content-type") || "";
    let imgUrl = "";
    if (ct.includes("application/json")) {
      const json = await res.json();
      imgUrl = json.photoUri || "";
    } else if (res.ok) {
      const buf2 = await res.arrayBuffer();
      return new Response(buf2, {
        headers: { "Content-Type": ct || "image/jpeg", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" }
      });
    }
    if (!imgUrl) return c.text("no photo uri", 502);
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return c.text("img fetch failed: " + imgRes.status, 502);
    const buf = await imgRes.arrayBuffer();
    const imgCt = imgRes.headers.get("content-type") || "image/jpeg";
    return new Response(buf, {
      headers: {
        "Content-Type": imgCt,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return c.text("proxy error: " + e.message, 500);
  }
});
app.post("/api/admin/fix-slugs", async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT id, name, location, slug FROM shops ORDER BY created_at ASC`;
  const results = [];
  for (const row of rows) {
    const base = (function() {
      let b = "";
      for (let i = 0; i < (row.name || "").length; i++) {
        const ch = (row.name[i] || "").toLowerCase();
        b += ch >= "a" && ch <= "z" || ch >= "0" && ch <= "9" ? ch : "-";
      }
      b = b.replace(/-+/g, "-").replace(/^-|-$/g, "") || "shop";
      const areaRaw = (row.location || "").split(",")[0].trim();
      let area = "";
      for (let i = 0; i < areaRaw.length; i++) {
        const ch = areaRaw[i].toLowerCase();
        area += ch >= "a" && ch <= "z" ? ch : "-";
      }
      area = area.replace(/-+/g, "-").replace(/^-|-$/g, "");
      return area ? `${b}-${area}` : b;
    })();
    const conflict = await sql`SELECT slug FROM shops WHERE slug=${base} AND id!=${row.id}`;
    let newSlug = base;
    if (conflict.length > 0) {
      for (let n = 2; n <= 99; n++) {
        const s = `${base}-${n}`;
        const c2 = await sql`SELECT slug FROM shops WHERE slug=${s} AND id!=${row.id}`;
        if (!c2.length) {
          newSlug = s;
          break;
        }
      }
    }
    if (newSlug !== row.slug) {
      await sql`UPDATE shops SET slug=${newSlug} WHERE id=${row.id}`;
      results.push({ id: row.id, name: row.name, old: row.slug, new: newSlug });
    }
  }
  return c.json({ ok: true, updated: results.length, results });
});
app.post("/api/admin/regenerate-seo-all", async (c) => {
  const sql = getDb();
  const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || "";
  if (!apiKey) return c.json({ error: "API key not configured" }, 500);
  const force = c.req.query("force") === "true";
  let rows = [];
  try {
    rows = force ? await sql`SELECT * FROM shops WHERE active=true ORDER BY created_at ASC` : await sql`SELECT * FROM shops WHERE active=true AND (description IS NULL OR description='' OR meta_description IS NULL OR meta_description='') ORDER BY created_at ASC`;
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
  const results = [];
  for (const row of rows) {
    const shop = rowToShop(row);
    try {
      const seo = await autoGenSeo({
        name: shop.name,
        category: shop.category,
        location: shop.location,
        services: shop.services,
        priceRange: shop.priceRange,
        rating: shop.rating,
        reviewCount: shop.reviewCount
      }, apiKey);
      if (!seo) {
        results.push({ id: shop.id, name: shop.name, status: "skipped (api fail)" });
        continue;
      }
      await sql`UPDATE shops SET
        description   = ${seo.description || shop.description},
        meta_description = ${seo.metaDescription || ""},
        seo_keywords  = ${Array.isArray(seo.keywords) ? seo.keywords.join(", ") : ""}
        WHERE id = ${shop.id}`;
      results.push({ id: shop.id, name: shop.name, status: "updated" });
    } catch (e) {
      results.push({ id: shop.id, name: shop.name, status: "error: " + e.message });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return c.json({ total: rows.length, results });
});
app.get("/shop/:slug", async (c) => {
  const sql = getDb();
  const shopRows = await sql`SELECT * FROM shops WHERE slug=${c.req.param("slug")}`;
  if (!shopRows.length) return c.notFound();
  const shop = rowToShop(shopRows[0]);
  const vidRows = await sql`SELECT * FROM videos WHERE shop_id=${shop.id} ORDER BY views DESC`;
  const shopVideos = vidRows.map((r) => rowToVideo({ ...r, shop_name: shop.name }));
  const relatedRows = await sql`
    SELECT id, name, slug, category, location, thumbnail, rating, review_count, description
    FROM shops
    WHERE category=${shop.category} AND id != ${shop.id} AND slug IS NOT NULL
    ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
    LIMIT 6`;
  const relatedShops = relatedRows.map((r) => rowToShop(r));
  const shopArea = shop.location ? ` (${shop.location.split(",")[0].trim()})` : "";
  const waMsg = encodeURIComponent(`[ Booking Request ]
Shop: ${shop.name}${shopArea}

Date: 
Time: 
Service: 
Name: 
People: `);
  const waUrl = `https://wa.me/${PLATFORM.whatsapp}?text=${waMsg}`;
  const base = "https://seoulbeautytrip.com";
  const canonicalUrl = `${base}/shop/${shop.slug}`;
  const ogImage = shop.thumbnail ? shop.thumbnail.startsWith("http") ? shop.thumbnail : `${base}${shop.thumbnail}` : `${base}/og-cover.jpg`;
  const catEmoji = { skincare: "\u{1F33F}", makeup: "\u{1F48B}", hair: "\u{1F487}", headspa: "\u{1F9D6}", nail: "\u{1F485}", clinic: "\u{1F3E5}" };
  const catIcon = catEmoji[shop.category] || "\u2728";
  return c.html(`<!DOCTYPE html>
<html lang="en" itemscope itemtype="https://schema.org/LocalBusiness">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${shop.name} | ${shop.location.split(",")[0].trim()} ${shop.category.charAt(0).toUpperCase() + shop.category.slice(1)} Seoul | Seoul Beauty Trip</title>
<meta name="description" content="${(shop.metaDescription || shop.description || `${shop.name} is a top-rated ${shop.category} salon in ${shop.location.split(",")[0].trim()}, Seoul. English-friendly service. Book via WhatsApp.`).slice(0, 155)}">
<meta name="keywords" content="${shop.seoKeywords || [shop.name, shop.name + " Seoul", shop.name + " " + shop.category, shop.name + " booking", shop.name + " review", shop.name + " foreigner", "best " + shop.category + " " + shop.location.split(",")[0].trim() + " Seoul", shop.category + " Seoul foreigners", "English speaking " + shop.category + " Seoul", "Korean " + shop.category + " Seoul", ...shop.services.slice(0, 3)].join(", ")}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<!-- Open Graph -->
<meta property="og:type" content="business.business">
<meta property="og:title" content="${shop.name} | Seoul Beauty Trip">
<meta property="og:description" content="${shop.description.slice(0, 155)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${shop.name} | Seoul Beauty Trip">
<meta name="twitter:description" content="${shop.description.slice(0, 155)}">
<meta name="twitter:image" content="${ogImage}">
<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":["LocalBusiness","BeautySalon"],
      "@id":"${canonicalUrl}",
      "name":"${shop.name}",
      "description":"${(shop.description || "").replace(/"/g, "'")}",
      "image":["${ogImage}"${shop.photos && shop.photos.length ? "," + shop.photos.map((p) => `"${p.startsWith("http") ? p : base + p}"`).join(",") : ""}],
      "url":"${canonicalUrl}",
      "address":{
        "@type":"PostalAddress",
        "streetAddress":"${shop.address.replace(/"/g, "'")}",
        "addressLocality":"${shop.location.split(",")[0].trim()}",
        "addressRegion":"Seoul",
        "addressCountry":"KR"
      },
      "geo":{
        "@type":"GeoCoordinates",
        "latitude":"${shop.lat || ""}",
        "longitude":"${shop.lng || ""}"
      },
      "openingHours":"${shop.hours.replace(/"/g, "'")}",
      "priceRange":"${shop.priceRange}",
      "currenciesAccepted":"KRW",
      "paymentAccepted":"Cash, Credit Card",
      "areaServed":{"@type":"City","name":"Seoul"},
      "aggregateRating":{
        "@type":"AggregateRating",
        "ratingValue":"${shop.rating}",
        "bestRating":"5",
        "worstRating":"1",
        "reviewCount":"${Math.max(shop.reviewCount, 1)}"
      },
      "hasOfferCatalog":{
        "@type":"OfferCatalog",
        "name":"${shop.category} Services at ${shop.name}",
        "itemListElement":[${shop.servicePrices.map((sp, i) => `{"@type":"Offer","position":${i + 1},"name":"${sp.name}","price":"${sp.price}","priceCurrency":"KRW","availability":"https://schema.org/InStock"}`).join(",")}]
      },
      "contactPoint":{
        "@type":"ContactPoint",
        "contactType":"reservations",
        "availableLanguage":["English","Korean"]
      },
      "sameAs":[
        "https://seoulbeautytrip.com/shop/${shop.slug}",
        ${shop.googlePlaceId ? `"https://maps.google.com/?cid=${shop.googlePlaceId}",` : ""}
        ${shop.googlePlaceId ? `"https://www.google.com/maps/place/?q=place_id:${shop.googlePlaceId}",` : ""}
        "https://www.instagram.com/seoulbeautytrip/"
      ],
      "keywords":"${shop.name}, ${shop.name} Seoul, ${shop.name} ${shop.category}, ${shop.name} booking, ${shop.name} review, ${shop.name} foreigners, best ${shop.category} ${shop.location.split(",")[0].trim()} Seoul, ${shop.category} Seoul English, ${shop.category} Seoul foreigners"
    },
    {
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"Seoul Beauty Trip","item":"${base}/"},
        {"@type":"ListItem","position":2,"name":"${shop.category.charAt(0).toUpperCase() + shop.category.slice(1)}","item":"${base}/?cat=${shop.category}"},
        {"@type":"ListItem","position":3,"name":"${shop.name}","item":"${canonicalUrl}"}
      ]
    },
    {
      "@type":"FAQPage",
      "mainEntity":[
        {
          "@type":"Question",
          "name":"Does ${shop.name} have English-speaking staff?",
          "acceptedAnswer":{"@type":"Answer","text":"Yes, ${shop.name} in ${shop.location.split(",")[0].trim()}, Seoul is foreigner-friendly and supports English communication for bookings and consultations."}
        },
        {
          "@type":"Question",
          "name":"How do I book at ${shop.name}?",
          "acceptedAnswer":{"@type":"Answer","text":"You can book ${shop.name} easily via WhatsApp through Seoul Beauty Trip. We handle all communication in English for you."}
        },
        {
          "@type":"Question",
          "name":"What services does ${shop.name} offer?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.name} offers ${shop.services.slice(0, 5).join(", ")}${shop.services.length > 5 ? " and more" : ""} in ${shop.location.split(",")[0].trim()}, Seoul."}
        },
        {
          "@type":"Question",
          "name":"What are ${shop.name}'s opening hours?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.hours ? shop.hours.replace(/"/g, "'").split("|")[0].trim() : "Please contact us for current opening hours."}"}
        },
        {
          "@type":"Question",
          "name":"How much does ${shop.name} cost?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.priceRange ? "Prices at " + shop.name + " start from " + shop.priceRange + ". Contact us via WhatsApp for exact pricing." : "Contact " + shop.name + " via WhatsApp through Seoul Beauty Trip for current pricing information."}"}
        }
      ]
    },
    ${shop.reviews && shop.reviews.length > 0 ? `{
      "@type":"ItemList",
      "name":"Reviews of ${shop.name}",
      "itemListElement":[${shop.reviews.slice(0, 3).map((r, i) => `{
        "@type":"ListItem","position":${i + 1},
        "item":{
          "@type":"Review",
          "author":{"@type":"Person","name":"${(r.author || "Guest").replace(/"/g, "'")}"},
          "reviewRating":{"@type":"Rating","ratingValue":"${r.rating || 5}","bestRating":"5"},
          "reviewBody":"${(r.text || "").replace(/"/g, "'").slice(0, 200)}",
          "itemReviewed":{"@type":"LocalBusiness","name":"${shop.name}"}
        }
      }`).join(",")}]
    },` : ""}
    {
      "@type":"WebPage",
      "@id":"${canonicalUrl}#webpage",
      "url":"${canonicalUrl}",
      "name":"${shop.name} | ${shop.location.split(",")[0].trim()} ${shop.category.charAt(0).toUpperCase() + shop.category.slice(1)} Seoul",
      "description":"${(shop.description || "").replace(/"/g, "'").slice(0, 155)}",
      "inLanguage":"en",
      "isPartOf":{"@id":"${base}/#website"},
      "primaryImageOfPage":{"@type":"ImageObject","url":"${shop.thumbnail}"}
    }
  ]
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;
  --gold:#C9A84C;--gold2:#F0C96E;
  --bg:#08080E;--bg2:#0F0F1A;--bg3:#161625;
  --cd:#1A1A2E;--cd2:#1F1F35;
  --border:rgba(255,255,255,.07);
  --ff-serif:'Playfair Display',serif;
  --ff-sans:'Inter',sans-serif;
}
body{background:var(--bg);color:#fff;font-family:var(--ff-sans);min-height:100vh}
/* NAV */
.sp-nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(8,8,14,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.sp-nav-logo{font-family:var(--ff-serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,#fff,var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.sp-nav-back{display:flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid var(--border);border-radius:20px;color:rgba(255,255,255,.6);font-size:12px;font-weight:600;text-decoration:none;transition:all .2s;background:rgba(255,255,255,.04)}
.sp-nav-back:hover{color:#fff;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
/* HERO */
.sp-hero{position:relative;height:320px;overflow:hidden}
.sp-hero-img{width:100%;height:100%;object-fit:cover}
.sp-hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,8,14,.1) 0%,transparent 30%,rgba(8,8,14,.6) 65%,var(--bg) 100%)}
.sp-hero-info{position:absolute;bottom:0;left:0;right:0;padding:24px 20px 20px}
.sp-cat-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 13px;border-radius:20px;background:rgba(232,65,122,.18);border:1px solid rgba(232,65,122,.35);font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--pk3);margin-bottom:8px;backdrop-filter:blur(8px)}
.sp-title{font-family:var(--ff-serif);font-size:26px;font-weight:700;line-height:1.2;margin-bottom:6px;text-shadow:0 2px 20px rgba(0,0,0,.8)}
.sp-loc{display:flex;align-items:center;gap:5px;font-size:13px;color:rgba(255,255,255,.65);margin-bottom:6px}
.sp-rating{display:flex;align-items:center;gap:6px}
.sp-stars{color:var(--gold);font-size:13px;letter-spacing:1px}
.sp-rating-num{font-size:12px;color:rgba(255,255,255,.55)}
/* GALLERY */
.sp-gallery{display:flex;gap:8px;overflow-x:auto;padding:16px 20px;scrollbar-width:none;background:var(--bg)}
.sp-gallery::-webkit-scrollbar{display:none}
.sp-gthumb{flex-shrink:0;width:72px;height:72px;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color .2s}
.sp-gthumb.active,.sp-gthumb:hover{border-color:var(--pk)}
.sp-gthumb img{width:100%;height:100%;object-fit:cover}
/* WRAP */
.sp-wrap{max-width:600px;margin:0 auto;padding:16px 20px 100px}
/* ACTION BTNS */
.sp-actions{display:flex;gap:10px;margin-bottom:20px}
.sp-wa{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;background:linear-gradient(135deg,#25D366,#0EA855);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,.3);transition:opacity .2s}
.sp-wa:hover{opacity:.9}
.sp-gmap{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;transition:opacity .2s}
.sp-gmap:hover{opacity:.9}
/* CARDS */
.sp-card{background:var(--cd);border:1px solid var(--border);border-radius:18px;padding:20px;margin-bottom:14px}
.sp-card-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.sp-info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:rgba(255,255,255,.75);line-height:1.5}
.sp-info-row i{color:var(--pk2);width:16px;flex-shrink:0;margin-top:2px}
/* SERVICES */
.sp-svc-tags{display:flex;flex-wrap:wrap;gap:7px}
.sp-svc-tag{padding:6px 13px;background:rgba(232,65,122,.08);border:1px solid rgba(232,65,122,.2);border-radius:20px;font-size:12px;color:var(--pk3);font-weight:600}
/* PRICE LIST */
.sp-price-list{display:flex;flex-direction:column;gap:0}
.sp-price-item{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.sp-price-item:last-child{border-bottom:none}
.sp-price-name{font-size:13px;color:rgba(255,255,255,.8);font-weight:500}
.sp-price-val{font-size:13px;color:var(--gold);font-weight:800}
/* MAP */
.sp-map{border-radius:14px;overflow:hidden;height:200px;border:1px solid var(--border)}
.sp-map iframe{width:100%;height:100%;border:0;display:block}
.sp-map-link{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#60a5fa;text-decoration:none}
.sp-map-link:hover{color:#93c5fd}
/* VIDEOS */
.sp-vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-vid-card{border-radius:14px;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16;background:#000}
.sp-vid-inner{position:absolute;inset:0;border-radius:14px;overflow:hidden}
.sp-vid-poster{transition:opacity .35s}
.sp-vid-card.vid-on .sp-vid-poster{opacity:0}
.sp-vid-card img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.sp-vid-card:hover img{transform:scale(1.04)}
.sp-vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.85) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:12px 10px}
.sp-vid-card-title{font-size:11px;font-weight:700;line-height:1.3;color:#fff}
.sp-vid-views{font-size:10px;color:rgba(255,255,255,.55);margin-top:3px}
.sp-play-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(232,65,122,.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
/* FLOAT BTN */
.sp-float{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;white-space:nowrap}
.sp-float a{display:flex;align-items:center;gap:9px;padding:15px 36px;background:linear-gradient(135deg,#25D366,#0EA855);border-radius:30px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 28px rgba(37,211,102,.45)}
/* \u2500\u2500 \uBE44\uC2B7\uD55C \uC5C5\uCCB4 \uCD94\uCC9C \u2500\u2500 */
.sp-related{padding:0 20px 0;margin-bottom:0}
.sp-related-title{font-size:13px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:7px}
.sp-related-title i{color:var(--pk2)}
.sp-rel-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-rel-card{display:block;text-decoration:none;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);transition:border-color .18s,transform .18s;position:relative}
.sp-rel-card:active{transform:scale(.97);border-color:rgba(232,65,122,.4)}
.sp-rel-thumb{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.sp-rel-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(8,8,14,.92) 100%)}
.sp-rel-info{position:absolute;bottom:0;left:0;right:0;padding:10px 10px 9px}
.sp-rel-name{font-size:12px;font-weight:800;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.sp-rel-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.sp-rel-loc{font-size:10px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:2px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-rel-rating{font-size:10px;color:#F59E0B;font-weight:700;display:flex;align-items:center;gap:2px;flex-shrink:0}
</style>
</head>
<body>
<nav class="sp-nav" itemscope itemtype="https://schema.org/SiteNavigationElement">
  <a href="/" class="sp-nav-logo" itemprop="url"><span itemprop="name">Seoul Beauty Trip</span></a>
  <a href="/" class="sp-nav-back"><i class="fas fa-arrow-left"></i> Catalog</a>
</nav>

<div class="sp-hero">
  <img class="sp-hero-img" src="${shop.thumbnail}" alt="${shop.name} \u2014 ${shop.location} ${shop.category}" itemprop="image">
  <div class="sp-hero-ov"></div>
  <div class="sp-hero-info">
    <div class="sp-cat-badge">${catIcon} ${shop.category.charAt(0).toUpperCase() + shop.category.slice(1)} \xB7 ${shop.location.split(",")[0].trim()} Seoul</div>
    <h1 class="sp-title" itemprop="name">${shop.name}</h1>
    <div class="sp-loc"><i class="fas fa-map-marker-alt" style="color:var(--pk)"></i><span itemprop="addressLocality">${shop.location}, Seoul</span></div>
    <div class="sp-rating">
      <span class="sp-stars">\u2605\u2605\u2605\u2605\u2605</span>
      <span class="sp-rating-num" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
        <span itemprop="ratingValue">${shop.rating}</span> (<span itemprop="reviewCount">${shop.reviewCount}</span> reviews)
      </span>
    </div>
  </div>
</div>

${(() => {
    const allP = [shop.thumbnail, ...(shop.photos || []).filter((p) => p && p !== shop.thumbnail)];
    if (allP.length < 2) return "";
    const thumbs = allP.map((url, i) => `<div class="sp-gthumb${i === 0 ? " active" : ""}" onclick="setHero('${url}',this)"><img src="${url}" alt="${shop.name} photo ${i + 1}" loading="lazy"></div>`).join("");
    return `<div class="sp-gallery">${thumbs}</div>`;
  })()}

<div class="sp-wrap">
  <div class="sp-actions">
    <a href="${waUrl}" target="_blank" rel="noopener" class="sp-wa">
      <i class="fab fa-whatsapp" style="font-size:19px"></i> Book via WhatsApp
    </a>
  </div>

  <div class="sp-card">
    <div class="sp-card-title"><i class="fas fa-info-circle"></i> Info</div>
    ${shop.hours ? `<div class="sp-info-row"><i class="fas fa-clock"></i><span itemprop="openingHours">${shop.hours}</span></div>` : ""}
    ${shop.priceRange ? `<div class="sp-info-row"><i class="fas fa-tag"></i><span itemprop="priceRange">${shop.priceRange}</span></div>` : ""}
    ${shop.address ? `<div class="sp-info-row"><i class="fas fa-map-marker-alt"></i><span itemprop="address">${shop.address}</span></div>` : ""}
    ${shop.description ? `<div class="sp-info-row"><i class="fas fa-quote-left"></i><span itemprop="description">${shop.description}</span></div>` : ""}
  </div>

  ${shop.servicePrices && shop.servicePrices.length > 0 ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-list-ul"></i> Price List</div><div class="sp-price-list">${shop.servicePrices.map((p) => `<div class="sp-price-item"><span class="sp-price-name">${p.name}</span><span class="sp-price-val">${p.price}</span></div>`).join("")}</div></div>` : ""}

  ${shop.services && shop.services.length > 0 ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-spa"></i> Services</div><div class="sp-svc-tags">${shop.services.map((s) => `<span class="sp-svc-tag">${s}</span>`).join("")}</div></div>` : ""}

  ${(() => {
    const embedUrl = shop.googleMapEmbed || (shop.lat && shop.lng ? `https://maps.google.com/maps?q=${shop.lat},${shop.lng}&z=17&output=embed&hl=en` : "");
    return embedUrl ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-map"></i> Location</div><div class="sp-map"><iframe src="${embedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>` : shop.address ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-map"></i> Location</div><div style="padding:12px;font-size:13px;color:rgba(0,0,0,.7)"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>${shop.address}</div></div>` : "";
  })()}

  ${(() => {
    if (!shopVideos.length) return "";
    const cardsHtml = shopVideos.map((v, vi) => {
      const thumb = v.thumbnail || "";
      const vidUrl = v.videoUrl || "";
      const displayTitle = v.title && v.title !== shop.name ? v.title : shop.name;
      return '<div class="sp-vid-card" data-vid-url="' + vidUrl + '" data-vid-thumb="' + thumb + '" onclick="playSpVid(' + vi + ')">' + (vidUrl ? '<video class="sp-vid-inline" data-src="' + vidUrl + '" poster="' + thumb + '" loop muted playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;display:block"></video>' : "") + (thumb ? '<img class="sp-vid-poster" src="' + thumb + '" alt="' + displayTitle + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;transition:opacity .4s">' : '<div class="sp-vid-poster" style="position:absolute;inset:0;background:#111;border-radius:14px"></div>') + '<div class="sp-play-ic"><i class="fas fa-play" style="font-size:14px;color:#fff;margin-left:2px"></i></div><div class="sp-vid-card-ov"><div class="sp-vid-card-title">' + displayTitle + '</div><div class="sp-vid-views"><i class="fas fa-eye"></i> ' + (v.views >= 1e3 ? (v.views / 1e3).toFixed(1) + "K" : String(v.views || 0)) + "</div></div></div>";
    }).join("");
    return '<div class="sp-card"><div class="sp-card-title"><i class="fas fa-play-circle"></i> Videos (' + shopVideos.length + ')</div><div class="sp-vid-grid">' + cardsHtml + "</div></div>";
  })()}

  ${relatedShops.length > 0 ? `
  <div class="sp-related">
    <div class="sp-related-title"><i class="fas fa-th-large"></i> More ${shop.category.charAt(0).toUpperCase() + shop.category.slice(1)} in Seoul</div>
    <div class="sp-rel-grid">
      ${relatedShops.map((r) => {
    const rArea = (r.location || "").split(",")[0].trim();
    const rRating = r.rating ? `<span class="sp-rel-rating"><i class="fas fa-star" style="font-size:8px"></i>${Number(r.rating).toFixed(1)}</span>` : "";
    const rThumb = r.thumbnail || "";
    return `<a class="sp-rel-card" href="/shop/${r.slug}">
          ${rThumb ? `<img class="sp-rel-thumb" src="${rThumb}" alt="${r.name}" loading="lazy">` : `<div class="sp-rel-thumb" style="background:#111"></div>`}
          <div class="sp-rel-ov"></div>
          <div class="sp-rel-info">
            <div class="sp-rel-name">${r.name}</div>
            <div class="sp-rel-meta">
              <span class="sp-rel-loc"><i class="fas fa-map-marker-alt" style="font-size:7px;color:#FF4D8D"></i>${rArea}</span>
              ${rRating}
            </div>
          </div>
        </a>`;
  }).join("")}
    </div>
  </div>` : ""}

  <div style="height:100px"></div>
</div>

<div class="sp-float">
  <a href="${waUrl}" target="_blank" rel="noopener">
    <i class="fab fa-whatsapp" style="font-size:20px"></i> Book via WhatsApp
  </a>
</div>

<script>
// \uB4A4\uB85C\uAC00\uAE30: \uC774\uC804 \uD398\uC774\uC9C0\uAC00 \uAC19\uC740 \uC0AC\uC774\uD2B8\uBA74 history.back(), \uC544\uB2C8\uBA74 \uBA54\uC778\uC73C\uB85C
function goBack(){
  // history\uAC00 2\uAC1C \uC774\uC0C1\uC774\uBA74 \uC774\uC804 \uD398\uC774\uC9C0\uB85C, \uC544\uB2C8\uBA74 \uBA54\uC778\uC73C\uB85C
  if(window.history.length > 1){
    window.history.back();
  } else {
    location.href = '/';
  }
}

function setHero(url, el) {
  document.querySelector('.sp-hero-img').src = url;
  document.querySelectorAll('.sp-gthumb').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
}

/* \u2500\u2500 sp-vid-card: \uD398\uC774\uC9C0 \uB85C\uB4DC \uC989\uC2DC + \uC2A4\uD06C\uB864 \uC9C4\uC785\uC2DC \uC790\uB3D9\uC7AC\uC0DD (\uC1FC\uCE20/\uB9B4\uC2A4 \uBC29\uC2DD) \u2500\u2500 */
(function(){
  function startVid(card){
    var vid = card.querySelector('.sp-vid-inline');
    var poster = card.querySelector('.sp-vid-poster');
    if(!vid) return;
    if(vid.dataset.src && !vid.dataset.loaded){
      vid.dataset.loaded = '1';
      vid.src = vid.dataset.src;
    }
    vid.muted = true;
    var p = vid.play();
    if(p && p.then) p.then(function(){
      card.classList.add('vid-on');
      if(poster) poster.style.opacity = '0';
    }).catch(function(){});
  }
  function stopVid(card){
    var vid = card.querySelector('.sp-vid-inline');
    var poster = card.querySelector('.sp-vid-poster');
    if(vid){ vid.pause(); }
    card.classList.remove('vid-on');
    if(poster) poster.style.opacity = '1';
  }
  function initVidCards(){
    var cards = document.querySelectorAll('.sp-vid-card');
    if(!cards.length) return;
    if(window.IntersectionObserver){
      var obs = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting) startVid(entry.target);
          else stopVid(entry.target);
        });
      },{threshold: 0.2, rootMargin:'0px'});
      cards.forEach(function(c){ obs.observe(c); });
    } else {
      cards.forEach(function(c){ startVid(c); });
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initVidCards);
  } else {
    initVidCards();
  }
})();

// \uC601\uC0C1 \uCE74\uB4DC \uD074\uB9AD \u2192 \uC804\uCCB4\uD654\uBA74 \uD31D\uC5C5 (\uC18C\uB9AC \uC788\uC74C)
function playSpVid(idx){
  var cards = document.querySelectorAll('.sp-vid-card');
  var card  = cards[idx];
  if(!card) return;
  var vidUrl = card.getAttribute('data-vid-url');
  var thumb  = card.getAttribute('data-vid-thumb');
  if(!vidUrl) return;

  // \uAE30\uC874 \uD31D\uC5C5 \uC81C\uAC70
  var old = document.getElementById('sp-vid-ov');
  if(old) old.remove();

  var ov = document.createElement('div');
  ov.id = 'sp-vid-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center';
  ov.innerHTML =
    '<div style="position:relative;width:min(92vw,420px);aspect-ratio:9/16">'
    +'<video src="'+vidUrl+'"'+(thumb?' poster="'+thumb+'"':'')
    +' autoplay loop playsinline controls'
    +' style="width:100%;height:100%;border-radius:16px;object-fit:cover;background:#000"></video>'
    +'<button id="sp-vid-ov-close"'
    +' style="position:absolute;top:-44px;right:0;width:36px;height:36px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:50%;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">&#10005;</button>'
    +'</div>';
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
  document.getElementById('sp-vid-ov-close').addEventListener('click', function(){ ov.remove(); });
  var vid = ov.querySelector('video');
  if(vid){
    vid.muted = false; // \uC18C\uB9AC \uCF1C\uAE30
    vid.play().catch(function(){ vid.muted=true; vid.play().catch(function(){}); });
  }
}
</script>
</body>
</html>`);
});
var CATEGORY_LABELS = {
  skincare: "Skincare",
  makeup: "Makeup",
  hair: "Hair Salon",
  headspa: "Head Spa",
  nail: "Nail Salon",
  clinic: "Skin Clinic",
  spa: "Spa & Massage"
};
var AREA_LABELS = {
  gangnam: "Gangnam",
  hongdae: "Hongdae",
  itaewon: "Itaewon",
  myeongdong: "Myeongdong",
  sinchon: "Sinchon",
  mapo: "Mapo",
  jongno: "Jongno",
  dongdaemun: "Dongdaemun",
  insadong: "Insadong",
  apgujeong: "Apgujeong",
  yeouido: "Yeouido",
  seoul: "Seoul"
};
var CAT_FAQ = {
  headspa: [
    { q: "What is a Korean head spa?", a: "A Korean head spa is a therapeutic scalp and hair treatment combining deep cleansing, massage, and nourishing treatments. It relieves stress, improves scalp health, and promotes hair growth \u2014 popular among tourists in Seoul." },
    { q: "How much does a head spa cost in Seoul?", a: "Head spa prices in Seoul typically range from \u20A950,000 to \u20A9150,000 depending on the salon and treatment duration. Most sessions last 60\u201390 minutes." },
    { q: "Do Seoul head spas have English-speaking staff?", a: "Many head spas in tourist areas like Gangnam, Hongdae, and Itaewon have English-speaking staff or translation support. Seoul Beauty Trip only lists foreigner-friendly salons." },
    { q: "Do I need to book a head spa in Seoul in advance?", a: "Yes, booking in advance is strongly recommended, especially on weekends. You can book via WhatsApp through Seoul Beauty Trip with English support." },
    { q: "What should I expect at a Korean head spa?", a: "Expect a consultation, scalp analysis, deep cleansing shampoo, relaxing massage, and nourishing treatment. Some salons also include a facial massage or aromatherapy." }
  ],
  skincare: [
    { q: "What makes Korean skincare treatments special?", a: "Korean skincare focuses on hydration, brightening, and glass-skin techniques using advanced ingredients like snail mucin, hyaluronic acid, and fermented extracts \u2014 not commonly found elsewhere." },
    { q: "How much do Korean facial treatments cost in Seoul?", a: "Facial treatments in Seoul range from \u20A950,000 to \u20A9300,000. Basic hydrafacials start around \u20A980,000 while advanced treatments like laser or RF cost more." },
    { q: "Are Seoul skin clinics safe for foreigners?", a: "Yes. Seoul skin clinics are among the most advanced in the world with certified dermatologists. Seoul Beauty Trip lists only foreigner-friendly clinics with English support." },
    { q: "Can I walk in or do I need a reservation?", a: "Reservations are recommended to avoid waiting. Book via WhatsApp through Seoul Beauty Trip for same-day or advance appointments with English support." },
    { q: "What skin treatments are most popular among tourists in Seoul?", a: "Hydrafacial, LED therapy, glass skin facial, galvanic treatment, and Korean lymphatic massage are the most popular among foreign tourists." }
  ],
  hair: [
    { q: "Are Seoul hair salons experienced with non-Asian hair?", a: "Many hair salons in Seoul, especially in Gangnam and Itaewon, have stylists trained for various hair textures including Western, curly, and colored hair. Always inform the salon beforehand." },
    { q: "How much does a haircut cost in Seoul?", a: "A basic haircut in Seoul ranges from \u20A920,000 to \u20A980,000. Korean perms, balayage, and color treatments range from \u20A980,000 to \u20A9300,000+ depending on length." },
    { q: "Can I get a K-pop hairstyle in Seoul?", a: "Absolutely! Many Seoul hair salons specialize in K-pop inspired hairstyles including perms, bleaching, and trendy cuts seen on Korean celebrities." },
    { q: "Do Seoul hair salons speak English?", a: "Tourist-area salons in Gangnam, Hongdae, and Itaewon often have English-speaking staff. Seoul Beauty Trip lists only English-friendly salons for foreign visitors." },
    { q: "How long does a hair appointment take in Seoul?", a: "A basic cut takes 30\u201360 minutes. Color treatments and perms can take 2\u20134 hours. Book in advance especially on weekends." }
  ],
  nail: [
    { q: "What is Korean nail art?", a: "Korean nail art features intricate designs, minimalist aesthetics, and high-quality gel applications. Popular styles include gradient nails, 3D nail art, and character-themed designs." },
    { q: "How much does a nail appointment cost in Seoul?", a: "Basic gel manicures start from \u20A930,000. Full nail art designs range from \u20A950,000 to \u20A9150,000 depending on complexity and salon." },
    { q: "How long does a nail appointment take in Seoul?", a: "A simple gel manicure takes about 1 hour. Full nail art with intricate designs can take 2\u20133 hours." },
    { q: "Do I need to book a nail salon in Seoul in advance?", a: "Weekend bookings should be made 2\u20133 days in advance. Weekday slots are more flexible. Book via WhatsApp through Seoul Beauty Trip." },
    { q: "Are Korean nail salons foreigner-friendly?", a: "Many nail salons in tourist areas have English menus and picture references so you can easily show the design you want." }
  ],
  clinic: [
    { q: "Are Korean skin clinics good for foreigners?", a: "Yes, Seoul has world-class dermatology clinics with cutting-edge laser, RF, and injection treatments. Many clinics near Gangnam cater specifically to medical tourists." },
    { q: "Do I need a prescription for skin treatments in Seoul?", a: "Most aesthetic treatments like laser, peels, and facials do not require prescriptions. Injectable treatments like Botox require a consultation with a licensed doctor." },
    { q: "How much does a laser treatment cost in Seoul?", a: "Laser treatments in Seoul range from \u20A9100,000 to \u20A9500,000+ depending on the type and area treated. Korean clinics are often 30\u201350% cheaper than Western countries." },
    { q: "Is it safe to get skin treatments in Seoul as a tourist?", a: "Yes, Seoul clinics follow strict safety standards. Consult with the clinic about your skin type, medications, and any conditions before treatment." },
    { q: "What are popular clinic treatments among foreign tourists in Seoul?", a: "Laser toning, skin booster injections, chemical peels, RF lifting, and acne scar treatment are most popular among medical tourists visiting Seoul." }
  ],
  makeup: [
    { q: "What is a Korean makeup look?", a: "Korean makeup emphasizes natural, dewy skin, gradient lips, straight eyebrows, and a youthful glow. It differs from Western makeup by focusing on skin texture over heavy coverage." },
    { q: "Can I get a Korean makeup lesson in Seoul?", a: "Yes! Many makeup studios in Seoul offer tutorial sessions for tourists where you learn Korean makeup techniques and take home product recommendations." },
    { q: "How much does a makeup session cost in Seoul?", a: "Professional makeup applications range from \u20A950,000 to \u20A9150,000. Makeup lessons with a Korean artist typically cost \u20A980,000 to \u20A9200,000." },
    { q: "What occasions are Korean makeup services popular for?", a: "Korean makeup studios are popular for photoshoots, hanbok experiences, K-pop lookbooks, weddings, and just as a unique cultural experience in Seoul." },
    { q: "Do Seoul makeup artists speak English?", a: "Many makeup studios in Hongdae, Myeongdong, and Gangnam cater to foreign tourists and have English-speaking artists or booking support." }
  ],
  spa: [
    { q: "What types of spa treatments are available in Seoul?", a: "Seoul spas offer traditional Korean body scrub (Italy towel exfoliation), aromatherapy massage, hot stone therapy, traditional Korean jjimjilbang experience, and luxurious body wraps." },
    { q: "What is a Korean body scrub?", a: "The Korean body scrub (\uB54C\uBC00\uC774, ddaemiri) is a traditional exfoliation using a special Italy towel. It removes dead skin cells leaving skin remarkably smooth and is a uniquely Korean experience." },
    { q: "How much does a Korean spa cost in Seoul?", a: "Basic spa treatments start from \u20A950,000. Premium body treatments and full spa packages range from \u20A9100,000 to \u20A9300,000." },
    { q: "Are Seoul spas open to foreigners?", a: "Yes, most Seoul spas welcome foreigners. Seoul Beauty Trip lists spas with English booking support and foreigner-friendly service." },
    { q: "Should I book a spa in Seoul in advance?", a: "Yes, especially for weekend visits. Premium time slots fill quickly. Book via WhatsApp through Seoul Beauty Trip for easy English reservations." }
  ]
};
var DEFAULT_FAQ = [
  { q: "How do I book a beauty salon in Seoul as a foreigner?", a: "Seoul Beauty Trip makes it easy \u2014 browse shops, choose your service, and book via WhatsApp in English. No Korean language skills needed." },
  { q: "Are these salons English-friendly?", a: "Yes, all salons listed on Seoul Beauty Trip are verified to support foreign visitors with English communication for bookings." },
  { q: "How far in advance should I book?", a: "1\u20133 days in advance is recommended. Same-day bookings are sometimes available on weekdays." },
  { q: "What payment methods are accepted?", a: "Most salons accept credit cards and cash (Korean Won). Some also accept international cards like Visa and Mastercard." },
  { q: "Can I cancel or reschedule my booking?", a: "Yes. Contact us via WhatsApp and we will help reschedule or cancel depending on the salon's policy." }
];
app.get("/best/:category/:area", async (c) => {
  const catSlug = c.req.param("category").toLowerCase();
  const areaSlug = c.req.param("area").toLowerCase();
  const catLabel = CATEGORY_LABELS[catSlug];
  const areaLabel = AREA_LABELS[areaSlug];
  if (!catLabel || !areaLabel) return c.notFound();
  const sql = getDb();
  const base = "https://seoulbeautytrip.com";
  const pageUrl = `${base}/best/${catSlug}/${areaSlug}`;
  const areaForQuery = areaLabel;
  let shops2 = [];
  try {
    const rows = areaSlug === "seoul" ? await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} ORDER BY rating DESC, review_count DESC LIMIT 10` : await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} AND LOWER(location) LIKE ${("%" + areaLabel + "%").toLowerCase()} ORDER BY rating DESC, review_count DESC LIMIT 10`;
    shops2 = rows.map(rowToShop);
  } catch (e) {
  }
  const faqList = CAT_FAQ[catSlug] || DEFAULT_FAQ;
  const titleMain = `Best ${catLabel} in ${areaLabel} Seoul for Foreigners`;
  const metaDesc = `Top-rated ${catLabel.toLowerCase()} salons in ${areaLabel}, Seoul. English-friendly, foreigner-approved. Book via WhatsApp \u2014 no Korean needed. Updated ${(/* @__PURE__ */ new Date()).getFullYear()}.`;
  const h1Text = `Best ${catLabel} in ${areaLabel}, Seoul`;
  const subText = `Foreigner-Friendly | English Booking | Verified Reviews`;
  const catEmoji = { skincare: "\u{1F33F}", makeup: "\u{1F48B}", hair: "\u{1F487}", headspa: "\u{1F9D6}", nail: "\u{1F485}", clinic: "\u{1F3E5}", spa: "\u{1F6C1}" };
  const emoji = catEmoji[catSlug] || "\u2728";
  const schemaGraph = [
    // WebPage
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      "url": pageUrl,
      "name": titleMain,
      "description": metaDesc,
      "inLanguage": "en",
      "isPartOf": { "@id": `${base}/#website` }
    },
    // BreadcrumbList
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Seoul Beauty Trip", "item": `${base}/` },
        { "@type": "ListItem", "position": 2, "name": catLabel, "item": `${base}/?cat=${catSlug}` },
        { "@type": "ListItem", "position": 3, "name": `${catLabel} ${areaLabel}`, "item": pageUrl }
      ]
    },
    // ItemList — 업체 목록
    ...shops2.length > 0 ? [{
      "@type": "ItemList",
      "name": `Best ${catLabel} in ${areaLabel} Seoul`,
      "description": metaDesc,
      "numberOfItems": shops2.length,
      "itemListElement": shops2.map((s, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": ["LocalBusiness", "BeautySalon"],
          "@id": `${base}/shop/${s.slug}`,
          "name": s.name,
          "url": `${base}/shop/${s.slug}`,
          "image": s.thumbnail,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": s.address,
            "addressLocality": areaLabel,
            "addressRegion": "Seoul",
            "addressCountry": "KR"
          },
          ...s.lat && s.lng ? { "geo": { "@type": "GeoCoordinates", "latitude": s.lat, "longitude": s.lng } } : {},
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": String(s.rating),
            "bestRating": "5",
            "reviewCount": String(Math.max(s.reviewCount, 1))
          },
          "priceRange": s.priceRange,
          ...s.googlePlaceId ? { "sameAs": [`https://www.google.com/maps/place/?q=place_id:${s.googlePlaceId}`] } : {}
        }
      }))
    }] : [],
    // FAQPage
    {
      "@type": "FAQPage",
      "mainEntity": faqList.map((f) => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    }
  ];
  const shopCards = shops2.length > 0 ? shops2.map((s, i) => {
    const stars = "\u2B50".repeat(Math.round(s.rating));
    const desc = (s.metaDescription || s.description || "").slice(0, 120);
    return `
<article class="shop-card" itemscope itemtype="https://schema.org/LocalBusiness">
  <a href="/shop/${s.slug}" class="card-link">
    <div class="card-rank">#${i + 1}</div>
    <div class="card-img-wrap">
      <img src="${s.thumbnail}" alt="${s.name} ${catLabel} ${areaLabel} Seoul" loading="lazy" onerror="this.parentElement.remove()">
    </div>
    <div class="card-body">
      <h2 class="card-name" itemprop="name">${s.name}</h2>
      <div class="card-meta">
        <span class="card-area">\u{1F4CD} ${s.location}</span>
        <span class="card-rating">${stars} ${s.rating} (${s.reviewCount} reviews)</span>
      </div>
      <p class="card-desc" itemprop="description">${desc}</p>
      <div class="card-services">${s.services.slice(0, 3).map((sv) => `<span class="svc-tag">${sv}</span>`).join("")}</div>
      <div class="card-price">${s.priceRange}</div>
      <div class="card-cta">
        <span class="btn-view">View Details \u2192</span>
        <span class="btn-book">\u{1F4F1} Book via WhatsApp</span>
      </div>
    </div>
  </a>
</article>`;
  }).join("") : `<div class="no-shops"><p>No ${catLabel} shops listed in ${areaLabel} yet. <a href="/">Browse all Seoul beauty salons \u2192</a></p></div>`;
  const faqHtml = faqList.map((f, i) => `
<details class="faq-item" ${i === 0 ? "open" : ""}>
  <summary class="faq-q">${f.q}</summary>
  <div class="faq-a">${f.a}</div>
</details>`).join("");
  const relatedCats = Object.entries(CATEGORY_LABELS).filter(([k]) => k !== catSlug).map(([k, v]) => `<a href="/best/${k}/${areaSlug}" class="rel-link">${catEmoji[k] || "\u2728"} ${v} in ${areaLabel}</a>`).join("");
  const relatedAreas = Object.entries(AREA_LABELS).filter(([k]) => k !== areaSlug && k !== "seoul").slice(0, 6).map(([k, v]) => `<a href="/best/${catSlug}/${k}" class="rel-link">${emoji} ${catLabel} in ${v}</a>`).join("");
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleMain} ${(/* @__PURE__ */ new Date()).getFullYear()} | Seoul Beauty Trip</title>
<meta name="description" content="${metaDesc}">
<meta name="keywords" content="best ${catLabel.toLowerCase()} ${areaLabel} Seoul, ${catLabel.toLowerCase()} Seoul foreigners, ${catLabel.toLowerCase()} Seoul English, ${catLabel.toLowerCase()} ${areaLabel} tourists, foreigner friendly ${catLabel.toLowerCase()} Seoul, ${catLabel.toLowerCase()} Seoul booking, Korean ${catLabel.toLowerCase()} ${areaLabel}, ${catLabel.toLowerCase()} Seoul recommendation">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="${titleMain} | Seoul Beauty Trip">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${shops2[0]?.thumbnail ? shops2[0].thumbnail.startsWith("http") ? shops2[0].thumbnail : base + shops2[0].thumbnail : base + "/og-cover.jpg"}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleMain} | Seoul Beauty Trip">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${shops2[0]?.thumbnail || base + "/og-cover.jpg"}">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": schemaGraph })}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f8f9fa;color:#1a1a2e}
a{text-decoration:none;color:inherit}
/* NAV */
.nav{background:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 8px rgba(0,0,0,.08);position:sticky;top:0;z-index:100}
.nav-logo{font-size:1.1rem;font-weight:800;background:linear-gradient(135deg,#e91e8c,#9c27b0);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-back{font-size:.85rem;color:#666;margin-left:auto}
/* HERO */
.hero{background:linear-gradient(135deg,#e91e8c 0%,#9c27b0 50%,#3f51b5 100%);color:#fff;padding:48px 20px 56px;text-align:center}
.hero-emoji{font-size:3rem;margin-bottom:12px;display:block}
.hero-h1{font-size:clamp(1.5rem,5vw,2.4rem);font-weight:800;line-height:1.25;margin-bottom:10px}
.hero-sub{font-size:.95rem;opacity:.9;margin-bottom:20px}
.hero-badges{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.badge{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:20px;padding:4px 14px;font-size:.8rem;font-weight:600}
/* MAIN */
.main{max-width:900px;margin:0 auto;padding:24px 16px 60px}
.section-title{font-size:1.3rem;font-weight:700;margin:32px 0 16px;display:flex;align-items:center;gap:8px}
/* SHOP CARDS */
.shop-card{background:#fff;border-radius:16px;overflow:hidden;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.08);transition:transform .2s,box-shadow .2s;position:relative}
.shop-card:hover{transform:translateY(-3px);box-shadow:0 6px 24px rgba(233,30,140,.15)}
.card-link{display:flex;gap:0}
.card-rank{position:absolute;top:12px;left:12px;background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;z-index:2}
.card-img-wrap{width:140px;min-width:140px;overflow:hidden}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;min-height:160px}
.card-body{flex:1;padding:16px}
.card-name{font-size:1.05rem;font-weight:700;margin-bottom:6px;color:#1a1a2e}
.card-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:.8rem;color:#666;margin-bottom:8px}
.card-rating{color:#f59e0b;font-weight:600}
.card-desc{font-size:.85rem;color:#444;line-height:1.5;margin-bottom:10px}
.card-services{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.svc-tag{background:#f3e8ff;color:#7c3aed;border-radius:12px;padding:2px 10px;font-size:.75rem;font-weight:500}
.card-price{font-size:.85rem;color:#e91e8c;font-weight:600;margin-bottom:12px}
.card-cta{display:flex;gap:8px;flex-wrap:wrap}
.btn-view{background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;padding:7px 16px;border-radius:20px;font-size:.82rem;font-weight:600}
.btn-book{background:#25d366;color:#fff;padding:7px 16px;border-radius:20px;font-size:.82rem;font-weight:600}
/* NO SHOPS */
.no-shops{text-align:center;padding:60px 20px;color:#666}
.no-shops a{color:#e91e8c;text-decoration:underline}
/* FAQ */
.faq-item{background:#fff;border-radius:12px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06)}
.faq-q{padding:16px 20px;font-size:.95rem;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;color:#1a1a2e}
.faq-q::-webkit-details-marker{display:none}
.faq-q::after{content:'\u25BC';font-size:.7rem;color:#e91e8c;transition:transform .2s}
details[open] .faq-q::after{transform:rotate(180deg)}
.faq-a{padding:0 20px 16px;font-size:.88rem;color:#444;line-height:1.7;border-top:1px solid #f0f0f0;padding-top:12px}
/* RELATED */
.rel-grid{display:flex;flex-wrap:wrap;gap:8px}
.rel-link{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:6px 16px;font-size:.82rem;font-weight:500;color:#374151;transition:all .2s}
.rel-link:hover{background:#fdf2f8;border-color:#e91e8c;color:#e91e8c}
/* INTRO TEXT */
.intro-box{background:#fff;border-radius:16px;padding:24px;margin-bottom:8px;box-shadow:0 1px 8px rgba(0,0,0,.06);font-size:.9rem;line-height:1.8;color:#374151}
.intro-box strong{color:#e91e8c}
/* FOOTER */
.lp-footer{text-align:center;padding:32px 16px;font-size:.82rem;color:#999;border-top:1px solid #eee;margin-top:40px}
.lp-footer a{color:#e91e8c}
@media(max-width:520px){
  .card-link{flex-direction:column}
  .card-img-wrap{width:100%;min-width:unset;height:180px}
  .card-img-wrap img{min-height:180px}
}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">Seoul Beauty Trip</a>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> All Salons</a>
</nav>
<header class="hero">
  <span class="hero-emoji">${emoji}</span>
  <h1 class="hero-h1">${h1Text}</h1>
  <p class="hero-sub">${subText}</p>
  <div class="hero-badges">
    <span class="badge">\u{1F30D} Foreigner Friendly</span>
    <span class="badge">\u{1F4AC} English Booking</span>
    <span class="badge">\u2B50 Verified Reviews</span>
    <span class="badge">\u{1F4F1} WhatsApp Support</span>
  </div>
</header>
<main class="main">
  <div class="intro-box">
    Looking for the <strong>best ${catLabel.toLowerCase()} in ${areaLabel}, Seoul</strong>? 
    Seoul Beauty Trip has curated the top foreigner-friendly ${catLabel.toLowerCase()} salons in ${areaLabel} \u2014 all verified, English-booking supported, and loved by international tourists. 
    Whether you're visiting Seoul for K-beauty experiences or living here, book your ${catLabel.toLowerCase()} appointment via WhatsApp in English with zero hassle.
  </div>
  <div class="section-title">${emoji} Top ${catLabel} Salons in ${areaLabel} <span style="font-size:.85rem;font-weight:400;color:#888">(${shops2.length} listed)</span></div>
  ${shopCards}
  <div class="section-title">\u2753 FAQ \u2014 ${catLabel} in ${areaLabel} Seoul</div>
  <div>${faqHtml}</div>
  <div class="section-title">\u{1F50D} More ${catLabel} by Area</div>
  <div class="rel-grid">${relatedAreas}</div>
  <div class="section-title">\u{1F485} Other Beauty Services in ${areaLabel}</div>
  <div class="rel-grid">${relatedCats}</div>
</main>
<footer class="lp-footer">
  \xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} <a href="/">Seoul Beauty Trip</a> \u2014 Book Korean Beauty in Seoul for Foreigners
</footer>
</body>
</html>`);
});
app.get("/shops", async (c) => {
  const sql = getDb();
  const rows = await sql`SELECT * FROM shops WHERE active=true ORDER BY rating DESC, created_at DESC`;
  const shops2 = rows.map(rowToShop);
  const catColors = { skincare: "#f472b6", headspa: "#67e8f9", hair: "#60a5fa", nail: "#34d399", clinic: "#fb923c", makeup: "#c084fc", spa: "#a78bfa" };
  const catIcons = { skincare: "fa-leaf", makeup: "fa-magic", hair: "fa-cut", headspa: "fa-spa", nail: "fa-hand-sparkles", clinic: "fa-briefcase-medical", spa: "fa-hot-tub" };
  const cats = ["all", "skincare", "makeup", "hair", "headspa", "nail", "clinic", "spa"];
  const catLabels = { all: "All", skincare: "Skincare", makeup: "Makeup", hair: "Hair", headspa: "Head Spa", nail: "Nail", clinic: "Clinic", spa: "Spa" };
  const catCountMap = {};
  shops2.forEach((s) => {
    catCountMap[s.category] = (catCountMap[s.category] || 0) + 1;
  });
  const cardsHtml = shops2.map((shop) => {
    const col = catColors[shop.category] || "#aaa";
    const icon = catIcons[shop.category] || "fa-star";
    const href = shop.slug ? `/shop/${shop.slug}` : "#";
    const loc = (shop.location || "").split(",")[0].trim();
    const nameL = shop.name.toLowerCase().replace(/"/g, "");
    return `<a class="sc-card" href="${href}" data-cat="${shop.category}" data-name="${nameL}" data-loc="${loc.toLowerCase()}">
  <div class="sc-img" id="scimg-${shop.id}"><img src="${shop.thumbnail || ""}" alt="" loading="lazy" decoding="async" onload="parentLoaded(this)" onerror="parentLoaded(this)"></div>
  <div class="sc-info">
    <div class="sc-cat" style="color:${col}"><i class="fas ${icon}"></i>${catLabels[shop.category] || shop.category}</div>
    <div class="sc-name">${shop.name}</div>
    <div class="sc-loc"><i class="fas fa-map-marker-alt"></i>${loc}</div>
  </div>
  <div class="sc-rating-wrap"><i class="fas fa-star"></i>${shop.rating}</div>
</a>`;
  }).join("");
  const filterBtns = cats.map((cat) => {
    const cnt = cat === "all" ? shops2.length : catCountMap[cat] || 0;
    if (cnt === 0) return "";
    return `<button class="sc-flt${cat === "all" ? " on" : ""}" data-cat="${cat}">${catLabels[cat]} <span class="sc-flt-n">${cnt}</span></button>`;
  }).join("");
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Catalog \u2014 All K-Beauty Shops | Seoul Beauty Trip</title>
<meta name="description" content="Browse all Korean beauty salons in Seoul \u2014 foreigner-friendly with English support.">
<link rel="canonical" href="https://seoulbeautytrip.com/shops">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;--gold:#C9A84C;
  --bg:#08080E;--border:rgba(255,255,255,.07);
  --nav-h:52px;--ctrl-h:84px;
  --ff-serif:'Playfair Display',serif;--ff-sans:'Inter',sans-serif
}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:#fff;font-family:var(--ff-sans);display:flex;flex-direction:column}
a{text-decoration:none;color:inherit}

/* NAV */
.sc-nav{
  flex-shrink:0;height:var(--nav-h);
  background:rgba(8,8,14,.97);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  padding:0 14px;
  display:flex;align-items:center;gap:10px;
}
.sc-back{
  display:flex;align-items:center;justify-content:center;
  width:30px;height:30px;border-radius:50%;
  border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.45);font-size:12px;
  transition:all .18s;flex-shrink:0;
}
.sc-back:hover{border-color:var(--pk);color:var(--pk2)}
.sc-title{
  font-family:var(--ff-serif);font-size:16px;font-weight:900;
  background:linear-gradient(100deg,#fff 20%,var(--pk3) 65%,var(--gold) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.sc-spacer{flex:1}
.sc-badge{
  background:rgba(232,65,122,.1);border:1px solid rgba(232,65,122,.2);
  border-radius:14px;padding:3px 9px;
  font-size:10px;font-weight:700;color:var(--pk2);
}

/* CONTROLS */
.sc-ctrl{
  flex-shrink:0;height:var(--ctrl-h);
  background:rgba(8,8,14,.97);backdrop-filter:blur(16px);
  border-bottom:1px solid var(--border);
  padding:8px 14px;display:flex;flex-direction:column;gap:7px;
}
.sc-srch{
  display:flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);
  border-radius:9px;padding:7px 11px;
  transition:border-color .18s;
}
.sc-srch:focus-within{border-color:rgba(232,65,122,.3)}
.sc-srch i{color:rgba(255,255,255,.2);font-size:11px;flex-shrink:0}
.sc-srch input{flex:1;background:none;border:none;outline:none;color:#fff;font-size:13px;font-family:var(--ff-sans)}
.sc-srch input::placeholder{color:rgba(255,255,255,.18)}
.sc-srch-x{background:none;border:none;color:rgba(255,255,255,.2);font-size:10px;cursor:pointer;padding:0;display:none}
.sc-srch-x.on{display:block}
.sc-flts{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none}
.sc-flts::-webkit-scrollbar{display:none}
.sc-flt{
  flex-shrink:0;padding:4px 10px;border-radius:12px;
  border:1px solid rgba(255,255,255,.07);background:transparent;
  color:rgba(255,255,255,.38);font-size:11px;font-weight:700;
  cursor:pointer;transition:all .15s;white-space:nowrap;font-family:var(--ff-sans);
}
.sc-flt:hover{color:rgba(255,255,255,.7)}
.sc-flt.on{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff;box-shadow:0 2px 8px rgba(232,65,122,.3)}
.sc-flt-n{font-size:9px;opacity:.75;margin-left:2px}

/* GRID AREA - fills remaining height */
.sc-area{
  flex:1;overflow:hidden;
  padding:10px 12px 10px;
}
.sc-grid{
  height:100%;
  display:grid;
  /* PC \uAE30\uBCF8: 5\uC5F4\xD72\uD589 */
  grid-template-columns:repeat(5,1fr);
  grid-template-rows:repeat(2,1fr);
  gap:8px;
}
@media(max-width:700px){
  .sc-grid{grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
}

/* CARD */
.sc-card{
  background:#0d0d1f;
  border:1px solid rgba(255,255,255,.07);
  border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column;
  transition:border-color .18s,box-shadow .18s,transform .18s;
  min-height:0;
}
.sc-card:hover{border-color:rgba(232,65,122,.35);box-shadow:0 4px 16px rgba(232,65,122,.12);transform:scale(1.02)}
.sc-img{flex:1;overflow:hidden;min-height:0;position:relative;background:#12122a}
/* shimmer skeleton \u2014 \uC774\uBBF8\uC9C0 \uB85C\uB529 \uC804 \uBC18\uC9DD\uC774\uB294 \uD50C\uB808\uC774\uC2A4\uD640\uB354 */
.sc-img::before{
  content:'';position:absolute;inset:0;z-index:1;
  background:linear-gradient(105deg,#12122a 40%,rgba(255,255,255,.04) 50%,#12122a 60%);
  background-size:200% 100%;
  animation:sc-shimmer 1.6s infinite linear;
}
@keyframes sc-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
/* \uC774\uBBF8\uC9C0 \uB85C\uB4DC \uC644\uB8CC \uD6C4 skeleton \uC228\uAE40 */
.sc-img.loaded::before{display:none}
.sc-img img{
  width:100%;height:100%;object-fit:cover;display:block;
  /* blur-up: \uCC98\uC74C\uC5D4 \uD750\uB9BF\uD558\uAC8C \u2192 \uB85C\uB4DC \uC644\uB8CC \uD6C4 \uC120\uBA85\uD558\uAC8C */
  filter:blur(6px);transform:scale(1.04);
  transition:filter .45s ease,transform .45s ease;
  position:relative;z-index:2;
}
.sc-img.loaded img{filter:blur(0);transform:scale(1)}
.sc-card:hover .sc-img.loaded img{transform:scale(1.06)}
.sc-rating-wrap{
  position:absolute;top:5px;right:5px;
  background:rgba(0,0,0,.7);backdrop-filter:blur(4px);
  border-radius:8px;padding:2px 5px;
  font-size:9px;font-weight:800;color:#fbbf24;
  display:flex;align-items:center;gap:2px;
  pointer-events:none;
}
.sc-rating-wrap i{font-size:7px}
.sc-info{
  flex-shrink:0;padding:5px 7px 6px;
  display:flex;flex-direction:column;gap:2px;
  background:#0d0d1f;
}
.sc-cat{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;display:flex;align-items:center;gap:3px;opacity:.85}
.sc-cat i{font-size:7px}
.sc-name{font-size:11px;font-weight:800;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-loc{display:flex;align-items:center;gap:3px;font-size:9px;color:rgba(255,255,255,.28)}
.sc-loc i{color:var(--pk);font-size:7px;flex-shrink:0}

/* HIDDEN / EMPTY */
.sc-card.hide{display:none}
.sc-empty{
  display:none;grid-column:1/-1;grid-row:1/-1;
  align-items:center;justify-content:center;flex-direction:column;gap:8px;
  color:rgba(255,255,255,.2);font-size:13px;
}
.sc-empty.show{display:flex}
.sc-empty i{font-size:32px;opacity:.2}
</style>
</head>
<body>

<nav class="sc-nav">
  <a href="/" class="sc-back"><i class="fas fa-arrow-left"></i></a>
  <div class="sc-title">Seoul Beauty</div>
  <div class="sc-spacer"></div>
  <div class="sc-badge" id="scBadge">${shops2.length} shops</div>
</nav>

<div class="sc-ctrl">
  <div class="sc-srch">
    <i class="fas fa-search"></i>
    <input id="scQ" type="search" placeholder="Name, area, category..." autocomplete="off" oninput="doFilter(this.value)">
    <button class="sc-srch-x" id="scX" onclick="clearQ()"><i class="fas fa-times"></i></button>
  </div>
  <div class="sc-flts">
    ${filterBtns}
  </div>
</div>

<div class="sc-area">
  <div class="sc-grid" id="scGrid">
    ${cardsHtml}
    <div class="sc-empty" id="scEmpty"><i class="fas fa-search"></i>No shops found</div>
  </div>
</div>

<script>
/* \uC774\uBBF8\uC9C0 blur-up \uD5EC\uD37C */
function parentLoaded(el){ if(el && el.parentElement) el.parentElement.classList.add('loaded'); }

var _cat='all', _q='';

/* \uCE74\uD14C\uACE0\uB9AC \uD544\uD130 */
document.querySelectorAll('.sc-flt').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.sc-flt').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');
    _cat = b.dataset.cat;
    render();
  });
});

/* \uAC80\uC0C9 */
function doFilter(v){
  _q = v.toLowerCase().trim();
  document.getElementById('scX').classList.toggle('on', !!_q);
  render();
}
function clearQ(){
  document.getElementById('scQ').value='';
  document.getElementById('scX').classList.remove('on');
  _q=''; render();
}

/* \uB80C\uB354 */
function render(){
  var cards = document.querySelectorAll('.sc-card');
  var vis = 0;
  cards.forEach(function(c){
    var ok = (_cat==='all' || c.dataset.cat===_cat)
          && (!_q || (c.dataset.name||'').indexOf(_q)!==-1
                  || (c.dataset.loc||'').indexOf(_q)!==-1
                  || (c.dataset.cat||'').indexOf(_q)!==-1);
    c.classList.toggle('hide', !ok);
    if(ok) vis++;
  });

  /* \uBCF4\uC774\uB294 \uCE74\uB4DC \uC218\uC5D0 \uB9DE\uAC8C \uADF8\uB9AC\uB4DC \uB808\uC774\uC544\uC6C3 \uC7AC\uACC4\uC0B0 */
  var grid = document.getElementById('scGrid');
  var cols, rows;
  var isMobile = window.innerWidth < 700;
  if(vis === 0){ cols=1; rows=1; }
  else if(isMobile){
    /* \uBAA8\uBC14\uC77C: \uCD5C\uB300 3\uC5F4, \uD544\uC694\uD55C \uB9CC\uD07C \uD589 */
    rows = vis <= 3 ? 1 : vis <= 6 ? 2 : 3;
    cols = Math.ceil(vis / rows);
  } else {
    /* PC: \uD56D\uC0C1 2\uD589, \uC5F4 \uC218\uB294 \uCE74\uB4DC \uC218\uC5D0 \uB9DE\uAC8C \uC790\uB3D9 */
    rows = vis <= 4 ? 1 : 2;
    cols = Math.ceil(vis / rows);
  }
  grid.style.gridTemplateColumns = 'repeat('+cols+',1fr)';
  grid.style.gridTemplateRows    = 'repeat('+rows+',1fr)';

  document.getElementById('scEmpty').classList.toggle('show', vis===0);
  document.getElementById('scBadge').textContent = vis+' shop'+(vis!==1?'s':'');
}

/* \uCD08\uAE30 \uB808\uC774\uC544\uC6C3 */
render();
</script>
</body>
</html>`);
});
app.get("/sitemap.xml", async (c) => {
  const sql = getDb();
  let shopSlugs = [];
  try {
    const rows = await sql`SELECT slug FROM shops WHERE active=true AND slug IS NOT NULL AND slug!=''`;
    shopSlugs = rows.map((r) => r.slug).filter(Boolean);
  } catch (e) {
  }
  const base = "https://seoulbeautytrip.com";
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const bestPages = [];
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    for (const area of Object.keys(AREA_LABELS)) {
      bestPages.push(`<url><loc>${base}/best/${cat}/${area}</loc><changefreq>weekly</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`);
    }
  }
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    ...bestPages,
    ...shopSlugs.map(
      (slug) => `<url><loc>${base}/shop/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`
    )
  ].join("\n  ");
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  ${urls}
</urlset>`, 200, { "Content-Type": "application/xml; charset=utf-8" });
});
app.get("/robots.txt", (c) => c.text(
  `User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://seoulbeautytrip.com/sitemap.xml
`
));
app.get("/", async (c) => {
  const sql = getDb();
  try {
    const vidRows = await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.active=true ORDER BY RANDOM()`;
    const initVideos = vidRows.map((r) => ({
      id: r.id,
      shopId: r.shop_id,
      title: r.title,
      description: r.description,
      videoUrl: r.video_url,
      thumbnail: r.thumbnail,
      tags: r.tags || [],
      views: r.views,
      likes: r.likes,
      createdAt: r.created_at,
      shop: { id: r.shop_id, name: r.shop_name, category: r.shop_cat, location: r.shop_location, thumbnail: r.shop_thumb }
    }));
    const initPlatform = { whatsapp: PLATFORM.whatsapp, name: PLATFORM.name, instagram: PLATFORM.instagram };
    const safeJson = (obj) => JSON.stringify(obj).replace(/<\/script>/gi, "<\\/script>").replace(/<!--/g, "<\\!--");
    const inlineScript = `<script>window.__INIT_VIDEOS__=${safeJson(initVideos)};window.__INIT_PLATFORM__=${safeJson(initPlatform)};</script>`;
    return c.html(MAIN_HTML.replace("__INLINE_DATA_PLACEHOLDER__", inlineScript));
  } catch (e) {
    console.error("[/ route error]", e?.message || e);
    return c.html(MAIN_HTML.replace("__INLINE_DATA_PLACEHOLDER__", ""));
  }
});
app.get("/admin", (c) => {
  const token = c.env?.GSK_TOKEN || "";
  const html = ADMIN_HTML.replace("__GSK_TOKEN__", token);
  return c.html(html);
});
var index_default = app;
var MAIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Seoul Beauty Trip \u2014 Book Korean Beauty in Seoul | Skincare, Hair, Nail, Clinic</title>
<meta name="description" content="Discover and book the best Korean beauty salons in Seoul. Skincare, makeup, hair, nail art and derma clinics \u2014 foreign-friendly with WhatsApp booking. K-beauty at its finest.">
<meta name="keywords" content="Seoul beauty salon, Korean skincare, K-beauty booking, Seoul hair salon, Seoul nail art, Korean makeup, Seoul derma clinic, beauty travel Korea">
<meta name="robots" content="index, follow">
<meta name="msvalidate.01" content="DD5A8D9AA094B888C8A409EADE4610E9">
<link rel="canonical" href="https://seoulbeautytrip.com/">
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta property="og:title" content="Seoul Beauty Trip \u2014 Book Korean Beauty in Seoul">
<meta property="og:description" content="Discover and book the best Korean beauty salons in Seoul. Skincare, makeup, hair, nail art and derma clinics \u2014 foreign-friendly with WhatsApp booking.">
<meta property="og:image" content="https://seoulbeautytrip.com/og-cover.jpg">
<meta property="og:url" content="https://seoulbeautytrip.com/">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@seoulbeautytrip">
<meta name="twitter:title" content="Seoul Beauty Trip \u2014 Book Korean Beauty in Seoul">
<meta name="twitter:description" content="Discover and book the best Korean beauty salons in Seoul. WhatsApp booking, foreign-friendly.">
<meta name="twitter:image" content="https://seoulbeautytrip.com/og-cover.jpg">
<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":"WebSite",
      "@id":"https://seoulbeautytrip.com/#website",
      "url":"https://seoulbeautytrip.com/",
      "name":"Seoul Beauty Trip",
      "description":"Discover and book the best Korean beauty salons in Seoul.",
      "inLanguage":"en",
      "potentialAction":{
        "@type":"SearchAction",
        "target":{"@type":"EntryPoint","urlTemplate":"https://seoulbeautytrip.com/?cat={search_term_string}"},
        "query-input":"required name=search_term_string"
      }
    },
    {
      "@type":"Organization",
      "@id":"https://seoulbeautytrip.com/#organization",
      "name":"Seoul Beauty Trip",
      "url":"https://seoulbeautytrip.com/",
      "logo":"https://seoulbeautytrip.com/og-cover.jpg",
      "sameAs":["https://instagram.com/seoulbeautytrip"]
    }
  ]
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;
  --gold:#C9A84C;--gold2:#F0C96E;
  --bg:#08080E;--bg2:#0F0F1A;--bg3:#161625;
  --cd:#1A1A2E;--cd2:#1F1F35;
  --border:rgba(255,255,255,.07);
  --ff-serif:'Playfair Display',serif;
  --ff-sans:'Inter',sans-serif;
}
html,body{height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:var(--ff-sans)}
/* \u2500\u2500 \uB85C\uB529 \uC2A4\uD50C\uB798\uC2DC \u2500\u2500 */
#ld{position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:opacity .6s}
.ld-pre{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.28);text-transform:uppercase;font-family:var(--ff-sans)}
.ld-logo{font-family:var(--ff-serif);font-size:34px;font-weight:900;background:linear-gradient(135deg,#fff 0%,var(--pk3) 60%,var(--gold2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;text-align:center;line-height:1.1;animation:ldpulse 2s ease-in-out infinite}
.ld-sub{font-size:9px;letter-spacing:6px;color:rgba(255,255,255,.25);text-transform:uppercase;margin-top:2px}
.ld-line{width:1px;height:28px;background:linear-gradient(to bottom,transparent,rgba(201,168,76,.5),transparent);margin:10px 0 6px}
.ld-bar{width:140px;height:2px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:4px}
.ld-prog{height:100%;background:linear-gradient(90deg,var(--pk),var(--gold));animation:ldpg 2.2s cubic-bezier(.4,0,.2,1) forwards}
.ld-tips{font-size:10px;color:rgba(255,255,255,.18);margin-top:18px;letter-spacing:.3px;text-align:center;min-height:14px;transition:opacity .4s}
@keyframes ldpg{from{width:0}to{width:100%}}
@keyframes ldpulse{0%,100%{opacity:1}50%{opacity:.75}}
/* \u2500\u2500 \uBAA8\uB2EC hero \uC774\uBBF8\uC9C0 shimmer + blur-up \u2500\u2500 */
.m-hero{position:relative}
.m-hero::before{
  content:'';position:absolute;inset:0;z-index:1;
  background:linear-gradient(105deg,#0c0c1e 40%,rgba(255,255,255,.045) 50%,#0c0c1e 60%);
  background-size:200% 100%;
  animation:mh-shimmer 1.6s infinite linear;
  border-radius:0;
}
@keyframes mh-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.m-hero.loaded::before{display:none}
.m-hero-img{
  position:relative;z-index:2;
  filter:blur(8px);transform:scale(1.05);
  transition:filter .5s ease,transform .5s ease;
}
.m-hero.loaded .m-hero-img{filter:blur(0);transform:scale(1)}
/* \uC378\uB124\uC77C \uC2A4\uD2B8\uB9BD \uC774\uBBF8\uC9C0\uB3C4 blur-up */
.m-ts-thumb img{
  filter:blur(4px);transform:scale(1.04);
  transition:filter .35s ease,transform .35s ease;
}
.m-ts-thumb.img-loaded img{filter:blur(0);transform:scale(1)}
/* \uC0AC\uC9C4 \uADF8\uB9AC\uB4DC blur-up */
.m-photos-grid img{
  filter:blur(5px);transform:scale(1.04);
  transition:filter .35s ease,transform .35s ease,opacity .2s;
}
.m-photos-grid img.img-loaded{filter:blur(0);transform:scale(1)}
/* \u2500\u2500 \uC2A4\uCF08\uB808\uD1A4 \uC2AC\uB77C\uC774\uB4DC \u2500\u2500 */
.skeleton-feed{height:100vh;width:100%;max-width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#0a0a14;flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-end}
.sk-bg{position:absolute;inset:0;background:linear-gradient(135deg,#0e0e20 0%,#12121e 50%,#0a0a16 100%)}
.sk-shimmer{position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.035) 50%,transparent 60%);background-size:200% 100%;animation:shimmer 1.8s infinite linear}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-info{position:absolute;bottom:0;left:0;right:0;padding:16px 18px 80px;z-index:3;display:flex;flex-direction:column;gap:8px}
.sk-badge{width:80px;height:18px;border-radius:10px;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite}
.sk-title{width:65%;height:20px;border-radius:6px;background:rgba(255,255,255,.07);animation:skpulse 1.5s ease-in-out infinite .1s}
.sk-desc{width:45%;height:13px;border-radius:5px;background:rgba(255,255,255,.05);animation:skpulse 1.5s ease-in-out infinite .2s}
.sk-shop{display:flex;align-items:center;gap:8px;margin-top:4px}
.sk-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite .15s;flex-shrink:0}
.sk-shop-info{display:flex;flex-direction:column;gap:5px}
.sk-shop-name{width:90px;height:12px;border-radius:4px;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite .2s}
.sk-shop-loc{width:60px;height:10px;border-radius:4px;background:rgba(255,255,255,.04);animation:skpulse 1.5s ease-in-out infinite .3s}
.sk-actions{position:absolute;right:14px;bottom:100px;display:flex;flex-direction:column;gap:16px;align-items:center;z-index:3}
.sk-act-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.05);animation:skpulse 1.5s ease-in-out infinite}
.sk-act-label{width:24px;height:8px;border-radius:3px;background:rgba(255,255,255,.04);animation:skpulse 1.5s ease-in-out infinite .1s}
@keyframes skpulse{0%,100%{opacity:.6}50%{opacity:1}}
/* \u2500\u2500 \uCE74\uD14C\uACE0\uB9AC \uC804\uD658 \uC624\uBC84\uB808\uC774 \u2500\u2500 */
#cat-loading{position:absolute;inset:0;z-index:50;display:none;align-items:center;justify-content:center;pointer-events:none}
#cat-loading.on{display:flex}
.cat-spin{width:28px;height:28px;border:2.5px solid rgba(232,65,122,.15);border-top-color:var(--pk);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* \u2500\u2500 \uD5E4\uB354 \u2500\u2500 */
#hd{position:fixed;top:0;left:0;right:0;z-index:100;padding:12px 16px 0;background:linear-gradient(to bottom,rgba(8,8,14,.96) 60%,transparent)}
.hd-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.logo{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.logo-mark{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--pk) 0%,#7C3AED 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 14px rgba(232,65,122,.38),0 0 0 1px rgba(255,255,255,.08);font-size:0}
.logo-mark::after{content:'';display:block;width:14px;height:14px;border-radius:50%;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 0 0 3px rgba(255,255,255,.15)}
.logo-text{display:flex;flex-direction:column;gap:1px}
.logo-name{font-family:var(--ff-serif);font-size:16px;font-weight:900;letter-spacing:.2px;line-height:1;background:linear-gradient(100deg,#fff 30%,var(--pk3) 80%,var(--gold2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tag{font-size:7.5px;color:rgba(201,168,76,.75);letter-spacing:3.5px;text-transform:uppercase;-webkit-text-fill-color:rgba(201,168,76,.75);font-weight:600}
.hd-right{display:flex;align-items:center;gap:8px}
.mute-btn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.mute-btn:hover{background:rgba(255,255,255,.1);color:#fff}
/* \u2500\u2500 \uCE74\uD14C\uACE0\uB9AC \uD0ED \u2500\u2500 */
.cats{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:12px;-webkit-overflow-scrolling:touch;touch-action:pan-x}
.cats::-webkit-scrollbar{display:none}
/* PC\uC5D0\uC11C cats \uAC00\uB85C \uC2A4\uD06C\uB864 \uAC15\uC81C \uD65C\uC131\uD654 */
@media(min-width:768px){
  .cats{overflow-x:scroll;cursor:grab}
  .cats:active{cursor:grabbing}
}
.cat{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:rgba(255,255,255,.4);font-size:10.5px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;font-family:var(--ff-sans);letter-spacing:.1px}
.cat:hover{background:rgba(232,65,122,.12);border-color:rgba(232,65,122,.3);color:rgba(255,255,255,.75)}
.cat.on{background:linear-gradient(135deg,var(--pk) 0%,#7C3AED 100%);border-color:transparent;color:#fff;box-shadow:0 2px 14px rgba(232,65,122,.4),0 0 0 1px rgba(255,255,255,.08) inset}
.cat i{font-size:9px;opacity:.85}
/* \u2500\u2500 \uD53C\uB4DC \u2500\u2500 */
#feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;display:flex;flex-direction:column;align-items:center}
#feed::-webkit-scrollbar{display:none}
/* \u2500\u2500 \uC2AC\uB77C\uC774\uB4DC \u2500\u2500 */
.slide{height:100vh;width:100%;max-width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#000;flex-shrink:0}
.bg-img{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
  filter:blur(12px);transform:scale(1.06);
  transition:filter .5s ease,transform .5s ease;
}
.bg-img.loaded{filter:blur(0);transform:scale(1)}
.slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#000}
.ov{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 25%,transparent 40%,rgba(0,0,0,.2) 60%,rgba(0,0,0,.7) 80%,rgba(0,0,0,.92) 100%);cursor:pointer}
/* \u2500\u2500 \uC2AC\uB77C\uC774\uB4DC \uC815\uBCF4 \uC601\uC5ED \u2500\u2500 */
.info{position:absolute;bottom:0;left:0;right:0;padding:16px 18px 26px;z-index:3;display:flex;flex-direction:column;gap:0}
.slide-cat-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;background:linear-gradient(135deg,rgba(232,65,122,.25),rgba(124,58,237,.2));backdrop-filter:blur(12px);border:1px solid rgba(232,65,122,.3);font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:6px;align-self:flex-start;box-shadow:0 2px 8px rgba(232,65,122,.15)}
.slide-cat-badge i{font-size:9px;color:var(--pk3)}
.shop-info-block{flex:1;overflow:hidden;min-width:0;margin-right:10px}
.shop-info-name{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:900;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.9);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.shop-info-name .si-icon{color:var(--pk3);font-size:13px;flex-shrink:0;filter:drop-shadow(0 0 4px rgba(255,179,204,.4))}
.shop-info-loc{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.5);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop-info-loc i{font-size:9px;color:var(--pk);opacity:.85}
.btns-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:0;overflow:hidden}
.wa-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:22px;border:none;background:linear-gradient(135deg,#25D366 0%,#128C5E 100%);color:#fff;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 16px rgba(37,211,102,.35),0 0 0 1px rgba(255,255,255,.08) inset;letter-spacing:.2px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.wa-btn:hover{opacity:.9;transform:scale(1.03)}
/* \u2500\u2500 \uC778\uB514\uCF00\uC774\uD130 \u2500\u2500 */
.hint{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:.4;animation:hb 2.4s infinite}
.hint span{font-size:8px;color:#fff;letter-spacing:2px;text-transform:uppercase}
@keyframes hb{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}
#dots{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:200;display:flex;flex-direction:column;gap:5px}
.dot{width:3px;height:3px;border-radius:2px;background:rgba(255,255,255,.18);transition:all .3s}
.dot.on{background:var(--pk);height:18px;box-shadow:0 0 6px rgba(232,65,122,.5)}
/* muteBtn: fixed \uD574\uC81C \u2192 hd-right \uC778\uB77C\uC778 \uBC84\uD2BC */
#muteBtn{position:relative;top:auto;right:auto;z-index:1;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;backdrop-filter:none}
#muteBtn:hover,#muteBtn.on{background:rgba(232,65,122,.15);color:var(--pk2);border-color:rgba(232,65,122,.3)}
/* \u2500\u2500 PC \uBC18\uC751\uD615 (768px~1199px) \u2500\u2500 */
@media(min-width:768px) and (max-width:1199px){
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  .modal{max-width:420px}
  .hint{display:none}
}
/* \u2500\u2500 PC \uC0AC\uC774\uB4DC \uCE74\uD0C8\uB85C\uADF8 \uC644\uC804 \uC81C\uAC70 \u2500\u2500 */
#shop-panel{display:none!important}
#pc-layout{display:block!important}
#feed-col{width:100%}
/* \u2500\u2500 PC \uBC18\uC751\uD615 (1200px+) \u2500\u2500 */
@media(min-width:1200px){
  body{overflow:hidden}
  /* pc-layout: \uD53C\uB4DC(\uC88C) + \uCE74\uD0C8\uB85C\uADF8(\uC6B0) \uB098\uB780\uD788 */
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  .modal{max-width:420px}
  .hint{display:none}
}
/* \u2500\u2500 PC \uCE74\uD0C8\uB85C\uADF8 \uD328\uB110 \u2500\u2500 */
#pc-layout{display:block;width:100%}
#feed-col{position:relative}
#shop-panel{display:none;flex:1;height:100vh;overflow-y:auto;background:#0d0d18;border-left:1px solid rgba(255,255,255,.06);padding:16px;scrollbar-width:thin;scrollbar-color:rgba(255,77,141,.3) transparent}
#shop-panel::-webkit-scrollbar{width:4px}
#shop-panel::-webkit-scrollbar-thumb{background:rgba(255,77,141,.3);border-radius:2px}
.sp-header{padding:8px 4px 12px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:14px}
.sp-title{font-size:13px;font-weight:900;color:#fff;letter-spacing:-.2px;margin-bottom:4px}
.sp-subtitle{font-size:11px;color:rgba(255,255,255,.35)}
.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .2s;position:relative}
.sp-card:hover{border-color:rgba(232,65,122,.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,65,122,.12)}
.sp-card-img{width:100%;height:100px;object-fit:cover;display:block;background:#1a1a2e}
.sp-card-body{padding:9px 10px 10px}
.sp-card-cat{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--pk);margin-bottom:3px;opacity:.85}
.sp-card-name{font-size:12px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-card-loc{font-size:10px;color:rgba(255,255,255,.38);display:flex;align-items:center;gap:3px}
.sp-card-loc i{font-size:8px;color:var(--pk);opacity:.7}
.sp-card-rating{position:absolute;top:7px;right:7px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);border-radius:20px;padding:3px 7px;font-size:10px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:3px}
.sp-filter{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:8px;margin-bottom:8px;-webkit-overflow-scrolling:touch}
.sp-filter::-webkit-scrollbar{display:none}
.sp-flt{padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);font-size:10px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap}
.sp-flt.on{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff}
.sp-empty{grid-column:1/-1;text-align:center;padding:40px 16px;color:rgba(255,255,255,.25);font-size:12px}
/* \u2500\u2500 \uC5C5\uCCB4 \uBAA8\uB2EC \u2500\u2500 */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:500;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(16px)}
.modal-bg.open{display:flex}
.modal{background:linear-gradient(180deg,#111118 0%,#0d0d14 100%);border-radius:28px 28px 0 0;padding:0;width:100%;max-width:520px;border:1px solid rgba(255,255,255,.08);border-bottom:none;animation:msu .35s cubic-bezier(.22,1,.36,1);position:relative;height:88vh;display:flex;flex-direction:column;touch-action:pan-y}
@media(min-width:768px){
  .modal-bg{align-items:center}
  .modal{border-radius:24px;border-bottom:1px solid rgba(255,255,255,.08);height:90vh;max-height:860px;max-width:440px}
}
@keyframes msu{from{transform:translateY(100%);opacity:.6}to{transform:translateY(0);opacity:1}}
/* \uD578\uB4E4 */
.modal-handle-area{flex-shrink:0;padding:10px 20px 0;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:10px}
.mhdl{width:32px;height:3px;background:rgba(255,255,255,.12);border-radius:2px}
.modal-top-row{display:flex;align-items:center;justify-content:space-between;width:100%}
.modal-back-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer;white-space:nowrap;transition:all .2s}
.modal-back-btn:hover,.modal-back-btn:active{background:rgba(232,65,122,.15);border-color:rgba(232,65,122,.4);color:var(--pk2)}
.mcls{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.mcls:hover{background:rgba(232,65,122,.18);color:#fff;border-color:rgba(232,65,122,.3)}
/* \uC2A4\uD06C\uB864 */
.modal-scroll{flex:1;overflow-y:auto;scrollbar-width:none}
.modal-scroll::-webkit-scrollbar{display:none}
/* \uD788\uC5B4\uB85C \u2014 \uD480\uBE14\uB9AC\uB4DC \uC0AC\uC9C4 */
.m-hero{height:240px;position:relative;overflow:hidden;flex-shrink:0;background:#0a0a12}
.m-hero-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
.m-hero:hover .m-hero-img{transform:scale(1.03)}
.m-hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,transparent 35%,rgba(8,8,14,.95) 100%)}
/* \uD788\uC5B4\uB85C \uC704 \uCE74\uD14C\uACE0\uB9AC \uBC43\uC9C0 */
.m-hero-badge{position:absolute;top:14px;left:16px;display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(8,8,14,.65);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#fff}
/* \uD558\uB2E8 3\uAC1C \uC378\uB124\uC77C \uC2A4\uD2B8\uB9BD \u2014 \uD788\uC5B4\uB85C \uBC14\uB85C \uC544\uB798 */
.m-thumbstrip{display:flex;gap:4px;padding:0 16px;margin-top:-1px;flex-shrink:0}
.m-ts-thumb{flex:1;height:52px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;border:2px solid transparent;transition:border-color .2s,opacity .2s;opacity:.72}
.m-ts-thumb.on,.m-ts-thumb:hover{border-color:var(--pk);opacity:1}
.m-ts-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.m-ts-more{flex:1;height:52px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(255,255,255,.45);cursor:pointer;gap:3px}
/* \uBCF8\uBB38 */
.m-body{padding:16px 20px 20px}
/* \uC0F5 \uD5E4\uB354 */
.m-shop-header{margin-bottom:16px}
.m-shop-name{font-family:var(--ff-serif);font-size:22px;font-weight:700;line-height:1.2;margin-bottom:6px;letter-spacing:-.2px}
.m-shop-sub{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.m-shop-loc{display:flex;align-items:center;gap:4px;font-size:11.5px;color:rgba(255,255,255,.4);font-weight:500}
.m-shop-loc i{color:var(--pk2);font-size:10px}
.m-divider{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2)}
.m-stars{color:var(--gold);font-size:11px;letter-spacing:1px}
.m-rating-txt{font-size:11.5px;color:rgba(255,255,255,.38)}
/* \uC815\uBCF4 \uCE74\uB4DC \uADF8\uB9AC\uB4DC */
.m-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
.m-info-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.m-info-card-label{font-size:9px;font-weight:700;color:rgba(255,255,255,.28);letter-spacing:1.5px;text-transform:uppercase}
.m-info-card-val{font-size:12.5px;color:rgba(255,255,255,.82);font-weight:600;line-height:1.4}
.m-info-card-val i{color:var(--pk2);margin-right:4px;font-size:11px}
/* \uC139\uC158 */
.m-sec{margin-bottom:20px}
.m-sec-title{font-size:9px;font-weight:800;color:var(--gold);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.m-sec-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(201,168,76,.25),transparent)}
/* \uAC00\uACA9 \uB9AC\uC2A4\uD2B8 */
.m-price-list{display:flex;flex-direction:column;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden}
.m-price-item{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.04)}
.m-price-item:last-child{border-bottom:none}
.m-price-name{font-size:13px;color:rgba(255,255,255,.78);font-weight:500}
.m-price-val{font-size:13px;color:var(--gold);font-weight:800;letter-spacing:.3px}
/* \uC11C\uBE44\uC2A4 \uD0DC\uADF8 */
.m-svc-tags{display:flex;flex-wrap:wrap;gap:6px}
.m-svc-tag{padding:5px 13px;background:rgba(232,65,122,.07);border:1px solid rgba(232,65,122,.16);border-radius:20px;font-size:11px;color:rgba(232,65,122,.9);font-weight:600;letter-spacing:.3px}
/* \uC9C0\uB3C4 */
.m-map{border-radius:16px;overflow:hidden;height:210px;border:1px solid rgba(255,255,255,.08);position:relative;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.m-map iframe{width:100%;height:100%;border:0;display:block}
/* \uAD6C\uAE00\uB9F5 "View on Google Maps" \uB9C1\uD06C \uC644\uC804 \uCC28\uB2E8 \uC624\uBC84\uB808\uC774 */
.m-map-cover{position:absolute;top:4px;left:4px;z-index:4;background:#fff;pointer-events:all;cursor:default;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.08)}
.m-map-cover-txt{font-size:12px;font-weight:400;color:#5f6368;font-family:Roboto,Arial,sans-serif;letter-spacing:0;white-space:nowrap}
.m-map-cover-icon{font-size:12px;color:#1a73e8}
.m-map-zoom{position:absolute;bottom:10px;right:10px;z-index:3;display:flex;flex-direction:column;gap:4px}
.m-map-zoom button{width:32px;height:32px;border-radius:8px;border:none;background:rgba(15,15,25,.82);backdrop-filter:blur(8px);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);transition:background .15s}
.m-map-zoom button:hover{background:rgba(232,65,122,.7)}
/* \uC601\uC5C5\uC2DC\uAC04 \uD14C\uC774\uBE14 */
.m-hours-table{width:100%;border-collapse:collapse}
.m-hours-table tr{border-bottom:1px solid rgba(255,255,255,.05)}
.m-hours-table tr:last-child{border-bottom:none}
.m-hours-table td{padding:7px 4px;font-size:12px;line-height:1.4}
.m-hours-td-day{color:rgba(255,255,255,.5);font-weight:600;width:88px;white-space:nowrap}
.m-hours-td-time{color:rgba(255,255,255,.82);font-weight:500}
.m-hours-td-time.closed{color:rgba(255,100,100,.6);font-style:italic}
.m-hours-td-today{background:rgba(201,168,76,.07);border-radius:6px}
.m-hours-td-today .m-hours-td-day{color:var(--gold)}
.m-hours-td-today .m-hours-td-time{color:var(--gold);font-weight:700}
/* \uB9AC\uBDF0 \uCE74\uB4DC */
.m-review-card{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.m-review-card:last-child{border-bottom:none}
.m-review-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.m-review-author{font-size:12px;font-weight:700;color:rgba(255,255,255,.85)}
.m-review-stars{font-size:12px;color:var(--gold);letter-spacing:1px}
.m-review-text{font-size:12.5px;color:rgba(255,255,255,.62);line-height:1.75}
.m-review-time{font-size:10px;color:rgba(255,255,255,.28);margin-top:5px}
/* \uC0AC\uC9C4 \uADF8\uB9AC\uB4DC */
.m-photos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;border-radius:12px;overflow:hidden}
.m-photos-grid img{width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;transition:opacity .2s}
.m-photos-grid img:hover{opacity:.85}
/* \uBAA8\uB2EC \uC601\uC0C1 \uADF8\uB9AC\uB4DC \u2014 full-bleed (\uD328\uB529 \uB3CC\uD30C) */
.m-vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 -20px;overflow:hidden}
.m-vid-card{border-radius:0;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16;background:#0a0a14}
@media(min-width:768px){
  .m-vid-grid{border-radius:0 0 20px 20px;overflow:hidden}
  .m-vid-card:nth-child(odd):last-child{grid-column:1/-1;aspect-ratio:16/9}
}
.m-vid-card:first-child{border-radius:0}
.m-vid-card video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}
.m-vid-card.vid-on video{opacity:1}
.m-vid-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s}
.m-vid-card:active img{transform:scale(1.04)}
.m-vid-card.vid-on img{opacity:0}
.m-vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.88) 100%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:10px 8px;pointer-events:none}
.m-vid-card-title{font-size:12px;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center}
.m-vid-card-views{display:none}
.m-vid-play-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:38px;height:38px;background:rgba(0,0,0,.48);border:1.5px solid rgba(255,255,255,.65);border-radius:50%;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);transition:opacity .2s,transform .2s;pointer-events:none}
.m-vid-play-ic i{font-size:12px;color:#fff;margin-left:2px}
.m-vid-card.vid-on .m-vid-play-ic{opacity:0;transform:translate(-50%,-60%) scale(.8)}
/* \uBC84\uD2BC */
.m-btns{flex-shrink:0;padding:10px 20px 28px;background:linear-gradient(0deg,#0d0d14 60%,transparent);display:flex;flex-direction:column;gap:8px}
.m-wa{
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:15px 20px;
  background:linear-gradient(135deg,#25D366 0%,#128C5E 100%);
  border:none;border-radius:16px;color:#fff;
  text-decoration:none;cursor:pointer;
  box-shadow:0 6px 20px rgba(37,211,102,.32),inset 0 1px 0 rgba(255,255,255,.18);
  transition:transform .16s,box-shadow .16s;
  position:relative;overflow:hidden;
}
.m-wa:active{transform:scale(.98)}
.m-wa:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(37,211,102,.42)}
.m-wa-icon{width:32px;height:32px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px}
.m-wa-text{display:flex;flex-direction:row;align-items:center;gap:6px;white-space:nowrap;overflow:hidden}
.m-wa-text b{font-size:14px;font-weight:800;letter-spacing:.2px;flex-shrink:0}
.m-wa-text span{font-size:13px;opacity:.82;font-weight:600;overflow:hidden;text-overflow:ellipsis}
/* \uBAA8\uB2EC \uD558\uB2E8 2\uCC28 \uBC84\uD2BC \uD589 */
.m-btns-row2{display:none}
/* \uAC80\uC0C9 */
/* hd-right: \uC18C\uB9AC\uBC84\uD2BC\xB7\uAC80\uC0C9\uBC84\uD2BC \uC138\uB85C \uBC30\uCE58\uB85C \uACF5\uAC04 \uC808\uC57D */
.hd-right{display:flex;flex-direction:column;align-items:center;gap:4px}
.srch-btn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.srch-btn:hover,.srch-btn.on{background:rgba(232,65,122,.15);color:var(--pk2);border-color:rgba(232,65,122,.3)}
#search-bar{overflow:hidden;max-height:0;transition:max-height .32s cubic-bezier(.4,0,.2,1),opacity .28s;opacity:0;padding:0 0 0}
#search-bar.open{max-height:60px;opacity:1;padding:0 0 10px}
.srch-wrap{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:9px 14px;transition:border-color .2s}
.srch-wrap:focus-within{border-color:rgba(232,65,122,.4);background:rgba(232,65,122,.04)}
#srchInput{flex:1;background:none;border:none;outline:none;color:#fff;font-size:14px;font-family:var(--ff-sans)}
#srchInput::placeholder{color:rgba(255,255,255,.28)}
.srch-clear{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:13px;padding:0;line-height:1;transition:color .15s;display:none}
.srch-clear.on{display:block}
.srch-clear:hover{color:rgba(255,255,255,.7)}
/* \uAC80\uC0C9 \uACB0\uACFC \uC624\uBC84\uB808\uC774 */
#search-overlay{display:none;position:fixed;inset:0;z-index:800;background:rgba(8,8,14,.97);backdrop-filter:blur(16px);flex-direction:column;overflow:hidden}
#search-overlay.open{display:flex}
.so-topbar{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:52px 14px 10px}
.so-back-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;padding:7px 12px;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
.so-back-btn:hover,.so-back-btn:active{background:rgba(232,65,122,.15);border-color:rgba(232,65,122,.4);color:var(--pk2)}
.so-srch-wrap{flex:1;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:9px 14px;transition:border-color .2s}
.so-srch-wrap:focus-within{border-color:rgba(232,65,122,.4);background:rgba(232,65,122,.04)}
#soInput{flex:1;background:none;border:none;outline:none;color:#fff;font-size:14px;font-family:var(--ff-sans)}
#soInput::placeholder{color:rgba(255,255,255,.28)}
.so-srch-x{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:12px;padding:0;line-height:1;display:none}
.so-srch-x.on{display:block}
.so-chips-row{flex-shrink:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
.so-chips-row::-webkit-scrollbar{display:none}
.so-chip{flex-shrink:0;padding:5px 12px;border-radius:16px;font-size:11px;font-weight:700;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.45);cursor:pointer;transition:all .18s;white-space:nowrap}
.so-chip.on{background:rgba(232,65,122,.18);border-color:rgba(232,65,122,.5);color:var(--pk2)}
.so-body{flex:1;overflow-y:auto;padding-top:6px}
.so-header{padding:8px 16px 8px;font-size:11px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:1px;text-transform:uppercase}
.so-grid{display:flex;flex-direction:column;gap:8px;padding:0 14px 40px}
/* \u2500\u2500 \uAC80\uC0C9 \uCE74\uB4DC (\uAC00\uB85C\uD615 \uB9AC\uC2A4\uD2B8) \u2500\u2500 */
.so-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;cursor:pointer;transition:background .18s,border-color .18s;text-decoration:none;display:flex;flex-direction:row;align-items:center;gap:0;position:relative}
.so-card:active{background:rgba(232,65,122,.07);border-color:rgba(232,65,122,.4)}
/* \uC774\uBBF8\uC9C0 \uC601\uC5ED \u2014 \uC815\uC0AC\uAC01\uD615 \uC378\uB124\uC77C */
.so-card-img-wrap{width:74px;height:74px;flex-shrink:0;position:relative;background:#0c0c1c;overflow:hidden}
.so-card-img-wrap::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(105deg,#0c0c1e 40%,rgba(255,255,255,.04) 50%,#0c0c1e 60%);background-size:200% 100%;animation:sc-shimmer 1.6s infinite linear}
.so-card-img-wrap.loaded::before{display:none}
.so-card-img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;z-index:2;transition:transform .45s}
.so-card-img-wrap.loaded .so-card-img{transform:scale(1)}
/* \uC601\uC0C1 \uBBF8\uB9AC\uBCF4\uAE30 (\uAC00\uB85C\uD615\uC5D0\uC11C\uB294 \uBE44\uD65C\uC131) */
.so-card-vid{display:none}
/* \uD50C\uB808\uC774 \uC544\uC774\uCF58 \uC228\uAE40 (\uAC00\uB85C\uD615) */
.so-card-play{display:none}
/* \uCE74\uB4DC \uC624\uBC84\uB808\uC774 \u2014 \uCE74\uD14C\uACE0\uB9AC \uCEEC\uB7EC \uBC14 */
.so-card-ov{position:absolute;left:0;top:0;bottom:0;width:3px;z-index:5;border-radius:0;pointer-events:none}
.so-card-cat-badge{display:none}
/* \uCE74\uB4DC \uC815\uBCF4 \uC601\uC5ED */
.so-card-body{flex:1;padding:12px 14px 12px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
.so-card-name{font-size:14px;font-weight:800;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.so-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.so-card-loc{font-size:11px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.so-card-rating{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--gold);font-weight:700;flex-shrink:0}
.so-card-cat{font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);text-transform:capitalize;flex-shrink:0}
.so-card-arrow{width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.18);font-size:11px}
.so-empty{padding:60px 20px;text-align:center;color:rgba(255,255,255,.25);font-size:14px}
/* \uD1A0\uC2A4\uD2B8 */
#toast{position:fixed;bottom:72px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(232,65,122,.92);color:#fff;padding:8px 18px;border-radius:18px;font-size:12px;font-weight:700;z-index:600;opacity:0;transition:all .28s;white-space:nowrap;pointer-events:none;backdrop-filter:blur(8px)}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div id="ld">
  <div class="ld-pre">Welcome to</div>
  <div class="ld-logo">Seoul Beauty Trip</div>
  <div class="ld-sub">Korean Beauty Experience</div>
  <div class="ld-line"></div>
  <div class="ld-bar"><div class="ld-prog"></div></div>
  <div class="ld-tips" id="ldTips"></div>
</div>

<header id="hd">
  <div class="hd-top">
    <div class="logo" id="logoBtn">
      <div class="logo-mark"></div>
      <div class="logo-text">
        <div class="logo-name">Seoul Beauty Trip</div>
        <div class="logo-tag">Korean Beauty Experience</div>
      </div>
    </div>
    <div class="hd-right">
      <button class="srch-btn" id="srchToggle" onclick="toggleSearch()" aria-label="Search shops"><i class="fas fa-search"></i></button>
      <button class="mute-btn" id="muteBtn" onclick="toggleMute()"><i class="fas fa-volume-mute"></i></button>
    </div>
  </div>
  <div id="search-bar">
    <div class="srch-wrap">
      <i class="fas fa-search" style="color:rgba(255,255,255,.28);font-size:12px;flex-shrink:0"></i>
      <input id="srchInput" type="search" placeholder="Search shops, area, category..." autocomplete="off" oninput="onSearch(this.value)">
      <button class="srch-clear" id="srchClear" onclick="clearSearch()"><i class="fas fa-times"></i></button>
    </div>
  </div>
  <nav class="cats" id="cats" aria-label="Beauty categories">
    <button class="cat on" data-cat="all"><i class="fas fa-star"></i> All</button>
    <button class="cat" data-cat="skincare"><i class="fas fa-leaf"></i> Skincare</button>
    <button class="cat" data-cat="makeup"><i class="fas fa-magic"></i> Makeup</button>
    <button class="cat" data-cat="hair"><i class="fas fa-cut"></i> Hair</button>
    <button class="cat" data-cat="headspa"><i class="fas fa-spa"></i> Head Spa</button>
    <button class="cat" data-cat="nail"><i class="fas fa-hand-sparkles"></i> Nail</button>
    <button class="cat" data-cat="clinic"><i class="fas fa-briefcase-medical"></i> Clinic</button>
    <button class="cat" data-cat="spa"><i class="fas fa-hot-tub"></i> Spa</button>
  </nav>
</header>

<!-- \uAC80\uC0C9 \uACB0\uACFC \uC624\uBC84\uB808\uC774 -->
<div id="search-overlay" role="dialog" aria-label="Search results">
  <div class="so-topbar">
    <button class="so-back-btn" id="soBackBtn" onclick="closeSearch()"><i class="fas fa-arrow-left" style="font-size:11px"></i> <span id="soBackLabel">Main</span></button>
    <div class="so-srch-wrap">
      <i class="fas fa-search" style="color:rgba(255,255,255,.3);font-size:12px;flex-shrink:0"></i>
      <input id="soInput" type="search" placeholder="Shop, area, category..." autocomplete="off" oninput="onSearch(this.value)">
      <button class="so-srch-x" id="soX" onclick="clearSoInput()"><i class="fas fa-times"></i></button>
    </div>
  </div>
  <div class="so-chips-row" id="so-filters">
    <button class="so-chip on" data-filter="all">All</button>
    <button class="so-chip" data-filter="skincare">Skincare</button>
    <button class="so-chip" data-filter="makeup">Makeup</button>
    <button class="so-chip" data-filter="hair">Hair</button>
    <button class="so-chip" data-filter="headspa">Head Spa</button>
    <button class="so-chip" data-filter="nail">Nail</button>
    <button class="so-chip" data-filter="clinic">Clinic</button>
    <button class="so-chip" data-filter="spa">Spa</button>
    <button class="so-chip" data-filter="Gangnam">Gangnam</button>
    <button class="so-chip" data-filter="Hongdae">Hongdae</button>
    <button class="so-chip" data-filter="Myeongdong">Myeongdong</button>
    <button class="so-chip" data-filter="Sinsa">Sinsa</button>
    <button class="so-chip" data-filter="Itaewon">Itaewon</button>
    <button class="so-chip" data-filter="Apgujeong">Apgujeong</button>
  </div>
  <div class="so-body">
    <div class="so-header" id="so-header"></div>
    <div class="so-grid" id="so-grid"></div>
  </div>
</div>

<!-- PC \uB808\uC774\uC544\uC6C3 \uB798\uD37C -->
<div id="pc-layout">
  <div id="feed-col" style="position:relative">
    <div id="dots" aria-hidden="true"></div>
    <div id="feed" role="feed" aria-label="Beauty videos"></div>
    <div id="cat-loading"><div class="cat-spin"></div></div>
  </div>
  <!-- PC \uC6B0\uCE21 \uC5C5\uCCB4 \uCE74\uD0C8\uB85C\uADF8 -->
  <aside id="shop-panel" aria-label="Shop catalog">
    <div class="sp-header">
      <div class="sp-title">Seoul Beauty Catalog</div>
      <div class="sp-subtitle" id="sp-count">Loading...</div>
    </div>
    <div class="sp-filter" id="sp-filter">
      <button class="sp-flt on" data-cat="all">All</button>
      <button class="sp-flt" data-cat="skincare">Skincare</button>
      <button class="sp-flt" data-cat="headspa">Head Spa</button>
      <button class="sp-flt" data-cat="hair">Hair</button>
      <button class="sp-flt" data-cat="nail">Nail</button>
      <button class="sp-flt" data-cat="clinic">Clinic</button>
      <button class="sp-flt" data-cat="makeup">Makeup</button>
      <button class="sp-flt" data-cat="spa">Spa</button>
    </div>
    <div class="sp-grid" id="sp-grid"></div>
  </aside>
</div>
<div id="toast" role="status" aria-live="polite"></div>

<!-- \uAD00\uB9AC\uC790 \uBE44\uBC00\uBC88\uD638 \uBAA8\uB2EC -->
<div id="adminModal" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);align-items:center;justify-content:center">
  <div style="background:var(--cd);border:1px solid rgba(232,65,122,.2);border-radius:20px;padding:28px 24px;width:280px;max-width:90vw;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">&#128274;</div>
    <div style="font-family:var(--ff-serif);font-size:15px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,var(--pk),var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent">Admin Login</div>
    <div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:18px">Enter password to continue</div>
    <form onsubmit="checkAdminPw();return false;" autocomplete="off">
      <input type="text" name="username" style="display:none" autocomplete="username">
      <input id="adminPwInput" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(232,65,122,.2);border-radius:11px;color:#fff;font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:12px;font-family:var(--ff-sans)">
      <div style="display:flex;gap:8px">
        <button type="submit" style="flex:1;padding:11px;background:linear-gradient(135deg,var(--pk),#7C3AED);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Confirm</button>
        <button type="button" onclick="closeAdminModal()" style="flex:1;padding:11px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:11px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer">Cancel</button>
      </div>
    </form>
    <div id="adminPwErr" style="font-size:11px;color:#ef4444;margin-top:10px;display:none">&#10060; Incorrect password</div>
  </div>
</div>

<!-- \uC5C5\uCCB4 \uC815\uBCF4 \uBAA8\uB2EC -->
<div class="modal-bg" id="shopModal" role="dialog" aria-modal="true" aria-label="Shop information">
  <div class="modal" id="modalPanel">
    <div class="modal-handle-area" id="modalHandle">
      <div class="mhdl"></div>
      <div class="modal-top-row">
        <button class="modal-back-btn" onclick="closeModal()" aria-label="Back"><i class="fas fa-arrow-left" style="font-size:11px"></i> <span>Back</span></button>
        <button class="mcls" onclick="closeModal()" aria-label="Close">&#10005;</button>
      </div>
    </div>
    <div class="modal-scroll" id="modalScroll">
      <div id="modalHero"></div>
      <div class="m-body" id="modalContent"></div>
    </div>
    <div class="m-btns" id="modalBtns"></div>
  </div>
</div>

__INLINE_DATA_PLACEHOLDER__
<script>
var vids = [], isMuted = true, liked = {}, platform = {}, allShopsData = [];
var shopCache = {}; // \uBAA8\uB2EC \uCE90\uC2DC: shopId \u2192 shop \uAC1D\uCCB4
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',headspa:'&#129496;',nail:'&#128133;',clinic:'&#127973;',spa:'&#129510;'};
var catFaIcons = {skincare:'fa-leaf',makeup:'fa-magic',hair:'fa-cut',headspa:'fa-spa',nail:'fa-hand-sparkles',clinic:'fa-briefcase-medical',spa:'fa-hot-tub'};

if(window.__INIT_PLATFORM__) { platform = window.__INIT_PLATFORM__; }
else { fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; }); }

/* \u2500\u2500 \uB85C\uB529 \uD301 \u2500\u2500 */
var _ldTips = [
  'Swipe up to explore more looks',
  'Tap the shop name to book',
  'Real shops in Seoul, Korea',
  'Curated K-beauty experiences',
  'Contact via WhatsApp to reserve'
];
(function(){
  var el = document.getElementById('ldTips');
  if(!el) return;
  var idx = 0;
  el.textContent = _ldTips[0];
  setInterval(function(){
    el.style.opacity = '0';
    setTimeout(function(){
      idx = (idx + 1) % _ldTips.length;
      el.textContent = _ldTips[idx];
      el.style.opacity = '1';
    }, 400);
  }, 2200);
})();

/* \u2500\u2500 \uC2A4\uCF08\uB808\uD1A4 \uC2AC\uB77C\uC774\uB4DC \u2500\u2500 */
function buildSkeleton() {
  return '<div class="skeleton-feed">'
    +'<div class="sk-bg"></div>'
    +'<div class="sk-shimmer"></div>'
    +'<div class="sk-actions">'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
    +'</div>'
    +'<div class="sk-info">'
      +'<div class="sk-badge"></div>'
      +'<div class="sk-title"></div>'
      +'<div class="sk-desc"></div>'
      +'<div class="sk-shop">'
        +'<div class="sk-avatar"></div>'
        +'<div class="sk-shop-info"><div class="sk-shop-name"></div><div class="sk-shop-loc"></div></div>'
      +'</div>'
    +'</div>'
  +'</div>';
}
function showSkeletonFeed() {
  var feed = document.getElementById('feed');
  if(!feed) return;
  feed.innerHTML = buildSkeleton();
}

/* \u2500\u2500 \uC774\uBBF8\uC9C0 blur-up \uD5EC\uD37C \uD568\uC218 \u2500\u2500
   HTML onload/onerror \uC18D\uC131 \uB0B4 \uB530\uC634\uD45C \uCDA9\uB3CC\uC744 \uD53C\uD558\uAE30 \uC704\uD574 \uD568\uC218 \uBD84\uB9AC */
function imgLoaded(el){ el.classList.add('loaded'); }
function parentLoaded(el){ if(el.parentElement) el.parentElement.classList.add('loaded'); }
function heroImgLoaded(el){ var w=el.closest('.m-hero'); if(w) w.classList.add('loaded'); }
function thumbImgLoaded(el){ el.classList.add('img-loaded'); if(el.parentElement) el.parentElement.classList.add('img-loaded'); }

/* \u2500\u2500 \uC2A4\uD50C\uB798\uC2DC \uB85C\uB529 \uC870\uC728 \u2500\u2500
   \uD750\uB984:
   1) shops + videos \uBAA9\uB85D \uC644\uB8CC \u2192 _checkLdReady()
   2) \uC989\uC2DC \uCCAB \uC601\uC0C1 src \uC138\uD305 (\uB2E4\uC6B4\uB85C\uB4DC \uC2DC\uC791)
   3) \uC2A4\uD50C\uB798\uC2DC \uD398\uC774\uB4DC(400ms)\uD558\uB294 \uB3D9\uC548 \uB3D9\uC2DC\uC5D0 \uB2E4\uC6B4\uB85C\uB4DC
   4) \uD398\uC774\uB4DC \uB05D \u2192 setupObs() \u2192 play()
   \uCD5C\uB300 fallback: 5\uCD08 */
var _ldStartTime = Date.now();
var _MIN_SPLASH_MS = 600;
var _ldReadyFlags = { shops: false, videos: false };
var _ldFallbackTimer = null;

/* \uD504\uB85C\uADF8\uB808\uC2A4 \uBC14 \uB2E8\uACC4 \uC81C\uC5B4 */
function setLdProgress(pct) {
  var prog = document.querySelector('.ld-prog');
  if(!prog) return;
  prog.style.animation = 'none';
  prog.style.transition = 'width .4s ease';
  prog.style.width = pct + '%';
}

/* loading hide */
var _ldHidden = false;
function hideLd(){
  if(_ldHidden) return;
  _ldHidden = true;
  if(_ldFallbackTimer){ clearTimeout(_ldFallbackTimer); _ldFallbackTimer = null; }
  var ld = document.getElementById('ld');
  if(!ld){ setupObs(); return; }
  setLdProgress(100);
  // \uD398\uC774\uB4DC \uC2DC\uC791\uACFC \uB3D9\uC2DC\uC5D0 \uCCAB \uC601\uC0C1 src \uC138\uD305 \u2192 \uB2E4\uC6B4\uB85C\uB4DC \uBCD1\uD589
  _preloadFirstVideo();
  ld.style.transition = 'opacity .4s';
  ld.style.opacity = '0';
  setTimeout(function(){
    ld.style.display = 'none';
    setupObs(); // \uC774\uBBF8 \uB2E4\uC6B4\uB85C\uB4DC \uC2DC\uC791\uB41C \uC0C1\uD0DC \u2192 play()\uB9CC
  }, 420);
}

/* \uC2A4\uD50C\uB798\uC2DC \uD398\uC774\uB4DC \uC911\uC5D0 \uCCAB \uC601\uC0C1 src \uC138\uD305 (\uB2E4\uC6B4\uB85C\uB4DC \uC120\uD589) */
function _preloadFirstVideo(){
  var v0 = document.getElementById('vid0');
  if(!v0 || v0.src || !v0.dataset.src) return;
  v0.preload = 'auto';
  v0.src = v0.dataset.src;
  v0.load();
}

/* shops + videos \uB458 \uB2E4 \uC900\uBE44\uB418\uBA74 \uCD5C\uC18C\uC2DC\uAC04 \uD6C4 hideLd() */
function _checkLdReady() {
  if(!_ldReadyFlags.shops || !_ldReadyFlags.videos) return;
  // vids\uC758 shopId \u2192 videoUrl/thumbnail \uC744 allShopsData\uC5D0 \uC8FC\uC785
  _injectVideoIntoShops();
  var elapsed = Date.now() - _ldStartTime;
  var delay = Math.max(0, _MIN_SPLASH_MS - elapsed);
  setTimeout(hideLd, delay);
}

/* vids \uBC30\uC5F4\uC5D0\uC11C shopId \uAE30\uC900\uC73C\uB85C \uC601\uC0C1 \uC815\uBCF4\uB97C allShopsData\uC5D0 \uC8FC\uC785 */
function _injectVideoIntoShops() {
  if(!vids || !vids.length || !allShopsData || !allShopsData.length) return;
  // shopId \u2192 \uCCAB \uBC88\uC9F8 video \uB9E4\uD551
  var vidMap = {};
  vids.forEach(function(v){
    if(v && v.shopId && !vidMap[v.shopId]) vidMap[v.shopId] = v;
  });
  allShopsData.forEach(function(s){
    var v = vidMap[s.id];
    if(v){
      if(!s.videoUrl && v.videoUrl) s.videoUrl = v.videoUrl;
      if(!s.videoThumb && (v.thumbnail || s.thumbnail)) s.videoThumb = v.thumbnail || s.thumbnail;
    }
  });
}

/* \u2500\u2500 \uC2A4\uD50C\uB798\uC2DC \uC911 shops \uB370\uC774\uD130 Prefetch \u2500\u2500
   \uC2A4\uD50C\uB798\uC2DC\uAC00 \uBCF4\uC774\uB294 \uB3D9\uC548 /api/shops \uB97C \uBBF8\uB9AC \uAC00\uC838\uC640\uC11C
   shopCache \uC5D0 \uCC44\uC6CC\uB460 \u2192 \uBAA8\uB2EC \uC5F4 \uB54C fetch \uC5C6\uC774 \uC989\uC2DC \uB80C\uB354 */
var _prefetchDone = false;
function prefetchShops(){
  if(_prefetchDone) return;
  _prefetchDone = true;
  setLdProgress(10);
  fetch('/api/shops')
    .then(function(r){ return r.json(); })
    .then(function(d){
      var list = d.shops || [];
      list.forEach(function(s){
        if(s && s.id && !shopCache[s.id]) shopCache[s.id] = s;
      });
      setLdProgress(40);
      _ldReadyFlags.shops = true;
      _checkLdReady();
    })
    .catch(function(){
      setLdProgress(40);
      _ldReadyFlags.shops = true;
      _checkLdReady();
    });
}
// \uD398\uC774\uC9C0 \uB85C\uB4DC \uC989\uC2DC \uC2DC\uC791
prefetchShops();

/* \uCE74\uD14C\uACE0\uB9AC \uC804\uD658 \uC2A4\uD53C\uB108 */
function showCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.add('on'); }
function hideCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.remove('on'); }

function loadVideos(cat) {
  // \uCCAB \uB85C\uB4DC\uC774\uACE0 cat='all'\uC774\uBA74 SSR \uC778\uB77C\uC778 \uB370\uC774\uD130 \uC989\uC2DC \uC0AC\uC6A9
  if((cat === 'all' || !cat) && window.__INIT_VIDEOS__ && window.__INIT_VIDEOS__.length) {
    vids = window.__INIT_VIDEOS__;
    window.__INIT_VIDEOS__ = null;
    for(var i=vids.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
    }
    renderFeed();
    setLdProgress(85);
    _ldReadyFlags.videos = true;
    _checkLdReady();
    return;
  }
  // \uCE74\uD14C\uACE0\uB9AC \uC804\uD658
  var isCatSwitch = _ldHidden;
  if(isCatSwitch) {
    showSkeletonFeed();
    showCatLoading();
  }
  fetch('/api/videos?category='+(cat||'all'))
    .then(function(r){ return r.json(); })
    .then(function(d){
      vids = d.videos || [];
      for(var i=vids.length-1;i>0;i--){
        var j=Math.floor(Math.random()*(i+1));
        var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
      }
      hideCatLoading();
      renderFeed();
      if(!_ldHidden){
        setLdProgress(85);
        _ldReadyFlags.videos = true;
        _checkLdReady();
      }
    })
    .catch(function(){
      vids = [];
      hideCatLoading();
      renderFeed();
      if(!_ldHidden){ hideLd(); }
    });
  // \uCD5C\uB300 5\uCD08 fallback
  _ldFallbackTimer = setTimeout(function(){ hideLd(); hideCatLoading(); }, 5000);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function areaOnly(loc) {
  if(!loc) return '';
  return String(loc).split(',')[0].trim();
}

function renderFeed() {
  var feed = document.getElementById('feed');
  var dots = document.getElementById('dots');
  feed.innerHTML = ''; dots.innerHTML = '';
  if(!vids.length){
    feed.innerHTML = '<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:rgba(255,255,255,.28);font-size:14px"><i class="fas fa-film" style="font-size:40px;margin-bottom:4px;color:rgba(232,65,122,.3)"></i><div>No videos yet</div><div style="font-size:12px;color:rgba(255,255,255,.18)">Add shops and videos from the admin panel</div></div>';
    if(!_ldHidden) hideLd();
    return;
  }
  for(var i=0;i<vids.length;i++){
    var dot=document.createElement('div');
    dot.className='dot'+(i===0?' on':''); dot.id='dot'+i;
    dots.appendChild(dot);
  }
  for(var i=0;i<vids.length;i++){ buildSlide(vids[i],i); }
  // \uCE74\uD14C\uACE0\uB9AC \uC804\uD658(\uC2A4\uD50C\uB798\uC2DC \uC774\uBBF8 \uC5C6\uC74C)\uC774\uBA74 \uC989\uC2DC setupObs
  if(_ldHidden) setupObs();
  // \uCCAB \uB85C\uB4DC\uBA74 _startFirstVideoLoad()\uAC00 \uB530\uB85C \uD638\uCD9C\uB428 \u2192 setupObs\uB294 hideLd \uD6C4 \uC2E4\uD589
}

function getAutoThumb(videoUrl) {
  if(!videoUrl) return '';
  if(videoUrl.indexOf('cloudinary.com') === -1) return '';
  // 9:16 \uC138\uB85C \uC378\uB124\uC77C, WebP, \uC800\uD654\uC9C8(q_auto:low) \u2192 \uBE60\uB978 poster \uD45C\uC2DC
  var u = videoUrl.replace('/video/upload/', '/video/upload/so_0,w_420,h_748,c_fill,q_auto:low,f_webp/');
  var dot = u.lastIndexOf('.');
  return dot !== -1 ? u.slice(0, dot) + '.webp' : u + '.webp';
}

function cdnImg(url, w, h) {
  // Cloudinary \uC774\uBBF8\uC9C0 \uCD5C\uC801\uD654: WebP \uBCC0\uD658 + \uD06C\uAE30 \uC870\uC815 + \uC790\uB3D9 \uC555\uCD95
  if(!url || url.indexOf('res.cloudinary.com') === -1) return url;
  var transform = 'w_'+w+(h?',h_'+h:'')+',c_fill,q_auto:good,f_webp,dpr_auto';
  return url.replace('/image/upload/', '/image/upload/'+transform+'/');
}

function cdnVideo(url) {
  // Cloudinary \uC601\uC0C1 \uC2A4\uD2B8\uB9AC\uBC0D \uCD5C\uC801\uD654: \uD654\uC9C8 \uC790\uB3D9, \uC2A4\uD2B8\uB9AC\uBC0D \uD78C\uD2B8
  if(!url || url.indexOf('res.cloudinary.com') === -1) return url;
  return url.replace('/video/upload/', '/video/upload/q_auto:low,vc_auto,br_800k/');
}

function buildSlide(v, idx) {
  var feed = document.getElementById('feed');
  var shop = v.shop || {};
  var s = document.createElement('article');
  s.className='slide'; s.id='sl'+idx;
  s.setAttribute('itemscope','');
  s.setAttribute('itemtype','https://schema.org/VideoObject');
  var tags = (v.tags||[]).map(function(t){return '<span class="vtag">'+esc(t)+'</span>';}).join('');
  var uploadDate = v.createdAt || new Date().toISOString().split('T')[0];
  // \uC378\uB124\uC77C: Cloudinary \uC800\uD654\uC9C8 WebP \uC790\uB3D9 \uC0DD\uC131 (poster \uBE60\uB978 \uD45C\uC2DC\uC6A9)
  var thumb = v.thumbnail || getAutoThumb(v.videoUrl) || '';
  // \uCCAB\uBC88\uC9F8 \uC2AC\uB77C\uC774\uB4DC\uB294 eager load, \uB098\uBA38\uC9C0\uB294 lazy
  var imgLoading = idx === 0 ? 'eager' : 'lazy';
  var imgPriority = idx === 0 ? ' fetchpriority="high"' : '';

  s.innerHTML =
    '<meta itemprop="name" content="'+esc(v.title)+'">' +
    '<meta itemprop="description" content="'+esc(v.description)+'">' +
    '<meta itemprop="thumbnailUrl" content="'+esc(thumb)+'">' +
    '<meta itemprop="uploadDate" content="'+esc(uploadDate)+'">' +
    (thumb ? '<img class="bg-img" src="'+esc(thumb)+'" alt="'+esc(v.title)+'" loading="'+imgLoading+'" decoding="async"'+imgPriority+' onload="imgLoaded(this)" onerror="imgLoaded(this)">' : '<div class="bg-img loaded" style="background:linear-gradient(135deg,#1a0a14 0%,#1c0e22 40%,#0f0816 100%)"></div>') +
    '<video id="vid'+idx+'" loop muted playsinline preload="'+(idx===0?'auto':'none')+'" poster="'+esc(thumb)+'" itemprop="contentUrl"></video>' +
    '<div id="playic'+idx+'" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:4;width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.55);align-items:center;justify-content:center;pointer-events:none;backdrop-filter:blur(4px)"><i class="fas fa-pause" style="font-size:20px;color:#fff"></i></div>' +
    '<div id="bufic'+idx+'" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;pointer-events:none"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.15);border-top-color:rgba(255,255,255,.8);border-radius:50%;animation:spin .7s linear infinite"></div></div>' +
    '<div class="ov"></div>' +
    '<div class="info">' +
      '<div class="slide-cat-badge"><i class="fas '+(catFaIcons[shop.category]||'fa-star')+'"></i> '+esc((shop.category||'').toUpperCase())+'</div>' +
      '<div class="btns-row">' +
        '<div class="shop-info-block">'
          +'<div class="shop-info-name"><i class="fas fa-store si-icon"></i>'+esc(shop.name||'')+'</div>'
          +(areaOnly(shop.location||'')
            ?'<div class="shop-info-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location||''))+'</div>'
            :'')
        +'</div>' +
        '<button class="wa-btn" id="wabtn'+idx+'"><i class="fab fa-whatsapp" style="font-size:14px"></i> Book</button>' +
      '</div>' +
    '</div>' +
    '<div class="hint"><i class="fas fa-chevron-up" style="font-size:10px"></i><span>Swipe Up</span></div>';

  feed.appendChild(s);

  (function(vid, vidIdx, shopData) {
    var ve     = document.getElementById('vid'+vidIdx);
    var ov     = s.querySelector('.ov');
    var playIc = document.getElementById('playic'+vidIdx);
    var bufIc  = document.getElementById('bufic'+vidIdx);

    if(ve) {
      ve.setAttribute('data-src', esc(cdnVideo(v.videoUrl)));

      // \u2500\u2500 \uBC84\uD37C\uB9C1 \uC2A4\uD53C\uB108 \uC81C\uC5B4 \u2500\u2500
      function showBuf(){ if(bufIc) bufIc.style.display='flex'; }
      function hideBuf(){ if(bufIc) bufIc.style.display='none'; }

      ve.addEventListener('waiting',  showBuf);   // \uBC84\uD37C \uBE44\uBA74 \uC2A4\uD53C\uB108
      ve.addEventListener('stalled',  showBuf);   // \uB124\uD2B8\uC6CC\uD06C \uC9C0\uC5F0
      ve.addEventListener('seeking',  showBuf);
      ve.addEventListener('canplay',  hideBuf);   // \uC7AC\uC0DD \uC900\uBE44 \uC644\uB8CC
      ve.addEventListener('playing',  hideBuf);   // \uC2E4\uC81C \uC7AC\uC0DD \uC2DC\uC791
      ve.addEventListener('play',     function(){ hideBuf(); if(playIc) playIc.style.display='none'; });
      ve.addEventListener('pause',    function(){ hideBuf(); if(playIc) playIc.style.display='flex'; });

      // \u2500\u2500 \uC5D0\uB7EC/\uBA48\uCDA4 \uC2DC \uC790\uB3D9 \uC7AC\uC2DC\uB3C4 \u2500\u2500
      ve.addEventListener('error', function(){
        hideBuf();
        // 1\uCD08 \uD6C4 src \uC7AC\uC138\uD305\uC73C\uB85C \uC7AC\uC2DC\uB3C4
        setTimeout(function(){
          if(ve.dataset.src && !ve.dataset.retried){
            ve.dataset.retried = '1';
            ve.src = ve.dataset.src;
            ve.load();
            ve.play().catch(function(){});
          }
        }, 1000);
      });

      // \u2500\u2500 stalled 3\uCD08 \uC9C0\uC18D \uC2DC \uAC15\uC81C load() \u2500\u2500
      var _stallTimer = null;
      ve.addEventListener('stalled', function(){
        clearTimeout(_stallTimer);
        _stallTimer = setTimeout(function(){
          if(ve.dataset.src && ve.networkState === 2 /* NETWORK_LOADING */){
            var t = ve.currentTime;
            ve.load();
            ve.currentTime = t;
            ve.play().catch(function(){});
          }
        }, 3000);
      });
      ve.addEventListener('playing', function(){ clearTimeout(_stallTimer); });
    }

    if(ov && ve) {
      ov.addEventListener('click', function(e){
        e.stopPropagation();
        if(ve.paused){ ve.muted=isMuted; ve.play().catch(function(){}); }
        else { ve.pause(); }
      });
    }

    document.getElementById('wabtn'+vidIdx).onclick = function(e){
      e.stopPropagation();
      // slug \uC788\uC73C\uBA74 \uC5C5\uCCB4 \uC0C1\uC138 \uD398\uC774\uC9C0\uB85C \uC774\uB3D9, \uC5C6\uC73C\uBA74 \uBAA8\uB2EC
      var slug = shopData.slug || (vid.shop && vid.shop.slug) || '';
      if(slug){ location.href = '/shop/'+slug; }
      else { openShopModal(vid.shopId||shopData.id); }
    };

    var infoEl = s.querySelector('.info');
    if(infoEl) infoEl.addEventListener('click', function(e){ e.stopPropagation(); });

    fetch('/api/videos/'+vid.id+'/view', {method:'POST'}).catch(function(){});
  })(v, idx, shop);
}

function loadVidSrc(vid){
  if(vid && !vid.src && vid.dataset.src){
    vid.preload = 'auto';
    vid.src = vid.dataset.src;
  }
}
function preloadNext(idx){
  // \uB2E4\uC74C 2\uAC1C \uC2AC\uB77C\uC774\uB4DC \uBBF8\uB9AC \uB2E4\uC6B4\uB85C\uB4DC (\uC1FC\uCE20\uCC98\uB7FC \uB04A\uAE40 \uC5C6\uC774)
  for(var n=1; n<=2; n++){
    var next = document.getElementById('vid'+(idx+n));
    if(next && !next.src && next.dataset.src){
      next.preload = 'auto';
      next.src = next.dataset.src;
      next.load();
    }
  }
}

function _playVid(vid, bufIc){
  if(!vid) return;
  vid.muted = true; // \uBAA8\uBC14\uC77C autoplay \uD544\uC218 (\uC18C\uB9AC OFF \uC0C1\uD0DC\uB85C \uC2DC\uC791)
  if(bufIc) bufIc.style.display = 'flex';
  // src \uC5C6\uC73C\uBA74 \uC138\uD305
  if(!vid.src && vid.dataset.src){
    vid.preload = 'auto';
    vid.src = vid.dataset.src;
    vid.load();
  }
  var _retried = false;
  var doPlay = function(){
    var p = vid.play();
    if(!p) return;
    p.then(function(){
      if(bufIc) bufIc.style.display = 'none';
    }).catch(function(err){
      // NotAllowedError = \uC790\uB3D9\uC7AC\uC0DD \uC815\uCC45 \uCC28\uB2E8
      // \uBAA8\uBC14\uC77C: muted \uC0C1\uD0DC\uC778\uB370\uB3C4 \uB9C9\uD788\uBA74 \uC7A0\uC2DC \uD6C4 \uC7AC\uC2DC\uB3C4
      if(!_retried){
        _retried = true;
        vid.muted = true;
        setTimeout(function(){
          vid.play().then(function(){
            if(bufIc) bufIc.style.display = 'none';
          }).catch(function(){
            // \uB450 \uBC88 \uC2E4\uD328 \u2192 \uC0AC\uC6A9\uC790\uAC00 \uD0ED\uD560 \uB54C\uAE4C\uC9C0 \uB300\uAE30
            if(bufIc) bufIc.style.display = 'none';
          });
        }, 500);
      } else {
        if(bufIc) bufIc.style.display = 'none';
      }
    });
  };
  if(vid.readyState >= 3){
    if(bufIc) bufIc.style.display = 'none';
    doPlay();
  } else {
    vid.addEventListener('canplay', function onCp(){
      vid.removeEventListener('canplay', onCp);
      if(bufIc) bufIc.style.display = 'none';
      doPlay();
    }, {once: true});
    doPlay(); // \uBA3C\uC800 \uC2DC\uB3C4 (\uC774\uBBF8 \uB85C\uB529\uB410\uC744 \uACBD\uC6B0 \uB300\uBE44)
  }
}

function setupObs(){
  // _obsReady: true\uAC00 \uB418\uAE30 \uC804\uAE4C\uC9C0 IntersectionObserver \uCF5C\uBC31\uC5D0\uC11C play \uAE08\uC9C0
  // (\uCCAB \uC9C4\uC785 \uC2DC observe() \uC989\uC2DC \uCF5C\uBC31 fire \u2192 \uC544\uB798 \uC9C1\uC811 _playVid(v0)\uC640 \uCDA9\uB3CC \uBC29\uC9C0)
  var _obsReady = false;
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var idx = parseInt(e.target.id.replace('sl',''));
      var vid = document.getElementById('vid'+idx);
      var bufIc = document.getElementById('bufic'+idx);
      document.querySelectorAll('.dot').forEach(function(d,i){ d.classList.toggle('on',i===idx); });

      if(e.isIntersecting){
        if(vid && _obsReady){ // _obsReady \uD6C4\uC5D0\uB9CC obs\uAC00 play \uB2F4\uB2F9
          _playVid(vid, bufIc);
          preloadNext(idx);
        } else if(vid){
          preloadNext(idx); // \uC544\uC9C1 _obsReady \uC804 \u2192 preload\uB9CC
        }
      } else {
        if(vid){ vid.pause(); vid.currentTime = 0; }
        if(bufIc) bufIc.style.display = 'none';
      }
    });
  },{threshold: 0.6});

  document.querySelectorAll('.slide').forEach(function(s){ obs.observe(s); });

  // \uCCAB \uC2AC\uB77C\uC774\uB4DC \uC9C1\uC811 \uC7AC\uC0DD \uD6C4 obs\uC5D0 \uC81C\uC5B4\uAD8C \uB118\uAE40
  var v0 = document.getElementById('vid0');
  var buf0 = document.getElementById('bufic0');
  var dot0 = document.getElementById('dot0');
  if(dot0) dot0.classList.add('on');
  _playVid(v0, buf0);
  preloadNext(0);
  // \uC57D\uAC04\uC758 \uB51C\uB808\uC774 \uD6C4 obs \uD65C\uC131\uD654 (\uCCAB \uCF5C\uBC31 \uBB34\uC2DC \uC644\uB8CC \uD6C4)
  setTimeout(function(){ _obsReady = true; }, 800);
}

function openShopModal(shopId) {
  if(!shopId) return;
  document.getElementById('modalHero').innerHTML = '';
  document.getElementById('modalBtns').innerHTML = '';
  document.getElementById('shopModal').classList.add('open');
  document.getElementById('modalScroll').scrollTop = 0;

  // 1) \uCE90\uC2DC\uC5D0 \uC788\uACE0 \uC0C1\uC138 \uC815\uBCF4(services \uB4F1)\uB3C4 \uC788\uC73C\uBA74 \u2192 \uC989\uC2DC \uB80C\uB354, \uBC31\uADF8\uB77C\uC6B4\uB4DC \uAC31\uC2E0\uC740 \uC0DD\uB7B5
  var cached = shopCache[shopId];
  if(cached && cached._detail) {
    renderShopModal(cached);
    return;
  }

  // 2) prefetch \uB85C \uAE30\uBCF8 \uC815\uBCF4\uB9CC \uC788\uB294 \uCE90\uC2DC \u2192 \uC989\uC2DC \uAE30\uBCF8 \uB80C\uB354 \uD6C4 \uC0C1\uC138 \uC815\uBCF4 \uBC31\uADF8\uB77C\uC6B4\uB4DC \uBCF4\uC644
  if(cached && cached.name) {
    renderShopModal(cached); // \uC2A4\uD53C\uB108 \uC5C6\uC774 \uAE30\uBCF8 \uC815\uBCF4\uB85C \uBA3C\uC800 \uD45C\uC2DC
    // \uC0C1\uC138 \uC815\uBCF4 \uBC31\uADF8\uB77C\uC6B4\uB4DC fetch \u2192 \uC870\uC6A9\uD788 \uB36E\uC5B4\uC50C\uC6B0\uAE30
    fetch('/api/shops/'+shopId)
      .then(function(r){ return r.json(); })
      .then(function(d){
        var shop = d.shop; if(!shop) return;
        shop._detail = true; // \uC0C1\uC138 \uC644\uB8CC \uB9C8\uCEE4
        shop._videos = d.videos || [];
        shopCache[shopId] = shop;
        // \uBAA8\uB2EC\uC774 \uC544\uC9C1 \uC5F4\uB824\uC788\uC73C\uBA74 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC5C5\uB370\uC774\uD2B8
        if(document.getElementById('shopModal').classList.contains('open')) {
          renderShopModal(shop);
        }
      }).catch(function(){});
    return;
  }

  // 3) \uCE90\uC2DC \uC5C6\uC74C: vids \uBC30\uC5F4\uC5D0\uC11C shop \uAE30\uBCF8\uC815\uBCF4 \uCC3E\uC544 \uC2A4\uCF08\uB808\uD1A4 \uC989\uC2DC \uD45C\uC2DC
  var quickShop = null;
  for(var i=0;i<vids.length;i++){
    if(vids[i].shopId===shopId || (vids[i].shop&&vids[i].shop.id===shopId)){
      quickShop = vids[i].shop || null; break;
    }
  }
  if(quickShop && quickShop.name) {
    document.getElementById('modalContent').innerHTML =
      '<div class="m-shop-header">'
        +'<div class="m-shop-name">'+esc(quickShop.name||'')+'</div>'
        +(quickShop.location?'<div class="m-shop-sub"><div class="m-shop-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(quickShop.location))+'</div></div>':'')
      +'</div>'
      +'<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.2)"><i class="fas fa-spinner fa-spin" style="font-size:18px"></i></div>';
  } else {
    document.getElementById('modalContent').innerHTML = '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,.25)"><i class="fas fa-spinner fa-spin" style="font-size:22px"></i></div>';
  }

  // 4) \uC0C1\uC138 API fetch \u2192 \uCE90\uC2DC \uC800\uC7A5 \uD6C4 \uB80C\uB354
  fetch('/api/shops/'+shopId).then(function(r){ return r.json(); }).then(function(d){
    var shop = d.shop;
    if(!shop){ document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">Shop information unavailable.</div>'; return; }
    shop._detail = true; // \uC0C1\uC138 \uC644\uB8CC \uB9C8\uCEE4
    shop._videos = d.videos || [];
    shopCache[shopId] = shop;
    renderShopModal(shop);
  }).catch(function(){
    document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">An error occurred.</div>';
  });
}

function renderShopModal(shop) {
  var waNum = platform.whatsapp || '8201058947690';
  /* \u2500\u2500 \uC5C5\uCCB4\uBCC4 \uAD6C\uC870\uD654\uB41C \uC608\uC57D \uBA54\uC2DC\uC9C0 \u2500\u2500 */
  var shopName = shop.name || 'your shop';
  var NL = String.fromCharCode(10);
  var shopLocation = shop.location ? ' ('+areaOnly(shop.location)+')' : '';
  var waMsg =
    '[ Booking Request ]' + NL
    + 'Shop: ' + shopName + shopLocation + NL
    + NL
    + 'Date: ' + NL
    + 'Time: ' + NL
    + 'Service: ' + NL
    + 'Name: ' + NL
    + 'People: ';
  var waUrl = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(waMsg);

  /* \u2500\u2500 \uC0AC\uC9C4 \uBC30\uC5F4 (thumbnail + photos, \uC911\uBCF5 \uC81C\uAC70) \u2500\u2500 */
  var allPhotos = [];
  if(shop.thumbnail) allPhotos.push(shop.thumbnail);
  (shop.photos||[]).forEach(function(p){ if(p && p!==shop.thumbnail) allPhotos.push(p); });

  /* \u2500\u2500 \uD788\uC5B4\uB85C (\uD480\uBE14\uB9AC\uB4DC) \u2500\u2500 */
  var heroHtml = '';
  if(allPhotos.length > 0) {
    heroHtml =
      '<div class="m-hero" id="mHeroWrap">'
        +'<img class="m-hero-img" id="mHeroImg" src="'+esc(cdnImg(allPhotos[0],800,600))+'" alt="'+esc(shop.name)+'" loading="eager" fetchpriority="high" decoding="async"'
          +' onload="heroImgLoaded(this)" onerror="heroImgLoaded(this)">'
        +'<div class="m-hero-ov"></div>'
        +'<div class="m-hero-badge">'+(catIcons[shop.category]||'')+'&nbsp;'+esc((shop.category||'').toUpperCase())+'</div>'
      +'</div>';

    /* \uD788\uC5B4\uB85C \uBC14\uB85C \uC544\uB798 \uC804\uCCB4 \uC378\uB124\uC77C \uC2A4\uD2B8\uB9BD (\uCD5C\uB300 6\uC7A5) */
    if(allPhotos.length > 1) {
      var stripPhotos = allPhotos.slice(0, 6);
      var strips = stripPhotos.map(function(url, i){
        return '<div class="m-ts-thumb'+(i===0?' on':'')+'" data-photo-url="'+esc(cdnImg(url,800,600))+'" onclick="setMHero(this.dataset.photoUrl,this)">'
          +'<img src="'+esc(cdnImg(url,120,120))+'" alt="" loading="lazy" decoding="async" onload="thumbImgLoaded(this)" onerror="this.parentElement.remove()">'
          +'</div>';
      }).join('');
      heroHtml += '<div class="m-thumbstrip">'+strips+'</div>';
    }
  }
  document.getElementById('modalHero').innerHTML = heroHtml;

  /* \u2500\u2500 \uBCC4\uC810 \u2500\u2500 */
  var rating = shop.rating || 5.0;
  var reviewCount = shop.reviewCount || 0;
  var starsHtml = '';
  for(var si=0; si<5; si++) starsHtml += (si < Math.round(rating)) ? '&#9733;' : '&#9734;';

  /* \u2500\u2500 \uC601\uC5C5\uC2DC\uAC04 \uD30C\uC2F1 (\uC694\uC77C\uBCC4 \uD14C\uC774\uBE14) \u2500\u2500 */
  var hoursHtml = '';
  if(shop.hours) {
    // "Monday: 10:00 AM \u2013 7:00 PM / Tuesday: ..." \uB610\uB294 "| " \uAD6C\uBD84\uC790 \uCC98\uB9AC
    var days = shop.hours.split(/s*[/|]s*/).map(function(s){ return s.trim(); }).filter(Boolean);
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var today = new Date().getDay(); // 0=Sun
    if(days.length > 1) {
      // \uAD6C\uAE00 Places \uD3EC\uB9F7
      var rows = days.map(function(line) {
        var col = line.indexOf(':');
        var dayPart = col > -1 ? line.slice(0, col).trim() : line;
        var timePart = col > -1 ? line.slice(col+1).trim() : '';
        var isToday = dayNames[today] && dayPart.toLowerCase().startsWith(dayNames[today].toLowerCase());
        var isClosed = timePart.toLowerCase().includes('closed');
        return '<tr class="'+(isToday?'m-hours-td-today':'')+'">'
          +'<td class="m-hours-td-day">'+esc(dayPart.slice(0,3).toUpperCase())+'</td>'
          +'<td class="m-hours-td-time'+(isClosed?' closed':'')+'">'+esc(timePart||'Closed')+'</td>'
          +'</tr>';
      }).join('');
      hoursHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div>'
        +'<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:6px 14px">'
        +'<table class="m-hours-table">'+rows+'</table></div></div>';
    } else {
      // \uB2E8\uC21C \uD14D\uC2A4\uD2B8
      hoursHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.72)">'+esc(shop.hours)+'</div></div>';
    }
  }

  /* \u2500\u2500 \uC815\uBCF4 \uCE74\uB4DC \uADF8\uB9AC\uB4DC \u2500\u2500 */
  var infoCards = '';
  if(shop.location) {
    // Hours\uB294 \uC774\uC81C \uBCC4\uB3C4 \uC139\uC158\uC73C\uB85C \uCC98\uB9AC \u2014 \uC5EC\uAE30\uC120 \uC81C\uC678
  }
  if(shop.location) {
    var locArea = areaOnly(shop.location);
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Area</div><div class="m-info-card-val"><i class="fas fa-map-marker-alt"></i>'+esc(locArea)+'</div></div>';
  }
  // Price Range \uC778\uD3EC\uCE74\uB4DC \uC81C\uAC70
  if(reviewCount > 0) {
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Rating</div><div class="m-info-card-val"><span class="m-stars">'+starsHtml+'</span>&nbsp;'+rating+'</div></div>';
  }
  var infoGridHtml = infoCards ? '<div class="m-info-grid">'+infoCards+'</div>' : '';

  /* \u2500\u2500 \uC8FC\uC18C (\uC804\uCCB4) \u2500\u2500 */
  var addrHtml = shop.address
    ? '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.42);margin-bottom:16px;line-height:1.5">'
        +'<i class="fas fa-location-dot" style="color:var(--pk2);margin-top:2px;flex-shrink:0"></i>'
        +'<span>'+esc(shop.address)+'</span>'
      +'</div>'
    : '';

  /* \u2500\u2500 \uC18C\uAC1C \u2500\u2500 */
  var descHtml = shop.description
    ? '<div class="m-sec"><div class="m-sec-title">About</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.62);line-height:1.8;letter-spacing:.1px">'+esc(shop.description)+'</div>'
      +'</div>'
    : '';

  /* \u2500\u2500 \uAC00\uACA9 \uC139\uC158 \u2014 \uAC00\uACA9 \uC788\uC73C\uBA74 \uD14C\uC774\uBE14, \uC5C6\uC73C\uBA74 \uC0C1\uB2F4 \uC548\uB0B4 \u2500\u2500 */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    // \uAC00\uACA9 \uACF5\uAC1C \uC5C5\uCCB4 \u2192 Price List \uD14C\uC774\uBE14
    var rows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+esc(p.name||'')+'</span><span class="m-price-val">'+esc(p.price||'')+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Price List</div><div class="m-price-list">'+rows+'</div></div>';
  } else {
    // \uAC00\uACA9 \uBE44\uACF5\uAC1C \uC5C5\uCCB4 \u2192 \uC548\uB0B4 \uD14D\uC2A4\uD2B8\uB9CC \uD45C\uC2DC
    priceHtml = '<div class="m-sec">'
      +'<div class="m-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Pricing</div>'
      +'<div style="font-size:13px;color:rgba(255,255,255,.55);line-height:1.7;padding:4px 0">'
        +'Prices vary by treatment &amp; consultation. '
        +'<span style="color:rgba(255,255,255,.35)">Contact us via WhatsApp below for a free quote.</span>'
      +'</div>'
    +'</div>';
  }

  /* \u2500\u2500 \uC11C\uBE44\uC2A4 \uD0DC\uADF8 \u2500\u2500 */
  var svcHtml = '';
  if(shop.services && shop.services.length > 0) {
    var svcs = shop.services.map(function(s){ return '<span class="m-svc-tag">'+esc(s)+'</span>'; }).join('');
    svcHtml = '<div class="m-sec"><div class="m-sec-title">Services</div><div class="m-svc-tags">'+svcs+'</div></div>';
  }

  /* \u2500\u2500 \uAD6C\uAE00\uB9F5 embed: lat/lng+place_id > embed > address \uC21C\uC73C\uB85C \uC2DC\uB3C4 \u2500\u2500 */
  var embedSrc = shop.googleMapEmbed || '';
  // 1\uC21C\uC704: lat/lng \uC88C\uD45C\uB85C \uD540 \uD45C\uC2DC (z=17 \uADFC\uC811 \uC90C, API\uD0A4 \uBD88\uD544\uC694)
  if(!embedSrc && shop.lat && shop.lng) {
    var mlat = parseFloat(shop.lat), mlng = parseFloat(shop.lng);
    embedSrc = 'https://maps.google.com/maps?q='+mlat+','+mlng+'&z=17&output=embed&hl=en';
  }
  // 2\uC21C\uC704: URL\uC5D0\uC11C \uD30C\uC2F1
  if(!embedSrc && shop.googleMapUrl) {
    var q = '';
    var qm = shop.googleMapUrl.match(/[?&]q=([^&]+)/);
    if(qm) { try { q = decodeURIComponent(qm[1]); } catch(e3){ q = qm[1]; } }
    else {
      var latm = shop.googleMapUrl.match(/@(-?d+.d+),(-?d+.d+)/);
      if(latm) q = latm[1]+','+latm[2];
    }
    if(!q && shop.address) q = shop.address;
    if(!q && shop.name)    q = shop.name + ' Seoul';
    if(q) embedSrc = 'https://www.google.com/maps?q='+encodeURIComponent(q)+'&output=embed&hl=en';
  }
  /* Location: embed URL \uC9C1\uC811 \uD45C\uC2DC \uB610\uB294 \uC8FC\uC18C \uD14D\uC2A4\uD2B8 */
  var mapHtml = '';
  if(embedSrc) {
    mapHtml = '<div class="m-sec"><div class="m-sec-title">Location</div>'
      +'<div class="m-map">'
        +'<iframe src="'+embedSrc+'" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0"></iframe>'
        +'<div class="m-map-cover"><i class="fas fa-map-marker-alt m-map-cover-icon"></i><span class="m-map-cover-txt">SeoulBeautyTrip</span></div>'
      +'</div>'
    +'</div>';
  } else if(shop.address || shop.location) {
    mapHtml = '<div class="m-sec"><div class="m-sec-title">Location</div>'
      +'<div style="padding:14px;background:rgba(255,255,255,.04);border-radius:12px;font-size:13px;color:rgba(255,255,255,.75)">'
        +(shop.address ? '<div><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>'+esc(shop.address)+'</div>' : '')
        +(shop.location && shop.location !== shop.address ? '<div style="margin-top:5px;color:rgba(255,255,255,.4);font-size:12px">'+esc(shop.location)+'</div>' : '')
      +'</div>'
    +'</div>';
  }

  /* \u2500\u2500 \uAD6C\uAE00 \uB9AC\uBDF0 \uC139\uC158 \u2500\u2500 */
  var reviewsHtml = '';
  var shopReviews = shop.reviews || [];
  if (shopReviews.length > 0) {
    var reviewCards = shopReviews.map(function(rv) {
      var rvRating = Number(rv.rating) || 5;
      var rvStars = '\u2605'.repeat(Math.min(5,Math.max(0,rvRating))) + '\u2606'.repeat(Math.max(0,5-rvRating));
      return '<div class="m-review-card">'
        +'<div class="m-review-top">'
          +'<span class="m-review-author">'+esc(rv.author||'Guest')+'</span>'
          +'<span class="m-review-stars">'+rvStars+'</span>'
        +'</div>'
        +'<div class="m-review-text">'+esc(rv.text||'')+'</div>'
        +(rv.time?'<div class="m-review-time">'+esc(rv.time)+'</div>':'')
      +'</div>';
    }).join('');
    reviewsHtml = '<div class="m-sec">'
      +'<div class="m-sec-title"><i class="fas fa-star" style="color:var(--gold);margin-right:4px"></i>Google Reviews'
        +(reviewCount?' <span style="font-size:10px;color:rgba(255,255,255,.35);font-weight:400">('+rating+'\u2605 &nbsp;\xB7&nbsp; '+reviewCount.toLocaleString()+' reviews)</span>':'')
      +'</div>'
      +'<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px 14px">'+reviewCards+'</div>'
    +'</div>';
  }

  /* \u2500\u2500 \uC601\uC0C1 \uC139\uC158 \u2500\u2500 */
  var videosHtml = '';
  var shopVideos = shop._videos || [];
  if(shopVideos.length > 0) {
    var vidCards = shopVideos.map(function(v, vi) {
      var vThumb = v.thumbnail || shop.thumbnail || '';
      var vUrl   = v.videoUrl  || '';
      var vTitle = (function(){
        var t = (v.title || '').trim();
        if(!t) return shop.name;
        // \uD30C\uC77C\uBA85 \uD328\uD134 \uAC10\uC9C0: \uC601\uBB38+\uC22B\uC790+_.- 8\uAE00\uC790 \uC774\uC0C1\uC774\uACE0 \uACF5\uBC31 \uC5C6\uC74C \u2192 shop.name\uC73C\uB85C \uB300\uCCB4
        if(/^[a-zA-Z0-9_.~-]{8,}$/.test(t)) return shop.name;
        // shop.name\uACFC \uB3D9\uC77C\uD558\uAC70\uB098 \uAC70\uC758 \uAC19\uC73C\uBA74 \uADF8\uB300\uB85C shop.name
        if(t === shop.name) return shop.name;
        return t;
      })();
      var vViews = v.views >= 1000 ? (v.views/1000).toFixed(1)+'K' : String(v.views||0);
      return '<div class="m-vid-card" id="mVidCard'+vi+'" onclick="mVidPlay('+vi+',this)">'
        +(vUrl?'<video data-src="'+esc(vUrl)+'" loop muted playsinline preload="none"></video>':'')
        +(vThumb?'<img src="'+esc(vThumb)+'" alt="'+esc(vTitle)+'" loading="lazy" decoding="async">':'<div style="position:absolute;inset:0;background:#111"></div>')
        +'<div class="m-vid-card-ov">'
          +'<div class="m-vid-card-title">'+esc(vTitle)+'</div>'
          +'<div class="m-vid-card-views"><i class="fas fa-eye"></i>'+vViews+'</div>'
        +'</div>'
        +'<div class="m-vid-play-ic"><i class="fas fa-play"></i></div>'
      +'</div>';
    }).join('');
    videosHtml = '<div class="m-sec" style="margin-bottom:0">'
      +'<div class="m-sec-title"><i class="fas fa-play-circle" style="color:var(--pk);margin-right:4px"></i>Videos'
        +' <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:400;letter-spacing:0">('+shopVideos.length+')</span>'
      +'</div>'
      +'<div class="m-vid-grid">'+vidCards+'</div>'
    +'</div>';
  }

  /* \u2500\u2500 \uBCF8\uBB38 \uC870\uB9BD \u2500\u2500 */
  document.getElementById('modalContent').innerHTML =
    '<div class="m-shop-header">'
      +'<div class="m-shop-name">'+esc(shop.name||'')+'</div>'
      +'<div class="m-shop-sub">'
        +(shop.location ? '<div class="m-shop-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location))+'</div>' : '')
        +(reviewCount > 0 ? '<div class="m-divider"></div><span class="m-stars">'+starsHtml+'</span><span class="m-rating-txt">'+rating+' ('+reviewCount.toLocaleString()+')</span>' : '')
      +'</div>'
    +'</div>'
    + addrHtml
    + infoGridHtml
    + descHtml
    + priceHtml
    + svcHtml
    + reviewsHtml
    + hoursHtml
    + mapHtml
    + videosHtml;

  /* \u2500\u2500 \uBC84\uD2BC \uC601\uC5ED \u2500\u2500 */
  var shopSlug = shop.slug || '';
  var pageUrl = shopSlug ? '/shop/'+shopSlug : '';
  var shareSupported = !!navigator.share;

  var btn2Row = '';

  // \uAC00\uACA9 \uC5C6\uB294 \uC5C5\uCCB4: WhatsApp \uBC84\uD2BC \uC5C6\uC774 \uC548\uB0B4 \uD14D\uC2A4\uD2B8\uB9CC \uC788\uC73C\uBA74 \uBC84\uD2BC \uD589\uB3C4 \uC2EC\uD50C\uD558\uAC8C
  var waBtn = '';
  if(shop.priceRange || (shop.servicePrices && shop.servicePrices.length > 0)) {
    waBtn = '<a href="'+waUrl+'" target="_blank" rel="noopener" class="m-wa">'
      +'<span class="m-wa-icon"><i class="fab fa-whatsapp"></i></span>'
      +'<span class="m-wa-text">'
        +'<b>Book via WhatsApp</b>'
        +'<span>\xB7 '+esc(shop.name||'this shop')+'</span>'
      +'</span>'
    +'</a>';
  } else {
    waBtn = '<a href="'+waUrl+'" target="_blank" rel="noopener" class="m-wa" style="background:linear-gradient(135deg,rgba(37,211,102,.7),rgba(18,140,94,.7))">'
      +'<span class="m-wa-icon"><i class="fab fa-whatsapp"></i></span>'
      +'<span class="m-wa-text">'
        +'<b>Ask via WhatsApp</b>'
        +'<span>\xB7 Free quote</span>'
      +'</span>'
    +'</a>';
  }

  document.getElementById('modalBtns').innerHTML = waBtn + btn2Row;
}

/* \u2500\u2500 \uBAA8\uB2EC \uB0B4 \uC601\uC0C1 \uC7AC\uC0DD/\uC815\uC9C0 \u2500\u2500 */
function mVidPlay(idx, card) {
  var vid = card.querySelector('video');
  if(!vid) return;
  // \uB2E4\uB978 \uCE74\uB4DC \uC815\uC9C0
  document.querySelectorAll('.m-vid-card').forEach(function(c){
    if(c !== card) {
      c.classList.remove('vid-on');
      var v = c.querySelector('video');
      if(v) { v.pause(); v.currentTime = 0; }
    }
  });
  if(card.classList.contains('vid-on')) {
    // \uC774\uBBF8 \uC7AC\uC0DD\uC911 \u2192 \uC815\uC9C0
    card.classList.remove('vid-on');
    vid.pause();
    vid.currentTime = 0;
  } else {
    // src \uB85C\uB4DC \uD6C4 \uC7AC\uC0DD
    if(vid.dataset.src && !vid.src) { vid.src = vid.dataset.src; }
    card.classList.add('vid-on');
    vid.muted = true;
    var p = vid.play();
    if(p && p.catch) p.catch(function(){});
  }
}

function shareShopBtn(btn) {
  var name = btn.getAttribute('data-name') || '';
  var path = btn.getAttribute('data-url') || '';
  shareShop(name, path);
}
function shareShop(name, path) {
  var url = path ? (location.origin + path) : location.href;
  if(navigator.share) {
    navigator.share({ title: name + ' | Seoul Beauty Trip', url: url }).catch(function(){});
  } else {
    // \uD074\uB9BD\uBCF4\uB4DC \uBCF5\uC0AC fallback
    try {
      navigator.clipboard.writeText(url).then(function(){
        showToast('Link copied!');
      });
    } catch(e) {
      // \uAD6C\uD615 \uBE0C\uB77C\uC6B0\uC800
      var ta = document.createElement('textarea');
      ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showToast('Link copied!'); } catch(e2) {}
      document.body.removeChild(ta);
    }
  }
}

function mapZoom(frameId, dir) {
  var fr = document.getElementById(frameId);
  if(!fr) return;
  var src = fr.src || fr.getAttribute('src') || '';
  /* zoom= \uD30C\uB77C\uBBF8\uD130 \uC870\uC815 (\uC5C6\uC73C\uBA74 15 \uAE30\uBCF8) */
  var zMatch = src.match(/[?&]z=(d+)/);
  var cur = zMatch ? parseInt(zMatch[1]) : 15;
  var next = Math.min(20, Math.max(10, cur + dir));
  if(src.indexOf('z=') !== -1) {
    src = src.replace(/([?&]z=)d+/, '$1'+next);
  } else {
    src += (src.indexOf('?') !== -1 ? '&' : '?') + 'z='+next;
  }
  fr.src = src;
}

function setMHero(url, el) {
  var wrap = document.getElementById('mHeroWrap');
  var img  = document.getElementById('mHeroImg');
  if(img) {
    // \uC0C8 \uC774\uBBF8\uC9C0\uB85C \uAD50\uCCB4 \uC2DC blur-up \uB2E4\uC2DC \uC2E4\uD589
    if(wrap) wrap.classList.remove('loaded');
    img.onload  = function(){ if(wrap) wrap.classList.add('loaded'); };
    img.onerror = function(){ if(wrap) wrap.classList.add('loaded'); };
    img.src = url;
  }
  document.querySelectorAll('.m-ts-thumb').forEach(function(t){ t.classList.remove('on'); });
  if(el) el.classList.add('on');
}

/* fullscreen viewer */
function openPhotoViewer(url) {
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;cursor:pointer';
  ov.innerHTML = '<img src="'+esc(url)+'" style="max-width:95vw;max-height:90vh;object-fit:contain;border-radius:8px">'
    +'<button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:18px;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">&#10005;</button>';
  ov.addEventListener('click', function(){ document.body.removeChild(ov); });
  document.body.appendChild(ov);
}

function closeModal(){
  // \uBAA8\uB2EC \uB0B4 \uC7AC\uC0DD \uC911\uC778 \uC601\uC0C1 \uBAA8\uB450 \uC815\uC9C0
  document.querySelectorAll('.m-vid-card').forEach(function(c){
    c.classList.remove('vid-on');
    var v = c.querySelector('video');
    if(v) { v.pause(); v.currentTime = 0; }
  });
  var bg = document.getElementById('shopModal');
  var panel = document.getElementById('modalPanel');
  panel.style.transition='transform .28s cubic-bezier(.32,1,.32,1)';
  panel.style.transform='translateY(100%)';
  setTimeout(function(){
    bg.classList.remove('open');
    panel.style.transition='';
    panel.style.transform='';
    // \uAC80\uC0C9 \uC624\uBC84\uB808\uC774\uAC00 \uC5F4\uB824\uC788\uC5C8\uC73C\uBA74 \uB2E4\uC2DC \uD45C\uC2DC (\uCE74\uD0C8\uB85C\uADF8 \uBCF5\uADC0)
    if(_searchOpen){
      var overlay = document.getElementById('search-overlay');
      if(overlay) overlay.classList.add('open');
    }
    // \uAC80\uC0C9 \uC624\uBC84\uB808\uC774\uAC00 \uB2EB\uD78C \uACBD\uC6B0\uAC00 \uC544\uB2D0 \uB54C\uB9CC \uD53C\uB4DC \uC601\uC0C1 \uC7AC\uAC1C
    if(!_searchOpen){
      document.querySelectorAll('.slide').forEach(function(sl){
        var rect = sl.getBoundingClientRect();
        if(rect.top >= -50 && rect.bottom <= window.innerHeight + 50){
          var idx = parseInt(sl.id.replace('sl',''));
          var fv = document.getElementById('vid'+idx);
          var fb = document.getElementById('bufic'+idx);
          if(fv && fv.paused){
            fv.muted = isMuted; // \uD604\uC7AC \uC18C\uB9AC \uC0C1\uD0DC \uBC18\uC601
            _playVid(fv, fb);
          }
        }
      });
    }
  }, 280);
}

/* close on backdrop click */
document.getElementById('shopModal').addEventListener('click', function(e){
  if(e.target === this) closeModal();
});

/* close on swipe down */
(function(){
  var panel = document.getElementById('modalPanel');
  var handle = document.getElementById('modalHandle');
  var startY = 0, startScrollTop = 0, dragging = false, isDragFromHandle = false;

  function onStart(e) {
    var touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    startScrollTop = document.getElementById('modalScroll').scrollTop;
    dragging = true;
    isDragFromHandle = e.currentTarget === handle;
    panel.style.transition = 'none';
  }
  function onMove(e) {
    if(!dragging) return;
    var touch = e.touches ? e.touches[0] : e;
    var dy = touch.clientY - startY;
    if(isDragFromHandle || (startScrollTop <= 0 && dy > 0)) {
      if(dy > 0) {
        e.preventDefault();
        panel.style.transform = 'translateY('+dy+'px)';
      }
    }
  }
  function onEnd(e) {
    if(!dragging) return;
    dragging = false;
    var touch = e.changedTouches ? e.changedTouches[0] : e;
    var dy = touch.clientY - startY;
    panel.style.transition = '';
    if(dy > 100) {
      closeModal();
    } else {
      panel.style.transition = 'transform .22s ease';
      panel.style.transform = 'translateY(0)';
      setTimeout(function(){ panel.style.transition=''; }, 220);
    }
  }

  handle.addEventListener('touchstart', onStart, {passive:true});
  panel.addEventListener('touchmove', onMove, {passive:false});
  panel.addEventListener('touchend', onEnd, {passive:true});
  handle.addEventListener('mousedown', function(e){
    onStart(e);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', function mu(e2){
      onEnd(e2);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', mu);
    });
  });
})();

window.toggleMute=function(){
  isMuted=!isMuted;
  document.getElementById('muteBtn').innerHTML=isMuted?'<i class="fas fa-volume-mute"></i>':'<i class="fas fa-volume-up"></i>';
  document.querySelectorAll('video').forEach(function(v){v.muted=isMuted;});
};
function showToast(msg){
  var t=document.getElementById('toast');
  t.innerHTML=msg; t.classList.add('on');
  setTimeout(function(){t.classList.remove('on');},3000);
}

/* \u2500\u2500 \uAC80\uC0C9 \uAE30\uB2A5 \u2500\u2500 */
var _searchOpen = false;
var _soFilter = 'all'; // \uD604\uC7AC \uC120\uD0DD\uB41C \uD544\uD130 \uCE69

function toggleSearch(){
  _searchOpen = !_searchOpen;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  var overlay = document.getElementById('search-overlay');
  bar.classList.toggle('open', _searchOpen);
  btn.classList.toggle('on', _searchOpen);
  if(_searchOpen){
    overlay.classList.add('open');
    _soFilter = 'all';
    _resetChips();
    _renderSearchResults('', 'all');
    // \uC624\uBC84\uB808\uC774 \uC5F4\uB9B4 \uB54C: \uB4A4\uB85C\uAC00\uAE30 = Main
    var lbl = document.getElementById('soBackLabel');
    if(lbl) lbl.textContent = 'Main';
    setTimeout(function(){ var inp = document.getElementById('soInput'); if(inp) inp.focus(); }, 200);
    // \uD53C\uB4DC \uC601\uC0C1 \uC77C\uC2DC\uC815\uC9C0 (\uC624\uBC84\uB808\uC774 \uC704\uC5D0 \uAC00\uB824\uC838\uC11C)
    document.querySelectorAll('#feed video').forEach(function(v){ v.pause(); });
  } else {
    clearSearch();
    overlay.classList.remove('open');
    // \uC624\uBC84\uB808\uC774 \uB2EB\uD790 \uB54C \uD53C\uB4DC \uC601\uC0C1 \uC7AC\uAC1C (\uC18C\uB9AC \uC0C1\uD0DC \uBC18\uC601)
    document.querySelectorAll('.slide').forEach(function(sl){
      var rect = sl.getBoundingClientRect();
      if(rect.top >= -50 && rect.bottom <= window.innerHeight + 50){
        var idx = parseInt(sl.id.replace('sl',''));
        var fv = document.getElementById('vid'+idx);
        var fb = document.getElementById('bufic'+idx);
        if(fv && fv.paused){
          fv.muted = isMuted;
          _playVid(fv, fb);
        }
      }
    });
  }
}

function _resetChips(){
  document.querySelectorAll('.so-chip').forEach(function(c){
    c.classList.toggle('on', c.getAttribute('data-filter') === _soFilter);
  });
}

function _renderSearchResults(q, filter){
  var grid   = document.getElementById('so-grid');
  var header = document.getElementById('so-header');
  if(!grid) return;
  var kw = (q||'').toLowerCase().trim();
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa'};
  var CAT_LIST = ['skincare','makeup','hair','headspa','nail','clinic','spa'];
  var AREA_LIST = ['gangnam','hongdae','myeongdong','sinsa','itaewon','insadong','jongno','mapo','yongsan','apgujeong','cheongdam','bukchon'];

  var results = allShopsData.filter(function(s){
    // \uCE74\uD14C\uACE0\uB9AC/\uC9C0\uC5ED \uCE69 \uD544\uD130
    if(filter && filter !== 'all'){
      var fl = filter.toLowerCase();
      var matchCat  = CAT_LIST.indexOf(fl) !== -1 && (s.category||'').toLowerCase() === fl;
      var matchArea = AREA_LIST.indexOf(fl) !== -1 && (s.location||'').toLowerCase().indexOf(fl) !== -1;
      // \uC9C0\uC5ED\uB3C4 \uCE74\uD14C\uACE0\uB9AC\uB3C4 \uC544\uB2C8\uBA74 location \uD3EC\uD568 \uC5EC\uBD80
      var matchLoc  = !matchCat && !matchArea && (s.location||'').toLowerCase().indexOf(fl) !== -1;
      if(!matchCat && !matchArea && !matchLoc) return false;
    }
    // \uD14D\uC2A4\uD2B8 \uAC80\uC0C9
    if(!kw) return true;
    return (s.name||'').toLowerCase().indexOf(kw) !== -1
      || (s.category||'').toLowerCase().indexOf(kw) !== -1
      || (s.location||'').toLowerCase().indexOf(kw) !== -1
      || (s.description||'').toLowerCase().indexOf(kw) !== -1
      || (s.services||[]).some(function(sv){ return sv.toLowerCase().indexOf(kw) !== -1; });
  });

  var label = kw ? '"' + q + '"' : (filter && filter !== 'all' ? filter : 'All shops');
  if(header) header.textContent = results.length + ' result' + (results.length!==1?'s':'') + ' \u2014 ' + label;

  if(!results.length){
    grid.innerHTML = '<div class="so-empty" style="grid-column:1/-1;padding:60px 20px;text-align:center"><i class="fas fa-search" style="font-size:32px;margin-bottom:12px;display:block;opacity:.3"></i>No shops found</div>';
    return;
  }
  grid.innerHTML = results.map(function(s){
    var col = catColors[s.category] || 'var(--pk)';
    var thumb = s.thumbnail || s.videoThumb || '';
    var area = (s.location||'').split(',')[0].trim();
    var ratingStr = s.rating ? '<span class="so-card-rating"><i class="fas fa-star" style="font-size:8px"></i>'+Number(s.rating).toFixed(1)+'</span>' : '';
    var catLabel = catIcons[s.category] ? catIcons[s.category]+' ' : '';
    return '<a class="so-card" href="#" onclick="event.preventDefault();openShopFromSearch(&quot;'+s.id+'&quot;)">'
      +'<div class="so-card-img-wrap" style="position:relative">'
        +'<img class="so-card-img" src="'+esc(thumb)+'" alt="'+esc(s.name)+'" loading="lazy" decoding="async"'
          +' onload="parentLoaded(this)" onerror="parentLoaded(this)">'
        +'<div class="so-card-ov" style="background:'+col+'"></div>'
      +'</div>'
      +'<div class="so-card-body">'
        +'<div class="so-card-name">'+esc(s.name)+'</div>'
        +'<div class="so-card-meta">'
          +'<span class="so-card-loc"><i class="fas fa-map-marker-alt" style="font-size:8px;color:var(--pk)"></i>'+esc(area)+'</span>'
          +(s.category?'<span class="so-card-cat">'+catLabel+esc(s.category)+'</span>':'')
          +ratingStr
        +'</div>'
        +(s.description?'<div style="font-size:11px;color:rgba(255,255,255,.38);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;width:100%">'+esc((s.description||'').slice(0,150))+'</div>':'')
      +'</div>'
      +'<div class="so-card-arrow"><i class="fas fa-chevron-right"></i></div>'
    +'</a>';
  }).join('');
}

function onSearch(q){
  var x = document.getElementById('soX');
  if(x) x.classList.toggle('on', q.length > 0);
  _renderSearchResults(q, _soFilter);
}

function clearSoInput(){
  var inp = document.getElementById('soInput');
  var x = document.getElementById('soX');
  if(inp){ inp.value = ''; inp.focus(); }
  if(x) x.classList.remove('on');
  _renderSearchResults('', _soFilter);
}

function clearSearch(){
  var inp = document.getElementById('soInput');
  var x = document.getElementById('soX');
  var overlay = document.getElementById('search-overlay');
  if(inp) inp.value = '';
  if(x) x.classList.remove('on');
  if(overlay) overlay.classList.remove('open');
}

function closeSearch(){
  _searchOpen = false;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  if(bar) bar.classList.remove('open');
  if(btn) btn.classList.remove('on');
  clearSearch();
}

// \uAC80\uC0C9 \uC624\uBC84\uB808\uC774\uC5D0\uC11C \uC5C5\uCCB4 \uD074\uB9AD \u2192 \uC624\uBC84\uB808\uC774\uB294 \uB4A4\uB85C \uC228\uAE30\uACE0 \uBAA8\uB2EC\uB9CC \uC5F4\uAE30
// closeModal() \uC2DC _searchOpen=true \uC774\uBA74 \uC624\uBC84\uB808\uC774 \uB2E4\uC2DC \uBCF5\uC6D0
function openShopFromSearch(sid){
  var overlay = document.getElementById('search-overlay');
  if(overlay) overlay.classList.remove('open');
  openShopModal(sid);
}

// \uAC80\uC0C9 \uCE74\uB4DC \uC601\uC0C1 \uBBF8\uB9AC\uBCF4\uAE30 \u2014 \uD0ED/\uD638\uBC84 \uC2DC \uC7AC\uC0DD
function soCardPreview(wrap){
  var vid = wrap.querySelector('.so-card-vid');
  if(!vid) return;
  if(!vid.src && vid.dataset.src){ vid.src = vid.dataset.src; vid.load(); }
  wrap.classList.add('vid-playing');
  vid.currentTime = 0;
  vid.play().catch(function(){});
}

// \uAC80\uC0C9 \uCE74\uB4DC \uC601\uC0C1 \uC815\uC9C0 (\uB9C8\uC6B0\uC2A4 \uC774\uD0C8 / \uD130\uCE58 \uD6C4 \uC790\uB3D9\uC815\uC9C0)
function soCardStop(wrap){
  var vid = wrap.querySelector('.so-card-vid');
  wrap.classList.remove('vid-playing');
  if(vid){ vid.pause(); vid.currentTime = 0; }
}

// \uD544\uD130 \uCE69 \uD074\uB9AD
document.getElementById('so-filters').addEventListener('click', function(e){
  var chip = e.target.closest('.so-chip');
  if(!chip) return;
  _soFilter = chip.getAttribute('data-filter');
  _resetChips();
  var q = (document.getElementById('soInput')||{}).value || '';
  _renderSearchResults(q, _soFilter);
});
// ESC \uD0A4\uB85C \uAC80\uC0C9 \uB2EB\uAE30
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeSearch();
});
window.addEventListener('load', function(){
  document.querySelectorAll('.cat').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.cat').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      loadVideos(b.getAttribute('data-cat'));
      document.getElementById('feed').scrollTo({top:0});
    });
  });

  /* logo 3x click -> admin */
  var clickCount = 0, clickTimer = null;
  var ADMIN_PW = '0907';

  document.getElementById('logoBtn').addEventListener('click', function(){
    clickCount++;
    if(clickTimer) clearTimeout(clickTimer);
    if(clickCount >= 3){
      clickCount = 0;
      showAdminModal();
    } else {
      clickTimer = setTimeout(function(){ clickCount = 0; }, 1500);
    }
  });

  window.showAdminModal = function(){
    var m = document.getElementById('adminModal');
    m.style.display = 'flex';
    var inp = document.getElementById('adminPwInput');
    inp.value = '';
    document.getElementById('adminPwErr').style.display = 'none';
    setTimeout(function(){ inp.focus(); }, 150);
  };
  window.closeAdminModal = function(){
    document.getElementById('adminModal').style.display = 'none';
  };
  window.checkAdminPw = function(){
    var pw = document.getElementById('adminPwInput').value;
    if(pw === ADMIN_PW){
      window.location.href = '/admin';
    } else {
      document.getElementById('adminPwErr').style.display = 'block';
      var inp = document.getElementById('adminPwInput');
      inp.value = '';
      inp.style.borderColor = '#ef4444';
      setTimeout(function(){ inp.style.borderColor = 'rgba(232,65,122,.2)'; }, 1200);
    }
  };
  document.getElementById('adminModal').addEventListener('click', function(e){
    if(e.target === this) window.closeAdminModal();
  });

  /* \u2500\u2500 PC: cats bar wheel \u2192 horizontal scroll \u2500\u2500 */
  var catsEl = document.getElementById('cats');
  if(catsEl) {
    catsEl.addEventListener('wheel', function(e) {
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        catsEl.scrollLeft += e.deltaY;
      }
    }, {passive: false});
  }

  /* \u2500\u2500 PC: feed wheel + keyboard navigation \u2500\u2500 */
  var feedEl = document.getElementById('feed');
  var wheelLocked = false;
  if(feedEl) {
    feedEl.addEventListener('wheel', function(e) {
      e.preventDefault();
      if(wheelLocked) return;
      wheelLocked = true;
      var dir = e.deltaY > 0 ? 1 : -1;
      var slides = document.querySelectorAll('.slide');
      var feedRect = feedEl.getBoundingClientRect();
      var current = 0;
      slides.forEach(function(sl, i) {
        var r = sl.getBoundingClientRect();
        if(Math.abs(r.top - feedRect.top) < feedRect.height * 0.5) current = i;
      });
      var next = Math.max(0, Math.min(slides.length - 1, current + dir));
      slides[next].scrollIntoView({behavior:'smooth', block:'start'});
      setTimeout(function(){ wheelLocked = false; }, 700);
    }, {passive: false});
  }

  document.addEventListener('keydown', function(e) {
    var modal = document.getElementById('shopModal');
    if(modal && modal.classList.contains('open')) return;
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var feedEl2 = document.getElementById('feed');
    if(!feedEl2) return;
    var delta = 0;
    if(e.key === 'ArrowDown' || e.key === 'PageDown') delta = 1;
    if(e.key === 'ArrowUp'   || e.key === 'PageUp')   delta = -1;
    if(delta === 0) return;
    e.preventDefault();
    var slides = document.querySelectorAll('.slide');
    var feedRect2 = feedEl2.getBoundingClientRect();
    var current2 = 0;
    slides.forEach(function(sl, i) {
      var r = sl.getBoundingClientRect();
      if(Math.abs(r.top - feedRect2.top) < feedRect2.height * 0.5) current2 = i;
    });
    var next2 = Math.max(0, Math.min(slides.length - 1, current2 + delta));
    slides[next2].scrollIntoView({behavior:'smooth', block:'start'});
  });

  // \uC2A4\uD50C\uB798\uC2DC \uD504\uB85C\uADF8\uB808\uC2A4 \uBC14 CSS \uC560\uB2C8\uBA54\uC774\uC158 \u2192 JS \uC9C1\uC811 \uC81C\uC5B4\uB85C \uC804\uD658
  setLdProgress(0);
  loadVideos('all');

  // \u2500\u2500 \uCE74\uD14C\uACE0\uB9AC \uD0ED \uB9C8\uC6B0\uC2A4 \uB4DC\uB798\uADF8 \uC2A4\uD06C\uB864 (PC) \u2500\u2500
  var catsEl = document.getElementById('cats');
  if(catsEl) {
    var isDragging = false, startX = 0, scrollLeft = 0;
    catsEl.addEventListener('mousedown', function(e){
      isDragging = true; startX = e.pageX - catsEl.offsetLeft; scrollLeft = catsEl.scrollLeft;
      catsEl.style.cursor = 'grabbing';
    });
    document.addEventListener('mouseup', function(){ isDragging = false; catsEl.style.cursor = 'grab'; });
    catsEl.addEventListener('mousemove', function(e){
      if(!isDragging) return;
      e.preventDefault();
      var x = e.pageX - catsEl.offsetLeft;
      catsEl.scrollLeft = scrollLeft - (x - startX);
    });
    catsEl.addEventListener('mouseleave', function(){ isDragging = false; catsEl.style.cursor = 'grab'; });
  }

  // \u2500\u2500 PC \uCE74\uD0C8\uB85C\uADF8 \uD328\uB110 (\uD56D\uC0C1 \uB85C\uB4DC, CSS\uB85C \uD45C\uC2DC/\uC228\uAE40 \uC81C\uC5B4) \u2500\u2500
  fetch('/api/shops').then(function(r){ return r.json(); }).then(function(d){
    allShopsData = d.shops || [];
    _injectVideoIntoShops(); // \uAC80\uC0C9 \uCE74\uB4DC\uC6A9 videoUrl/videoThumb \uC8FC\uC785
    renderShopPanel('all');
  });
  document.querySelectorAll('#sp-filter .sp-flt').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#sp-filter .sp-flt').forEach(function(b){ b.classList.remove('on'); });
      btn.classList.add('on');
      renderShopPanel(btn.getAttribute('data-cat'));
    });
  });
});

function renderShopPanel(cat) {
  var grid = document.getElementById('sp-grid');
  var countEl = document.getElementById('sp-count');
  if(!grid) return;
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa'};
  var filtered = cat === 'all' ? allShopsData : allShopsData.filter(function(s){ return s.category === cat; });
  if(countEl) countEl.textContent = filtered.length + ' shops';
  if(!filtered.length){
    grid.innerHTML = '<div class="sp-empty"><div style="font-size:28px;margin-bottom:8px">&#128269;</div>No shops in this category</div>';
    return;
  }
  grid.innerHTML = filtered.map(function(s){
    var col = catColors[s.category] || '#aaa';
    var sid = s.id.replace(/'/g, '');
    var hasSlug = s.slug && s.slug.length > 0;
    var clickAttr = hasSlug
      ? 'data-slug="/shop/'+s.slug+'" onclick="location.href=this.dataset.slug"'
      : 'onclick="openShopModal(&quot;'+sid+'&quot;)"';
    return '<div class="sp-card" '+clickAttr+'>'+
      '<img class="sp-card-img" src="'+(s.thumbnail||'')+'" alt="'+esc(s.name)+'" loading="lazy" onerror="this.style.background=&quot;#1a1a2e&quot;">'+
      '<div class="sp-card-rating"><i class="fas fa-star" style="font-size:8px"></i> '+s.rating+'</div>'+
      (hasSlug ? '<div style="position:absolute;top:7px;left:7px;background:rgba(232,65,122,.85);border-radius:6px;padding:2px 6px;font-size:9px;font-weight:800;color:#fff;letter-spacing:.5px"><i class="fas fa-link" style="font-size:8px"></i></div>' : '')+
      '<div class="sp-card-body">'+
        '<div class="sp-card-cat" style="color:'+col+'">'+esc(s.category)+'</div>'+
        '<div class="sp-card-name">'+esc(s.name)+'</div>'+
        '<div class="sp-card-loc"><i class="fas fa-map-marker-alt"></i>'+esc((s.location||'').split(',')[0])+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}
</script>

<!-- \u2605 Best \uB79C\uB529 \uD398\uC774\uC9C0 \uB0B4\uBD80 \uB9C1\uD06C \u2014 \uAD6C\uAE00 \uD06C\uB864\uB7EC\uAC00 \uBC1C\uACAC\uD558\uB3C4\uB85D DOM\uC5D0 \uC0BD\uC785 -->
<nav aria-label="Browse by category and area" style="background:#fff;border-top:1px solid #f0f0f0;padding:32px 16px 40px">
  <div style="max-width:700px;margin:0 auto">
    <h2 style="font-size:1rem;font-weight:700;color:#1a1a2e;margin-bottom:6px;text-align:center">Browse Korean Beauty by Area</h2>
    <p style="font-size:.82rem;color:#888;text-align:center;margin-bottom:20px">Foreigner-friendly salons in Seoul \u2014 find your area</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">\u{1F9D6} Head Spa</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/headspa/gangnam" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/headspa/hongdae" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/headspa/itaewon" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/headspa/myeongdong" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Myeongdong</a>
          <a href="/best/headspa/apgujeong" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Apgujeong</a>
          <a href="/best/headspa/seoul" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">\u{1F33F} Skincare</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/skincare/gangnam" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/skincare/hongdae" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/skincare/itaewon" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/skincare/myeongdong" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Myeongdong</a>
          <a href="/best/skincare/seoul" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">\u{1F487} Hair Salon</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/hair/gangnam" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/hair/hongdae" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/hair/itaewon" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/hair/sinchon" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Sinchon</a>
          <a href="/best/hair/seoul" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">\u{1F485} Nail \xB7 \u{1F3E5} Clinic \xB7 \u{1F48B} Makeup \xB7 \u{1F6C1} Spa</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/nail/hongdae" style="background:#faf5ff;color:#7c3aed;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F485} Nail Hongdae</a>
          <a href="/best/nail/gangnam" style="background:#faf5ff;color:#7c3aed;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F485} Nail Gangnam</a>
          <a href="/best/clinic/gangnam" style="background:#fff7ed;color:#c2410c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F3E5} Clinic Gangnam</a>
          <a href="/best/clinic/apgujeong" style="background:#fff7ed;color:#c2410c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F3E5} Clinic Apgujeong</a>
          <a href="/best/makeup/hongdae" style="background:#fff1f2;color:#be123c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F48B} Makeup Hongdae</a>
          <a href="/best/makeup/myeongdong" style="background:#fff1f2;color:#be123c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F48B} Makeup Myeongdong</a>
          <a href="/best/spa/itaewon" style="background:#f0f9ff;color:#0369a1;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F6C1} Spa Itaewon</a>
          <a href="/best/spa/gangnam" style="background:#f0f9ff;color:#0369a1;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">\u{1F6C1} Spa Gangnam</a>
        </div>
      </div>
    </div>
  </div>
</nav>

</body>
</html>`;
var ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Trip - Admin</title>
<script>var _GSK_TOKEN = '__GSK_TOKEN__';</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30;--green:#10b981;--yellow:#f59e0b;--red:#ef4444;--blue:#3b82f6}
body{background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
/* NAV */
.nav{background:var(--bg2);border-bottom:1px solid rgba(255,77,141,.18);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-logo{font-size:16px;font-weight:900;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-back{color:#aaa;text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px;padding:6px 13px;border:1px solid rgba(255,255,255,.12);border-radius:16px}
/* TABS */
.tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.08);background:var(--bg2);overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:13px 18px;font-size:12px;font-weight:700;color:rgba(255,255,255,.4);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;display:flex;align-items:center;gap:5px}
.tab.on{color:var(--pk);border-bottom-color:var(--pk)}
.tab-content{display:none;padding:20px;max-width:900px;margin:0 auto}
.tab-content.on{display:block}
/* STATS */
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
.stat-card{background:var(--cd);border-radius:14px;padding:16px;border:1px solid rgba(255,255,255,.06)}
.stat-val{font-size:28px;font-weight:900;margin-bottom:2px}
.stat-lbl{font-size:11px;color:rgba(255,255,255,.45);font-weight:600}
.stat-icon{font-size:22px;margin-bottom:6px}
/* CARDS */
.card{background:var(--cd);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;margin-bottom:12px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.card-title{font-size:14px;font-weight:800;color:#fff;display:flex;align-items:center;gap:6px}
/* FORM */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.full{grid-column:1/-1}
label{font-size:11px;color:rgba(255,255,255,.38);display:block;margin-bottom:3px}
input,select,textarea{width:100%;padding:10px 13px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,77,141,.18);border-radius:10px;color:#fff;font-size:13px;outline:none;transition:border-color .2s}
input:focus,select:focus,textarea:focus{border-color:var(--pk)}
select option{background:var(--bg2)}
textarea{height:80px;resize:none}
.btn-pk{padding:10px 20px;background:linear-gradient(135deg,var(--pk),var(--pu));border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;cursor:pointer}
.btn-sm{padding:6px 12px;border-radius:8px;border:none;font-size:11.5px;font-weight:700;cursor:pointer}
.btn-red{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#ef4444}
.btn-green{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#10b981}
.btn-blue{background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:#60a5fa}
/* TABLE */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:11px;color:rgba(255,255,255,.38);font-weight:700;padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06)}
.tbl td{font-size:12.5px;padding:10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
.tbl tr:hover td{background:rgba(255,255,255,.02)}
/* BADGES */
.bdg{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10px;font-weight:800}
.bdg-new{background:rgba(59,130,246,.2);color:#60a5fa}
.bdg-contacted{background:rgba(245,158,11,.2);color:#f59e0b}
.bdg-confirmed{background:rgba(16,185,129,.2);color:#10b981}
.bdg-completed{background:rgba(139,92,246,.2);color:#a78bfa}
.bdg-cancelled{background:rgba(239,68,68,.2);color:#ef4444}
.bdg-cat{background:rgba(255,77,141,.15);color:var(--pk)}
/* SHOP CARD */
.shop-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;display:flex;gap:14px;align-items:flex-start;transition:border-color .2s}
.shop-card:hover{border-color:rgba(255,77,141,.4)}
.shop-row{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.shop-row:last-child{border:none}
.shop-row img{width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0}
.shop-meta{flex:1}
.shop-meta h4{font-size:14px;font-weight:700;margin-bottom:3px}
.shop-meta p{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px}
.shop-meta .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
/* VIDEO CARD */
.vid-row{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.vid-row:last-child{border:none}
.vid-row img{width:48px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0}
/* TOP VIDEO */
.top-vid{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.top-vid:last-child{border:none}
.top-vid img{width:40px;height:52px;border-radius:7px;object-fit:cover;flex-shrink:0}
.top-rank{font-size:18px;font-weight:900;color:var(--pk);width:24px;flex-shrink:0}
@media(max-width:540px){.stats-grid{grid-template-columns:1fr 1fr!important}.form-grid{grid-template-columns:1fr}}
.bar-wrap{display:flex;align-items:center;gap:8px;font-size:12px}
.bar-bg{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .6s cubic-bezier(.4,0,.2,1)}
.bar-label{min-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.7);font-size:11px}
.bar-val{min-width:36px;text-align:right;color:rgba(255,255,255,.45);font-size:11px}
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-logo">&#10024; Seoul Beauty Trip \u2014 \uAD00\uB9AC\uC790</div>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> \uC0AC\uC774\uD2B8\uB85C</a>
</nav>

<div class="tabs">
  <div class="tab on" data-tab="dashboard"><i class="fas fa-chart-bar"></i> \uB300\uC2DC\uBCF4\uB4DC</div>
  <div class="tab" data-tab="bookings"><i class="fas fa-calendar-check"></i> \uC608\uC57D\uAD00\uB9AC <span style="font-size:9px;background:rgba(251,191,36,.2);color:#fbbf24;border-radius:10px;padding:1px 5px;vertical-align:middle">\uC900\uBE44\uC911</span></div>
  <div class="tab" data-tab="shops"><i class="fas fa-store"></i> \uC5C5\uCCB4 \xB7 \uC601\uC0C1</div>
  <div class="tab" data-tab="settings"><i class="fas fa-cog"></i> \uC124\uC815</div>
</div>

<!-- \uB300\uC2DC\uBCF4\uB4DC -->
<div class="tab-content on" id="tab-dashboard">
  <!-- \uD575\uC2EC \uC9C0\uD45C \uCE74\uB4DC 6\uAC1C -->
  <div class="stats-grid" id="statsGrid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    <div class="stat-card"><div class="stat-icon">&#128065;</div><div class="stat-val" id="st-views">-</div><div class="stat-lbl">\uCD1D \uC870\uD68C\uC218</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#10b981">&#127968;</div><div class="stat-val" id="st-shops" style="color:#10b981">-</div><div class="stat-lbl">\uB4F1\uB85D \uC5C5\uCCB4</div></div>
    <div class="stat-card"><div class="stat-icon">&#128197;</div><div class="stat-val" id="st-bookings">-</div><div class="stat-lbl">\uCD1D \uC608\uC57D</div></div>
    <div class="stat-card" style="background:rgba(59,130,246,.08);border-color:rgba(59,130,246,.2)"><div class="stat-icon" style="color:#60a5fa">&#128276;</div><div class="stat-val" id="st-new" style="color:#60a5fa">-</div><div class="stat-lbl">\uC2E0\uADDC \uC608\uC57D</div></div>
    <div class="stat-card" style="background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.2)"><div class="stat-icon" style="color:#34d399">&#9989;</div><div class="stat-val" id="st-confirmed" style="color:#34d399">-</div><div class="stat-lbl">\uD655\uC815 \uC608\uC57D</div></div>
    <div class="stat-card" style="background:rgba(251,146,60,.08);border-color:rgba(251,146,60,.2)"><div class="stat-icon" style="color:#fb923c">&#128172;</div><div class="stat-val" id="st-contacted" style="color:#fb923c">-</div><div class="stat-lbl">\uC5F0\uB77D \uC644\uB8CC</div></div>
  </div>

  <!-- \uCC28\uD2B8 \uD589 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <!-- \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uC5C5\uCCB4 \uBD84\uD3EC -->
    <div class="card" style="margin-bottom:0;padding:16px">
      <div class="card-title" style="font-size:12px;margin-bottom:12px"><i class="fas fa-chart-pie" style="color:#a78bfa"></i> \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uC5C5\uCCB4</div>
      <canvas id="catChart" height="180"></canvas>
    </div>
    <!-- \uC608\uC57D \uC0C1\uD0DC \uB3C4\uB11B -->
    <div class="card" style="margin-bottom:0;padding:16px">
      <div class="card-title" style="font-size:12px;margin-bottom:12px"><i class="fas fa-chart-donut" style="color:#f472b6"></i> \uC608\uC57D \uC0C1\uD0DC \uD604\uD669</div>
      <canvas id="bookingChart" height="180"></canvas>
    </div>
  </div>

  <!-- \uC5C5\uCCB4\uBCC4 \uC870\uD68C\uC218 TOP5 -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><div class="card-title"><i class="fas fa-trophy" style="color:#fbbf24"></i> \uC5C5\uCCB4\uBCC4 \uC870\uD68C\uC218 TOP 5</div></div>
    <div id="shopViewStats" style="display:flex;flex-direction:column;gap:8px;padding:0 4px"></div>
  </div>

  <!-- \uC778\uAE30 \uC601\uC0C1 TOP5 -->
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fas fa-fire" style="color:#FF4D8D"></i> \uC778\uAE30 \uC601\uC0C1 TOP 5</div></div>
    <div id="topVids"></div>
  </div>

  <!-- SEO \uAD00\uB9AC \uCE74\uB4DC -->
  <div class="card" style="border:1px solid rgba(99,102,241,.3)">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-search" style="color:#6366f1"></i> SEO \uAD00\uB9AC</div>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:14px">\uC5C5\uCCB4\uBCC4 Google \uC0C1\uC704\uB178\uCD9C\uC744 \uC704\uD55C SEO \uC790\uB3D9 \uAD00\uB9AC \uB3C4\uAD6C</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <button onclick="regenSeoAll(false)" id="regen-btn" class="btn-sm btn-blue" style="font-size:12px;padding:8px 16px">
        <i class="fas fa-magic"></i> SEO \uBBF8\uC0DD\uC131 \uC5C5\uCCB4 \uC77C\uAD04 \uC0DD\uC131
      </button>
      <button onclick="regenSeoAll(true)" id="regen-force-btn" class="btn-sm" style="font-size:12px;padding:8px 16px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#a78bfa">
        <i class="fas fa-sync"></i> \uC804\uCCB4 \uC5C5\uCCB4 SEO \uAC15\uC81C \uC7AC\uC0DD\uC131
      </button>
      <button onclick="fixAllSlugs()" id="fix-slugs-btn" class="btn-sm" style="font-size:12px;padding:8px 16px;background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.3);color:#fbbf24">
        <i class="fas fa-link"></i> \uC804\uCCB4 Slug \uC815\uB9AC (\uC5C5\uCCB4\uBA85-\uC9C0\uC5ED\uBA85)
      </button>
      <a href="/sitemap.xml" target="_blank" class="btn-sm btn-green" style="font-size:12px;padding:8px 16px;display:inline-flex;align-items:center;gap:5px">
        <i class="fas fa-sitemap"></i> sitemap.xml \uD655\uC778
      </a>
    </div>
    <div id="regen-status" style="font-size:12px;color:rgba(255,255,255,.5)"></div>
    <div id="regen-results" style="margin-top:10px;max-height:200px;overflow-y:auto"></div>
    <!-- Best \uB79C\uB529 \uD398\uC774\uC9C0 \uB9C1\uD06C -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.45);margin-bottom:10px">\u{1F4CD} \uCE74\uD14C\uACE0\uB9AC\xD7\uC9C0\uC5ED \uB79C\uB529 \uD398\uC774\uC9C0 (Google \uC0C1\uC704\uB178\uCD9C \uD0C0\uAC9F)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="best-pages-grid">
        <a href="/best/headspa/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F9D6} Head Spa Gangnam</a>
        <a href="/best/headspa/hongdae" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F9D6} Head Spa Hongdae</a>
        <a href="/best/skincare/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F33F} Skincare Gangnam</a>
        <a href="/best/hair/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F487} Hair Gangnam</a>
        <a href="/best/nail/hongdae" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F485} Nail Hongdae</a>
        <a href="/best/clinic/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F3E5} Clinic Gangnam</a>
        <a href="/best/spa/itaewon" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F6C1} Spa Itaewon</a>
        <a href="/best/makeup/myeongdong" target="_blank" class="btn-sm btn-blue" style="font-size:10px">\u{1F48B} Makeup Myeongdong</a>
      </div>
    </div>
  </div>
</div>

<!-- \uC608\uC57D\uAD00\uB9AC -->
<div class="tab-content" id="tab-bookings">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-calendar-check" style="color:#FF4D8D"></i> \uC608\uC57D \uAD00\uB9AC</div>
    </div>
    <div style="text-align:center;padding:40px 20px">
      <i class="fas fa-calendar-clock" style="font-size:40px;color:rgba(251,191,36,.4);margin-bottom:16px;display:block"></i>
      <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,.6);margin-bottom:8px">\uC608\uC57D \uAD00\uB9AC \uAE30\uB2A5 \uC900\uBE44 \uC911</div>
      <div style="font-size:12px;color:rgba(255,255,255,.3);line-height:1.7">\uACE0\uAC1D \uC608\uC57D \uC694\uCCAD\uC740 \uD604\uC7AC WhatsApp\uC744 \uD1B5\uD574 \uC9C1\uC811 \uC811\uC218\uB429\uB2C8\uB2E4.<br>\uC608\uC57D \uAD00\uB9AC \uC2DC\uC2A4\uD15C\uC740 \uCD94\uD6C4 \uC5C5\uB370\uC774\uD2B8 \uC608\uC815\uC785\uB2C8\uB2E4.</div>
    </div>
  </div>
</div>

<!-- \uC5C5\uCCB4\xB7\uC601\uC0C1 \uD1B5\uD569\uAD00\uB9AC -->
<div class="tab-content" id="tab-shops">

  <!-- \u2460 \uC5C5\uCCB4 \uB4F1\uB85D \uD3FC -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-store" style="color:#FF4D8D"></i> \uC5C5\uCCB4 \uB4F1\uB85D</div>
    </div>

    <!-- STEP 1: \uAD6C\uAE00 \uC790\uB3D9\uAC00\uC838\uC624\uAE30 (\uCD5C\uC6B0\uC120) -->
    <div style="background:linear-gradient(135deg,rgba(66,133,244,.12),rgba(52,168,83,.08));border:1px solid rgba(66,133,244,.35);border-radius:16px;padding:16px;margin-bottom:18px">
      <div style="font-size:13px;font-weight:800;color:#60a5fa;margin-bottom:12px">
        <i class="fab fa-google"></i> STEP 1 \u2014 \uAD6C\uAE00\uC5D0\uC11C \uC5C5\uCCB4 \uC815\uBCF4 \uC790\uB3D9\uAC00\uC838\uC624\uAE30
        <div style="font-size:11px;font-weight:400;color:rgba(255,255,255,.4);margin-top:3px">\uC5C5\uCCB4\uBA85 \uC785\uB825 \uD6C4 \uBC84\uD2BC \uD074\uB9AD \u2192 \uC601\uBB38\uC8FC\uC18C\xB7\uC601\uC5C5\uC2DC\uAC04\xB7\uC0AC\uC9C4\xB7\uB9AC\uBDF0 \uD55C\uBC88\uC5D0 \uC790\uB3D9\uC785\uB825</div>
      </div>
      <!-- \uAD6C\uAE00\uB9F5 \uB9C1\uD06C \uBD99\uC5EC\uB123\uAE30 -->
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:5px"><i class="fas fa-link"></i> \uAD6C\uAE00\uB9F5 \uB9C1\uD06C\uB85C \uC790\uB3D9\uC785\uB825 (\uC120\uD0DD)</div>
        <div style="display:flex;gap:8px">
          <input id="sh-gmap-raw" placeholder="https://maps.app.goo.gl/... \uBD99\uC5EC\uB123\uAE30" style="flex:1;font-size:13px;margin-bottom:0">
          <button type="button" id="sh-gmap-btn" style="padding:0 16px;background:rgba(66,133,244,.25);border:1px solid rgba(66,133,244,.4);border-radius:10px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0"><i class="fas fa-magic"></i> \uB9C1\uD06C\uC785\uB825</button>
        </div>
        <div id="sh-gmap-status" style="font-size:11px;color:rgba(255,255,255,.4);min-height:16px;margin-top:4px"></div>
      </div>
      <!-- \uAD6C\uAE00 \uC804\uCCB4 \uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uBC84\uD2BC -->
      <button type="button" onclick="fetchPlacesInfo('sh')" id="sh-places-btn"
        style="width:100%;padding:11px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:12px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
        <i class="fab fa-google"></i> \uAD6C\uAE00 Places API\uB85C \uC804\uCCB4 \uC815\uBCF4 \uC790\uB3D9\uAC00\uC838\uC624\uAE30
        <span style="font-size:10px;opacity:.7">(\uC8FC\uC18C\xB7\uC601\uC5C5\uC2DC\uAC04\xB7\uD3C9\uC810\xB7\uB9AC\uBDF0\xB7\uC0AC\uC9C4)</span>
      </button>
      <div id="sh-places-status" style="margin-top:8px;min-height:16px"></div>
    </div>

    <!-- STEP 2: \uAE30\uBCF8 \uC815\uBCF4 \uC785\uB825 -->
    <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:10px">STEP 2 \u2014 \uAE30\uBCF8 \uC815\uBCF4 <span style="font-weight:400;color:rgba(255,255,255,.25)">(\uC790\uB3D9\uC785\uB825 \uB610\uB294 \uC9C1\uC811 \uC218\uC815)</span></div>
    <div class="form-grid">
      <div class="full">
        <label>\uC5C5\uCCB4\uBA85 * <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uC804\uC5D0 \uD55C\uAD6D\uC5B4 \uC5C5\uCCB4\uBA85 \uC785\uB825)</span></label>
        <input id="sh-name" placeholder="\uC608: \uC555\uAD6C\uC815 \uD5E4\uC5B4\uD329\uD1A0\uB9AC" oninput="updateSlugPreview()">
        <div id="sh-slug-preview" style="margin-top:5px;font-size:11px;color:rgba(255,255,255,.35);display:none">
          \u{1F517} URL \uBBF8\uB9AC\uBCF4\uAE30: <span style="color:#fbbf24;font-family:monospace" id="sh-slug-preview-val"></span>
        </div>
      </div>
      <div>
        <label>\uCE74\uD14C\uACE0\uB9AC *</label>
        <select id="sh-cat">
          <option value="skincare">\uC2A4\uD0A8\uCF00\uC5B4</option>
          <option value="makeup">\uBA54\uC774\uD06C\uC5C5</option>
          <option value="hair">\uD5E4\uC5B4</option>
          <option value="headspa">\uD5E4\uB4DC\uC2A4\uD30C</option>
          <option value="nail">\uB124\uC77C</option>
          <option value="clinic">\uD074\uB9AC\uB2C9</option>
          <option value="spa">\uC2A4\uD30C\xB7\uB9C8\uC0AC\uC9C0</option>
        </select>
      </div>
      <div>
        <label>\uC9C0\uC5ED <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uC785\uB825)</span></label>
        <input id="sh-loc" placeholder="\uC608: Gangnam, Seoul" oninput="updateSlugPreview()">
      </div>
      <div class="full">
        <label>\uC601\uBB38 \uC8FC\uC18C <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uAC00\uC838\uC624\uAE30\uB85C \uC601\uBB38 \uC790\uB3D9\uC785\uB825)</span></label>
        <input id="sh-addr" placeholder="\uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uD6C4 \uC790\uB3D9\uC785\uB825\uB429\uB2C8\uB2E4">
      </div>
      <div class="full">
        <label>\uC601\uC5C5\uC2DC\uAC04 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uAC00\uC838\uC624\uAE30\uB85C \uC694\uC77C\uBCC4 \uC790\uB3D9\uC785\uB825)</span></label>
        <input id="sh-hours" placeholder="\uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uD6C4 \uC790\uB3D9\uC785\uB825\uB429\uB2C8\uB2E4">
      </div>
      <div class="full">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>\uC5C5\uCCB4 \uC18C\uAC1C <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC120\uD0DD)</span></span>
          <button type="button" onclick="genAiSeo('sh')" style="display:flex;align-items:center;gap:5px;padding:4px 12px;background:linear-gradient(135deg,#7C3AED,#E8417A);border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;transition:opacity .2s" id="sh-ai-btn">
            <i class="fas fa-magic"></i> AI SEO \uC790\uB3D9\uC0DD\uC131
          </button>
        </label>
        <textarea id="sh-desc" placeholder="AI SEO \uC790\uB3D9\uC0DD\uC131 \uBC84\uD2BC\uC744 \uB204\uB974\uAC70\uB098 \uC9C1\uC811 \uC785\uB825\uD558\uC138\uC694..."></textarea>
        <div id="sh-ai-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
      </div>
      <div class="full">
        <label style="color:#60a5fa;font-weight:800">\u{1F5FA}\uFE0F \uC9C0\uB3C4 embed URL <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,.5)">(\uBAA8\uB2EC\uC5D0\uC11C \uC9C0\uB3C4 \uD45C\uC2DC)</span></label>
        <div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:6px;line-height:1.6">
          Google Maps\uC5D0\uC11C \uC5C5\uCCB4 \uAC80\uC0C9 \u2192 <b style="color:rgba(255,255,255,.7)">\uACF5\uC720</b> \u2192 <b style="color:rgba(255,255,255,.7)">\uC9C0\uB3C4 \uD37C\uAC00\uAE30</b> \u2192 HTML \uCF54\uB4DC \uC548\uC758 <code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:10px">src="..."</code> \uAC12\uB9CC \uBCF5\uC0AC
        </div>
        <input id="sh-gmap-embed" placeholder="https://www.google.com/maps/embed?pb=..." oninput="updateGmapEmbedPreview('sh-gmap-embed-preview','sh-gmap-embed')" style="border-color:rgba(96,165,250,.4)">
        <div id="sh-gmap-embed-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:180px;border:1px solid rgba(96,165,250,.3)">
          <iframe id="sh-gmap-embed-frame" src="" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0"></iframe>
        </div>
      </div>
    </div>
    <input type="hidden" id="sh-lat" value="">
    <input type="hidden" id="sh-lng" value="">
    <input type="hidden" id="sh-rating" value="">
    <input type="hidden" id="sh-review-count" value="">
    <input type="hidden" id="sh-reviews" value="[]">
    <input type="hidden" id="sh-place-id" value="">
    <input type="hidden" id="sh-photos" value="[]">
    <div id="sh-photos-preview" style="display:none;flex-wrap:wrap;gap:4px;margin-top:4px"></div>

    <!-- \uC11C\uBE44\uC2A4 \uB3D9\uC801 \uCD94\uAC00 -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:10px">STEP 3 \u2014 \uC11C\uBE44\uC2A4 \uBAA9\uB85D <span style="font-weight:400;color:rgba(255,255,255,.3)">(\uC774\uB984 + \uAC00\uACA9)</span></div>
      <div id="svc-list"></div>
      <button type="button" id="svc-add-btn" style="margin-top:8px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:rgba(255,255,255,.5);padding:8px 16px;font-size:12px;cursor:pointer;width:100%">+ \uC11C\uBE44\uC2A4 \uCD94\uAC00</button>
    </div>

    <!-- \uC601\uC0C1 \uC5C5\uB85C\uB4DC -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:10px">\uB300\uD45C \uC601\uC0C1 <span style="font-weight:400;color:rgba(255,255,255,.3)">(\uC120\uD0DD \xB7 \uB098\uC911\uC5D0 \uCD94\uAC00 \uAC00\uB2A5)</span></div>
      <div id="vid-list"></div>
      <button type="button" id="vid-add-btn" style="margin-top:8px;background:rgba(255,77,141,.06);border:1px dashed rgba(255,77,141,.3);border-radius:10px;color:rgba(255,77,141,.7);padding:8px 16px;font-size:12px;cursor:pointer;width:100%">+ \uC601\uC0C1 \uCD94\uAC00</button>
    </div>

    <button class="btn-pk" style="margin-top:16px;width:100%;padding:14px;font-size:15px" id="sh-submit-btn"><i class="fas fa-check"></i> \uC5C5\uCCB4 \uB4F1\uB85D \uC644\uB8CC</button>
  </div>

  <!-- \u2461 \uB4F1\uB85D\uB41C \uC5C5\uCCB4 \uBAA9\uB85D (\uD074\uB9AD\uD558\uBA74 \uC601\uC0C1 \uCD94\uAC00) -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-list" style="color:#FF4D8D"></i> \uB4F1\uB85D\uB41C \uC5C5\uCCB4 <span style="font-size:12px;color:rgba(255,255,255,.4);font-weight:400">\u2014 \uC5C5\uCCB4 \uD074\uB9AD \uC2DC \uC601\uC0C1 \uCD94\uAC00</span></div>
    <div id="shopList"></div>
  </div>

  <!-- \u2461 \uC5C5\uCCB4 \uC218\uC815 \uD328\uB110 -->
  <div class="card" id="editShopPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(59,130,246,.4)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-edit" style="color:#60a5fa"></i> \uC5C5\uCCB4 \uC218\uC815 \u2014 <span id="edit-shop-name-label" style="color:#93c5fd"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="edit-panel-close">\u2715</button>
    </div>
    <!-- \uAD6C\uAE00 \uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uC139\uC158 -->
    <div style="background:linear-gradient(135deg,rgba(66,133,244,.1),rgba(52,168,83,.07));border:1px solid rgba(66,133,244,.3);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:800;color:#60a5fa;margin-bottom:10px"><i class="fab fa-google"></i> \uAD6C\uAE00 Places API \uC790\uB3D9\uAC00\uC838\uC624\uAE30
        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.4);margin-left:6px">\uC601\uBB38\uC8FC\uC18C\xB7\uC601\uC5C5\uC2DC\uAC04\xB7\uD3C9\uC810\xB7\uB9AC\uBDF0\xB7\uC0AC\uC9C4 \uD55C\uBC88\uC5D0</span>
      </div>
      <button type="button" onclick="fetchPlacesInfo('edit-sh')" id="edit-sh-places-btn"
        style="width:100%;padding:10px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
        <i class="fab fa-google"></i> \uAD6C\uAE00\uC5D0\uC11C \uC804\uCCB4 \uC815\uBCF4 \uB2E4\uC2DC \uAC00\uC838\uC624\uAE30
      </button>
      <div id="edit-sh-places-status" style="margin-top:8px;min-height:16px"></div>
    </div>

    <div class="form-grid">
      <div class="full"><label>\uC5C5\uCCB4\uBA85 *</label><input id="edit-sh-name" placeholder="\uC5C5\uCCB4\uBA85"></div>
      <div>
        <label>\uCE74\uD14C\uACE0\uB9AC</label>
        <select id="edit-sh-cat">
          <option value="skincare">\uC2A4\uD0A8\uCF00\uC5B4</option>
          <option value="makeup">\uBA54\uC774\uD06C\uC5C5</option>
          <option value="hair">\uD5E4\uC5B4</option>
          <option value="headspa">\uD5E4\uB4DC\uC2A4\uD30C</option>
          <option value="nail">\uB124\uC77C</option>
          <option value="clinic">\uD074\uB9AC\uB2C9</option>
          <option value="spa">\uC2A4\uD30C\xB7\uB9C8\uC0AC\uC9C0</option>
        </select>
      </div>
      <div><label>\uC9C0\uC5ED</label><input id="edit-sh-loc" placeholder="\uC608: Gangnam, Seoul"></div>
      <div class="full">
        <label>\uC601\uBB38 \uC8FC\uC18C <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uAC00\uC838\uC624\uAE30\uB85C \uC601\uBB38 \uC8FC\uC18C \uC790\uB3D9\uC785\uB825)</span></label>
        <input id="edit-sh-addr" placeholder="\uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uD6C4 \uC601\uBB38 \uC8FC\uC18C \uC790\uB3D9\uC785\uB825">
      </div>
      <div class="full">
        <label>\uC601\uC5C5\uC2DC\uAC04 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(\uC790\uB3D9\uAC00\uC838\uC624\uAE30\uB85C \uC694\uC77C\uBCC4 \uC790\uB3D9\uC785\uB825)</span></label>
        <input id="edit-sh-hours" placeholder="\uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uD6C4 \uC790\uB3D9\uC785\uB825">
      </div>
      <div class="full">
        <label style="color:#60a5fa;font-weight:800">\u{1F5FA}\uFE0F \uC9C0\uB3C4 embed URL <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.45)">(\uBAA8\uB2EC\uC5D0\uC11C \uC9C0\uB3C4 \uD45C\uC2DC)</span></label>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px">Google Maps \u2192 \uACF5\uC720 \u2192 \uC9C0\uB3C4 \uD37C\uAC00\uAE30 \u2192 src="..." \uAC12\uB9CC \uBCF5\uC0AC</div>
        <input id="edit-sh-gmap-embed" placeholder="https://www.google.com/maps/embed?pb=..." oninput="updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed')" style="border-color:rgba(96,165,250,.4)">
        <input type="hidden" id="edit-sh-gmap-url" value="">
        <input type="hidden" id="edit-sh-lat" value="">
        <input type="hidden" id="edit-sh-lng" value="">
        <div id="edit-gmap-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:180px;border:1px solid rgba(96,165,250,.3)">
          <iframe id="edit-gmap-frame" src="" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0"></iframe>
        </div>
      </div>
      <div class="full">
        <label>\uB300\uD45C \uC378\uB124\uC77C</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="edit-sh-thumb" placeholder="https://...image.jpg" style="flex:1">
          <button type="button" id="edit-thumb-upload-btn" style="padding:8px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0"><i class="fas fa-upload"></i> \uC5C5\uB85C\uB4DC</button>
          <input type="file" id="edit-thumb-file" accept="image/*" style="display:none">
        </div>
        <div id="edit-thumb-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
        <div id="edit-thumb-preview" style="margin-top:6px;display:none"><img id="edit-thumb-preview-img" style="width:80px;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1)"></div>
      </div>
      <div><label>\uC218\uC218\uB8CC (%)</label><input id="edit-sh-commission" type="number" min="0" max="100" placeholder="15"></div>
      <div></div>
      <div class="full">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>\uC5C5\uCCB4 \uC18C\uAC1C</span>
          <button type="button" onclick="genAiSeo('edit-sh')" style="display:flex;align-items:center;gap:5px;padding:4px 12px;background:linear-gradient(135deg,#7C3AED,#E8417A);border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;cursor:pointer" id="edit-sh-ai-btn">
            <i class="fas fa-magic"></i> AI SEO \uC790\uB3D9\uC0DD\uC131
          </button>
        </label>
        <textarea id="edit-sh-desc" placeholder="AI SEO \uC790\uB3D9\uC0DD\uC131 \uBC84\uD2BC\uC744 \uB204\uB974\uAC70\uB098 \uC9C1\uC811 \uC785\uB825..."></textarea>
        <div id="edit-sh-ai-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
      </div>
    </div>
    <!-- \uCD94\uAC00 \uC0AC\uC9C4 \uC5C5\uB85C\uB4DC -->
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:8px"><i class="fas fa-images" style="color:#a78bfa;margin-right:4px"></i>\uCD94\uAC00 \uC0AC\uC9C4 <span style="font-weight:400;color:rgba(255,255,255,.3)">(\uACE0\uAC1D\uC5D0\uAC8C \uBCF4\uC5EC\uC9C8 \uC5C5\uCCB4 \uC0AC\uC9C4)</span></div>
      <div id="edit-photos-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>
      <button type="button" id="edit-photo-add-btn" style="background:rgba(167,139,250,.08);border:1px dashed rgba(167,139,250,.35);border-radius:10px;color:rgba(167,139,250,.8);padding:8px 16px;font-size:12px;cursor:pointer;width:100%"><i class="fas fa-plus"></i> \uC0AC\uC9C4 \uCD94\uAC00</button>
      <input type="file" id="edit-photo-file" accept="image/*" style="display:none">
    </div>
    <!-- \uC11C\uBE44\uC2A4 \uBAA9\uB85D \uC218\uC815 -->
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:8px">\uC11C\uBE44\uC2A4 \uBAA9\uB85D (\uC774\uB984 + \uAC00\uACA9)</div>
      <div id="edit-svc-list"></div>
      <button type="button" id="edit-svc-add-btn" style="margin-top:6px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:rgba(255,255,255,.5);padding:7px 14px;font-size:12px;cursor:pointer;width:100%">+ \uC11C\uBE44\uC2A4 \uCD94\uAC00</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn-pk" style="flex:1;padding:13px;font-size:14px" id="edit-sh-submit-btn"><i class="fas fa-save"></i> \uC218\uC815 \uC800\uC7A5</button>
      <button type="button" id="edit-panel-cancel" style="padding:13px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(255,255,255,.5);font-size:13px;font-weight:600;cursor:pointer">\uCDE8\uC18C</button>
    </div>
  </div>

  <!-- \u2462-1 \uC601\uC0C1 \uC218\uC815 \uD328\uB110 -->
  <div class="card" id="videoEditPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(99,102,241,.45)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-pen" style="color:#a5b4fc"></i> \uC601\uC0C1 \uC218\uC815 \u2014 <span id="ve-title-label" style="color:#a5b4fc;font-size:13px"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="ve-panel-close">\u2715</button>
    </div>
    <div class="form-grid">
      <div class="full"><label>\uC601\uC0C1 \uC81C\uBAA9 *</label><input id="ve-title" placeholder="\uC601\uC0C1 \uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694"></div>
      <div class="full"><label>\uC601\uC0C1 \uC124\uBA85 <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC120\uD0DD)</span></label><input id="ve-desc" placeholder="\uC9E7\uC740 \uC124\uBA85..."></div>
      <div class="full"><label>\uD0DC\uADF8 <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC27C\uD45C \uAD6C\uBD84)</span></label><input id="ve-tags" placeholder="#KBeauty, #\uAC15\uB0A8, #\uC2A4\uD0A8\uCF00\uC5B4"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn-pk" style="flex:1;padding:12px;font-size:14px" id="ve-submit-btn"><i class="fas fa-save"></i> \uC800\uC7A5</button>
      <button type="button" id="ve-panel-cancel" style="padding:12px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(255,255,255,.5);font-size:13px;font-weight:600;cursor:pointer">\uCDE8\uC18C</button>
    </div>
  </div>

  <!-- \u2462-2 \uC601\uC0C1 \uCD94\uAC00 \uD328\uB110 (\uC5C5\uCCB4 \uD074\uB9AD \uC2DC \uC2AC\uB77C\uC774\uB4DC\uB2E4\uC6B4) -->
  <div class="card" id="videoAddPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(255,77,141,.35)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-film" style="color:#FF4D8D"></i> \uC601\uC0C1 \uCD94\uAC00 \u2014 <span id="vd-shop-name" style="color:#FF85B3"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="vd-panel-close">\u2715</button>
    </div>
    <div class="form-grid">
      <div class="full"><label>\uC601\uC0C1 \uC81C\uBAA9 *</label><input id="vd-title" placeholder="\uC608: \uAC15\uB0A8 \uB7ED\uC154\uB9AC \uD398\uC774\uC15C 60\uBD84 \uD480\uCF54\uC2A4"></div>
      <div class="full">
        <label>\uC601\uC0C1 URL *</label>
        <div style="background:rgba(255,77,141,.06);border:1px solid rgba(255,77,141,.15);border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.6)">
          \uAD6C\uAE00 \uB4DC\uB77C\uC774\uBE0C \uACF5\uC720 \uB9C1\uD06C\uB97C \uADF8\uB300\uB85C \uBD99\uC5EC\uB123\uC73C\uBA74 \uC790\uB3D9 \uBCC0\uD658\uB429\uB2C8\uB2E4 \u2728
        </div>
        <div style="position:relative">
          <input id="vd-url" placeholder="\uC601\uC0C1 URL \uB610\uB294 \uAD6C\uAE00 \uB4DC\uB77C\uC774\uBE0C \uB9C1\uD06C" oninput="handleVideoUrlInput(this.value)" style="padding-right:100px">
          <div id="vd-url-badge" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800"></div>
        </div>
        <div id="vd-url-hint" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);border-radius:8px;font-size:12px;color:#4ade80"></div>
        <div id="vd-url-preview" style="display:none;margin-top:8px"></div>
      </div>
      <div class="full"><label>\uC378\uB124\uC77C URL <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC120\uD0DD)</span></label><input id="vd-thumb" placeholder="https://...image.jpg (\uBE44\uC6CC\uB450\uBA74 \uC5C5\uCCB4 \uC378\uB124\uC77C \uC0AC\uC6A9)"></div>
      <div class="full"><label>\uC601\uC0C1 \uC124\uBA85 <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC120\uD0DD)</span></label><input id="vd-desc" placeholder="\uC9E7\uC740 \uC124\uBA85..."></div>
      <div class="full"><label>\uD0DC\uADF8 <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC120\uD0DD, \uC27C\uD45C \uAD6C\uBD84)</span></label><input id="vd-tags" placeholder="#KBeauty, #\uAC15\uB0A8, #\uC2A4\uD0A8\uCF00\uC5B4"></div>
    </div>
    <button class="btn-pk" style="margin-top:12px" id="vd-submit-btn"><i class="fas fa-plus"></i> \uC601\uC0C1 \uB4F1\uB85D</button>
  </div>

</div>

<!-- \uC124\uC815 -->
<div class="tab-content" id="tab-settings">
  <div class="card" style="margin-bottom:16px">
    <div class="card-title" style="margin-bottom:16px"><i class="fas fa-link" style="color:#60a5fa"></i> \uC0AC\uC774\uD2B8 \uB9C1\uD06C \uBAA8\uC74C</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <a href="/" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-home" style="color:#60a5fa;width:16px"></i> \uBA54\uC778 \uD53C\uB4DC (\uD648)
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/</span>
      </a>
      <a href="/shops" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-store" style="color:#a78bfa;width:16px"></i> \uC5C5\uCCB4 \uCE74\uD0C8\uB85C\uADF8
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/shops</span>
      </a>
      <a href="/sitemap.xml" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-sitemap" style="color:#4ade80;width:16px"></i> Sitemap (SEO)
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/sitemap.xml</span>
      </a>
      <a href="/robots.txt" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-robot" style="color:#fbbf24;width:16px"></i> robots.txt
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/robots.txt</span>
      </a>
    </div>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-search" style="color:#6366f1"></i> SEO \uD398\uC774\uC9C0 \uB9C1\uD06C</div>
    <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:12px">\uC5C5\uCCB4\uBCC4 Google \uAC80\uC0C9 \uB178\uCD9C URL \u2014 \uD074\uB9AD\uD574\uC11C \uD655\uC778\uD558\uC138\uC694</div>
    <div id="seoLinks"></div>
  </div>
</div>

<script>
var shops=[], videos=[], bookings=[];

// safe-img: data-fallback / data-fallback-text \uC18D\uC131\uC73C\uB85C onerror \uB300\uCCB4
document.addEventListener('error', function(e){
  var t = e.target;
  if(t && t.tagName === 'IMG' && t.classList.contains('safe-img')){
    var fb = t.getAttribute('data-fallback');
    var fbText = t.getAttribute('data-fallback-text');
    if(fb){ t.src = fb; }
    else if(fbText && t.parentElement){ t.parentElement.textContent = fbText; }
    else { t.style.display = 'none'; }
  }
}, true);

document.addEventListener('DOMContentLoaded', function(){

// \u2500\u2500 \uD0ED \uC804\uD658 \u2500\u2500
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    document.getElementById('tab-' + t.getAttribute('data-tab')).classList.add('on');
  });
});

// \u2500\u2500 \uC774\uBCA4\uD2B8 \uC704\uC784 \u2500\u2500
document.addEventListener('click', function(e){
  var delShopBtn = e.target.closest('.del-shop-btn');
  if(delShopBtn){ delShop(delShopBtn.getAttribute('data-id')); return; }
  var editShopBtn = e.target.closest('.edit-shop-btn');
  if(editShopBtn){ openEditShopPanel(editShopBtn.getAttribute('data-id')); return; }
  var delVideoBtn = e.target.closest('.del-video-btn');
  if(delVideoBtn){ delVideo(delVideoBtn.getAttribute('data-id')); return; }
  var addVideoBtn = e.target.closest('[data-add-video]');
  if(addVideoBtn){ openVideoPanel(addVideoBtn.getAttribute('data-add-video')); return; }

  // \u2500\u2500 \uC601\uC0C1 \uC218\uC815 \uBC84\uD2BC \u2192 \uC218\uC815 \uD328\uB110 \uC5F4\uAE30 \u2500\u2500
  var vidEditBtn = e.target.closest('.vid-edit-btn');
  if(vidEditBtn){ openVideoEditPanel(vidEditBtn.getAttribute('data-id')); return; }
});
document.addEventListener('change', function(e){
  var sel = e.target.closest('.status-select');
  if(sel){ updateStatus(sel.getAttribute('data-id'), sel.value); }
});

// \u2500\u2500 \uD604\uC7AC \uC601\uC0C1 \uCD94\uAC00 \uC911\uC778 \uC5C5\uCCB4 ID \u2500\u2500
var currentShopId = null;

// \u2500\u2500 \uB370\uC774\uD130 \uB85C\uB4DC \u2500\u2500
function loadAll(){
  fetch('/api/stats').then(function(r){return r.json();}).then(function(d){
    // \u2500\u2500 \uD575\uC2EC \uC9C0\uD45C \uCE74\uB4DC \u2500\u2500
    var fmtNum = function(n){ return n>=1000?(n/1000).toFixed(1)+'K':n; };
    document.getElementById('st-views').textContent = fmtNum(d.totalViews);
    document.getElementById('st-bookings').textContent = d.totalBookings;
    document.getElementById('st-new').textContent = d.newBookings;
    document.getElementById('st-confirmed').textContent = d.confirmedBookings||0;
    document.getElementById('st-contacted').textContent = d.contactedBookings||0;
    document.getElementById('st-shops').textContent = d.totalShops;

    // \u2500\u2500 \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uC5C5\uCCB4 \uB3C4\uB11B \uCC28\uD2B8 \u2500\u2500
    var catLabels = {skincare:'\uC2A4\uD0A8\uCF00\uC5B4',makeup:'\uBA54\uC774\uD06C\uC5C5',hair:'\uD5E4\uC5B4',headspa:'\uD5E4\uB4DC\uC2A4\uD30C',nail:'\uB124\uC77C',clinic:'\uD074\uB9AC\uB2C9',spa:'\uC2A4\uD30C'};
    var catColors = ['#f472b6','#c084fc','#60a5fa','#67e8f9','#34d399','#fb923c','#a78bfa'];
    var cats = d.categoryStats||[];
    if(cats.length && document.getElementById('catChart')){
      new Chart(document.getElementById('catChart'), {
        type:'doughnut',
        data:{
          labels: cats.map(function(c){ return catLabels[c.category]||c.category; }),
          datasets:[{data: cats.map(function(c){ return c.count; }), backgroundColor: catColors.slice(0,cats.length), borderWidth:2, borderColor:'#1c1c30'}]
        },
        options:{plugins:{legend:{position:'right',labels:{color:'rgba(255,255,255,.6)',font:{size:11},boxWidth:12,padding:8}}},cutout:'62%'}
      });
    }

    // \u2500\u2500 \uC608\uC57D \uC0C1\uD0DC \uB3C4\uB11B \uCC28\uD2B8 \u2500\u2500
    if(document.getElementById('bookingChart')){
      new Chart(document.getElementById('bookingChart'), {
        type:'doughnut',
        data:{
          labels:['\uC2E0\uADDC','\uC5F0\uB77D\uC644\uB8CC','\uD655\uC815'],
          datasets:[{data:[d.newBookings||0, d.contactedBookings||0, d.confirmedBookings||0],
            backgroundColor:['#60a5fa','#fb923c','#34d399'], borderWidth:2, borderColor:'#1c1c30'}]
        },
        options:{plugins:{legend:{position:'right',labels:{color:'rgba(255,255,255,.6)',font:{size:11},boxWidth:12,padding:8}}},cutout:'62%'}
      });
    }

    // \u2500\u2500 \uC5C5\uCCB4\uBCC4 \uC870\uD68C\uC218 TOP5 \uBC14 \uCC28\uD2B8 \u2500\u2500
    var svEl = document.getElementById('shopViewStats');
    var svData = d.shopViewStats||[];
    var maxV = svData.length ? svData[0].views : 1;
    var barColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',headspa:'#67e8f9',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
    svEl.innerHTML = svData.length ? svData.map(function(s,i){
      var pct = maxV>0 ? Math.round(s.views/maxV*100) : 0;
      var col = barColors[s.category]||'#aaa';
      return '<div class="bar-wrap">'+
        '<div class="bar-label">'+(i+1)+'. '+s.name+'</div>'+
        '<div class="bar-bg"><div class="bar-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'+
        '<div class="bar-val">'+fmtNum(s.views)+'</div>'+
        '</div>';
    }).join('') : '<div style="color:rgba(255,255,255,.3);font-size:12px;padding:8px">\uB370\uC774\uD130 \uC5C6\uC74C</div>';

    // \u2500\u2500 \uC778\uAE30 \uC601\uC0C1 TOP5 \u2500\u2500
    document.getElementById('topVids').innerHTML = (d.topVideos||[]).map(function(v,i){
      return '<div class="top-vid">'+
        '<div class="top-rank">#'+(i+1)+'</div>'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img">'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;margin-bottom:3px">'+v.title+'</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+fmtNum(v.views)+' \uC870\uD68C &nbsp; '+v.likes+' \uC88B\uC544\uC694</div></div>'+
        '</div>';
    }).join('');
  });
  fetch('/api/shops').then(function(r){return r.json();}).then(function(d){
    shops = d.shops||[];
    renderShops();
    renderSeoLinks();
  });
  fetch('/api/videos').then(function(r){return r.json();}).then(function(d){
    videos = d.videos||[];
    renderVideos();
  });
  fetch('/api/bookings').then(function(r){return r.json();}).then(function(d){
    bookings = d.bookings||[];
    renderBookings();
  });
}

// \u2500\u2500 \uAC00\uACA9 \uD3EC\uB9F7 (\uC22B\uC790 \u2192 \u20A9xx,xxx) \u2500\u2500
function fmtPrice(n){
  if(!n || isNaN(n)) return '';
  return '\u20A9'+Number(n).toLocaleString();
}

// \u2500\u2500 \uC5C5\uCCB4 \uBAA9\uB85D \uB80C\uB354 \u2500\u2500
function renderShops(){
  var el = document.getElementById('shopList');
  if(!shops.length){
    el.innerHTML = '<div style="text-align:center;padding:40px 24px;color:rgba(255,255,255,.25);font-size:13px"><div style="font-size:32px;margin-bottom:8px">&#127978;</div>No shops registered<br><span style="font-size:11px">Add a shop using the form above</span></div>';
    return;
  }
  var catColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',headspa:'#67e8f9',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
  var catLabels = {skincare:'\uC2A4\uD0A8\uCF00\uC5B4',makeup:'\uBA54\uC774\uD06C\uC5C5',hair:'\uD5E4\uC5B4',headspa:'\uD5E4\uB4DC\uC2A4\uD30C',nail:'\uB124\uC77C',clinic:'\uD074\uB9AC\uB2C9',spa:'\uC2A4\uD30C'};
  el.innerHTML = '<div style="display:grid;gap:12px">' + shops.map(function(s){
    var vcount = videos.filter(function(v){return v.shopId===s.id;}).length;
    var catColor = catColors[s.category] || '#aaa';
    var catLabel = catLabels[s.category] || s.category;
    var initial = (s.name||'S')[0].toUpperCase();
    // \uC774 \uC5C5\uCCB4 \uC18C\uC18D \uC601\uC0C1 \uBAA9\uB85D
    var shopVids = videos.filter(function(v){ return v.shopId === s.id; });
    var vidsHtml = shopVids.length
      ? shopVids.map(function(v){
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid rgba(255,255,255,.05)">'
            +'<img src="'+(v.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/36x48/1c1c30/FF4D8D?text=V" style="width:36px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0">'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">'+v.title+'</div>'
              +'<div style="font-size:10px;color:rgba(255,255,255,.3)">'+v.views+' \uC870\uD68C</div>'
            +'</div>'
            +'<div style="display:flex;gap:4px;flex-shrink:0">'
              +'<button class="vid-edit-btn" data-id="'+v.id+'" style="padding:4px 10px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:6px;color:#a5b4fc;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-pen"></i> \uC218\uC815</button>'
              +'<button class="del-video-btn" data-id="'+v.id+'" style="padding:4px 8px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:6px;color:#f87171;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-trash"></i></button>'
            +'</div>'
          +'</div>';
        }).join('')
      : '<div style="font-size:11px;color:rgba(255,255,255,.2);padding:8px 0;border-top:1px solid rgba(255,255,255,.05)">\uB4F1\uB85D\uB41C \uC601\uC0C1 \uC5C6\uC74C</div>';

    return '<div class="shop-card" style="flex-direction:column;gap:0">'
      // \uC5C5\uCCB4 \uD5E4\uB354\uD589
      +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">'
        // \uC378\uB124\uC77C or \uC774\uB2C8\uC15C
        +'<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(255,77,141,.2),rgba(155,89,182,.2));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#FF4D8D">'
          +(s.thumbnail ? '<img src="'+s.thumbnail+'" class="safe-img" style="width:100%;height:100%;object-fit:cover" data-fallback-text="'+initial+'">' : initial)
        +'</div>'
        // \uBA54\uD0C0\uC815\uBCF4
        +'<div style="flex:1;min-width:0">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
            +'<span style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.name+'</span>'
            +'<span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(255,255,255,.07);color:'+catColor+'">'+catLabel+'</span>'
          +'</div>'
          +(s.location ? '<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:4px"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:4px"></i>'+s.location+'</div>' : '')
          +'<div style="display:flex;align-items:center;gap:10px">'
            +'<span style="font-size:11px;color:#a78bfa"><i class="fas fa-film" style="margin-right:3px"></i>'+vcount+'\uAC1C \uC601\uC0C1</span>'
            +(s.priceRange ? '<span style="font-size:11px;color:#34d399">'+s.priceRange+'</span>' : '')
          +'</div>'
        +'</div>'
        // \uC5C5\uCCB4 \uC561\uC158 \uBC84\uD2BC
        +'<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
          +'<button data-add-video="'+s.id+'" style="padding:6px 12px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:8px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-plus"></i> \uC601\uC0C1</button>'
          +'<button class="edit-shop-btn" data-id="'+s.id+'" style="padding:6px 12px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.25);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-edit"></i> \uC218\uC815</button>'
          +'<button class="del-shop-btn" data-id="'+s.id+'" style="padding:6px 12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:8px;color:#f87171;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-trash"></i> \uC0AD\uC81C</button>'
        +'</div>'
      +'</div>'
      // \uC601\uC0C1 \uBAA9\uB85D
      + vidsHtml
    +'</div>';
  }).join('') + '</div>';
}

// \u2500\u2500 \uC601\uC0C1 \uBAA9\uB85D \uB80C\uB354 (\uC5C5\uCCB4\uBCC4 \uADF8\uB8F9) \u2500\u2500
function renderVideos(){
  var el = document.getElementById('videoList');
  if(!el) return; // \uC601\uC0C1 \uBAA9\uB85D \uCE74\uB4DC \uC81C\uAC70\uB428
  if(!videos.length){
    el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">\uB4F1\uB85D\uB41C \uC601\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
    return;
  }
  // \uC5C5\uCCB4\uBCC4 \uADF8\uB8F9\uD551
  var byShop = {};
  videos.forEach(function(v){
    if(!byShop[v.shopId]) byShop[v.shopId] = [];
    byShop[v.shopId].push(v);
  });
  var html = '';
  Object.keys(byShop).forEach(function(sid){
    var shop = shops.find(function(s){return s.id===sid;})||{name:'(\uC0AD\uC81C\uB41C \uC5C5\uCCB4)'};
    html += '<div style="font-size:12px;font-weight:700;color:#FF85B3;padding:8px 0 4px;border-bottom:1px solid rgba(255,77,141,.15);margin-bottom:6px">'+shop.name+'</div>';
    byShop[sid].forEach(function(v){
      html += '<div class="vid-row">'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/48x64/1c1c30/FF4D8D?text=V">'+
        '<div style="flex:1">'+
          '<div style="font-size:13px;font-weight:700;margin-bottom:2px">'+v.title+'</div>'+
          '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+v.views+' \uC870\uD68C &nbsp; '+v.likes+' \uC88B\uC544\uC694</div>'+
        '</div>'+
        '<button class="btn-sm btn-red del-video-btn" data-id="'+v.id+'">\uC0AD\uC81C</button>'+
      '</div>';
    });
    html += '<div style="margin-bottom:12px"></div>';
  });
  el.innerHTML = html;
}

var statusLabels={new:'\uC2E0\uADDC',contacted:'\uC5F0\uB77D\uC911',confirmed:'\uD655\uC815',completed:'\uC644\uB8CC',cancelled:'\uCDE8\uC18C'};
var statusColors={new:'#60a5fa',contacted:'#fbbf24',confirmed:'#34d399',completed:'#a78bfa',cancelled:'#f87171'};

function renderBookings(){
  document.getElementById('bookingTbody').innerHTML = bookings.map(function(b){
    var sc = statusColors[b.status]||'#aaa';
    return '<tr>'+
      '<td style="white-space:nowrap;font-size:11px">'+b.createdAt+'</td>'+
      '<td><div style="font-weight:700;font-size:13px">'+b.name+'</div><div style="font-size:11px;color:rgba(255,255,255,.4)">'+b.email+'</div></td>'+
      '<td style="font-size:12px">'+b.shopName+'</td>'+
      '<td style="font-size:12px">'+b.service+'</td>'+
      '<td style="font-size:12px">'+b.people+'</td>'+
      '<td style="font-size:12px;color:#10b981;font-weight:700">'+b.estimatedAmount+'</td>'+
      '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(255,255,255,.07);color:'+sc+'">'+statusLabels[b.status]+'</span></td>'+
      '<td>'+
        '<select class="status-select" data-id="'+b.id+'" style="padding:4px 6px;font-size:11px;width:auto;background:#1c1c30;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:6px">'+
          Object.keys(statusLabels).map(function(k){return '<option value="'+k+'"'+(b.status===k?' selected':'')+'>'+statusLabels[k]+'</option>';}).join('')+
        '</select>'+
        '<br><a href="https://wa.me/'+b.phone.replace(/[^0-9]/g,'')+'" target="_blank" style="display:inline-flex;align-items:center;gap:3px;margin-top:4px;font-size:11px;color:#25D366;text-decoration:none">WA \uC5F0\uB77D</a>'+
      '</td>'+
    '</tr>';
  }).join('');
}

function renderSeoLinks(){
  document.getElementById('seoLinks').innerHTML = shops.map(function(s){
    var url = '/shop/'+s.slug;
    return '<div style="font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'+
      '<a href="'+url+'" target="_blank" style="color:#60a5fa;text-decoration:none">'+url+'</a>'+
      ' <span style="color:rgba(255,255,255,.3);font-size:11px">\u2014 '+s.name+'</span>'+
    '</div>';
  }).join('');
}

function updateStatus(id, status){
  fetch('/api/bookings/'+id+'/status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})
    .then(loadAll);
}

// \u2500\u2500 \uC601\uC0C1 \uCD94\uAC00 \uD328\uB110 \uC5F4\uAE30/\uB2EB\uAE30 \u2500\u2500
function openVideoPanel(shopId){
  // id \uD0C0\uC785 \uBD88\uC77C\uCE58 \uBC29\uC9C0: \uBB38\uC790\uC5F4\uB85C \uD1B5\uC77C\uD574\uC11C \uBE44\uAD50
  var shop = shops.find(function(s){ return String(s.id) === String(shopId); });
  currentShopId = shopId;

  // tab-shops \uD0ED\uC774 \uBE44\uD65C\uC131\uD654 \uC0C1\uD0DC\uBA74 \uC790\uB3D9 \uD65C\uC131\uD654
  var tabShops = document.getElementById('tab-shops');
  if(tabShops && !tabShops.classList.contains('on')){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    var tabBtn = document.querySelector('.tab[data-tab="shops"]');
    if(tabBtn) tabBtn.classList.add('on');
    tabShops.classList.add('on');
  }

  // shop\uC744 \uCC3E\uC9C0 \uBABB\uD574\uB3C4 \uD328\uB110\uC740 \uC5F4\uC5B4\uC90C (\uC774\uB984\uC740 shopId\uB85C \uD45C\uC2DC)
  document.getElementById('vd-shop-name').textContent = shop ? shop.name : ('#' + shopId);
  document.getElementById('videoAddPanel').style.display = 'block';
  setTimeout(function(){
    document.getElementById('videoAddPanel').scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
}

function closeVideoPanel(){
  document.getElementById('videoAddPanel').style.display = 'none';
  currentShopId = null;
  ['vd-title','vd-url','vd-thumb','vd-desc','vd-tags'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('vd-url-badge').style.display='none';
  document.getElementById('vd-url-hint').style.display='none';
  document.getElementById('vd-url-preview').style.display='none';
}

document.getElementById('vd-panel-close').addEventListener('click', closeVideoPanel);
document.getElementById('vd-submit-btn').addEventListener('click', addVideo);
document.getElementById('sh-submit-btn').addEventListener('click', addShop);
document.getElementById('svc-add-btn').addEventListener('click', addSvcRow);
document.getElementById('vid-add-btn').addEventListener('click', addVidRow);

// \u2500\u2500 \uC601\uC0C1 \uC218\uC815 \uD328\uB110 \u2500\u2500
var editingVideoId = null;
function openVideoEditPanel(videoId){
  var vid = videos.find(function(v){ return v.id === videoId; });
  if(!vid){ alert('\uC601\uC0C1 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'); return; }
  editingVideoId = videoId;

  document.getElementById('ve-title-label').textContent = vid.title;
  document.getElementById('ve-title').value = vid.title || '';
  document.getElementById('ve-desc').value = vid.description || '';
  document.getElementById('ve-tags').value = (vid.tags||[]).join(', ');

  // \uD328\uB110 \uC5F4\uAE30 (\uC601\uC0C1 \uCD94\uAC00 \uD328\uB110 \uB2EB\uAE30)
  document.getElementById('videoEditPanel').style.display = 'block';
  document.getElementById('videoAddPanel').style.display = 'none';
  document.getElementById('editShopPanel').style.display = 'none';
  setTimeout(function(){
    document.getElementById('videoEditPanel').scrollIntoView({behavior:'smooth', block:'start'});
    document.getElementById('ve-title').focus();
    document.getElementById('ve-title').select();
  }, 50);
}
function closeVideoEditPanel(){
  document.getElementById('videoEditPanel').style.display = 'none';
  editingVideoId = null;
}
function saveVideoEdit(){
  if(!editingVideoId) return;
  var title = document.getElementById('ve-title').value.trim();
  if(!title){ alert('\uC601\uC0C1 \uC81C\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694!'); return; }
  var desc  = document.getElementById('ve-desc').value.trim();
  var tags  = document.getElementById('ve-tags').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);

  var btn = document.getElementById('ve-submit-btn');
  btn.disabled = true; btn.textContent = '\uC800\uC7A5 \uC911...';

  // \uAE30\uC874 thumbnail \uC720\uC9C0
  var vid = videos.find(function(v){ return v.id === editingVideoId; }) || {};
  fetch('/api/videos/'+editingVideoId, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ title: title, description: desc, thumbnail: vid.thumbnail||'', tags: tags })
  }).then(function(r){ return r.json(); }).then(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> \uC800\uC7A5';
    closeVideoEditPanel();
    loadAll();
    alert('\u2705 \uC601\uC0C1 \uC815\uBCF4\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
  }).catch(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> \uC800\uC7A5';
    alert('\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
  });
}
document.getElementById('ve-panel-close').addEventListener('click', closeVideoEditPanel);
document.getElementById('ve-panel-cancel').addEventListener('click', closeVideoEditPanel);
document.getElementById('ve-submit-btn').addEventListener('click', saveVideoEdit);

// \u2500\u2500 \uC5C5\uCCB4 \uC218\uC815 \uD328\uB110 \uC5F4\uAE30 \u2500\u2500
var editingShopId = null;
function openEditShopPanel(shopId){
  var shop = shops.find(function(s){ return String(s.id) === String(shopId); });
  if(!shop){ alert('\uC5C5\uCCB4 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'); return; }
  editingShopId = shopId;

  // \uD0ED \uD65C\uC131\uD654
  var tabShops = document.getElementById('tab-shops');
  if(tabShops && !tabShops.classList.contains('on')){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    var tabBtn = document.querySelector('.tab[data-tab="shops"]');
    if(tabBtn) tabBtn.classList.add('on');
    tabShops.classList.add('on');
  }

  // \uD3FC\uC5D0 \uAE30\uC874\uAC12 \uCC44\uC6B0\uAE30
  document.getElementById('edit-shop-name-label').textContent = shop.name;
  document.getElementById('edit-sh-name').value = shop.name || '';
  document.getElementById('edit-sh-cat').value = shop.category || 'skincare';
  document.getElementById('edit-sh-loc').value = shop.location || '';
  document.getElementById('edit-sh-addr').value = shop.address || '';
  document.getElementById('edit-sh-hours').value = shop.hours || '';
  document.getElementById('edit-sh-gmap-url').value = shop.googleMapUrl || '';
  document.getElementById('edit-sh-gmap-embed').value = shop.googleMapEmbed || '';
  document.getElementById('edit-sh-lat').value = shop.lat || '';
  document.getElementById('edit-sh-lng').value = shop.lng || '';
  // embed \uBBF8\uB9AC\uBCF4\uAE30 \uAC31\uC2E0
  setTimeout(function(){ updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed'); }, 50);
  document.getElementById('edit-sh-thumb').value = shop.thumbnail || '';
  document.getElementById('edit-sh-commission').value = shop.commission || 15;
  document.getElementById('edit-sh-desc').value = shop.description || '';
  // \uB9AC\uBDF0/Places/photos \uB370\uC774\uD130 hidden \uD544\uB4DC \uCD08\uAE30\uD654
  var rEl = document.getElementById('edit-sh-reviews');
  if(!rEl){ rEl=document.createElement('input');rEl.type='hidden';rEl.id='edit-sh-reviews';document.body.appendChild(rEl); }
  rEl.value = JSON.stringify(shop.reviews||[]);
  var pidEl = document.getElementById('edit-sh-place-id');
  if(!pidEl){ pidEl=document.createElement('input');pidEl.type='hidden';pidEl.id='edit-sh-place-id';document.body.appendChild(pidEl); }
  pidEl.value = shop.googlePlaceId||'';
  var rcEl = document.getElementById('edit-sh-review-count');
  if(!rcEl){ rcEl=document.createElement('input');rcEl.type='hidden';rcEl.id='edit-sh-review-count';document.body.appendChild(rcEl); }
  rcEl.value = shop.reviewCount||0;
  var ratEl = document.getElementById('edit-sh-rating');
  if(!ratEl){ ratEl=document.createElement('input');ratEl.type='hidden';ratEl.id='edit-sh-rating';document.body.appendChild(ratEl); }
  ratEl.value = shop.rating||5.0;
  var phEl = document.getElementById('edit-sh-photos');
  if(!phEl){ phEl=document.createElement('input');phEl.type='hidden';phEl.id='edit-sh-photos';document.body.appendChild(phEl); }
  phEl.value = JSON.stringify(shop.photos||[]);
  // \uC0AC\uC9C4 \uBBF8\uB9AC\uBCF4\uAE30
  var phPrev = document.getElementById('edit-sh-photos-preview');
  if(!phPrev){ phPrev=document.createElement('div');phPrev.id='edit-sh-photos-preview';phPrev.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:8px'; document.body.appendChild(phPrev); }
  var existingPhotos = shop.photos||[];
  phPrev.innerHTML = existingPhotos.map(function(url){ return '<img src="'+url+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.15)" onerror="this.remove()">'; }).join('');

  // \uC11C\uBE44\uC2A4 \uBAA9\uB85D \uCC44\uC6B0\uAE30
  var svcList = document.getElementById('edit-svc-list');
  svcList.innerHTML = '';
  var prices = shop.servicePrices || [];
  if(prices.length > 0){
    prices.forEach(function(p){
      var rawPrice = p.price ? p.price.replace(/[\u20A9,]/g,'') : '';
      addEditSvcRow(p.name, rawPrice);
    });
  } else {
    addEditSvcRow('','');
  }

  // photos \uBC30\uC5F4 \uB80C\uB354\uB9C1
  var photosList = document.getElementById('edit-photos-list');
  photosList.innerHTML = '';
  var existingPhotos = shop.photos || [];
  existingPhotos.forEach(function(url){
    appendEditPhotoCard(url);
  });

  // \uC378\uB124\uC77C \uBBF8\uB9AC\uBCF4\uAE30 \uCD08\uAE30\uD654
  var thumbPreview = document.getElementById('edit-thumb-preview');
  var thumbStatus = document.getElementById('edit-thumb-status');
  var thumbPreviewImg = document.getElementById('edit-thumb-preview-img');
  thumbStatus.textContent = '';
  if(shop.thumbnail){
    thumbPreview.style.display = 'block';
    thumbPreviewImg.src = shop.thumbnail;
  } else {
    thumbPreview.style.display = 'none';
  }

  document.getElementById('editShopPanel').style.display = 'block';
  document.getElementById('videoAddPanel').style.display = 'none';
  setTimeout(function(){
    document.getElementById('editShopPanel').scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
}

function closeEditShopPanel(){
  document.getElementById('editShopPanel').style.display = 'none';
  editingShopId = null;
}

function addEditSvcRow(name, price){
  var list = document.getElementById('edit-svc-list');
  var row = document.createElement('div');
  row.className = 'edit-svc-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  var nameIn = document.createElement('input');
  nameIn.className = 'edit-svc-name';
  nameIn.placeholder = '\uC11C\uBE44\uC2A4\uBA85';
  nameIn.value = name || '';
  nameIn.style.flex = '2';
  var priceIn = document.createElement('input');
  priceIn.className = 'edit-svc-price';
  priceIn.type = 'number';
  priceIn.placeholder = '\uAC00\uACA9 (\uC608: 80000)';
  priceIn.value = price || '';
  priceIn.min = '0';
  priceIn.step = '1000';
  priceIn.style.flex = '1';
  var del = document.createElement('button');
  del.type = 'button';
  del.textContent = '\u2715';
  del.style.cssText = 'background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:32px;height:32px;cursor:pointer;font-size:14px;flex-shrink:0';
  del.addEventListener('click', function(){ row.remove(); });
  row.appendChild(nameIn); row.appendChild(priceIn); row.appendChild(del);
  list.appendChild(row);
}

function saveEditShop(){
  if(!editingShopId){ return; }
  var name = document.getElementById('edit-sh-name').value.trim();
  if(!name){ alert('\uC5C5\uCCB4\uBA85\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694!'); return; }

  // \uC11C\uBE44\uC2A4 \uC218\uC9D1
  var svcRows = document.querySelectorAll('#edit-svc-list .edit-svc-row');
  var svcs = [], svcPrices = [], pMin = 0, pMax = 0;
  svcRows.forEach(function(row){
    var n = row.querySelector('.edit-svc-name').value.trim();
    var p = parseInt(row.querySelector('.edit-svc-price').value)||0;
    if(n){
      svcs.push(n);
      svcPrices.push({name:n, price: p ? fmtPrice(p) : ''});
      if(p){ if(!pMin||p<pMin) pMin=p; if(p>pMax) pMax=p; }
    }
  });
  var priceRange = (pMin||pMax) ? (fmtPrice(pMin)+(pMax&&pMax!==pMin?'~'+fmtPrice(pMax):'')) : (document.getElementById('edit-sh-hours').value ? 'Contact us' : '');

  var btn = document.getElementById('edit-sh-submit-btn');
  btn.disabled = true; btn.textContent = '\uC800\uC7A5 \uC911...';

  var shop = shops.find(function(s){ return String(s.id) === String(editingShopId); }) || {};

  // photos \uC218\uC9D1 (\uC218\uB3D9 \uC5C5\uB85C\uB4DC + Places API \uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uBCD1\uD569)
  var photoCards = document.querySelectorAll('#edit-photos-list .edit-photo-card');
  var photosArr = [];
  photoCards.forEach(function(card){
    var u = card.getAttribute('data-url');
    if(u) photosArr.push(u);
  });
  // Places API\uB85C \uAC00\uC838\uC628 photos\uB3C4 \uBCD1\uD569 (\uC911\uBCF5 \uC81C\uAC70)
  try {
    var placesPhotosEl = document.getElementById('edit-sh-photos');
    var placesPhotos = placesPhotosEl ? JSON.parse(placesPhotosEl.value||'[]') : [];
    placesPhotos.forEach(function(u){ if(u && photosArr.indexOf(u)===-1) photosArr.push(u); });
  } catch(e2){};

  fetch('/api/shops/'+editingShopId, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      name: name,
      slug: shop.slug || '',
      category: document.getElementById('edit-sh-cat').value,
      location: document.getElementById('edit-sh-loc').value || 'Seoul',
      address: document.getElementById('edit-sh-addr').value || '',
      hours: document.getElementById('edit-sh-hours').value || '',
      googleMapUrl: document.getElementById('edit-sh-gmap-url').value || '',
      googleMapEmbed: document.getElementById('edit-sh-gmap-embed').value || '',
      lat: document.getElementById('edit-sh-lat').value || '',
      lng: document.getElementById('edit-sh-lng').value || '',
      thumbnail: document.getElementById('edit-sh-thumb').value || '',
      commission: parseInt(document.getElementById('edit-sh-commission').value)||15,
      description: document.getElementById('edit-sh-desc').value || '',
      services: svcs,
      servicePrices: svcPrices,
      priceRange: svcs.length > 0 ? priceRange : (shop.priceRange||''),
      rating: (function(){ var el=document.getElementById('edit-sh-rating'); return el?parseFloat(el.value)||shop.rating||5.0:shop.rating||5.0;})(),
      reviewCount: (function(){ var el=document.getElementById('edit-sh-review-count'); return el?parseInt(el.value)||shop.reviewCount||0:shop.reviewCount||0;})(),
      reviews: (function(){ try{ var el=document.getElementById('edit-sh-reviews'); return el?JSON.parse(el.value||'[]'):shop.reviews||[];} catch(e){return shop.reviews||[];}}()),
      googlePlaceId: (function(){ var el=document.getElementById('edit-sh-place-id'); return el&&el.value?el.value:shop.googlePlaceId||'';})(),
      active: true,
      photos: photosArr
    })
  }).then(function(r){ return r.json(); }).then(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> \uC218\uC815 \uC800\uC7A5';
    closeEditShopPanel();
    loadAll();
    alert('\u2705 \uC5C5\uCCB4 \uC815\uBCF4\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
  }).catch(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> \uC218\uC815 \uC800\uC7A5';
    alert('\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
  });
}

document.getElementById('edit-panel-close').addEventListener('click', closeEditShopPanel);
document.getElementById('edit-panel-cancel').addEventListener('click', closeEditShopPanel);
document.getElementById('edit-sh-submit-btn').addEventListener('click', saveEditShop);
document.getElementById('edit-svc-add-btn').addEventListener('click', function(){ addEditSvcRow('',''); });

// \u2500\u2500 \uC0AC\uC9C4 \uCE74\uB4DC \uCD94\uAC00 \uD5EC\uD37C \u2500\u2500
function appendEditPhotoCard(url){
  var list = document.getElementById('edit-photos-list');
  var card = document.createElement('div');
  card.className = 'edit-photo-card';
  card.setAttribute('data-url', url);
  card.style.cssText = 'position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.12);flex-shrink:0';
  var img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.innerHTML = '&times;';
  delBtn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.85);border:none;color:#fff;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0';
  delBtn.addEventListener('click', function(){ card.remove(); });
  card.appendChild(img);
  card.appendChild(delBtn);
  list.appendChild(card);
}

// \u2500\u2500 Cloudinary \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC \uACF5\uD1B5 \uD568\uC218 \u2500\u2500
function uploadImageToCloudinary(file, onProgress, onSuccess, onError){
  onProgress('\uC11C\uBA85 \uBC1C\uAE09 \uC911...');
  fetch('/api/upload-sign-image')
    .then(function(r){ return r.json(); })
    .then(function(sign){
      if(sign.error) throw new Error(sign.error);
      var mb = (file.size/1024/1024).toFixed(1);
      onProgress('\uC5C5\uB85C\uB4DC \uC911... (' + mb + 'MB)');
      var fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      fd.append('folder', sign.folder);
      return fetch('https://api.cloudinary.com/v1_1/' + sign.cloudName + '/image/upload', {
        method:'POST', body:fd
      }).then(function(r){ return r.json(); });
    })
    .then(function(data){
      if(data.secure_url){ onSuccess(data.secure_url); }
      else {
        var msg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
        onError(msg);
      }
    })
    .catch(function(err){ onError(err.message || '\uB124\uD2B8\uC6CC\uD06C \uC624\uB958'); });
}

// \u2500\u2500 \uC378\uB124\uC77C \uC5C5\uB85C\uB4DC \uD578\uB4E4\uB7EC \u2500\u2500
document.getElementById('edit-thumb-upload-btn').addEventListener('click', function(){
  document.getElementById('edit-thumb-file').click();
});
document.getElementById('edit-thumb-file').addEventListener('change', function(){
  var file = this.files && this.files[0];
  if(!file) return;
  var statusEl = document.getElementById('edit-thumb-status');
  var previewWrap = document.getElementById('edit-thumb-preview');
  var previewImg = document.getElementById('edit-thumb-preview-img');
  var btn = document.getElementById('edit-thumb-upload-btn');
  statusEl.style.color = '#fbbf24';
  btn.disabled = true;
  uploadImageToCloudinary(
    file,
    function(msg){ statusEl.style.color='#fbbf24'; statusEl.textContent=msg; },
    function(url){
      document.getElementById('edit-sh-thumb').value = url;
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '\u2705 \uC5C5\uB85C\uB4DC \uC644\uB8CC!';
      previewImg.src = url;
      previewWrap.style.display = 'block';
      btn.disabled = false;
    },
    function(errMsg){
      statusEl.style.color = '#f87171';
      statusEl.textContent = '\u274C ' + errMsg;
      btn.disabled = false;
    }
  );
  this.value = ''; // \uD30C\uC77C \uC778\uD48B \uCD08\uAE30\uD654 (\uAC19\uC740 \uD30C\uC77C \uC7AC\uC120\uD0DD \uAC00\uB2A5)
});

// \u2500\u2500 \uCD94\uAC00 \uC0AC\uC9C4 \uC5C5\uB85C\uB4DC \uD578\uB4E4\uB7EC \u2500\u2500
document.getElementById('edit-photo-add-btn').addEventListener('click', function(){
  document.getElementById('edit-photo-file').click();
});
document.getElementById('edit-photo-file').addEventListener('change', function(){
  var file = this.files && this.files[0];
  if(!file) return;
  var btn = document.getElementById('edit-photo-add-btn');
  var origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '\uC5C5\uB85C\uB4DC \uC911...';
  uploadImageToCloudinary(
    file,
    function(){},
    function(url){
      appendEditPhotoCard(url);
      btn.disabled = false;
      btn.textContent = origText;
    },
    function(errMsg){
      alert('\uC0AC\uC9C4 \uC5C5\uB85C\uB4DC \uC2E4\uD328: ' + errMsg);
      btn.disabled = false;
      btn.textContent = origText;
    }
  );
  this.value = ''; // \uD30C\uC77C \uC778\uD48B \uCD08\uAE30\uD654
});

// \uAD6C\uAE00\uB9F5 \uC790\uB3D9\uC785\uB825 \uBC84\uD2BC + \uBD99\uC5EC\uB123\uAE30 \uC774\uBCA4\uD2B8
document.getElementById('sh-gmap-btn').addEventListener('click', function(){
  parseGmapUrl(document.getElementById('sh-gmap-raw').value);
});
document.getElementById('sh-gmap-raw').addEventListener('paste', function(e){
  // paste \uC774\uBCA4\uD2B8\uB294 value \uBC18\uC601 \uC804\uC5D0 \uBC1C\uC0DD \u2192 setTimeout\uC73C\uB85C \uC57D\uAC04 \uB51C\uB808\uC774
  setTimeout(function(){
    var val = document.getElementById('sh-gmap-raw').value.trim();
    if(val) parseGmapUrl(val);
  }, 100);
});
document.getElementById('sh-gmap-raw').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    parseGmapUrl(document.getElementById('sh-gmap-raw').value);
  }
});

// \uC11C\uBE44\uC2A4 \uD589 \uC0AD\uC81C \uC774\uBCA4\uD2B8
document.getElementById('svc-list').addEventListener('click', function(e){
  var btn = e.target.closest('.svc-del');
  if(btn) btn.closest('.svc-row').remove();
});
// \uC601\uC0C1 \uD589 \uC0AD\uC81C \uC774\uBCA4\uD2B8
document.getElementById('vid-list').addEventListener('click', function(e){
  var btn = e.target.closest('.vid-del');
  if(btn) btn.closest('.vid-row').remove();
});

// \uCD08\uAE30 \uC11C\uBE44\uC2A4 1\uD589 \uCD94\uAC00
addSvcRow();

// \u2500\u2500 \uC11C\uBE44\uC2A4 \uD589 \uCD94\uAC00 \u2500\u2500
function addSvcRow(name, price){
  var list = document.getElementById('svc-list');
  var row = document.createElement('div');
  row.className = 'svc-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';

  var nameIn = document.createElement('input');
  nameIn.className = 'svc-name';
  nameIn.placeholder = '\uC11C\uBE44\uC2A4\uBA85 (\uC608: \uB525\uD074\uB80C\uC9D5 \uD398\uC774\uC15C)';
  nameIn.value = name || '';
  nameIn.style.flex = '2';

  var priceIn = document.createElement('input');
  priceIn.className = 'svc-price';
  priceIn.type = 'number';
  priceIn.placeholder = '\uAC00\uACA9 (\uC608: 80000)';
  priceIn.value = price || '';
  priceIn.min = '0';
  priceIn.step = '1000';
  priceIn.style.flex = '1';

  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'svc-del';
  del.textContent = '\u2715';
  del.style.cssText = 'background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:32px;height:32px;cursor:pointer;font-size:14px;flex-shrink:0';

  row.appendChild(nameIn);
  row.appendChild(priceIn);
  row.appendChild(del);
  list.appendChild(row);
}

// \u2500\u2500 \uC601\uC0C1 \uD589 \uCD94\uAC00 \u2500\u2500
function addVidRow(){
  var list = document.getElementById('vid-list');
  var row = document.createElement('div');
  row.className = 'vid-row-form';
  row.style.cssText = 'background:rgba(255,77,141,.04);border:1px solid rgba(255,77,141,.15);border-radius:12px;padding:12px;margin-bottom:10px';

  // \uC228\uACA8\uC9C4 URL \uC800\uC7A5\uC6A9 input (addShop\uC5D0\uC11C \uC218\uC9D1)
  var urlIn = document.createElement('input');
  urlIn.className = 'vid-form-url';
  urlIn.type = 'hidden';

  // \uC601\uC0C1 \uC81C\uBAA9 \uC785\uB825 (\uD30C\uC77C \uC120\uD0DD \uC2DC \uAE30\uBCF8\uAC12, \uC218\uC815 \uAC00\uB2A5)
  var titleIn = document.createElement('input');
  titleIn.className = 'vid-form-title';
  titleIn.type = 'text';
  titleIn.placeholder = 'Video title (e.g. Gangnam Facial Treatment)';
  titleIn.style.cssText = 'width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 12px;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;';

  // \uC228\uACA8\uC9C4 desc
  var descIn = document.createElement('input');
  descIn.className = 'vid-form-desc';
  descIn.type = 'hidden';
  descIn.value = '';

  // \uC5C5\uB85C\uB4DC \uC601\uC5ED
  var uploadWrap = document.createElement('div');
  uploadWrap.style.cssText = 'display:flex;align-items:center;gap:10px';

  var fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'video/mp4,video/quicktime,video/x-m4v';
  fileIn.style.cssText = 'display:none';

  var uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.style.cssText = 'padding:8px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap';
  uploadBtn.textContent = '\uC601\uC0C1 \uD30C\uC77C \uC120\uD0DD';

  var uploadStatus = document.createElement('span');
  uploadStatus.style.cssText = 'font-size:12px;color:rgba(255,255,255,.4)';
  uploadStatus.textContent = '\uD30C\uC77C\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694';

  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'vid-del';
  delBtn.textContent = '\u2715';
  delBtn.style.cssText = 'margin-left:auto;background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:30px;height:30px;cursor:pointer;font-size:13px;flex-shrink:0';

  uploadBtn.addEventListener('click', function(){ fileIn.click(); });

  fileIn.addEventListener('change', function(){
    var file = fileIn.files && fileIn.files[0];
    if(!file) return;
    if(!titleIn.value) titleIn.value = file.name.split('.').slice(0,-1).join('.').replace(/[-_]/g,' ') || file.name;
    uploadStatus.style.color = '#fbbf24';
    uploadStatus.textContent = '\uC11C\uBA85 \uBC1C\uAE09 \uC911...';
    uploadBtn.disabled = true;
    uploadBtn.textContent = '\uC5C5\uB85C\uB4DC \uC911...';
    // 1) \uC11C\uBC84\uC5D0\uC11C \uC11C\uBA85 \uBC1B\uAE30
    fetch('/api/upload-sign')
      .then(function(r){ return r.json(); })
      .then(function(sign){
        if(sign.error){ throw new Error(sign.error); }
        // 2) Cloudinary\uC5D0 \uC9C1\uC811 \uC5C5\uB85C\uB4DC (Vercel \uD06C\uAE30\uC81C\uD55C \uC6B0\uD68C)
        var mb = (file.size/1024/1024).toFixed(1);
        uploadStatus.textContent = '\uC5C5\uB85C\uB4DC \uC911... (' + mb + 'MB)';
        var fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', sign.apiKey);
        fd.append('timestamp', sign.timestamp);
        fd.append('signature', sign.signature);
        fd.append('folder', sign.folder);
        return fetch('https://api.cloudinary.com/v1_1/' + sign.cloudName + '/video/upload', {
          method: 'POST', body: fd
        }).then(function(r){ return r.json(); });
      })
      .then(function(data){
        if(data.secure_url){
          urlIn.value = data.secure_url;
          uploadStatus.style.color = '#4ade80';
          uploadStatus.textContent = '\u2705 \uC5C5\uB85C\uB4DC \uC644\uB8CC!';
          uploadBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          uploadBtn.textContent = '\uC644\uB8CC \u2713';
        } else {
          var errMsg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
          uploadStatus.style.color = '#f87171';
          uploadStatus.textContent = '\u274C ' + errMsg;
          uploadBtn.disabled = false;
          uploadBtn.textContent = '\uC601\uC0C1 \uD30C\uC77C \uC120\uD0DD';
        }
      })
      .catch(function(err){
        uploadStatus.style.color = '#f87171';
        uploadStatus.textContent = '\u274C ' + (err.message || '\uB124\uD2B8\uC6CC\uD06C \uC624\uB958');
        uploadBtn.disabled = false;
        uploadBtn.textContent = '\uC601\uC0C1 \uD30C\uC77C \uC120\uD0DD';
      });
  });

  uploadWrap.appendChild(fileIn);
  uploadWrap.appendChild(uploadBtn);
  uploadWrap.appendChild(uploadStatus);
  uploadWrap.appendChild(delBtn);

  row.appendChild(urlIn);
  row.appendChild(descIn);
  row.appendChild(titleIn);
  row.appendChild(uploadWrap);
  list.appendChild(row);
}

// \uC601\uC0C1 \uD589 URL \uCC98\uB9AC (\uAD6C\uAE00\uB4DC\uB77C\uC774\uBE0C \uC790\uB3D9\uBCC0\uD658)
function handleVidRowUrl(input, badge){
  var raw = input.value;
  if(!raw){ badge.style.display='none'; return; }
  if(raw.indexOf('drive.google.com') !== -1){
    var converted = convertGDriveUrl(raw);
    if(converted){
      input.value = converted;
      badge.style.display='inline-block';
      badge.style.background='linear-gradient(135deg,#4285F4,#34A853)';
      badge.style.color='#fff';
      badge.textContent='G Drive';
    }
    return;
  }
  if(raw.indexOf('r2.dev') !== -1){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#F6821F,#FAAD3D)';
    badge.style.color='#fff';
    badge.textContent='R2';
    return;
  }
  badge.style.display='none';
}

// \u2500\u2500 \uC9C0\uC5ED \uD0A4\uC6CC\uB4DC \u2192 \uC9C0\uC5ED\uBA85 \uBCC0\uD658 \u2500\u2500
function detectArea(text){
  var areaMap = [
    ['\uC555\uAD6C\uC815','Apgujeong, Seoul'],['\uCCAD\uB2F4','Cheongdam, Seoul'],
    ['\uAC00\uB85C\uC218\uAE38','Sinsa, Seoul'],['\uC2E0\uC0AC','Sinsa, Seoul'],
    ['\uC5ED\uC0BC','Gangnam, Seoul'],['\uC120\uB989','Gangnam, Seoul'],['\uC0BC\uC131\uB3D9','Gangnam, Seoul'],
    ['\uAC15\uB0A8','Gangnam, Seoul'],['\uC11C\uCD08','Seocho, Seoul'],
    ['\uD64D\uB300','Hongdae, Seoul'],['\uD569\uC815','Hapjeong, Seoul'],['\uC0C1\uC218','Hapjeong, Seoul'],
    ['\uC2E0\uCD0C','Sinchon, Seoul'],['\uB9C8\uD3EC','Mapo, Seoul'],
    ['\uC774\uD0DC\uC6D0','Itaewon, Seoul'],['\uD55C\uB0A8','Itaewon, Seoul'],['\uC6A9\uC0B0','Yongsan, Seoul'],
    ['\uBA85\uB3D9','Myeongdong, Seoul'],['\uCDA9\uBB34\uB85C','Myeongdong, Seoul'],['\uC911\uAD6C','Myeongdong, Seoul'],
    ['\uC885\uB85C','Jongno, Seoul'],['\uC778\uC0AC\uB3D9','Jongno, Seoul'],['\uBD81\uCD0C','Jongno, Seoul'],
    ['\uB3D9\uB300\uBB38','Dongdaemun, Seoul'],['\uC2E0\uC124','Dongdaemun, Seoul'],
    ['\uC131\uC218','Seongsu, Seoul'],['\uC131\uB3D9','Seongsu, Seoul'],['\uB69D\uC12C','Seongsu, Seoul'],
    ['\uAC74\uB300','Konkuk, Seoul'],['\uAD11\uC9C4','Konkuk, Seoul'],
    ['\uC7A0\uC2E4','Jamsil, Seoul'],['\uC1A1\uD30C','Songpa, Seoul'],['\uAC15\uB3D9','Songpa, Seoul'],
    ['\uB178\uC6D0','Nowon, Seoul'],['\uB3C4\uBD09','Nowon, Seoul'],
    ['\uC2E0\uB9BC','Sinlim, Seoul'],['\uAD00\uC545','Sinlim, Seoul'],
    ['\uC5EC\uC758\uB3C4','Yeouido, Seoul'],['\uC601\uB4F1\uD3EC','Yeouido, Seoul'],
    ['\uAC15\uC11C','Gangseo, Seoul'],['\uBAA9\uB3D9','Gangseo, Seoul'],
    ['\uC740\uD3C9','Eunpyeong, Seoul'],['\uC5F0\uC2E0\uB0B4','Eunpyeong, Seoul'],
    ['\uBD80\uC0B0','Busan'],['\uD574\uC6B4\uB300','Busan'],['\uC11C\uBA74','Busan'],
    ['\uC81C\uC8FC','Jeju'],['\uC778\uCC9C','Incheon'],['\uB300\uAD6C','Daegu'],
    ['\uB300\uC804','Daejeon'],['\uAD11\uC8FC','Gwangju'],['\uC218\uC6D0','Suwon']
  ];
  var t = text.toLowerCase();
  for(var i=0;i<areaMap.length;i++){
    if(t.indexOf(areaMap[i][0])!==-1) return areaMap[i][1];
  }
  return '';
}

// \u2500\u2500 \uC5C5\uCCB4\uBA85 \uCD94\uCD9C (place URL\uC758 \uCCAB \uD1A0\uD070) \u2500\u2500
function extractPlaceName(placeText){
  // "\uAC15\uB0A8 \uAE00\uB85C\uC6B0 \uC2A4\uD0A8\uD074\uB9AC\uB2C9 \uC11C\uC6B8\uD2B9\uBCC4\uC2DC \uAC15\uB0A8\uAD6C..." \u2192 \uCCAB \uC758\uBBF8 \uB2E8\uC704 \uCD94\uCD9C
  var parts = placeText.split(' ');
  // \uC55E\uC5D0\uC11C \uCD5C\uB300 4\uB2E8\uC5B4, \uC8FC\uC18C\uC131 \uB2E8\uC5B4 \uB098\uC624\uBA74 \uC911\uB2E8
  var stopWords = ['\uC11C\uC6B8','\uACBD\uAE30','\uBD80\uC0B0','\uC778\uCC9C','\uB300\uAD6C','\uAD11\uC8FC','\uB300\uC804','\uC6B8\uC0B0','\uC138\uC885','\uD2B9\uBCC4\uC2DC','\uAD11\uC5ED\uC2DC','\uB3C4','\uC2DC','\uAD6C','\uB3D9','\uB85C','\uAE38','\uBC88\uAE38','\uBC88\uC9C0'];
  var name = [];
  for(var i=0;i<parts.length&&i<5;i++){
    var w = parts[i];
    var isStop = false;
    for(var j=0;j<stopWords.length;j++){
      if(w.indexOf(stopWords[j])!==-1){ isStop=true; break; }
    }
    if(isStop) break;
    name.push(w);
  }
  return name.join(' ');
}

// embed iframe preview helper
function updateGmapEmbedPreview(previewId, inputId) {
  var input = document.getElementById(inputId);
  var preview = document.getElementById(previewId);
  if(!input || !preview) return;
  var val = input.value.trim();
  // src="..." \uD615\uD0DC\uB85C \uBD99\uC5EC\uB123\uC73C\uBA74 src \uAC12\uB9CC \uCD94\uCD9C
  var srcMatch = val.match(/src=["']([^"']+)["']/);
  if(srcMatch) { val = srcMatch[1]; input.value = val; }
  if(val.indexOf('google.com/maps/embed') !== -1) {
    var frameId = previewId.replace('preview','frame').replace('gmap-preview','gmap-frame');
    var frame = document.getElementById(frameId) || preview.querySelector('iframe');
    if(frame) frame.src = val;
    preview.style.display = 'block';
  } else if(!val) {
    preview.style.display = 'none';
  }
}

// \u2500\u2500 \uAD6C\uAE00\uB9F5 URL \uD30C\uC2F1 \u2192 \uC790\uB3D9\uC785\uB825 \u2500\u2500
/* \u2500\u2500 \uAD6C\uAE00\uB9F5 \uB9C1\uD06C \u2192 resolve-gmap \u2192 \uD3FC \uC790\uB3D9\uC785\uB825 \u2500\u2500 */
function applyPlacesDataToForm(prefix, d) {
  /* resolve-gmap / places-fetch \uC751\uB2F5\uC744 \uD3FC prefix\uC758 \uBAA8\uB4E0 \uD544\uB4DC\uC5D0 \uCC44\uC6CC \uB123\uB294 \uACF5\uD1B5 \uD568\uC218 */
  if(d.name)    { var ne=document.getElementById(prefix+'-name');    if(ne && !ne.value.trim()) ne.value=d.name; }
  if(d.address) { var ae=document.getElementById(prefix+'-addr');    if(ae) ae.value=d.address; }
  if(d.location){ var le=document.getElementById(prefix+'-loc');     if(le && !le.value.trim()) le.value=d.location; }
  if(d.lat)     { var late=document.getElementById(prefix+'-lat');   if(late) late.value=d.lat; }
  if(d.lng)     { var lnge=document.getElementById(prefix+'-lng');   if(lnge) lnge.value=d.lng; }

  if(d.weekdayDescriptions && d.weekdayDescriptions.length>0){
    var he=document.getElementById(prefix+'-hours'); if(he) he.value=d.weekdayDescriptions.join(' | ');
  } else if(d.hours){
    var he2=document.getElementById(prefix+'-hours'); if(he2) he2.value=d.hours;
  }

  /* \uC5C5\uCCB4 \uC18C\uAC1C (editorialSummary) \u2014 \uBE44\uC5B4\uC788\uC744 \uB54C\uB9CC \uCC44\uC6C0 */
  if(d.description){
    var de=document.getElementById(prefix+'-desc');
    if(de && !de.value.trim()) de.value=d.description;
  }

  /* \uCE74\uD14C\uACE0\uB9AC \uC790\uB3D9\uC120\uD0DD (suggestedCategory) */
  if(d.suggestedCategory){
    var ce=document.getElementById(prefix+'-cat');
    if(ce) ce.value=d.suggestedCategory;
  }

  if(d.rating){ var re=document.getElementById(prefix+'-rating'); if(re) re.value=d.rating; }
  if(d.reviewCount){ var rce=document.getElementById(prefix+'-review-count'); if(rce) rce.value=d.reviewCount; }
  if(d.reviews && d.reviews.length>0){ var rve=document.getElementById(prefix+'-reviews'); if(rve) rve.value=JSON.stringify(d.reviews); }
  if(d.placeId){ var pie=document.getElementById(prefix+'-place-id'); if(pie) pie.value=d.placeId; }
  if(d.photos && d.photos.length>0){
    var th=document.getElementById(prefix+'-thumb'); if(th && !th.value) th.value=d.photos[0];
    var ph=document.getElementById(prefix+'-photos'); if(ph) ph.value=JSON.stringify(d.photos);
    /* \uC0AC\uC9C4 \uBBF8\uB9AC\uBCF4\uAE30 */
    var prevId=prefix==='sh'?'sh-photos-preview':'edit-sh-photos-preview';
    var prevEl=document.getElementById(prevId);
    if(prevEl){
      prevEl.innerHTML=d.photos.map(function(u){ return '<img src="'+u+'" style="width:64px;height:64px;object-fit:cover;border-radius:7px;border:1px solid rgba(255,255,255,.12)" onerror="this.remove()">'; }).join('');
      prevEl.style.display='flex'; prevEl.style.flexWrap='wrap'; prevEl.style.gap='4px'; prevEl.style.marginTop='8px';
    }
  }
}

var _CAT_LABEL = {skincare:'\uC2A4\uD0A8\uCF00\uC5B4',makeup:'\uBA54\uC774\uD06C\uC5C5',hair:'\uD5E4\uC5B4',headspa:'\uD5E4\uB4DC\uC2A4\uD30C',nail:'\uB124\uC77C',clinic:'\uD074\uB9AC\uB2C9',spa:'\uC2A4\uD30C\xB7\uB9C8\uC0AC\uC9C0'};

function buildPlacesResultCard(d, extra) {
  /* \uAC00\uC838\uC628 \uC815\uBCF4\uB97C \uD55C\uB208\uC5D0 \uBCFC \uC218 \uC788\uB294 \uC0C1\uC138 \uCE74\uB4DC HTML \uBC18\uD658 */
  var html = '<div style="background:rgba(66,133,244,.07);border:1px solid rgba(66,133,244,.3);border-radius:12px;padding:12px 14px;margin-top:8px;font-size:12px">';
  html += '<div style="font-weight:800;color:#60a5fa;margin-bottom:8px;font-size:12px"><i class="fab fa-google"></i> \uAD6C\uAE00 \uC815\uBCF4 \uAC00\uC838\uC624\uAE30 \uC644\uB8CC!</div>';

  /* \uC5C5\uCCB4\uBA85 + \uCE74\uD14C\uACE0\uB9AC \uC790\uB3D9\uAC10\uC9C0 \uBC30\uC9C0 */
  var nameRow = '';
  if(d.name) nameRow += '<b style="color:#fff;font-size:13px">'+d.name+'</b>';
  if(d.suggestedCategory){
    nameRow += ' <span style="background:rgba(232,65,122,.18);border:1px solid rgba(232,65,122,.4);border-radius:20px;padding:1px 8px;font-size:10px;color:#f9a8d4;margin-left:4px">\uC790\uB3D9\uAC10\uC9C0: '+(_CAT_LABEL[d.suggestedCategory]||d.suggestedCategory)+'</span>';
  }
  if(nameRow) html += '<div style="margin-bottom:6px">'+nameRow+'</div>';

  /* \uD3C9\uC810 + \uB9AC\uBDF0\uC218 */
  if(d.rating){
    var stars=''; for(var i=0;i<5;i++) stars+=(i<Math.round(d.rating)?'\u2605':'\u2606');
    html += '<div style="margin-bottom:5px"><span style="color:#fbbf24;font-size:13px">'+stars+'</span> <b style="color:#fbbf24">'+d.rating+'</b> <span style="color:rgba(255,255,255,.4)">('+((d.reviewCount||0).toLocaleString())+'\uAC1C \uB9AC\uBDF0)</span></div>';
  }

  /* \uC8FC\uC18C */
  if(d.address) html += '<div style="margin-bottom:4px;line-height:1.5"><i class="fas fa-map-marker-alt" style="color:#f87171;margin-right:4px"></i><span style="color:rgba(255,255,255,.75)">'+d.address+'</span></div>';

  /* \uC9C0\uC5ED */
  if(d.location) html += '<div style="margin-bottom:5px"><i class="fas fa-location-dot" style="color:#a78bfa;margin-right:4px"></i><span style="color:#c4b5fd">'+d.location+'</span></div>';

  /* \uC5C5\uCCB4 \uC18C\uAC1C */
  if(d.description){
    html += '<div style="margin-bottom:6px;background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px">';
    html += '<div style="color:rgba(255,255,255,.4);margin-bottom:3px;font-size:10px"><i class="fas fa-info-circle" style="margin-right:3px"></i>\uC5C5\uCCB4 \uC18C\uAC1C (\uC790\uB3D9\uC785\uB825\uB428)</div>';
    html += '<div style="color:rgba(255,255,255,.7);font-size:11px;line-height:1.6">'+d.description+'</div>';
    html += '</div>';
  }

  /* \uC601\uC5C5\uC2DC\uAC04 */
  if(d.weekdayDescriptions && d.weekdayDescriptions.length>0){
    html += '<div style="margin-bottom:6px"><div style="color:rgba(255,255,255,.4);margin-bottom:3px"><i class="fas fa-clock" style="margin-right:4px"></i>\uC601\uC5C5\uC2DC\uAC04</div>';
    html += '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:6px 8px;font-size:11px;color:rgba(255,255,255,.65);line-height:1.7">';
    d.weekdayDescriptions.forEach(function(h){ html += h + '<br>'; });
    html += '</div></div>';
  }

  /* \uC0AC\uC9C4 */
  if(d.photos && d.photos.length>0){
    html += '<div style="margin-bottom:6px"><div style="color:rgba(255,255,255,.4);margin-bottom:4px"><i class="fas fa-images" style="margin-right:4px"></i>\uC0AC\uC9C4 '+d.photos.length+'\uC7A5</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    d.photos.slice(0,8).forEach(function(u){ html += '<img src="'+u+'" style="width:58px;height:58px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.1)" onerror="this.remove()">'; });
    html += '</div></div>';
  }

  /* \uB9AC\uBDF0 \uBBF8\uB9AC\uBCF4\uAE30 */
  if(d.reviews && d.reviews.length>0){
    html += '<div style="margin-bottom:4px"><div style="color:rgba(255,255,255,.4);margin-bottom:4px"><i class="fas fa-comment" style="margin-right:4px"></i>\uB9AC\uBDF0 \uBBF8\uB9AC\uBCF4\uAE30</div>';
    d.reviews.slice(0,2).forEach(function(rv){
      var strs=''; for(var i=0;i<(rv.rating||5);i++) strs+='\u2605';
      html += '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px;margin-bottom:4px;font-size:11px">';
      html += '<div style="color:#fbbf24;font-size:10px;margin-bottom:2px">'+strs+' <span style="color:rgba(255,255,255,.4)">'+rv.author+'</span></div>';
      html += '<div style="color:rgba(255,255,255,.7);line-height:1.5">'+rv.text.slice(0,120)+(rv.text.length>120?'\u2026':'')+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if(extra) html += extra;
  html += '</div>';
  return html;
}

function parseGmapUrl(raw){
  var status = document.getElementById('sh-gmap-status');
  var url = raw.trim();
  if(!url){ status.textContent=''; return; }

  document.getElementById('sh-gmap-raw').setAttribute('data-gmap-url', url);

  /* \uAD6C\uAE00\uB9F5 URL \u2192 \uC11C\uBC84 \uACBD\uC720: resolve-gmap\uC774 Places API\uAE4C\uC9C0 \uC870\uD68C\uD574\uC11C \uC804\uCCB4\uC815\uBCF4 \uBC18\uD658 */
  if(url.indexOf('google.com/maps')!==-1 || url.indexOf('goo.gl')!==-1 || url.indexOf('maps.app')!==-1){
    status.style.color='#fbbf24';
    status.innerHTML='<i class="fas fa-spinner fa-spin"></i> \uAD6C\uAE00\uC5D0\uC11C \uC5C5\uCCB4 \uC815\uBCF4 \uAC00\uC838\uC624\uB294 \uC911...';
    fetch('/api/resolve-gmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){ status.style.color='#f87171'; status.textContent='\u274C '+d.error; return; }
        /* \uACF5\uD1B5 \uD5EC\uD37C\uB85C sh- \uD3FC \uC804\uCCB4 \uC785\uB825 */
        applyPlacesDataToForm('sh', d);
        if(d._fromPlaces){
          status.innerHTML = buildPlacesResultCard(d, '<div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.3)">\uB9C1\uD06C \uC790\uB3D9\uAC00\uC838\uC624\uAE30 \uC644\uB8CC</div>');
        } else if(d.address||d.name){
          status.style.color='#4ade80';
          status.textContent='\u2705 \uC790\uB3D9\uC785\uB825 \uC644\uB8CC! \uB0B4\uC6A9\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.';
        } else {
          status.style.color='#fbbf24';
          status.textContent='\u26A0 \uC77C\uBD80 \uC815\uBCF4\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.';
        }
      })
      .catch(function(e){
        status.style.color='#f87171';
        status.textContent='\u274C \uBD84\uC11D \uC2E4\uD328: '+e.message;
      });
    return;
  }

  status.style.color='rgba(255,255,255,.4)';
  status.textContent='\uAD6C\uAE00\uB9F5 \uB9C1\uD06C\uB97C \uBD99\uC5EC\uB123\uC5B4 \uC8FC\uC138\uC694.';
}

// \u2500\u2500 \uC5C5\uCCB4 \uB4F1\uB85D \u2500\u2500
function addShop(){
  var name = document.getElementById('sh-name').value.trim();
  if(!name){ alert('\uC5C5\uCCB4\uBA85\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694!'); return; }

  // \uC11C\uBE44\uC2A4 \uD589 \uC218\uC9D1
  var svcRows = document.querySelectorAll('#svc-list .svc-row');
  var svcs = [], svcPrices = [], pMin = 0, pMax = 0;
  svcRows.forEach(function(row){
    var n = row.querySelector('.svc-name').value.trim();
    var p = parseInt(row.querySelector('.svc-price').value)||0;
    if(n){
      svcs.push(n);
      svcPrices.push({name:n, price: p ? fmtPrice(p) : ''});
      if(p){ if(!pMin||p<pMin) pMin=p; if(p>pMax) pMax=p; }
    }
  });
  var priceRange = (pMin||pMax) ? (fmtPrice(pMin)+(pMax&&pMax!==pMin?'~'+fmtPrice(pMax):'')) : 'Contact us';

  // slug \uC0DD\uC131 (\uD55C\uAE00 \uC5C5\uCCB4\uBA85\uB3C4 \uC548\uC804\uD558\uAC8C)
  var slugBase = '';
  for(var ci=0;ci<name.length;ci++){ var ch=name[ci].toLowerCase(); slugBase += (ch>='a'&&ch<='z')||(ch>='0'&&ch<='9') ? ch : '-'; }
  while(slugBase.indexOf('--')!==-1) slugBase=slugBase.split('--').join('-');
  slugBase = slugBase.split('').filter(function(c){return c!=='-';}).length === 0 ? '' : slugBase;
  if(slugBase && slugBase[0]==='-') slugBase=slugBase.slice(1);
  if(slugBase && slugBase[slugBase.length-1]==='-') slugBase=slugBase.slice(0,-1);
  var slug = (slugBase||'shop') + '-' + Date.now().toString().slice(-6);

  var rawInput = document.getElementById('sh-gmap-raw');
  var gmapUrl = rawInput.getAttribute('data-gmap-url') || rawInput.value || '';

  // \uC601\uC0C1 \uD589 \uC218\uC9D1
  var vidRows = document.querySelectorAll('#vid-list .vid-row-form');
  var pendingVids = [];
  vidRows.forEach(function(row){
    var t = row.querySelector('.vid-form-title').value.trim();
    var u = row.querySelector('.vid-form-url').value.trim();
    var d = row.querySelector('.vid-form-desc').value.trim();
    if(t && u) pendingVids.push({title:t, videoUrl:u, description:d});
  });

  var btn = document.getElementById('sh-submit-btn');
  btn.disabled = true;
  btn.textContent = '\uB4F1\uB85D \uC911...';

  fetch('/api/shops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:name, slug:slug,
    category:document.getElementById('sh-cat').value,
    location:document.getElementById('sh-loc').value||'Seoul',
    priceRange:priceRange,
    hours:document.getElementById('sh-hours').value||'',
    commission:15,
    address:document.getElementById('sh-addr').value||'',
    googleMapUrl:gmapUrl,
    googleMapEmbed:document.getElementById('sh-gmap-embed').value||'',
    lat:document.getElementById('sh-lat').value||'',
    lng:document.getElementById('sh-lng').value||'',
    thumbnail:'',
    services:svcs,
    servicePrices:svcPrices,
    description:document.getElementById('sh-desc').value||'',
    reviews:(function(){ try{ var el=document.getElementById('sh-reviews'); return el?JSON.parse(el.value||'[]'):[];} catch(e){return[];}}()),
    googlePlaceId:(function(){ var el=document.getElementById('sh-place-id'); return el?el.value:'';})(),
    rating:(function(){ var el=document.getElementById('sh-rating'); return el?parseFloat(el.value)||5.0:5.0;})(),
    reviewCount:(function(){ var el=document.getElementById('sh-review-count'); return el?parseInt(el.value)||0:0;})(),
    photos:(function(){ try{ var el=document.getElementById('sh-photos'); return el?JSON.parse(el.value||'[]'):[];} catch(e){return[];}}())
  })}).then(function(r){return r.json();}).then(function(res){
    var newShopId = res.id || null;
    // \uD3FC \uCD08\uAE30\uD654
    var gepEl = document.getElementById('sh-gmap-embed'); if(gepEl){ gepEl.value=''; }
    var gepPrev = document.getElementById('sh-gmap-embed-preview'); if(gepPrev) gepPrev.style.display='none';
    ['sh-name','sh-loc','sh-addr','sh-desc','sh-gmap-raw'].forEach(function(id){
      var el = document.getElementById(id);
      if(el){ el.value=''; el.removeAttribute('data-gmap-url'); }
    });
    document.getElementById('sh-gmap-status').textContent='';
    document.getElementById('svc-list').innerHTML='';
    document.getElementById('vid-list').innerHTML='';
    addSvcRow();
    btn.disabled = false;
    btn.textContent = '\uC5C5\uCCB4 \uB4F1\uB85D \uC644\uB8CC';
    // \uC601\uC0C1 \uC21C\uCC28 \uB4F1\uB85D
    if(newShopId && pendingVids.length > 0){
      var chain = Promise.resolve();
      pendingVids.forEach(function(v){
        chain = chain.then(function(){
          return fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            shopId:newShopId,
            title:v.title,
            videoUrl:v.videoUrl,
            description:v.description,
            thumbnail:'',
            tags:[],
            views:0, likes:0
          })});
        });
      });
      chain.then(loadAll);
    } else {
      loadAll();
    }
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = '\uC5C5\uCCB4 \uB4F1\uB85D \uC644\uB8CC';
    alert('\uB4F1\uB85D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
  });
}

function delShop(id){
  if(!confirm('\uC5C5\uCCB4\uB97C \uC0AD\uC81C\uD558\uBA74 \uC5F0\uACB0\uB41C \uC601\uC0C1\uB3C4 \uBAA8\uB450 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4. \uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'))return;
  fetch('/api/shops/'+id,{method:'DELETE'}).then(loadAll);
}

// \u2500\u2500 \uAD6C\uAE00 \uB4DC\uB77C\uC774\uBE0C URL \uBCC0\uD658 \u2500\u2500
function convertGDriveUrl(url){
  var marker1 = 'drive.google.com/file/d/';
  var idx1 = url.indexOf(marker1);
  if(idx1 !== -1){
    var rest1 = url.slice(idx1 + marker1.length);
    var id1 = rest1.split('/')[0].split('?')[0];
    if(id1) return 'https://drive.google.com/uc?export=download&id=' + id1;
  }
  var marker2 = 'drive.google.com/open?id=';
  var idx2 = url.indexOf(marker2);
  if(idx2 !== -1){
    var id2 = url.slice(idx2 + marker2.length).split('&')[0];
    if(id2) return 'https://drive.google.com/uc?export=download&id=' + id2;
  }
  if(url.indexOf('drive.google.com/uc') !== -1) return url;
  return null;
}

function detectUrlType(url){
  if(!url) return null;
  if(url.indexOf('drive.google.com') !== -1) return 'gdrive';
  if(url.indexOf('r2.dev') !== -1 || url.indexOf('r2.cloudflarestorage') !== -1) return 'r2';
  var lower = url.toLowerCase().split('?')[0];
  if(lower.slice(-4)==='.mp4'||lower.slice(-5)==='.webm'||lower.slice(-4)==='.mov'||lower.slice(-4)==='.avi') return 'direct';
  if(url.indexOf('https://')===0 || url.indexOf('http://')===0) return 'url';
  return null;
}

function handleVideoUrlInput(raw){
  var badge = document.getElementById('vd-url-badge');
  var hint  = document.getElementById('vd-url-hint');
  var preview = document.getElementById('vd-url-preview');
  var input = document.getElementById('vd-url');
  if(!raw){ badge.style.display='none'; hint.style.display='none'; preview.style.display='none'; return; }
  var type = detectUrlType(raw);
  if(type === 'gdrive'){
    var converted = convertGDriveUrl(raw);
    if(converted){
      input.value = converted;
      badge.style.display='inline-block';
      badge.style.background='linear-gradient(135deg,#4285F4,#34A853)';
      badge.style.color='#fff';
      badge.textContent='\uAD6C\uAE00 \uB4DC\uB77C\uC774\uBE0C';
      hint.style.display='block';
      hint.textContent='\u2705 \uAD6C\uAE00 \uB4DC\uB77C\uC774\uBE0C \uB9C1\uD06C \uC790\uB3D9 \uBCC0\uD658 \uC644\uB8CC!';
      showVideoPreview(converted, preview);
      return;
    }
  }
  if(type === 'r2'){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#F6821F,#FAAD3D)';
    badge.style.color='#fff';
    badge.textContent='Cloudflare R2';
    hint.style.display='none';
    showVideoPreview(raw, preview);
    return;
  }
  if(type === 'direct'){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#9B59B6,#8E44AD)';
    badge.style.color='#fff';
    badge.textContent='MP4 \uB9C1\uD06C';
    hint.style.display='none';
    showVideoPreview(raw, preview);
    return;
  }
  badge.style.display='none';
  hint.style.display='none';
  preview.style.display='none';
}

function showVideoPreview(url, container){
  container.style.display='block';
  var wrap = document.createElement('div');
  var label = document.createElement('div');
  label.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px';
  label.textContent = '\u25B6 \uBBF8\uB9AC\uBCF4\uAE30';
  var vid = document.createElement('video');
  vid.src = url;
  vid.controls = true;
  vid.style.cssText = 'width:100%;max-height:160px;border-radius:10px;background:#000;display:block';
  vid.onerror = function(){
    var errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:#f87171';
    errDiv.textContent = '\u26A0 \uC601\uC0C1\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. URL\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.';
    while(container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(label.cloneNode(true));
    container.appendChild(errDiv);
  };
  wrap.appendChild(label);
  wrap.appendChild(vid);
  while(container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(wrap);
}

// \u2500\u2500 \uC601\uC0C1 \uB4F1\uB85D \u2500\u2500
function addVideo(){
  if(!currentShopId){ alert('\uC5C5\uCCB4\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694!'); return; }
  var title = document.getElementById('vd-title').value.trim();
  var url   = document.getElementById('vd-url').value.trim();
  if(!title){ alert('\uC601\uC0C1 \uC81C\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694!'); return; }
  if(!url){   alert('\uC601\uC0C1 URL\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694!'); return; }
  var shop = shops.find(function(s){return s.id===currentShopId;})||{};
  var tags = document.getElementById('vd-tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean);
  fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    shopId:currentShopId,
    title:title, videoUrl:url,
    thumbnail:document.getElementById('vd-thumb').value || shop.thumbnail || '',
    description:document.getElementById('vd-desc').value||'',
    tags:tags
  })}).then(function(){
    closeVideoPanel();
    loadAll();
  });
}

function delVideo(id){
  if(!confirm('\uC774 \uC601\uC0C1\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'))return;
  fetch('/api/videos/'+id,{method:'DELETE'}).then(loadAll);
}

function saveSettings(){
  alert('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4!');
}

/* \u2500\u2500 Google Places \uC790\uB3D9\uAC00\uC838\uC624\uAE30 (\uD1B5\uD569) \u2500\u2500 */
async function fetchPlacesInfo(prefix) {
  var nameEl   = document.getElementById(prefix + '-name');
  var locEl    = document.getElementById(prefix + '-loc');
  var statusEl = document.getElementById(prefix + '-places-status');
  var btnEl    = document.getElementById(prefix + '-places-btn');

  var shopName = nameEl ? nameEl.value.trim() : '';
  var location = locEl  ? locEl.value.trim()  : '';

  /* placeId\uAC00 \uC774\uBBF8 \uC788\uC73C\uBA74 ID\uB85C \uC9C1\uC811 \uC870\uD68C (\uB354 \uC815\uD655) */
  var pidEl = document.getElementById(prefix + '-place-id');
  var existingPid = pidEl ? pidEl.value.trim() : '';

  if (!shopName && !existingPid) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">\u26A0\uFE0F \uC5C5\uCCB4\uBA85\uC744 \uBA3C\uC800 \uC785\uB825\uD558\uC138\uC694</span>';
    return;
  }

  if(statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#60a5fa"></i> <span style="color:#93c5fd"> \uAD6C\uAE00 Places\uC5D0\uC11C \uC804\uCCB4 \uC815\uBCF4 \uAC00\uC838\uC624\uB294 \uC911...</span>';
  if(btnEl) { btnEl.disabled = true; btnEl.style.opacity = '.6'; }

  try {
    var body;
    if(existingPid) {
      body = JSON.stringify({ placeId: existingPid });
    } else {
      var query = shopName + (location ? ' ' + location : '') + ' Seoul Korea';
      body = JSON.stringify({ query: query });
    }

    var res = await fetch('/api/places-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    var d = await res.json();

    if (d.error) {
      if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">\u274C ' + (d.error === 'No place found' ? '\uAD6C\uAE00\uC5D0\uC11C \uC5C5\uCCB4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC5C5\uCCB4\uBA85\uC744 \uC601\uBB38\uC73C\uB85C \uBC14\uAFD4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694.' : d.error) + '</span>';
      return;
    }

    /* \uACF5\uD1B5 \uD5EC\uD37C\uB85C \uBAA8\uB4E0 \uD544\uB4DC \uC790\uB3D9\uC785\uB825 */
    applyPlacesDataToForm(prefix, d);

    /* \uC0C1\uC138 \uACB0\uACFC \uCE74\uB4DC \uB80C\uB354 */
    if(statusEl) statusEl.innerHTML = buildPlacesResultCard(d, '');

  } catch(e) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">\u274C \uC624\uB958: ' + e.message + '</span>';
  } finally {
    if(btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
  }
}

/* \u2500\u2500 AI SEO \uC790\uB3D9\uC0DD\uC131 \u2500\u2500 */
async function genAiSeo(prefix) {
  var nameEl   = document.getElementById(prefix + '-name');
  var locEl    = document.getElementById(prefix + '-loc');
  var catEl    = document.getElementById(prefix + '-cat');
  var descEl   = document.getElementById(prefix + '-desc');
  var statusEl = document.getElementById(prefix + '-ai-status');
  var btnEl    = document.getElementById(prefix + '-ai-btn');

  var name     = nameEl ? nameEl.value.trim() : '';
  var location = locEl  ? locEl.value.trim()  : '';
  var category = catEl  ? catEl.value         : '';

  if (!name) {
    if (statusEl) statusEl.textContent = '\u26A0\uFE0F \uC5C5\uCCB4\uBA85\uC744 \uBA3C\uC800 \uC785\uB825\uD558\uC138\uC694';
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> \uC0DD\uC131 \uC911...'; }
  if (statusEl) statusEl.textContent = 'AI is generating SEO description...';

  // \uC11C\uBE44\uC2A4 \uBAA9\uB85D \uC218\uC9D1
  var services = [];
  var svcInputs = document.querySelectorAll('[id^="' + (prefix==='sh'?'sh':'edit-sh') + '"] .svc-name-input, .svc-name-input');
  svcInputs.forEach(function(el){ if(el.value) services.push(el.value); });

  // \uAC00\uACA9\uB300, \uC601\uC5C5\uC2DC\uAC04 \uC218\uC9D1
  var priceRange = (document.getElementById(prefix + '-price') || {}).value || '';
  var hours      = (document.getElementById(prefix + '-hours') || {}).value || '';

  var catKeywords = {
    skincare:'Korean skincare, facial treatment, glass skin, K-beauty skincare, skin clinic Seoul',
    makeup:'Korean makeup artist, K-beauty makeup Seoul, Korean beauty look, makeup studio Seoul',
    hair:'Korean hair salon, K-pop hairstyle Seoul, hair coloring Seoul, balayage Korean salon',
    headspa:'head spa Seoul, Korean scalp treatment, scalp care Seoul, relaxing head massage Korea',
    nail:'Korean nail art Seoul, nail salon Seoul, K-pop nail design, gel nails Korea',
    clinic:'Korean dermatology Seoul, skin clinic Korea, laser treatment Seoul, aesthetic clinic Korea',
    spa:'Korean spa Seoul, body treatment Korea, Korean massage Seoul, relaxation spa Korea'
  };
  var keywords = catKeywords[category] || 'Korean beauty Seoul, K-beauty';
  var area = (location || 'Seoul').split(',')[0].trim();

  var NL = String.fromCharCode(10);
  var prompt = "You are an SEO expert for a Korean beauty booking platform for foreign tourists." + NL + NL
    + "Generate SEO content for this shop:" + NL
    + "- Name: " + name + NL
    + "- Area: " + area + ", Seoul" + NL
    + "- Category: " + category + NL
    + "- Services: " + (services.join(", ") || "beauty services") + NL
    + "- Keywords to include naturally: " + keywords + ", " + area + " " + category + " Seoul, best " + category + " " + area + NL + NL
    + "Rules:" + NL
    + "1. metaDescription: 140-155 chars, natural English, include shop name + area + category, end with Book via WhatsApp" + NL
    + "2. description: 2 sentences, 180-240 chars, SEO-friendly, English-friendly tone" + NL
    + "3. keywords: exactly 6 strings foreigners search on Google" + NL
    + "4. titleSuffix: short phrase like Gangnam Head Spa Seoul" + NL
    + "5. No quotes inside text, no markdown" + NL + NL
    + 'Return ONLY valid JSON: {"metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6"],"titleSuffix":"..."}';

  try {
    var aiRes = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _GSK_TOKEN },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1200 })
    });
    if (!aiRes.ok) {
      var errBody = ''; try { errBody = await aiRes.text(); } catch(ex){}
      throw new Error('API \uC624\uB958 (' + aiRes.status + ')' + (errBody ? ': ' + errBody.slice(0,120) : ''));
    }
    var aiData = await aiRes.json();
    if (aiData.error) throw new Error(aiData.error.message || JSON.stringify(aiData.error));
    var text = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || '';
    if (!text) throw new Error('AI \uC751\uB2F5\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4. \uD1A0\uD070\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.');

    /* JSON \uCD94\uCD9C (\uB9C8\uD06C\uB2E4\uC6B4 \uCF54\uB4DC\uBE14\uB85D \uD3EC\uD568 \uB300\uC751) */
    /* backtick\uC774 template literal\uB85C \uD574\uC11D\uB418\uC9C0 \uC54A\uB3C4\uB85D RegExp \uC0DD\uC131\uC790 \uC0AC\uC6A9 */
    var reFenceStart = new RegExp('^' + String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96) + 'json[\\s]*');
    var reFenceEnd   = new RegExp(String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96) + '[\\s]*$');
    var cleaned = text.trim().replace(reFenceStart,'').replace(reFenceEnd,'');
    var jsonStart = cleaned.indexOf('{');
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
    var match = cleaned.match(/{[sS]*}/);
    if (!match) throw new Error('JSON \uD30C\uC2F1 \uC2E4\uD328 \u2014 AI \uC751\uB2F5: ' + text.slice(0,100));
    var data = JSON.parse(match[0]);

    if (descEl && data.description) {
      descEl.value = data.description;
      descEl.style.borderColor = 'rgba(124,58,237,.6)';
    }
    if (statusEl) {
      var kw = (data.keywords || []).slice(0,4).join(', ');
      statusEl.innerHTML = '<div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);border-radius:9px;padding:8px 10px;margin-top:4px">'
        + '<div style="color:#a78bfa;font-weight:800;margin-bottom:4px"><i class="fas fa-magic"></i> SEO \uC0DD\uC131 \uC644\uB8CC!</div>'
        + (data.titleSuffix ? '<div style="font-size:11px;color:rgba(255,255,255,.55);margin-bottom:3px">\uD0C0\uC774\uD2C0: <b style="color:rgba(255,255,255,.8)">'+data.titleSuffix+'</b></div>' : '')
        + '<div style="font-size:10px;color:rgba(255,255,255,.4)">\uD0A4\uC6CC\uB4DC: '+kw+'</div>'
        + '</div>';
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#f87171">\u274C \uC2E4\uD328: ' + e.message + '</span>';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fas fa-magic"></i> AI SEO \uC790\uB3D9\uC0DD\uC131'; }
  }
}

loadAll();

/* \u2500\u2500 \uB4F1\uB85D \uD3FC slug \uBBF8\uB9AC\uBCF4\uAE30 \u2500\u2500 */
function updateSlugPreview() {
  var name = (document.getElementById('sh-name')||{}).value || '';
  var loc  = (document.getElementById('sh-loc')||{}).value  || '';
  // \uD074\uB77C\uC774\uC5B8\uD2B8 slug \uBBF8\uB9AC\uACC4\uC0B0 (\uC11C\uBC84\uC640 \uB3D9\uC77C \uB85C\uC9C1)
  var base = '';
  for (var i=0; i<name.length; i++) {
    var ch = name[i].toLowerCase();
    base += (ch>='a'&&ch<='z')||(ch>='0'&&ch<='9') ? ch : '-';
  }
  base = base.replace(/-+/g,'-').replace(/^-|-$/g,'') || 'shop';
  var areaRaw = loc.split(',')[0].trim();
  var area = '';
  for (var j=0; j<areaRaw.length; j++) {
    var ac = areaRaw[j].toLowerCase();
    area += (ac>='a'&&ac<='z') ? ac : '-';
  }
  area = area.replace(/-+/g,'-').replace(/^-|-$/g,'');
  var slug = area ? base+'-'+area : base;

  var wrap = document.getElementById('sh-slug-preview');
  var val  = document.getElementById('sh-slug-preview-val');
  if (!name) { if(wrap) wrap.style.display='none'; return; }
  if (wrap) wrap.style.display='block';
  if (val)  val.textContent = '/shop/' + slug;
}

/* \u2500\u2500 \uC804\uCCB4 Slug \uC815\uB9AC \u2500\u2500 */
async function fixAllSlugs() {
  var btn = document.getElementById('fix-slugs-btn');
  var statusEl = document.getElementById('regen-status');
  var resultsEl = document.getElementById('regen-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Slug \uC815\uB9AC \uC911...'; }
  if (statusEl) statusEl.textContent = '\u23F3 \uC5C5\uCCB4\uBA85+\uC9C0\uC5ED\uBA85 \uAE30\uBC18\uC73C\uB85C Slug \uC7AC\uC0DD\uC131 \uC911...';
  if (resultsEl) resultsEl.innerHTML = '';
  try {
    var res = await fetch('/api/admin/fix-slugs', { method: 'POST', headers: { 'Authorization': 'Bearer ' + _GSK_TOKEN } });
    var data = await res.json();
    if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24">\u2705 \uC644\uB8CC! ' + data.updated + '\uAC1C Slug \uC5C5\uB370\uC774\uD2B8</span>';
    if (resultsEl && data.results) {
      resultsEl.innerHTML = data.results.map(function(r) {
        return '<div style="font-size:11px;padding:3px 0;color:#fbbf24">'
          + '\u{1F517} <b>' + r.name + '</b><br>'
          + '&nbsp;&nbsp;\uC774\uC804: <span style="color:#6b7280">' + r.old + '</span><br>'
          + '&nbsp;&nbsp;\uBCC0\uACBD: <span style="color:#10b981">' + r.new + '</span>'
          + '</div>';
      }).join('<div style="border-top:1px solid rgba(255,255,255,.05);margin:4px 0"></div>');
    }
    if (data.updated > 0) loadShops();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">\u274C \uC624\uB958: ' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> \uC804\uCCB4 Slug \uC815\uB9AC (\uC5C5\uCCB4\uBA85-\uC9C0\uC5ED\uBA85)'; }
  }
}

/* \u2500\u2500 \uC77C\uAD04 SEO \uC7AC\uC0DD\uC131 \u2500\u2500 */
async function regenSeoAll(force) {
  var btn = document.getElementById(force ? 'regen-force-btn' : 'regen-btn');
  var statusEl = document.getElementById('regen-status');
  var resultsEl = document.getElementById('regen-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> \uCC98\uB9AC \uC911...'; }
  if (statusEl) statusEl.textContent = force ? '\u23F3 \uC804\uCCB4 \uC5C5\uCCB4 SEO \uC7AC\uC0DD\uC131 \uC911...' : '\u23F3 SEO \uBBF8\uC0DD\uC131 \uC5C5\uCCB4 \uCC98\uB9AC \uC911...';
  if (resultsEl) resultsEl.innerHTML = '';
  try {
    var url = '/api/admin/regenerate-seo-all' + (force ? '?force=true' : '');
    var res = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + _GSK_TOKEN } });
    var data = await res.json();
    if (statusEl) statusEl.innerHTML = '<span style="color:#10b981">\u2705 \uC644\uB8CC! \uCD1D ' + data.total + '\uAC1C \uC5C5\uCCB4 \uCC98\uB9AC</span>';
    if (resultsEl && data.results) {
      resultsEl.innerHTML = data.results.map(function(r) {
        var color = r.status === 'updated' ? '#10b981' : r.status.startsWith('error') ? '#ef4444' : '#6b7280';
        return '<div style="font-size:11px;padding:3px 0;color:' + color + '">'
          + (r.status === 'updated' ? '\u2705' : r.status.startsWith('error') ? '\u274C' : '\u23ED\uFE0F')
          + ' ' + r.name + ' \u2014 ' + r.status + '</div>';
      }).join('');
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">\u274C \uC624\uB958: ' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = force ? '<i class="fas fa-sync"></i> \uC804\uCCB4 \uC5C5\uCCB4 SEO \uAC15\uC81C \uC7AC\uC0DD\uC131' : '<i class="fas fa-magic"></i> SEO \uBBF8\uC0DD\uC131 \uC5C5\uCCB4 \uC77C\uAD04 \uC0DD\uC131'; }
  }
}

}); // DOMContentLoaded
</script>
</body>
</html>`;
