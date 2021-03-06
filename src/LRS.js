/*
    Copyright 2012 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/**
TinCan client library

@module TinCan
@submodule TinCan.LRS
**/
(function () {
    "use strict";
    var IE = "ie",

    /**
    @class TinCan.LRS
    @constructor
    */
    LRS = TinCan.LRS = function (cfg) {
        this.log("constructor");

        /**
        @property endpoint
        @type String
        */
        this.endpoint = null;

        /**
        @property version
        @type String
        */
        this.version = null;

        /**
        @property auth
        @type String
        */
        this.auth = null;

        /**
        @property allowFail
        @type Boolean
        @default true
        */
        this.allowFail = true;

        /**
        @property alertOnRequestFailure
        @type Boolean
        @default true
        */
        this.alertOnRequestFailure = true;

        /**
        @property extended
        @type Object
        */
        this.extended = null;

        /**
        @property _requestMode
        @type String
        @default "native"
        @private
        */
        this._requestMode = "native";

        this.init(cfg);
    };
    LRS.prototype = {
        /**
        @property LOG_SRC
        */
        LOG_SRC: "LRS",

        /**
        @method log
        */
        log: TinCan.prototype.log,

        /**
        @method init
        */
        init: function (cfg) {
            /*jslint regexp: true */
            this.log("init");

            var urlParts,
                schemeMatches,
                isXD,
                env = TinCan.environment()
            ;

            cfg = cfg || {};

            if (! cfg.hasOwnProperty("endpoint")) {
                if (env.isBrowser && this.alertOnRequestFailure) {
                    alert("[error] LRS invalid: no endpoint");
                }
                throw {
                    code: 3,
                    mesg: "LRS invalid: no endpoint"
                };
            }

            this.endpoint = cfg.endpoint;

            if (cfg.hasOwnProperty("allowFail")) {
                this.allowFail = cfg.allowFail;
            }

            if (cfg.hasOwnProperty("auth")) {
                this.auth = cfg.auth;
            }

            urlParts = cfg.endpoint.toLowerCase().match(/([A-Za-z]+:)\/\/([^:\/]+):?(\d+)?(\/.*)?$/);

            if (env.isBrowser) {
                //
                // determine whether this is a cross domain request,
                // if it is then if we are in IE check that the schemes
                // match to see if we should be able to talk to the LRS
                //
                schemeMatches = location.protocol.toLowerCase() === urlParts[1];
                isXD = (
                    // is same scheme?
                    ! schemeMatches

                    // is same host?
                    || location.hostname.toLowerCase() !== urlParts[2]

                    // is same port?
                    || location.port !== (
                        urlParts[3] !== null ? urlParts[3] : (urlParts[1] === "http:" ? "80" : "443")
                    )
                );
                if (isXD && env.isIE) {
                    if (schemeMatches) {
                        this._requestMode = IE;
                    }
                    else {
                        if (cfg.allowFail) {
                            if (this.alertOnRequestFailure) {
                                alert("[warning] LRS invalid: cross domain request for differing scheme in IE");
                            }
                        }
                        else {
                            if (this.alertOnRequestFailure) {
                                alert("[error] LRS invalid: cross domain request for differing scheme in IE");
                            }
                            throw {
                                code: 2,
                                mesg: "LRS invalid: cross domain request for differing scheme in IE"
                            };
                        }
                    }
                }
            }
            else {
                this.log("Unrecognized environment not supported: " + env);
            }

            if (typeof cfg.version !== "undefined") {
                this.log("version: " + cfg.version);
                this.version = cfg.version;
            }
            else {
                //
                // assume max supported when not specified,
                // TODO: add detection of LRS from call to endpoint
                //
                this.version = TinCan.versions()[0];
            }
        },

        /**
        Method used to send a request via browser objects to the LRS

        @method sendRequest
        @param {Object} [cfg] Configuration for request
            @param {String} [cfg.url] URL portion to add to endpoint
            @param {String} [cfg.method] GET, PUT, POST, etc.
            @param {Object} [cfg.params] Parameters to set on the querystring
            @param {String} [cfg.data] String of body content
            @param {Object} [cfg.headers] Additional headers to set in the request
            @param {Function} [cfg.callback] Function to run at completion
                @param {String|Null} cfg.callback.err If an error occurred, this parameter will contain the HTTP status code.
                    If the operation succeeded, err will be null.
                @param {Object} cfg.callback.xhr XHR object
            @param {Boolean} [cfg.ignore404] Whether 404 status codes should be considered an error
        @return {Object} XHR if called in a synchronous way (in other words no callback)
        */
        sendRequest: function (cfg) {
            this.log("sendRequest");
            var xhr,
                finished = false,
                location = window.location,
                fullUrl = this.endpoint + cfg.url,
                headers = {},
                data,
                requestCompleteResult,
                until,
                prop,
                pairs = [],
                self = this
            ;

            // respect absolute URLs passed in
            if (cfg.url.indexOf("http") === 0) {
                fullUrl = cfg.url;
            }

            // add extended LMS-specified values to the params
            if (this.extended !== null) {
                for (prop in this.extended) {
                    if (this.extended.hasOwnProperty(prop)) {
                        // TODO: don't overwrite cfg.params value
                        if (this.extended[prop] !== null && this.extended[prop].length > 0) {
                            cfg.params[prop] = this.extended[prop];
                        }
                    }
                }
            }

            // consolidate headers
            headers["Content-Type"] = "application/json";
            headers.Authorization = this.auth;
            if (this.version !== "0.9") {
                headers["X-Experience-API-Version"] = this.version;
            }

            for (prop in cfg.headers) {
                if (cfg.headers.hasOwnProperty(prop)) {
                    headers[prop] = cfg.headers[prop];
                }
            }

            if (this._requestMode === "native") {
                this.log("sendRequest using XMLHttpRequest");

                for (prop in cfg.params) {
                    if (cfg.params.hasOwnProperty(prop)) {
                        pairs.push(prop + "=" + encodeURIComponent(cfg.params[prop]));
                    }
                }
                if (pairs.length > 0) {
                    fullUrl += "?" + pairs.join("&");
                }

                xhr = new XMLHttpRequest();
                xhr.open(cfg.method, fullUrl, (typeof cfg.callback !== "undefined"));
                for (prop in headers) {
                    if (headers.hasOwnProperty(prop)) {
                        xhr.setRequestHeader(prop, headers[prop]);
                    }
                }
                data = cfg.data;
            }
            else if (this._requestMode === IE) {
                this.log("sendRequest using XDomainRequest");

                // method has to go on querystring, and nothing else,
                // and the actual method is then always POST
                fullUrl += "?method=" + cfg.method;

                // params end up in the body
                for (prop in cfg.params) {
                    if (cfg.params.hasOwnProperty(prop)) {
                        pairs.push(prop + "=" + encodeURIComponent(headers[prop]));
                    }
                }

                // headers go into form data
                for (prop in headers) {
                    if (headers.hasOwnProperty(prop)) {
                        pairs.push(prop + "=" + encodeURIComponent(headers[prop]));
                    }
                }

                // the original data is repackaged as "content" form var
                if (cfg.data !== null) {
                    pairs.push("content=" + encodeURIComponent(cfg.data));
                }

                data = pairs.join("&");

                xhr = new XDomainRequest ();
                xhr.open("POST", fullUrl);
            }
            else {
                this.log("sendRequest unrecognized _requestMode: " + this._requestMode);
            }

            // Setup request callback
            function requestComplete () {
                self.log("requestComplete: " + finished + ", xhr.status: " + xhr.status);
                var notFoundOk;

                if (! finished) {
                    // may be in sync or async mode, using XMLHttpRequest or IE XDomainRequest, onreadystatechange or
                    // onload or both might fire depending upon browser, just covering all bases with event hooks and
                    // using 'finished' flag to avoid triggering events multiple times
                    finished = true;

                    notFoundOk = (cfg.ignore404 && xhr.status === 404);
                    if (xhr.status === undefined || (xhr.status >= 200 && xhr.status < 400) || notFoundOk) {
                        if (cfg.callback) {
                            cfg.callback(null, xhr);
                        }
                        else {
                            requestCompleteResult = {
                                err: null,
                                xhr: xhr
                            };
                            return requestCompleteResult;
                        }
                    }
                    else {
                        // Alert all errors except cancelled XHR requests
                        if (xhr.status > 0) {
                            requestCompleteResult = {
                                err: xhr.status,
                                xhr: xhr
                            };
                            if (self.alertOnRequestFailure) {
                                alert("[warning] There was a problem communicating with the Learning Record Store. (" + xhr.status + " | " + xhr.responseText+ ")");
                            }
                            if (cfg.callback) {
                                cfg.callback(xhr.status, xhr);
                            }
                        }
                        return requestCompleteResult;
                    }
                }
                else {
                    return requestCompleteResult;
                }
            }

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    requestComplete();
                }
            };

            xhr.onload = requestComplete;
            xhr.onerror = requestComplete;

            xhr.send(data);

            if (! cfg.callback) {
                // synchronous
                if (this._requestMode === IE) {
                    // synchronous call in IE, with no synchronous mode available
                    until = 1000 + Date.now();
                    this.log("sendRequest - until: " + until + ", finished: " + finished);

                    while (Date.now() < until && ! finished) {
                        //this.log("calling __delay");
                        this.__delay();
                    }
                }
                return requestComplete();
            }

            //
            // for async requests give them the XHR object directly
            // as the return value, the actual stuff they should be
            // caring about is params to the callback, for sync
            // requests they got the return value above
            //
            return xhr;
        },

        /**
        Save a statement, when used from a browser sends to the endpoint using the RESTful interface.
        Use a callback to make the call asynchronous.

        @method saveStatement
        @param {Object} TinCan.Statement to send
        @param {Object} [cfg] Configuration used when saving
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        saveStatement: function (stmt, cfg) {
            this.log("saveStatement");
            var requestCfg;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestCfg = {
                url: "statements",
                method: "PUT",
                params: {
                    statementId: stmt.id
                },
                data: JSON.stringify(stmt.asVersion( this.version ))
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Retrieve a statement, when used from a browser sends to the endpoint using the RESTful interface.

        @method retrieveStatement
        @param {String} ID of statement to retrieve
        @param {Object} [cfg] Configuration options
            @param {Function} [cfg.callback] Callback to execute on completion
        @return {Object} TinCan.Statement retrieved
        */
        retrieveStatement: function (stmtId, cfg) {
            this.log("retrieveStatement");
            var requestCfg,
                requestResult,
                callbackWrapper;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestCfg = {
                url: "statements",
                method: "GET",
                params: {
                    statementId: stmtId
                }
            };
            if (typeof cfg.callback !== "undefined") {
                callbackWrapper = function (err, xhr) {
                    var result = xhr;

                    if (err === null) {
                        result = TinCan.Statement.fromJSON(xhr.responseText);
                    }

                    cfg.callback(err, result);
                };
                requestCfg.callback = callbackWrapper;
            }

            requestResult = this.sendRequest(requestCfg);
            if (! callbackWrapper) {
                requestResult.statement = null;
                if (requestResult.err === null) {
                    requestResult.statement = TinCan.Statement.fromJSON(requestResult.xhr.responseText);
                }
            }

            return requestResult;
        },

        /**
        Save a set of statements, when used from a browser sends to the endpoint using the RESTful interface.
        Use a callback to make the call asynchronous.

        @method saveStatements
        @param {Array} Array of statements or objects convertable to statements
        @param {Object} [cfg] Configuration used when saving
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        saveStatements: function (stmts, cfg) {
            this.log("saveStatements");
            var versionedStatements = [],
                requestCfg,
                i
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            cfg = cfg || {};

            if (stmts.length > 0) {
                for (i = 0; i < stmts.length; i += 1) {
                    versionedStatements.push(
                        stmts[i].asVersion( this.version )
                    );
                }

                requestCfg = {
                    url: "statements",
                    method: "POST",
                    data: JSON.stringify(versionedStatements)
                };
                if (typeof cfg.callback !== "undefined") {
                    requestCfg.callback = cfg.callback;
                }

                return this.sendRequest(requestCfg);
            }
        },

        /**
        Fetch a set of statements, when used from a browser sends to the endpoint using the
        RESTful interface.  Use a callback to make the call asynchronous.

        @method queryStatements
        @param {Object} [cfg] Configuration used to query
            @param {Object} [cfg.params] Query parameters
                @param {TinCan.Agent} [cfg.params.actor] Agent matches 'actor'
                @param {TinCan.Verb} [cfg.params.verb] Verb to query on
                @param {TinCan.Activity|TinCan.Agent|TinCan.Statement} [cfg.params.target] Activity, Agent, or Statement matches 'object'
                @param {TinCan.Agent} [cfg.params.instructor] Agent matches 'context:instructor'
                @param {String} [cfg.params.registration] Registration UUID
                @param {Boolean} [cfg.params.context] When filtering on target, include statements with matching context
                @param {String} [cfg.params.since] Match statements stored since specified timestamp
                @param {String} [cfg.params.until] Match statements stored at or before specified timestamp
                @param {Integer} [cfg.params.limit] Number of results to retrieve
                @param {Boolean} [cfg.params.authoritative] Get authoritative results
                @param {Boolean} [cfg.params.sparse] Get sparse results
                @param {Boolean} [cfg.params.ascending] Return results in ascending order of stored time
            @param {Function} [cfg.callback] Callback to execute on completion
                @param {String|null} cfg.callback.err Error status or null if succcess
                @param {TinCan.StatementsResult|XHR} cfg.callback.response Receives a StatementsResult argument
        @return {Object} Request result
        */
        queryStatements: function (cfg) {
            this.log("queryStatements");
            var requestCfg,
                requestResult,
                callbackWrapper;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            cfg = cfg || {};
            cfg.params = cfg.params || {};

            if (cfg.params.hasOwnProperty("target")) {
                cfg.params.object = cfg.params.target;
            }

            requestCfg = this._queryStatementsRequestCfg(cfg);

            if (typeof cfg.callback !== "undefined") {
                callbackWrapper = function (err, xhr) {
                    var result = xhr;

                    if (err === null) {
                        result = TinCan.StatementsResult.fromJSON(xhr.responseText);
                    }

                    cfg.callback(err, result);
                };
                requestCfg.callback = callbackWrapper;
            }

            requestResult = this.sendRequest(requestCfg);
            requestResult.config = requestCfg;

            if (! callbackWrapper) {
                requestResult.statementsResult = null;
                if (requestResult.err === null) {
                    requestResult.statementsResult = TinCan.StatementsResult.fromJSON(requestResult.xhr.responseText);
                }
            }

            return requestResult;
        },

        /**
        Build a request config object that can be passed to sendRequest() to make a query request

        @method _queryStatementsRequestCfg
        @private
        @param {Object} [cfg] See configuration for {{#crossLink "TinCan.LRS/queryStatements"}}{{/crossLink}}
        @return {Object} Request configuration object
        */
        _queryStatementsRequestCfg: function (cfg) {
            this.log("_queryStatementsRequestCfg");
            var params = {},
                returnCfg = {
                    url: "statements",
                    method: "GET",
                    params: params
                },
                jsonProps = [
                    "actor",
                    "object",
                    "instructor"
                ],
                idProps = ["verb"],
                valProps = [
                    "registration",
                    "context",
                    "since",
                    "until",
                    "limit",
                    "authoritative",
                    "sparse",
                    "ascending"
                ],
                i;

            for (i = 0; i < jsonProps.length; i += 1) {
                if (typeof cfg.params[jsonProps[i]] !== "undefined") {
                    params[jsonProps[i]] = JSON.stringify(cfg.params[jsonProps[i]].asVersion(this.version));
                }
            }

            for (i = 0; i < idProps.length; i += 1) {
                if (typeof cfg.params[idProps[i]] !== "undefined") {
                    params[idProps[i]] = cfg.params[idProps[i]].id;
                }
            }

            for (i = 0; i < valProps.length; i += 1) {
                if (typeof cfg.params[valProps[i]] !== "undefined") {
                    params[valProps[i]] = cfg.params[valProps[i]];
                }
            }

            return returnCfg;
        },

        /**
        Fetch more statements from a previous query, when used from a browser sends to the endpoint using the
        RESTful interface.  Use a callback to make the call asynchronous.

        @method moreStatements
        @param {Object} [cfg] Configuration used to query
            @param {String} [cfg.url] More URL
            @param {Function} [cfg.callback] Callback to execute on completion
                @param {String|null} cfg.callback.err Error status or null if succcess
                @param {TinCan.StatementsResult|XHR} cfg.callback.response Receives a StatementsResult argument
        @return {Object} Request result
        */
        moreStatements: function (cfg) {
            this.log("moreStatements: " + cfg.url);
            var requestCfg,
                requestResult,
                callbackWrapper,
                parsedURL,
                serverRoot;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            cfg = cfg || {};

            // to support our interface (to support IE) we need to break apart
            // the more URL query params so that the request can be made properly later
            parsedURL = TinCan.Utils.parseURL(cfg.url);

            //Respect a more URL that is relative to either the server root 
            //or endpoint (though only the former is allowed in the spec)
            serverRoot = TinCan.Utils.getServerRoot(this.endpoint);
            if (parsedURL.path.indexOf("/statements") === 0){
                parsedURL.path = this.endpoint.replace(serverRoot, '') + parsedURL.path;
                this.log("converting non-standard more URL to " + parsedURL.path);
            }

            //The more relative URL might not start with a slash, add it if not
            if (parsedURL.path.indexOf("/") !== 0) {
                parsedURL.path = "/" + parsedURL.path;
            }

            requestCfg = {
                method: "GET",
                //For arbitrary more URLs to work, 
                //we need to make the URL absolute here
                url: serverRoot + parsedURL.path,
                params: parsedURL.params
            };
            if (typeof cfg.callback !== "undefined") {
                callbackWrapper = function (err, xhr) {
                    var result = xhr;

                    if (err === null) {
                        result = TinCan.StatementsResult.fromJSON(xhr.responseText);
                    }

                    cfg.callback(err, result);
                };
                requestCfg.callback = callbackWrapper;
            }

            requestResult = this.sendRequest(requestCfg);
            requestResult.config = requestCfg;

            if (! callbackWrapper) {
                requestResult.statementsResult = null;
                if (requestResult.err === null) {
                    requestResult.statementsResult = TinCan.StatementsResult.fromJSON(requestResult.xhr.responseText);
                }
            }

            return requestResult;
        },

        /**
        Retrieve a state value, when used from a browser sends to the endpoint using the RESTful interface.

        @method retrieveState
        @param {String} key Key of state to retrieve
        @param {Object} cfg Configuration options
            @param {Object} cfg.activity TinCan.Activity
            @param {Object} cfg.agent TinCan.Agent
            @param {String} [cfg.registration] Registration
            @param {Function} [cfg.callback] Callback to execute on completion
                @param {Object|Null} cfg.callback.error
                @param {TinCan.State|null} cfg.callback.result null if state is 404
        @return {Object} TinCan.State retrieved when synchronous, or result from sendRequest
        */
        retrieveState: function (key, cfg) {
            this.log("retrieveState");
            var requestParams = {},
                requestCfg = {},
                requestResult,
                callbackWrapper
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestParams = {
                stateId: key,
                activityId: cfg.activity.id
            };
            if (this.version === "0.9") {
                requestParams.actor = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            else {
                requestParams.agent = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            if (typeof cfg.registration !== "undefined") {
                requestParams.registrationId = cfg.registration;
            }

            requestCfg = {
                url: "activities/state",
                method: "GET",
                params: requestParams,
                ignore404: true
            };
            if (typeof cfg.callback !== "undefined") {
                callbackWrapper = function (err, xhr) {
                    var result = xhr;

                    if (err === null) {
                        if (xhr.status === 404) {
                            result = null;
                        }
                        else {
                            result = new TinCan.State(
                                {
                                    id: key,
                                    contents: xhr.responseText
                                }
                            );
                        }
                    }

                    cfg.callback(err, result);
                };
                requestCfg.callback = callbackWrapper;
            }

            requestResult = this.sendRequest(requestCfg);
            if (! callbackWrapper) {
                requestResult.state = null;
                if (requestResult.err === null && requestResult.xhr.status !== 404) {
                    requestResult.state = new TinCan.State(
                        {
                            id: key,
                            contents: requestResult.xhr.responseText
                        }
                    );
                }
            }

            return requestResult;
        },

        /**
        Save a state value, when used from a browser sends to the endpoint using the RESTful interface.

        @method saveState
        @param {String} key Key of state to save
        @param {String} val Value of state to save
        @param {Object} cfg Configuration options
            @param {Object} cfg.activity TinCan.Activity
            @param {Object} cfg.agent TinCan.Agent
            @param {String} [cfg.registration] Registration
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        saveState: function (key, val, cfg) {
            this.log("saveState");
            var requestParams,
                requestCfg,
                requestResult
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            if (typeof val === "object") {
                val = JSON.stringify(val);
            }

            requestParams = {
                stateId: key,
                activityId: cfg.activity.id
            };
            if (this.version === "0.9") {
                requestParams.actor = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            else {
                requestParams.agent = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            if (typeof cfg.registration !== "undefined") {
                requestParams.registrationId = cfg.registration;
            }

            requestCfg = {
                url: "activities/state",
                method: "PUT",
                params: requestParams,
                data: val
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Drop a state value or all of the state, when used from a browser sends to the endpoint using the RESTful interface.

        @method dropState
        @param {String|null} key Key of state to delete, or null for all
        @param {Object} cfg Configuration options
            @param {Object} [cfg.activity] TinCan.Activity
            @param {Object} [cfg.agent] TinCan.Agent
            @param {String} [cfg.registration] Registration
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        dropState: function (key, cfg) {
            this.log("dropState");
            var requestParams = {},
                requestCfg = {}
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestParams = {
                activityId: cfg.activity.id
            };
            if (this.version === "0.9") {
                requestParams.actor = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            else {
                requestParams.agent = JSON.stringify(cfg.agent.asVersion(this.version));
            }
            if (key !== null) {
                requestParams.stateId = key;
            }
            if (typeof cfg.registration !== "undefined") {
                requestParams.registrationId = cfg.registration;
            }

            requestCfg = {
                url: "activities/state",
                method: "DELETE",
                params: requestParams
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Retrieve an activity profile value, when used from a browser sends to the endpoint using the RESTful interface.

        @method retrieveActivityProfile
        @param {String} key Key of activity profile to retrieve
        @param {Object} cfg Configuration options
            @param {Object} cfg.activity TinCan.Activity
            @param {Function} [cfg.callback] Callback to execute on completion
        @return {Object} Value retrieved
        */
        retrieveActivityProfile: function (key, cfg) {
            this.log("retrieveActivityProfile");
            var requestCfg = {},
                requestResult
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestCfg = {
                url: "activities/profile",
                method: "GET",
                params: {
                    profileId: key,
                    activityId: cfg.activity.id
                }
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Save an activity profile value, when used from a browser sends to the endpoint using the RESTful interface.

        @method saveActivityProfile
        @param {String} key Key of activity profile to retrieve
        @param {Object} cfg Configuration options
            @param {Object} cfg.activity TinCan.Activity
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        saveActivityProfile: function (key, val, cfg) {
            this.log("saveActivityProfile");
            var requestCfg;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            if (typeof val === "object") {
                val = JSON.stringify(val);
            }

            requestCfg = {
                url: "activities/profile",
                method: "PUT",
                params: {
                    profileId: key,
                    activityId: cfg.activity.id
                },
                data: val
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Drop an activity profile value or all of the activity profile, when used from a browser sends to the endpoint using the RESTful interface.

        @method dropActivityProfile
        @param {String|null} key Key of activity profile to delete, or null for all
        @param {Object} cfg Configuration options
            @param {Object} cfg.activity TinCan.Activity
            @param {Function} [cfg.callback] Callback to execute on completion
        */
        dropActivityProfile: function (key, cfg) {
            this.log("dropActivityProfile");
            var requestParams = {},
                requestCfg = {}
            ;

            // TODO: it would be better to make a subclass that knows
            //       its own environment and just implements the protocol
            //       that it needs to
            if (! TinCan.environment().isBrowser) {
                this.log("error: environment not implemented");
                return;
            }

            requestParams = {
                activityId: cfg.activity.id
            };
            if (key !== null) {
                requestParams.profileId = key;
            }

            requestCfg = {
                url: "activities/profile",
                method: "DELETE",
                params: requestParams
            };
            if (typeof cfg.callback !== "undefined") {
                requestCfg.callback = cfg.callback;
            }

            return this.sendRequest(requestCfg);
        },

        /**
        Non-environment safe method used to create a delay to give impression
        of synchronous response

        @method __delay
        @private
        */
        __delay: function () {
            //
            // use a synchronous request to the current location to allow the browser
            // to yield to the asynchronous request's events but still block in the
            // outer loop to make it seem synchronous to the end user
            //
            // removing this made the while loop too tight to allow the asynchronous
            // events through to get handled so that the response was correctly handled
            //
            var xhr = new XMLHttpRequest (),
                url = window.location + "?forcenocache=" + TinCan.Utils.getUUID()
            ;
            xhr.open("GET", url, false);
            xhr.send(null);
        }
    };
}());
