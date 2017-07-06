
import qs from 'qs';
import HttpStatus from 'http-status-codes';

class HTTPError extends Error {
    constructor(code, msg = null, response = {}) {
        let statusText = HttpStatus.getStatusText(code);

        if (!msg || msg === "") {
            msg = statusText;
        }

        super(msg);
        this._code = parseInt(code, 10);
        this._response = response;
        this.name = this.constructor.name;

        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else { 
            this.stack = (new Error(msg)).stack; 
        }
    }

    get code() {
        return this._code;
    }

    get statusText() {
        return HttpStatus.getStatusText(this.code);
    }

    get response() {
        return this._response;
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

  _fetch (route, method, body, isQuery = false) {
    if (!route) throw new Error('Route is undefined');
    var fullRoute = this._fullRoute(route);
    if (isQuery && body) {
      const query = qs.stringify(body);
      fullRoute = `${fullRoute}?${query}`;
      body = undefined;
    }
    let opts = {
      method,
      headers: this.headers
    };
    if (body) {
      Object.assign(opts, { body: JSON.stringify(body) });
    }
    const fetchPromise = () => fetch(fullRoute, opts);

    function processResp(response){
      if (response.ok) {

          switch (response.status) {
              case HttpStatus.NO_CONTENT:
                  return {};
                default:
                  return response.json();
          }

      } else {
        __DEV__ && console.log(response);
        throw new HTTPError(response.status, response.statusText, response);
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

  GET (route, query) { return this._fetch(route, 'GET', query, true); }
  POST (route, body) { return this._fetch(route, 'POST', body); }
  PUT (route, body) { return this._fetch(route, 'PUT', body); }
  PATCH (route, body) { return this._fetch(route, 'PATCH', body); }
  DELETE (route, query) { return this._fetch(route, 'DELETE', query, true); }
}
