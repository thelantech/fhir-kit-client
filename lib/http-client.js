require('es6-promise').polyfill();
require('isomorphic-fetch');

const { logRequestError, logRequestInfo, logResponseInfo } = require('./logging');

const defaultHeaders = { accept: 'application/json+fhir' };

function responseError({
  status,
  rawData,
  httpVerb,
  url,
  headers,
}) {
  const error = new Error();
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (e) {
    data = rawData;
  }
  error.response = { status, data };
  error.config = { method: httpVerb, url, headers };
  logRequestError(error);
  return error;
}

/**
 * Class used by Client to make HTTP requests. Do not use this class directly,
 * use Client#read, Client#create, etc.
 *
 * @private
 */
module.exports = class {
  /**
   * Create an HTTP client.
   *
   * @param {Object} config HTTP Client configuration
   * @param {String} config.baseUrl Base URL used to resolve relative paths
   * @param {Object} [config.customHeaders] Custom headers to send with each
   *   request
   * @throws An error will be thrown on unsuccessful requests.
   */
  constructor({ baseUrl, customHeaders = {} }) {
    this.baseUrl = baseUrl;
    this.customHeaders = customHeaders || {};
  }

  set bearerToken(token) {
    const header = `Bearer ${token}`;
    this.authHeader = { authorization: header };
  }

  async request(httpVerb, url, requestHeaders, body) {
    const headers = this.mergeHeaders(requestHeaders);
    const fullUrl = this.expandUrl(url);
    let status;
    let error;
    logRequestInfo(httpVerb, fullUrl, headers);

    const options = {
      headers,
      method: httpVerb,
      body: JSON.stringify(body),
    };
    const data = await fetch(fullUrl, options)
      .then((response) => {
        ({ status } = response);
        error = !response.ok;
        if (error) {
          return response.text();
        }
        return response.json();
      });

    logResponseInfo({ status, data });

    if (error) {
      throw responseError({
        status,
        httpVerb,
        headers,
        rawData: data,
        url: fullUrl,
      });
    }
    return data;
  }

  async get(url, headers) {
    return this.request('get', url, headers);
  }

  async delete(url, headers) {
    return this.request('delete', url, headers);
  }

  async put(url, body, headers) {
    return this.request('put', url, headers, body);
  }

  async post(url, body, headers) {
    return this.request('post', url, headers, body);
  }

  async patch(url, body, headers) {
    return this.request('patch', url, headers.headers, body);
  }

  expandUrl(url = '') {
    if (url.startsWith('http')) {
      return url;
    }
    if (this.baseUrl.endsWith('/') && url.startsWith('/')) {
      return this.baseUrl + url.slice(1);
    }
    if (this.baseUrl.endsWith('/') || url.startsWith('/')) {
      return this.baseUrl + url;
    }
    return `${this.baseUrl}/${url}`;
  }

  mergeHeaders(requestHeaders) {
    return Object.assign(
      {},
      defaultHeaders,
      this.authHeader,
      this.customHeaders,
      requestHeaders,
    );
  }
};
