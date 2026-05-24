
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
      let handler2;
      if (middleware[i]) {
        handler2 = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler2 = i === middleware.length && next || void 0;
      }
      if (handler2) {
        try {
          res = await handler2(context, () => dispatch(i + 1));
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
        args.forEach((handler2) => {
          this.#addRoute(method, this.#path, handler2);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler2) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler2);
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
      handlers.forEach((handler2) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler2);
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
      let handler2;
      if (app2.errorHandler === errorHandler) {
        handler2 = r.handler;
      } else {
        handler2 = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler2[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler2);
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
  onError = (handler2) => {
    this.errorHandler = handler2;
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
  notFound = (handler2) => {
    this.#notFoundHandler = handler2;
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
    const handler2 = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler2);
    return this;
  }
  #addRoute(method, path, handler2) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler: handler2 };
    this.router.add(method, path, [handler2, r]);
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
  add(method, path, handler2) {
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
            re.test(p) && middleware[m][p].push([handler2, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler2, paramCount])
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
          routes[m][path2].push([handler2, paramCount - len + i + 1]);
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
  add(method, path, handler2) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler2]);
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
  constructor(method, handler2, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler2) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler: handler2, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler2) {
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
        handler: handler2,
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
    return [handlerSets.map(({ handler: handler2, params }) => [handler2, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler2) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler2);
      }
      return;
    }
    this.#node.insert(method, path, handler2);
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
var app = new Hono2();
var PLATFORM = {
  whatsapp: "821012345678",
  // 운영자 왓츠앱 번호 (국가코드 포함, +없이)
  name: "SEOUL BEAUTY TRIP",
  instagram: "seoulbeautytrip",
  commission: "10~20%"
};
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
var bookings = [
  { id: "b1", shopId: "s1", shopName: "Gangnam Glow Skin Clinic", videoId: "v1", name: "Sarah Johnson", email: "sarah@example.com", phone: "+1-555-0101", date: "2024-02-15", people: "2 People", service: "Deep Cleansing Facial", message: "Excited to try!", status: "confirmed", commissionRate: 15, estimatedAmount: "\u20A9240,000", createdAt: "2024-02-10" },
  { id: "b2", shopId: "s4", shopName: "Itaewon Nail Bar", videoId: "v4", name: "Emma Wilson", email: "emma@example.com", phone: "+44-7700-900123", date: "2024-02-18", people: "1 Person", service: "K-pop Nail Art", message: "Can you do BTS inspired nails?", status: "new", commissionRate: 10, estimatedAmount: "\u20A970,000", createdAt: "2024-02-12" },
  { id: "b3", shopId: "s2", shopName: "Hongdae Beauty Studio", videoId: "v2", name: "Yuki Tanaka", email: "yuki@example.com", phone: "+81-90-1234-5678", date: "2024-02-20", people: "3 People", service: "K-pop Makeup", message: "We are visiting Seoul for 3 days!", status: "contacted", commissionRate: 10, estimatedAmount: "\u20A9360,000", createdAt: "2024-02-13" },
  { id: "b4", shopId: "s5", shopName: "Apgujeong Derma Lab", videoId: "v5", name: "Lisa Chen", email: "lisa@example.com", phone: "+65-9123-4567", date: "2024-02-22", people: "1 Person", service: "Laser Treatment", message: "Interested in skin brightening", status: "new", commissionRate: 20, estimatedAmount: "\u20A9300,000", createdAt: "2024-02-14" }
];
app.get("/api/videos", (c) => {
  const cat = c.req.query("category");
  const list = cat && cat !== "all" ? videos.filter((v) => {
    const shop = shops.find((s) => s.id === v.shopId);
    return shop?.category === cat;
  }) : videos;
  const result = list.map((v) => {
    const shop = shops.find((s) => s.id === v.shopId);
    return { ...v, shop };
  });
  return c.json({ videos: result });
});
app.get("/api/shops", (c) => c.json({ shops }));
app.get("/api/shops/:id", (c) => {
  const shop = shops.find((s) => s.id === c.req.param("id"));
  if (!shop) return c.json({ error: "Not found" }, 404);
  const shopVideos = videos.filter((v) => v.shopId === shop.id);
  return c.json({ shop, videos: shopVideos });
});
app.post("/api/resolve-gmap", async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url) return c.json({ error: "no url" }, 400);
    let resolved = url;
    for (let i = 0; i < 5; i++) {
      const r = await fetch(resolved, { method: "HEAD", redirect: "manual" });
      const loc = r.headers.get("location");
      if (!loc) break;
      resolved = loc.indexOf("http") === 0 ? loc : resolved;
      if (loc.indexOf("maps.google.com") !== -1 || loc.indexOf("/maps/place/") !== -1) break;
    }
    const areaMap = [
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
      ["\uBD80\uC0B0", "Busan"],
      ["\uD574\uC6B4\uB300", "Busan"],
      ["\uC11C\uBA74", "Busan"],
      ["\uC81C\uC8FC", "Jeju"],
      ["\uC778\uCC9C", "Incheon"],
      ["\uB300\uAD6C", "Daegu"],
      ["\uB300\uC804", "Daejeon"],
      ["\uAD11\uC8FC", "Gwangju"],
      ["\uC218\uC6D0", "Suwon"]
    ];
    const findArea = (text) => {
      const t = text.toLowerCase();
      for (const [kw, val] of areaMap) {
        if (t.indexOf(kw) !== -1) return val;
      }
      return "";
    };
    const placeIdx = resolved.indexOf("/place/");
    if (placeIdx !== -1) {
      const raw2 = resolved.slice(placeIdx + 7).split("/")[0];
      let decoded = "";
      try {
        decoded = decodeURIComponent(raw2.split("+").join(" "));
      } catch {
        decoded = raw2;
      }
      decoded = decoded.split("?")[0].trim();
      const stopWords = ["\uC11C\uC6B8", "\uACBD\uAE30", "\uBD80\uC0B0", "\uC778\uCC9C", "\uB300\uAD6C", "\uAD11\uC8FC", "\uB300\uC804", "\uC6B8\uC0B0", "\uD2B9\uBCC4\uC2DC", "\uAD11\uC5ED\uC2DC", "\uAD6C", "\uB3D9", "\uB85C ", "\uAE38 ", "\uBC88\uAE38", "\uBC88\uC9C0"];
      const parts = decoded.split(" ");
      const nameParts = [];
      for (let i = 0; i < parts.length && i < 5; i++) {
        const w = parts[i];
        if (stopWords.some((s) => w.indexOf(s) !== -1)) break;
        nameParts.push(w);
      }
      const name = nameParts.join(" ");
      const location = findArea(decoded);
      return c.json({ name, address: decoded, location });
    }
    let qIdx = resolved.indexOf("?q=");
    if (qIdx === -1) qIdx = resolved.indexOf("&q=");
    if (qIdx !== -1) {
      const qVal = resolved.slice(qIdx + 3).split("&")[0];
      let dec2 = "";
      try {
        dec2 = decodeURIComponent(qVal.split("+").join(" "));
      } catch {
        dec2 = qVal;
      }
      return c.json({ address: dec2, location: findArea(dec2), name: "" });
    }
    return c.json({ address: "", location: "", name: "" });
  } catch (e) {
    return c.json({ error: e.message || "failed" }, 500);
  }
});
app.post("/api/upload", async (c) => {
  try {
    const CLOUD_NAME = "dc0ouozcd";
    const API_KEY = "221647295675392";
    const API_SECRET = "g10Q4wv2UzDEAGV35QluPCYz4Ms";
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file) return c.json({ error: "No file" }, 400);
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const folder = "seoul-beauty";
    const strToSign = "folder=" + folder + "&timestamp=" + timestamp + API_SECRET;
    const enc = new TextEncoder();
    const keyData = enc.encode(strToSign);
    const hashBuf = await crypto.subtle.digest("SHA-1", keyData);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const signature = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", API_KEY);
    uploadForm.append("timestamp", timestamp);
    uploadForm.append("signature", signature);
    uploadForm.append("folder", folder);
    const res = await fetch("https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/video/upload", {
      method: "POST",
      body: uploadForm
    });
    const data = await res.json();
    if (!res.ok) return c.json({ error: data.error?.message || "Upload failed" }, 500);
    return c.json({ ok: true, url: data.secure_url, publicId: data.public_id });
  } catch (e) {
    return c.json({ error: e.message || "Unknown error" }, 500);
  }
});
app.post("/api/shops", async (c) => {
  const body = await c.req.json();
  const newId = "s" + Date.now();
  shops.push({ id: newId, createdAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], active: true, ...body });
  return c.json({ ok: true, id: newId });
});
app.put("/api/shops/:id", async (c) => {
  const idx = shops.findIndex((s) => s.id === c.req.param("id"));
  if (idx === -1) return c.json({ error: "Not found" }, 404);
  const body = await c.req.json();
  shops[idx] = { ...shops[idx], ...body };
  return c.json({ ok: true });
});
app.delete("/api/shops/:id", (c) => {
  const idx = shops.findIndex((s) => s.id === c.req.param("id"));
  if (idx !== -1) shops.splice(idx, 1);
  return c.json({ ok: true });
});
app.post("/api/videos", async (c) => {
  const body = await c.req.json();
  videos.push({ id: "v" + Date.now(), views: 0, likes: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], ...body });
  return c.json({ ok: true });
});
app.delete("/api/videos/:id", (c) => {
  const idx = videos.findIndex((v) => v.id === c.req.param("id"));
  if (idx !== -1) videos.splice(idx, 1);
  return c.json({ ok: true });
});
app.post("/api/videos/:id/view", (c) => {
  const v = videos.find((x) => x.id === c.req.param("id"));
  if (v) v.views++;
  return c.json({ ok: true });
});
app.get("/api/bookings", (c) => c.json({ bookings }));
app.post("/api/bookings", async (c) => {
  const body = await c.req.json();
  const shop = shops.find((s) => s.id === body.shopId);
  bookings.unshift({
    id: "b" + Date.now(),
    shopName: shop?.name || "",
    status: "new",
    commissionRate: shop?.commission || 10,
    createdAt: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    ...body
  });
  return c.json({ ok: true });
});
app.put("/api/bookings/:id/status", async (c) => {
  const b = bookings.find((x) => x.id === c.req.param("id"));
  if (!b) return c.json({ error: "Not found" }, 404);
  const { status } = await c.req.json();
  b.status = status;
  return c.json({ ok: true });
});
app.get("/api/stats", (c) => {
  const totalViews = videos.reduce((a, v) => a + v.views, 0);
  const totalBookings = bookings.length;
  const newBookings = bookings.filter((b) => b.status === "new").length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed" || b.status === "completed").length;
  const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 3).map((v) => ({
    ...v,
    shop: shops.find((s) => s.id === v.shopId)
  }));
  return c.json({ totalViews, totalBookings, newBookings, confirmedBookings, totalShops: shops.length, topVideos });
});
app.get("/api/platform", (c) => c.json(PLATFORM));
app.get("/shop/:slug", (c) => {
  const shop = shops.find((s) => s.slug === c.req.param("slug"));
  if (!shop) return c.notFound();
  const shopVideos = videos.filter((v) => v.shopId === shop.id);
  const waMsg = encodeURIComponent(`Hi! I found ${shop.name} on Seoul Beauty Trip and I'd like to book a service. Shop: ${shop.name} (${shop.location})`);
  const waUrl = `https://wa.me/${PLATFORM.whatsapp}?text=${waMsg}`;
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${shop.name} | ${shop.location} ${shop.category} | Seoul Beauty Trip</title>
<meta name="description" content="${shop.description} Located in ${shop.location}. Services: ${shop.services.join(", ")}. Price: ${shop.priceRange}">
<meta name="keywords" content="${shop.location} ${shop.category}, ${shop.location} beauty, Seoul ${shop.category}, ${shop.services.join(", ")}">
<meta property="og:title" content="${shop.name} | Seoul Beauty Trip">
<meta property="og:description" content="${shop.description}">
<meta property="og:image" content="${shop.thumbnail}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30}
body{background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
.nav{background:var(--bg2);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,77,141,.15)}
.nav-logo{font-size:15px;font-weight:900;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.nav-back{color:#aaa;text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px}
.hero{position:relative;height:280px;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover}
.hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.85) 100%)}
.hero-info{position:absolute;bottom:0;left:0;right:0;padding:20px}
.cat-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border-radius:18px;background:linear-gradient(135deg,var(--pk),var(--pu));font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:8px}
.hero-title{font-size:22px;font-weight:900;margin-bottom:4px}
.hero-loc{font-size:13px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:4px}
.rating{display:flex;align-items:center;gap:4px;margin-top:5px}
.stars{color:#FFD700;font-size:13px}
.rating-num{font-size:13px;color:rgba(255,255,255,.7)}
.wrap{max-width:600px;margin:0 auto;padding:20px}
.action-btns{display:flex;gap:10px;margin-bottom:24px}
.wa-btn{flex:1;padding:14px;background:linear-gradient(135deg,#25D366,#128C7E);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.map-btn{flex:1;padding:14px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.card{background:var(--cd);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px;margin-bottom:16px}
.card-title{font-size:13px;font-weight:800;color:var(--pk);margin-bottom:12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.5px}
.info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:rgba(255,255,255,.75)}
.info-row i{color:var(--pk);width:16px;flex-shrink:0;margin-top:2px}
.services{display:flex;flex-wrap:wrap;gap:7px}
.svc-tag{padding:5px 12px;background:rgba(255,77,141,.1);border:1px solid rgba(255,77,141,.25);border-radius:20px;font-size:12px;color:var(--pl);font-weight:600}
.map-embed{border-radius:12px;overflow:hidden;height:180px;margin-bottom:16px}
.map-embed iframe{width:100%;height:100%;border:0}
.vid-title{font-size:15px;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vid-card{border-radius:12px;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16}
.vid-card img{width:100%;height:100%;object-fit:cover}
.vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.8) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:10px}
.vid-card-title{font-size:11px;font-weight:700;line-height:1.3}
.vid-views{font-size:10px;color:rgba(255,255,255,.6);margin-top:2px}
.book-float{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100}
.book-float a{display:flex;align-items:center;gap:8px;padding:14px 32px;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:30px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 24px rgba(37,211,102,.45);white-space:nowrap}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">&#128132; SEOUL BEAUTY TRIP</a>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> Back</a>
</nav>

<div class="hero">
  <img src="${shop.thumbnail}" alt="${shop.name}">
  <div class="hero-ov"></div>
  <div class="hero-info">
    <div class="cat-badge">${shop.category}</div>
    <div class="hero-title">${shop.name}</div>
    <div class="hero-loc"><i class="fas fa-map-marker-alt" style="color:#FF4D8D"></i>${shop.location}</div>
    <div class="rating">
      <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
      <span class="rating-num">${shop.rating} (${shop.reviewCount} reviews)</span>
    </div>
  </div>
</div>

<div class="wrap">
  <div class="action-btns" style="margin-top:20px">
    <a href="${waUrl}" target="_blank" class="wa-btn">
      <i class="fab fa-whatsapp" style="font-size:18px"></i> WhatsApp Book
    </a>
    <a href="${shop.googleMapUrl}" target="_blank" class="map-btn">
      <i class="fas fa-map-marker-alt"></i> Google Map
    </a>
  </div>

  <div class="card">
    <div class="card-title"><i class="fas fa-info-circle"></i> Shop Info</div>
    <div class="info-row"><i class="fas fa-clock"></i><span>${shop.hours}</span></div>
    <div class="info-row"><i class="fas fa-won-sign"></i><span>${shop.priceRange}</span></div>
    <div class="info-row"><i class="fas fa-map-marker-alt"></i><span>${shop.address}</span></div>
    <div class="info-row"><i class="fas fa-info"></i><span>${shop.description}</span></div>
  </div>

  <div class="card">
    <div class="card-title"><i class="fas fa-list"></i> Services</div>
    <div class="services">
      ${shop.services.map((s) => `<span class="svc-tag">${s}</span>`).join("")}
    </div>
  </div>

  <div class="map-embed">
    <iframe src="${shop.googleMapEmbed}" allowfullscreen loading="lazy"></iframe>
  </div>

  ${shopVideos.length > 0 ? `
  <div class="vid-title"><i class="fas fa-play-circle" style="color:#FF4D8D"></i> Videos</div>
  <div class="vid-grid">
    ${shopVideos.map((v) => `
    <div class="vid-card" onclick="window.location='/'">
      <img src="${v.thumbnail}" alt="${v.title}">
      <div class="vid-card-ov">
        <div class="vid-card-title">${v.title}</div>
        <div class="vid-views"><i class="fas fa-eye"></i> ${(v.views / 1e3).toFixed(1)}K</div>
      </div>
    </div>`).join("")}
  </div>` : ""}

  <div style="height:80px"></div>
</div>

<div class="book-float">
  <a href="${waUrl}" target="_blank">
    <i class="fab fa-whatsapp" style="font-size:20px"></i> Book via WhatsApp
  </a>
</div>
</body>
</html>`);
});
app.get("/", (c) => c.html(MAIN_HTML));
app.get("/admin", (c) => c.html(ADMIN_HTML));
var src_default = app;
var MAIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Seoul Beauty Trip - Discover Korean Beauty</title>
<meta name="description" content="Book Korean beauty experiences in Seoul. Skincare, makeup, hair, nail and derma clinics. Foreign-friendly with WhatsApp booking.">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30}
html,body{height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif}
#ld{position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .5s}
#ld .sub{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.3);text-transform:uppercase}
#ld .brand{font-size:40px;font-weight:900;letter-spacing:3px;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
#ld .sub2{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-top:-4px}
#ld .bar{width:140px;height:2px;background:rgba(255,255,255,.1);border-radius:2px;margin-top:16px;overflow:hidden}
#ld .prog{height:100%;background:linear-gradient(90deg,var(--pk),var(--pu));animation:lp 1.8s ease forwards}
@keyframes lp{from{width:0}to{width:100%}}
#hd{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 16px 12px;background:linear-gradient(to bottom,rgba(13,13,24,.97) 55%,transparent)}
.logo{display:flex;align-items:center;gap:9px;margin-bottom:11px}
.logo-ic{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--pk),var(--pu));display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.logo-nm{font-size:16px;font-weight:900;letter-spacing:1px;background:linear-gradient(135deg,#fff,var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tg{font-size:8px;color:rgba(255,255,255,.32);letter-spacing:3px;text-transform:uppercase;-webkit-text-fill-color:rgba(255,255,255,.32)}
.cats{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat{flex-shrink:0;padding:6px 13px;border-radius:20px;border:1.5px solid rgba(255,77,141,.28);background:rgba(255,77,141,.05);color:rgba(255,255,255,.5);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.cat.on,.cat:hover{background:linear-gradient(135deg,var(--pk),var(--pu));border-color:transparent;color:#fff}
#feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none}
#feed::-webkit-scrollbar{display:none}
.slide{height:100vh;width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#000}
.bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
.ov{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 22%,transparent 48%,rgba(0,0,0,.32) 68%,rgba(0,0,0,.88) 100%)}
.acts{position:absolute;right:12px;bottom:150px;z-index:3;display:flex;flex-direction:column;gap:16px;align-items:center}
.act{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
.act-ic{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:19px;color:#fff;transition:all .18s}
.act-ic:active{transform:scale(.9)}
.act-lb{font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}
.info{position:absolute;bottom:0;left:0;right:64px;padding:14px 16px 24px;z-index:3}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border-radius:18px;background:linear-gradient(135deg,var(--pk),var(--pu));font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
.vt{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,.7)}
.vl{display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,.7);margin-bottom:5px}
.vd{font-size:12px;color:rgba(255,255,255,.62);line-height:1.55;margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vtags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.vtag{font-size:11px;color:var(--pl);font-weight:700}
.btns-row{display:flex;gap:8px;align-items:center}
.wa-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:24px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 14px rgba(37,211,102,.35);letter-spacing:.2px}
.shop-info-mini{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:11.5px;color:rgba(255,255,255,.6)}
.hint{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:1px;opacity:.45;animation:hb 2.2s infinite}
.hint span{font-size:9px;color:#fff;letter-spacing:1.5px}
@keyframes hb{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
#dots{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:200;display:flex;flex-direction:column;gap:5px}
.dot{width:3px;height:3px;border-radius:2px;background:rgba(255,255,255,.2);transition:all .3s}
.dot.on{background:var(--pk);height:18px}
#muteBtn{position:fixed;top:50%;right:12px;transform:translateY(-50%);z-index:200;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px)}
/* \uC5C5\uCCB4 \uBAA8\uB2EC */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px)}
.modal-bg.open{display:flex}
.modal{background:var(--bg2);border-radius:24px 24px 0 0;padding:0 0 40px;width:100%;max-width:520px;border:1px solid rgba(255,77,141,.2);border-bottom:none;animation:su .3s cubic-bezier(.32,1,.32,1);position:relative;height:80vh;display:flex;flex-direction:column;touch-action:pan-y}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
/* \uBAA8\uB2EC \uD578\uB4E4 \uC601\uC5ED */
.modal-handle-area{flex-shrink:0;padding:12px 20px 0;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:10px}
.mhdl{width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:3px;transition:background .2s}
.mhdl:hover{background:rgba(255,255,255,.4)}
.modal-top-row{display:flex;align-items:center;justify-content:space-between;width:100%}
.modal-top-title{font-size:12px;color:rgba(255,255,255,.35);font-weight:700;letter-spacing:1px;text-transform:uppercase}
.mcls{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.mcls:hover{background:rgba(255,77,141,.2);color:#fff}
/* \uBAA8\uB2EC \uC2A4\uD06C\uB864 \uC601\uC5ED */
.modal-scroll{flex:1;overflow-y:auto;padding:16px 20px 0;scrollbar-width:thin;scrollbar-color:rgba(255,77,141,.3) transparent}
.modal-scroll::-webkit-scrollbar{width:3px}
.modal-scroll::-webkit-scrollbar-track{background:transparent}
.modal-scroll::-webkit-scrollbar-thumb{background:rgba(255,77,141,.3);border-radius:3px}
/* \uC20D \uD5E4\uB354 */
.shop-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}
.shop-thumb{width:72px;height:72px;border-radius:14px;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,77,141,.2)}
.shop-nm{font-size:17px;font-weight:900;margin-bottom:3px;line-height:1.3}
.shop-loc{font-size:12px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:4px;margin-bottom:5px}
.shop-rating{display:flex;align-items:center;gap:5px;font-size:12px}
.shop-stars{color:#FFD700;font-size:13px}
/* \uC139\uC158 */
.m-section{margin-bottom:16px}
.m-section-title{font-size:10px;font-weight:800;color:var(--pk);letter-spacing:1px;text-transform:uppercase;margin-bottom:9px;display:flex;align-items:center;gap:5px;padding-bottom:6px;border-bottom:1px solid rgba(255,77,141,.1)}
.m-info-row{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:rgba(255,255,255,.72);margin-bottom:8px}
.m-info-row i{color:var(--pk);width:14px;flex-shrink:0;margin-top:2px}
/* \uAC00\uACA9 \uB9AC\uC2A4\uD2B8 */
.m-price-list{display:flex;flex-direction:column;gap:0}
.m-price-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.m-price-item:last-child{border-bottom:none}
.m-price-name{font-size:13px;color:rgba(255,255,255,.8);font-weight:500}
.m-price-val{font-size:13px;color:var(--pl);font-weight:800}
/* \uAD6C\uAE00\uB9F5 \uC784\uBCA0\uB4DC */
.m-map{border-radius:14px;overflow:hidden;height:180px;margin-bottom:16px;border:1px solid rgba(255,255,255,.07);position:relative}
.m-map iframe{width:100%;height:100%;border:0;display:block}
.m-map-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(20,20,40,.9);flex-direction:column;gap:8px;font-size:12px;color:rgba(255,255,255,.5)}
/* \uBC84\uD2BC */
.m-btns{display:flex;flex-direction:column;gap:9px;padding:16px 20px 0}
.m-wa{display:flex;align-items:center;justify-content:center;gap:9px;padding:15px;background:linear-gradient(135deg,#25D366,#128C7E);border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,.3);transition:opacity .2s}
.m-wa:active{opacity:.85}
.m-detail{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:rgba(255,255,255,.65);font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}
.m-detail:hover{background:rgba(255,255,255,.09);color:#fff}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(255,77,141,.9);color:#fff;padding:8px 18px;border-radius:18px;font-size:12px;font-weight:700;z-index:600;opacity:0;transition:all .28s;white-space:nowrap;pointer-events:none}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
/* adm \uB9C1\uD06C \uC81C\uAC70\uB428 */
</style>
</head>
<body>
<div id="ld">
  <div class="sub">Discover</div>
  <div style="font-size:36px;margin-bottom:-4px">&#10024;</div>
  <div class="brand">SEOUL</div>
  <div class="sub2">BEAUTY TRIP</div>
  <div class="bar"><div class="prog"></div></div>
</div>

<header id="hd">
  <div class="logo" id="logoBtn" style="cursor:pointer;user-select:none">
    <div class="logo-ic">&#10024;</div>
    <div>
      <div class="logo-nm">SEOUL BEAUTY TRIP</div>
      <div class="logo-tg">Korean Beauty Experience</div>
    </div>
  </div>
  <div class="cats" id="cats">
    <button class="cat on" data-cat="all">&#10024; All</button>
    <button class="cat" data-cat="skincare">&#127807; Skincare</button>
    <button class="cat" data-cat="makeup">&#128139; Makeup</button>
    <button class="cat" data-cat="hair">&#128135; Hair</button>
    <button class="cat" data-cat="nail">&#128133; Nail</button>
    <button class="cat" data-cat="clinic">&#127973; Clinic</button>
  </div>
</header>

<div id="dots"></div>
<button id="muteBtn" onclick="toggleMute()"><i class="fas fa-volume-mute"></i></button>
<div id="feed"></div>
<div id="toast"></div>

<!-- \uAD00\uB9AC\uC790 \uBE44\uBC00\uBC88\uD638 \uBAA8\uB2EC -->
<div id="adminModal" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(10px);align-items:center;justify-content:center">
  <div style="background:#13132a;border:1px solid rgba(255,77,141,.25);border-radius:20px;padding:28px 24px;width:280px;max-width:90vw;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">&#128274;</div>
    <div style="font-size:15px;font-weight:800;margin-bottom:4px;background:linear-gradient(135deg,#FF4D8D,#FF85B3);-webkit-background-clip:text;-webkit-text-fill-color:transparent">\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778</div>
    <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:18px">\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694</div>
    <form onsubmit="checkAdminPw();return false;" autocomplete="off">
      <input type="text" name="username" style="display:none" autocomplete="username">
      <input id="adminPwInput" type="password" placeholder="\uBE44\uBC00\uBC88\uD638" autocomplete="current-password" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,77,141,.25);border-radius:11px;color:#fff;font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:12px">
      <div style="display:flex;gap:8px">
        <button type="submit" style="flex:1;padding:11px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer">\uD655\uC778</button>
        <button type="button" onclick="closeAdminModal()" style="flex:1;padding:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer">\uCDE8\uC18C</button>
      </div>
    </form>
    <div id="adminPwErr" style="font-size:11px;color:#ef4444;margin-top:10px;display:none">\u274C \uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4</div>
  </div>
</div>

<!-- \uC5C5\uCCB4 \uC815\uBCF4 \uBAA8\uB2EC -->
<div class="modal-bg" id="shopModal">
  <div class="modal" id="modalPanel">
    <div class="modal-handle-area" id="modalHandle">
      <div class="mhdl"></div>
      <div class="modal-top-row">
        <span class="modal-top-title">Shop Info</span>
        <button class="mcls" onclick="closeModal()">&#10005;</button>
      </div>
    </div>
    <div class="modal-scroll" id="modalContent"></div>
    <div class="m-btns" id="modalBtns"></div>
  </div>
</div>

<script>
var vids = [], isMuted = true, liked = {}, platform = {};
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',nail:'&#128133;',clinic:'&#127973;'};

fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; });

function loadVideos(cat) {
  fetch('/api/videos?category='+(cat||'all')).then(function(r){return r.json();}).then(function(d){
    vids = d.videos || [];
    renderFeed();
  });
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderFeed() {
  var feed = document.getElementById('feed');
  var dots = document.getElementById('dots');
  feed.innerHTML = ''; dots.innerHTML = '';
  for(var i=0;i<vids.length;i++){
    var dot=document.createElement('div');
    dot.className='dot'+(i===0?' on':''); dot.id='dot'+i;
    dots.appendChild(dot);
  }
  for(var i=0;i<vids.length;i++){ buildSlide(vids[i],i); }
  setupObs();
}

function buildSlide(v, idx) {
  var feed = document.getElementById('feed');
  var shop = v.shop || {};
  var s = document.createElement('div');
  s.className='slide'; s.id='sl'+idx;
  var tags = (v.tags||[]).map(function(t){return '<span class="vtag">'+esc(t)+'</span>';}).join('');

  s.innerHTML =
    '<img class="bg-img" src="'+esc(v.thumbnail)+'" alt="'+esc(v.title)+'">' +
    '<video id="vid'+idx+'" src="'+esc(v.videoUrl)+'" loop muted playsinline preload="metadata" poster="'+esc(v.thumbnail)+'"></video>' +
    '<div class="ov"></div>' +
    '<div class="acts">' +
      '<div class="act" id="alke'+idx+'"><div class="act-ic" id="lkic'+esc(v.id)+'"><i class="fas fa-heart"></i></div><span class="act-lb" id="lklb'+esc(v.id)+'">Like</span></div>' +
      '<div class="act" id="ashop'+idx+'"><div class="act-ic"><i class="fas fa-store"></i></div><span class="act-lb">Shop</span></div>' +
      '<div class="act" id="ashare'+idx+'"><div class="act-ic"><i class="fas fa-share"></i></div><span class="act-lb">Share</span></div>' +
    '</div>' +
    '<div class="info">' +
      '<div class="badge">'+(catIcons[shop.category]||'&#10024;')+' '+esc(shop.category||'')+'</div>' +
      '<div class="vt">'+esc(v.title)+'</div>' +
      '<div class="shop-info-mini"><i class="fas fa-store" style="color:#FF4D8D"></i>'+esc(shop.name||'')+' &nbsp;|&nbsp; <i class="fas fa-map-marker-alt" style="color:#FF4D8D"></i>'+esc(shop.location||'')+'</div>' +
      '<div class="vd">'+esc(v.description)+'</div>' +
      '<div class="vtags">'+tags+'</div>' +
      '<div class="btns-row">' +
        '<div class="wa-btn" id="wabtn'+idx+'"><i class="fab fa-whatsapp" style="font-size:15px"></i> Book & Shop Info</div>' +
      '</div>' +
    '</div>' +
    '<div class="hint"><i class="fas fa-chevron-up" style="font-size:11px"></i><span>SWIPE UP</span></div>';

  feed.appendChild(s);

  (function(vid, vidIdx, shop) {
    var ve = document.getElementById('vid'+vidIdx);
    if(ve) ve.onerror = function(){ ve.style.display='none'; };
    document.getElementById('alke'+vidIdx).onclick = function(){ doLike(vid.id); };
    document.getElementById('ashop'+vidIdx).onclick = function(){ openShopModal(shop); };
    document.getElementById('ashare'+vidIdx).onclick = function(){ doShare(vid.title); };
    document.getElementById('wabtn'+vidIdx).onclick = function(){ openShopModal(shop); };
    // \uC870\uD68C\uC218 \uAE30\uB85D
    fetch('/api/videos/'+vid.id+'/view', {method:'POST'}).catch(function(){});
  })(v, idx, shop);
}

function setupObs(){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var idx=parseInt(e.target.id.replace('sl',''));
      var vid=document.getElementById('vid'+idx);
      document.querySelectorAll('.dot').forEach(function(d,i){d.classList.toggle('on',i===idx);});
      if(e.isIntersecting){ if(vid){vid.muted=isMuted;vid.play().catch(function(){});} }
      else { if(vid){vid.pause();vid.currentTime=0;} }
    });
  },{threshold:0.65});
  document.querySelectorAll('.slide').forEach(function(s){obs.observe(s);});
}

function openWhatsApp(shop, videoTitle) {
  var waNum = platform.whatsapp || '821012345678';
  var msg = 'Hi! I found ' + (shop.name||'your shop') + ' on Seoul Beauty Trip and I would like to book a service.';
  if(shop.location) msg += ' Location: ' + shop.location + '.';
  if(shop.priceRange) msg += ' Price range: ' + shop.priceRange + '.';
  var url = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(msg);
  window.open(url, '_blank');
}

function openShopModal(shop) {
  if(!shop || !shop.id) return;
  var waNum = platform.whatsapp || '821012345678';
  var waMsg = 'Hi! I found ' + (shop.name||'your shop') + ' on Seoul Beauty Trip and I would like to book a service. Shop: ' + (shop.name||'') + ' (' + (shop.location||'') + ')';
  var waUrl = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(waMsg);
  var mapUrl = shop.googleMapUrl || ('https://maps.google.com/?q='+encodeURIComponent((shop.name||'')+(shop.address?' '+shop.address:'')));

  /* \uAD6C\uAE00\uB9F5 \uC784\uBCA0\uB4DC */
  var embedSrc = shop.googleMapEmbed || '';
  var mapHtml = embedSrc
    ? '<div class="m-section"><div class="m-section-title"><i class="fas fa-map"></i> Location</div><div class="m-map"><iframe src="'+embedSrc+'" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>'
    : '';

  /* \uAC00\uACA9 \uB9AC\uC2A4\uD2B8 */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    var rows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+p.name+'</span><span class="m-price-val">'+p.price+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-section"><div class="m-section-title"><i class="fas fa-tag"></i> Price List</div><div class="m-price-list">'+rows+'</div></div>';
  } else if(shop.priceRange) {
    priceHtml = '<div class="m-section"><div class="m-section-title"><i class="fas fa-tag"></i> Price</div><div class="m-info-row"><i class="fas fa-won-sign"></i><span>'+shop.priceRange+'</span></div></div>';
  }

  /* \uBAA8\uB2EC \uCF58\uD150\uCE20 */
  var thumbHtml = shop.thumbnail
    ? '<img class="shop-thumb" id="mThumb" src="'+esc(shop.thumbnail)+'">'
    : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="shop-header">' +
      thumbHtml +
      '<div style="flex:1;min-width:0">' +
        '<div class="shop-nm">'+esc(shop.name||'')+'</div>' +
        '<div class="shop-loc"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;font-size:11px"></i><span style="margin-left:2px">'+esc(shop.location||'')+'</span></div>' +
        '<div class="shop-rating"><span class="shop-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><span style="color:rgba(255,255,255,.45);font-size:11px;margin-left:4px">'+(shop.rating||5.0)+' ('+(shop.reviewCount||0)+' reviews)</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="m-section">' +
      '<div class="m-section-title"><i class="fas fa-store"></i> Basic Info</div>' +
      '<div class="m-info-row"><i class="fas fa-clock"></i><span>'+(shop.hours||'Please contact us')+'</span></div>' +
      '<div class="m-info-row"><i class="fas fa-map-marker-alt"></i><span>'+(shop.address||shop.location||'')+'</span></div>' +
    '</div>' +

    priceHtml +
    mapHtml;

  /* \uD558\uB2E8 \uBC84\uD2BC - WhatsApp \uC608\uC57D\uB9CC */
  document.getElementById('modalBtns').innerHTML =
    '<a href="'+waUrl+'" target="_blank" class="m-wa"><i class="fab fa-whatsapp" style="font-size:19px"></i> Book via WhatsApp</a>';

  document.getElementById('shopModal').classList.add('open');
  /* \uC5F4\uB9B4 \uB54C \uC2A4\uD06C\uB864 \uCD5C\uC0C1\uB2E8\uC73C\uB85C */
  document.getElementById('modalContent').scrollTop = 0;
  /* \uC378\uB124\uC77C \uC5D0\uB7EC \uCC98\uB9AC */
  var mThumb = document.getElementById('mThumb');
  if(mThumb) mThumb.onerror = function(){ this.style.display='none'; };
}

function closeModal(){
  var bg = document.getElementById('shopModal');
  var panel = document.getElementById('modalPanel');
  panel.style.transition='transform .28s cubic-bezier(.32,1,.32,1)';
  panel.style.transform='translateY(100%)';
  setTimeout(function(){
    bg.classList.remove('open');
    panel.style.transition='';
    panel.style.transform='';
  }, 280);
}

/* \uBC30\uACBD \uD074\uB9AD\uC73C\uB85C \uB2EB\uAE30 */
document.getElementById('shopModal').addEventListener('click', function(e){
  if(e.target === this) closeModal();
});

/* \uC2A4\uC640\uC774\uD504 \uB2E4\uC6B4\uC73C\uB85C \uB2EB\uAE30 */
(function(){
  var panel = document.getElementById('modalPanel');
  var handle = document.getElementById('modalHandle');
  var startY = 0, startScrollTop = 0, dragging = false, isDragFromHandle = false;

  function onStart(e) {
    var touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    startScrollTop = document.getElementById('modalContent').scrollTop;
    dragging = true;
    isDragFromHandle = e.currentTarget === handle;
    panel.style.transition = 'none';
  }
  function onMove(e) {
    if(!dragging) return;
    var touch = e.touches ? e.touches[0] : e;
    var dy = touch.clientY - startY;
    /* \uD578\uB4E4\uC5D0\uC11C \uB4DC\uB798\uADF8\uD558\uAC70\uB098, \uCF58\uD150\uCE20 \uCD5C\uC0C1\uB2E8\uC5D0\uC11C \uC544\uB798\uB85C \uB2F9\uAE38 \uB54C\uB9CC */
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
  /* \uB9C8\uC6B0\uC2A4 \uB4DC\uB798\uADF8 (\uB370\uC2A4\uD06C\uD1B1) */
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

function doLike(id){
  liked[id]=!liked[id];
  var ic=document.getElementById('lkic'+id);
  var lb=document.getElementById('lklb'+id);
  if(ic){ic.style.color=liked[id]?'#FF4D8D':'#fff';ic.style.background=liked[id]?'rgba(255,77,141,.4)':'rgba(255,255,255,.12)';}
  if(lb){lb.textContent=liked[id]?'Liked!':'Like';}
  showToast(liked[id]?'&#10084;&#65039; Added to favorites!':'Removed');
}
function doShare(title){
  if(navigator.share){navigator.share({title:title,url:location.href});}
  else{navigator.clipboard.writeText(location.href);showToast('&#128279; Link copied!');}
}
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
window.addEventListener('load', function(){
  /* \uCE74\uD14C\uACE0\uB9AC \uD544\uD130 */
  document.querySelectorAll('.cat').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.cat').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      loadVideos(b.getAttribute('data-cat'));
      document.getElementById('feed').scrollTo({top:0});
    });
  });

  /* \u2500\u2500 \uB85C\uACE0 3\uBC88 \uD074\uB9AD \u2192 \uAD00\uB9AC\uC790 \uBE44\uBC00\uBC88\uD638 \uBAA8\uB2EC \u2500\u2500 */
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
      setTimeout(function(){ inp.style.borderColor = 'rgba(255,77,141,.25)'; }, 1200);
    }
  };
  document.getElementById('adminModal').addEventListener('click', function(e){
    if(e.target === this) window.closeAdminModal();
  });

  /* \uB85C\uB529 \uC2A4\uD06C\uB9B0 */
  setTimeout(function(){
    var ld = document.getElementById('ld');
    ld.style.opacity = '0';
    setTimeout(function(){ ld.style.display = 'none'; }, 500);
  }, 1800);

  loadVideos('all');
});
</script>
</body>
</html>`;
var ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Trip - Admin</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
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
@media(max-width:540px){.stats-grid{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-logo">&#10024; Seoul Beauty Trip \u2014 \uAD00\uB9AC\uC790</div>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> \uC0AC\uC774\uD2B8\uB85C</a>
</nav>

<div class="tabs">
  <div class="tab on" data-tab="dashboard"><i class="fas fa-chart-bar"></i> \uB300\uC2DC\uBCF4\uB4DC</div>
  <div class="tab" data-tab="bookings"><i class="fas fa-calendar-check"></i> \uC608\uC57D\uAD00\uB9AC</div>
  <div class="tab" data-tab="shops"><i class="fas fa-store"></i> \uC5C5\uCCB4 \xB7 \uC601\uC0C1</div>
  <div class="tab" data-tab="settings"><i class="fas fa-cog"></i> \uC124\uC815</div>
</div>

<!-- \uB300\uC2DC\uBCF4\uB4DC -->
<div class="tab-content on" id="tab-dashboard">
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card"><div class="stat-icon">&#128065;</div><div class="stat-val" id="st-views">-</div><div class="stat-lbl">\uCD1D \uC870\uD68C\uC218</div></div>
    <div class="stat-card"><div class="stat-icon">&#128197;</div><div class="stat-val" id="st-bookings">-</div><div class="stat-lbl">\uCD1D \uC608\uC57D\uC218</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#3b82f6">&#128276;</div><div class="stat-val" id="st-new" style="color:#60a5fa">-</div><div class="stat-lbl">\uC2E0\uADDC \uC608\uC57D</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#10b981">&#127968;</div><div class="stat-val" id="st-shops" style="color:#10b981">-</div><div class="stat-lbl">\uB4F1\uB85D \uC5C5\uCCB4</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fas fa-fire" style="color:#FF4D8D"></i> \uC778\uAE30 \uC601\uC0C1 TOP 3</div></div>
    <div id="topVids"></div>
  </div>
</div>

<!-- \uC608\uC57D\uAD00\uB9AC -->
<div class="tab-content" id="tab-bookings">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-calendar-check" style="color:#FF4D8D"></i> \uC608\uC57D \uC694\uCCAD \uBAA9\uB85D</div>
    </div>
    <div id="bookingList" style="overflow-x:auto">
      <table class="tbl">
        <thead><tr>
          <th>\uB0A0\uC9DC</th><th>\uACE0\uAC1D\uBA85</th><th>\uC5C5\uCCB4</th><th>\uC11C\uBE44\uC2A4</th><th>\uC778\uC6D0</th><th>\uC218\uC218\uB8CC</th><th>\uC0C1\uD0DC</th><th>\uCC98\uB9AC</th>
        </tr></thead>
        <tbody id="bookingTbody"></tbody>
      </table>
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
    <!-- \uAD6C\uAE00\uB9F5 \uBD99\uC5EC\uB123\uAE30 \u2192 \uC790\uB3D9\uC644\uC131 -->
    <div style="background:rgba(66,133,244,.08);border:1px solid rgba(66,133,244,.3);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:10px">
        <i class="fas fa-map-marker-alt"></i> \uAD6C\uAE00\uB9F5 \uB9C1\uD06C \uBD99\uC5EC\uB123\uAE30 <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,.4)">\u2192 \uC5C5\uCCB4\uBA85\xB7\uC8FC\uC18C\xB7\uC9C0\uC5ED \uC790\uB3D9\uC785\uB825</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="sh-gmap-raw" placeholder="https://maps.app.goo.gl/... \uB9C1\uD06C\uB97C \uC5EC\uAE30\uC5D0 \uBD99\uC5EC\uB123\uC73C\uC138\uC694" style="flex:1;font-size:14px;margin-bottom:0">
        <button type="button" id="sh-gmap-btn" style="padding:0 18px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0">\uC790\uB3D9\uC785\uB825</button>
      </div>
      <div id="sh-gmap-status" style="font-size:12px;color:rgba(255,255,255,.4);min-height:18px"></div>
    </div>

    <div class="form-grid">
      <div class="full">
        <label>\uC5C5\uCCB4\uBA85 *</label>
        <input id="sh-name" placeholder="\uAD6C\uAE00\uB9F5 \uBD99\uC5EC\uB123\uC73C\uBA74 \uC790\uB3D9\uC785\uB825">
      </div>
      <div>
        <label>\uCE74\uD14C\uACE0\uB9AC *</label>
        <select id="sh-cat">
          <option value="skincare">\uC2A4\uD0A8\uCF00\uC5B4</option>
          <option value="makeup">\uBA54\uC774\uD06C\uC5C5</option>
          <option value="hair">\uD5E4\uC5B4</option>
          <option value="nail">\uB124\uC77C</option>
          <option value="clinic">\uD074\uB9AC\uB2C9</option>
          <option value="spa">\uC2A4\uD30C\xB7\uB9C8\uC0AC\uC9C0</option>
        </select>
      </div>
      <div>
        <label>\uC9C0\uC5ED <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC790\uB3D9\uC785\uB825)</span></label>
        <input id="sh-loc" placeholder="\uAD6C\uAE00\uB9F5 \uBD99\uC5EC\uB123\uC73C\uBA74 \uC790\uB3D9\uC785\uB825" readonly style="background:rgba(255,255,255,.04);color:rgba(255,255,255,.7)">
      </div>
      <div class="full">
        <label>\uC8FC\uC18C <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC790\uB3D9\uC785\uB825)</span></label>
        <input id="sh-addr" placeholder="\uAD6C\uAE00\uB9F5 \uBD99\uC5EC\uB123\uC73C\uBA74 \uC790\uB3D9\uC785\uB825" readonly style="background:rgba(255,255,255,.04);color:rgba(255,255,255,.7)">
      </div>
      <div class="full">
        <label>\uC5C5\uCCB4 \uC18C\uAC1C <span style="font-size:11px;color:rgba(255,255,255,.4)">(\uC120\uD0DD)</span></label>
        <textarea id="sh-desc" placeholder="\uACE0\uAC1D\uC5D0\uAC8C \uBCF4\uC5EC\uC9C8 \uC18C\uAC1C \uBB38\uAD6C..."></textarea>
      </div>
    </div>

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

  <!-- \u2462 \uC601\uC0C1 \uCD94\uAC00 \uD328\uB110 (\uC5C5\uCCB4 \uD074\uB9AD \uC2DC \uC2AC\uB77C\uC774\uB4DC\uB2E4\uC6B4) -->
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

  <!-- \u2463 \uC601\uC0C1 \uBAA9\uB85D (\uC5C5\uCCB4\uBCC4) -->
  <div class="card">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-film" style="color:#FF4D8D"></i> \uB4F1\uB85D\uB41C \uC601\uC0C1 \uBAA9\uB85D</div>
    <div id="videoList"></div>
  </div>
</div>

<!-- \uC124\uC815 -->
<div class="tab-content" id="tab-settings">
  <div class="card">
    <div class="card-title" style="margin-bottom:16px"><i class="fas fa-cog" style="color:#FF4D8D"></i> \uD50C\uB7AB\uD3FC \uC124\uC815</div>
    <div style="margin-bottom:12px">
      <label>\uC653\uCE20\uC571 \uBC88\uD638 (\uAD6D\uAC00\uCF54\uB4DC \uD3EC\uD568, + \uC5C6\uC774)</label>
      <input id="cfg-wa" placeholder="821012345678" value="821012345678">
    </div>
    <div style="margin-bottom:12px">
      <label>\uC218\uC218\uB8CC \uBC94\uC704</label>
      <input id="cfg-comm" placeholder="10~20%" value="10~20%">
    </div>
    <button class="btn-pk" onclick="saveSettings()"><i class="fas fa-save"></i> \uC124\uC815 \uC800\uC7A5</button>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)">
      <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:8px">SEO \uD398\uC774\uC9C0 \u2014 \uC5C5\uCCB4\uBCC4 \uAD6C\uAE00 \uAC80\uC0C9 \uB178\uCD9C URL</div>
      <div id="seoLinks"></div>
    </div>
  </div>
</div>

<script>
var shops=[], videos=[], bookings=[];

// safe-img: data-fallback \uC18D\uC131\uC73C\uB85C onerror \uB300\uCCB4 (\uC2A4\uD06C\uB9BD\uD2B8 \uBB38\uC790\uC5F4 \uC774\uC2A4\uCF00\uC774\uD504 \uBB38\uC81C \uBC29\uC9C0)
document.addEventListener('error', function(e){
  var t = e.target;
  if(t && t.tagName === 'IMG' && t.classList.contains('safe-img')){
    var fb = t.getAttribute('data-fallback');
    if(fb) t.src = fb;
    else t.style.display = 'none';
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
  var delVideoBtn = e.target.closest('.del-video-btn');
  if(delVideoBtn){ delVideo(delVideoBtn.getAttribute('data-id')); return; }
  var addVideoBtn = e.target.closest('[data-add-video]');
  if(addVideoBtn){ openVideoPanel(addVideoBtn.getAttribute('data-add-video')); return; }
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
    document.getElementById('st-views').textContent = d.totalViews>=1000?(d.totalViews/1000).toFixed(1)+'K':d.totalViews;
    document.getElementById('st-bookings').textContent = d.totalBookings;
    document.getElementById('st-new').textContent = d.newBookings;
    document.getElementById('st-shops').textContent = d.totalShops;
    document.getElementById('topVids').innerHTML = (d.topVideos||[]).map(function(v,i){
      return '<div class="top-vid">'+
        '<div class="top-rank">#'+(i+1)+'</div>'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img">'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;margin-bottom:3px">'+v.title+'</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+v.views+' \uC870\uD68C &nbsp; '+v.likes+' \uC88B\uC544\uC694</div></div>'+
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
    el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">\uB4F1\uB85D\uB41C \uC5C5\uCCB4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
    return;
  }
  el.innerHTML = shops.map(function(s){
    var vcount = videos.filter(function(v){return v.shopId===s.id;}).length;
    var priceStr = s.priceRange || '';
    return '<div class="shop-row add-video-row" data-id="'+s.id+'" style="cursor:pointer" title="\uD074\uB9AD\uD558\uBA74 \uC601\uC0C1 \uCD94\uAC00">'+
      '<img src="'+(s.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/56x56/1c1c30/FF4D8D?text=S">'+
      '<div class="shop-meta" style="flex:1">'+
        '<h4>'+s.name+'</h4>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px">'+
          '<span class="bdg bdg-cat" style="margin-right:6px">'+s.category+'</span>'+
          (s.location ? s.location+' &nbsp;' : '')+
          (priceStr ? '&nbsp; '+priceStr : '')+
        '</div>'+
        '<div style="font-size:11px;color:#a78bfa;margin-top:4px">'+vcount+'\uAC1C \uC601\uC0C1</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;align-items:center">'+
        '<button class="btn-sm" style="background:linear-gradient(135deg,#FF4D8D,#9B59B6);color:#fff;white-space:nowrap" data-add-video="'+s.id+'">+ \uC601\uC0C1</button>'+
        '<button class="btn-sm btn-red del-shop-btn" data-id="'+s.id+'">\uC0AD\uC81C</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// \u2500\u2500 \uC601\uC0C1 \uBAA9\uB85D \uB80C\uB354 (\uC5C5\uCCB4\uBCC4 \uADF8\uB8F9) \u2500\u2500
function renderVideos(){
  var el = document.getElementById('videoList');
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
  var shop = shops.find(function(s){return s.id===shopId;});
  if(!shop) return;
  currentShopId = shopId;
  document.getElementById('vd-shop-name').textContent = shop.name;
  document.getElementById('videoAddPanel').style.display = 'block';
  document.getElementById('videoAddPanel').scrollIntoView({behavior:'smooth', block:'start'});
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

  // \uC228\uACA8\uC9C4 title \uC800\uC7A5\uC6A9 (\uD30C\uC77C\uBA85 \uC790\uB3D9 \uC0AC\uC6A9)
  var titleIn = document.createElement('input');
  titleIn.className = 'vid-form-title';
  titleIn.type = 'hidden';

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
  fileIn.accept = 'video/*';
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
    titleIn.value = file.name.split('.').slice(0,-1).join('.') || file.name;
    uploadStatus.style.color = '#fbbf24';
    uploadStatus.textContent = '\uC5C5\uB85C\uB4DC \uC911... (' + (file.size/1024/1024).toFixed(1) + 'MB)';
    uploadBtn.disabled = true;
    uploadBtn.textContent = '\uC5C5\uB85C\uB4DC \uC911...';
    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/upload', {method:'POST', body: fd})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.ok && data.url){
          urlIn.value = data.url;
          uploadStatus.style.color = '#4ade80';
          uploadStatus.textContent = '\u2705 \uC5C5\uB85C\uB4DC \uC644\uB8CC!';
          uploadBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          uploadBtn.textContent = '\uC644\uB8CC \u2713';
        } else {
          uploadStatus.style.color = '#f87171';
          uploadStatus.textContent = '\u274C \uC2E4\uD328: ' + (data.error || '\uC624\uB958');
          uploadBtn.disabled = false;
          uploadBtn.textContent = '\uC601\uC0C1 \uD30C\uC77C \uC120\uD0DD';
        }
      })
      .catch(function(){
        uploadStatus.style.color = '#f87171';
        uploadStatus.textContent = '\u274C \uC5C5\uB85C\uB4DC \uC2E4\uD328';
        uploadBtn.disabled = false;
        uploadBtn.textContent = '\uC601\uC0C1 \uD30C\uC77C \uC120\uD0DD';
      });
  });

  uploadWrap.appendChild(fileIn);
  uploadWrap.appendChild(uploadBtn);
  uploadWrap.appendChild(uploadStatus);
  uploadWrap.appendChild(delBtn);

  row.appendChild(urlIn);
  row.appendChild(titleIn);
  row.appendChild(descIn);
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

// \u2500\u2500 \uAD6C\uAE00\uB9F5 URL \uD30C\uC2F1 \u2192 \uC790\uB3D9\uC785\uB825 \u2500\u2500
function parseGmapUrl(raw){
  var status = document.getElementById('sh-gmap-status');
  var url = raw.trim();
  if(!url){ status.textContent=''; return; }

  document.getElementById('sh-gmap-raw').setAttribute('data-gmap-url', url);

  // \uB2E8\uCD95 URL (maps.app.goo.gl, goo.gl) \u2192 \uC11C\uBC84 \uACBD\uC720 \uC5B8\uD329
  if(url.indexOf('goo.gl')!==-1 || url.indexOf('maps.app')!==-1){
    status.style.color='#fbbf24';
    status.textContent='\u{1F504} \uB9C1\uD06C \uBD84\uC11D \uC911...';
    fetch('/api/resolve-gmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.name) document.getElementById('sh-name').value = d.name;
        if(d.address) document.getElementById('sh-addr').value = d.address;
        if(d.location) document.getElementById('sh-loc').value = d.location;
        if(d.address||d.name){
          status.style.color='#4ade80';
          status.textContent='\u2705 \uC790\uB3D9\uC785\uB825 \uC644\uB8CC! \uB0B4\uC6A9\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.';
        } else {
          status.style.color='#fbbf24';
          status.textContent='\u26A0 \uC77C\uBD80 \uC815\uBCF4\uB97C \uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.';
        }
      })
      .catch(function(){
        status.style.color='#f87171';
        status.textContent='\u274C \uBD84\uC11D \uC2E4\uD328. \uC544\uB798 \uC815\uBCF4\uB97C \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.';
      });
    return;
  }

  // /place/ \uD615\uC2DD: maps.google.com/maps/place/\uC5C5\uCCB4\uBA85+\uC8FC\uC18C/
  var placeIdx = url.indexOf('/place/');
  if(placeIdx!==-1){
    var placePart = url.slice(placeIdx+7).split('/')[0];
    var decoded='';
    try{ decoded=decodeURIComponent(placePart.split('+').join(' ')); }catch(e){ decoded=placePart; }
    if(decoded){
      var pname = extractPlaceName(decoded);
      var area = detectArea(decoded);
      if(pname && !document.getElementById('sh-name').value) document.getElementById('sh-name').value = pname;
      document.getElementById('sh-addr').value = decoded;
      if(area) document.getElementById('sh-loc').value = area;
      status.style.color='#4ade80';
      status.textContent='\u2705 \uC790\uB3D9\uC785\uB825 \uC644\uB8CC! \uB0B4\uC6A9\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.';
      return;
    }
  }

  // ?q= \uD615\uC2DD
  var qIdx = url.indexOf('?q=');
  if(qIdx===-1) qIdx=url.indexOf('&q=');
  if(qIdx!==-1){
    var qVal=url.slice(qIdx+3).split('&')[0];
    var dec2='';
    try{ dec2=decodeURIComponent(qVal.split('+').join(' ')); }catch(e){ dec2=qVal; }
    if(dec2){
      var area2=detectArea(dec2);
      document.getElementById('sh-addr').value=dec2;
      if(area2) document.getElementById('sh-loc').value=area2;
      status.style.color='#4ade80';
      status.textContent='\u2705 \uC8FC\uC18C \uC790\uB3D9\uC785\uB825 \uC644\uB8CC!';
      return;
    }
  }

  status.style.color='rgba(255,255,255,.4)';
  status.textContent='\uB9C1\uD06C\uC5D0\uC11C \uC815\uBCF4\uB97C \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC544\uB798\uC5D0 \uC9C1\uC811 \uC785\uB825\uD574\uC8FC\uC138\uC694.';
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
    hours:'', commission:15,
    address:document.getElementById('sh-addr').value||'',
    googleMapUrl:gmapUrl,
    googleMapEmbed:'',
    thumbnail:'',
    services:svcs,
    servicePrices:svcPrices,
    description:document.getElementById('sh-desc').value||'',
    rating:5.0, reviewCount:0
  })}).then(function(r){return r.json();}).then(function(res){
    var newShopId = res.id || null;
    // \uD3FC \uCD08\uAE30\uD654
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

loadAll();

}); // DOMContentLoaded
</script>
</body>
</html>`;

// api/_handler.ts
async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url || "/"}`;
  const method = req.method || "GET";
  const body = await new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }
  const request = new Request(url, {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? void 0 : body.length > 0 ? body : void 0
  });
  try {
    const response = await src_default.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const resBody = await response.arrayBuffer();
    res.end(Buffer.from(resBody));
  } catch (e) {
    res.statusCode = 500;
    res.end("Internal Server Error: " + (e.message || "unknown"));
  }
}
module.exports = handler;
module.exports.default = handler;


// Vercel CJS handler export
if (typeof handler === 'function') {
  module.exports = handler;
}
