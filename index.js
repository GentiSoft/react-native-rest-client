import ExtendableError from 'extendable-error';
import qs from 'qs';
import HttpStatus from 'http-status-codes';

class HTTPError extends ExtendableError {
    constructor(code, msg = null, response = {}) {
        let statusText = HttpStatus.getStatusText(code);

        if (!msg || msg === "") {
            msg = statusText;
        }

        super(msg);
        this.code = parseInt(code, 10);
        this.response = response;
        this.name = this.constructor.name;

        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(msg)).stack;
        }
    }

    get statusText() {
        return HttpStatus.getStatusText(this.code);
    }
}

export default class RestClient {
  constructor (baseUrl = '', { headers = {}, devMode = false, simulatedDelay = 0 } = {}) {
    if (!baseUrl) throw new Error('missing baseUrl');
    this.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    Object.assign(this.headers, headers);
    this.baseUrl = baseUrl;
    this.simulatedDelay = simulatedDelay;
    this.devMode = devMode;
  }

  _simulateDelay () {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, this.simulatedDelay);
    });
  }

  _fullRoute (url) {
    return `${this.baseUrl}${url}`;
  }

  _fetch (route, method = 'GET', body = null, options = {}) {
    let customHeaders = options.headers || {},
        isQuery = options.isQuery || false,
        query = options.query || null;

    if (!route) throw new Error('Route is undefined');
    var fullRoute = this._fullRoute(route);

    if (isQuery && body) {
      query = Object.assign({}, query || {}, body);
      body = undefined;
    }

    if (query && Object.keys(query).length) {
      fullRoute += `?${qs.stringify(query)}`;
    }

    const headers = Object.assign({}, this.headers, customHeaders);

    let opts = {
      method,
      headers
    };

    if (body) {
      switch (headers['Content-Type']) {
        case 'application/json':
          body = JSON.stringify(body);
          break;
        case 'text':
        case 'text/plain':
          if (typeof body !== 'string') {
            body = body.toString();
          }
          break;
        case 'multipart/form-data':
          let nbody = new FormData();
          Object.keys(body).forEach((k) => nbody.append(k, body[k]));
          body = nbody;
          delete opts.headers['Content-Type'];
          break;
        default:
          throw Error(`Can't to cast ${headers['Content-Type']} Content-Type`);
      }
    }

    Object.assign(opts, { body });

    const fetchPromise = () => fetch(fullRoute, opts);

    async function processResp(response){
      if (response.ok) {

          switch (response.status) {
              case HttpStatus.NO_CONTENT:
                  return {};
                default:
                  return response.json();
          }

      } else {
		  const resp = await response.json();
        __DEV__ && console.log(response);
        throw new HTTPError(response.status, response.statusText, resp);
      }
    }

    return fetchPromise()
        .then(response => processResp(response))
        .then(response => this.transform(response))
        .catch((e) => {
            __DEV__ && console.log('Error:' ,e);
            throw e;
        });
  }

  transform(data) {
    return data;
  }

  updateHeaders(headers = {}) {
    Object.assign(this.headers, headers);
    return this;
  }

  GET (route, query, options = {}) {
    return this._fetch(route, 'GET', query, Object.assign(
      { query: true },
      options
    ));
  }

  POST (route, body, options = {}) {
    return this._fetch(route, 'POST', body, options);
  }

  PUT (route, body, options = {}) {
    return this._fetch(route, 'PUT', body, options);
  }

  PATCH (route, body, options = {}) {
    return this._fetch(route, 'PATCH', body, options);
  }

  DELETE (route, query, options = {}) {
    return this._fetch(route, 'DELETE', query, Object.assign(
      { query: true },
      options
    ));
  }
}
