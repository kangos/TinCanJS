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
@submodule TinCan.Utils
**/
(function () {
    "use strict";

    /**
    @class TinCan.Utils
    */
    TinCan.Utils = {
        /**
        @method getUUID
        @return {String} UUID
        @static

        Excerpt from: Math.uuid.js (v1.4)
        http://www.broofa.com
        mailto:robert@broofa.com
        Copyright (c) 2010 Robert Kieffer
        Dual licensed under the MIT and GPL licenses.
        */
        getUUID: function () {
            /*jslint bitwise: true eqeq: true */
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
                /[xy]/g,
                function (c) {
                    var r = Math.random() * 16|0, v = c == 'x' ? r : (r&0x3|0x8);
                    return v.toString(16);
                }
            );
        },

        /**
        @method getISODateString
        @param {Date} date Date to stringify
        @return {String} ISO date String
        */
        getISODateString: function (d) {
            function pad (val, n) {
                var padder,
                    tempVal;
                if (val === null) {
                    val = 0;
                }
                if (n === null) {
                    n = 2;
                }
                padder = Math.pow(10, n-1);
                tempVal = val.toString();

                while (val < padder && padder > 1) {
                    tempVal = '0' + tempVal;
                    padder = padder / 10;
                }

                return tempVal;
            }

            return d.getUTCFullYear() + '-'
                + pad(d.getUTCMonth() + 1) + '-'
                + pad(d.getUTCDate()) + 'T'
                + pad(d.getUTCHours()) + ':'
                + pad(d.getUTCMinutes()) + ':'
                + pad(d.getUTCSeconds()) + '.'
                + pad(d.getUTCMilliseconds(), 3) + 'Z';
        },

        /**
        @method getLangDictionaryValue
        @param {String} prop Property name storing the dictionary
        @param {String} [lang] Language to return
        @return {String}

        Intended to be inherited by objects with properties that store
        display values in a language based "dictionary"
        */
        getLangDictionaryValue: function (prop, lang) {
            var langDict = this[prop],
                key;

            if (typeof lang !== "undefined" && typeof langDict[lang] !== "undefined") {
                return langDict[lang];
            }
            if (typeof langDict.und !== "undefined") {
                return langDict.und;
            }
            if (typeof langDict["en-US"] !== "undefined") {
                return langDict["en-US"];
            }
            for (key in langDict) {
                if (langDict.hasOwnProperty(key)) {
                    return langDict[key];
                }
            }

            return "";
        },

        /**
        @method parseURL
        @param {String} url
        @return {Object} Object of values
        @private
        */
        parseURL: function (url) {
            var parts = String(url).split('?'),
                pairs,
                pair,
                i,
                params = {}
            ;
            if (parts.length === 2) {
                pairs = parts[1].split('&');
                for (i = 0; i < pairs.length; i += 1) {
                    pair = pairs[i].split('=');
                    if (pair.length === 2 && pair[0]) {
                        params[pair[0]] = decodeURIComponent(pair[1]);
                    }
                }
            }

            return {
                path: parts[0],
                params: params
            };
        },

        /**
        @method getServerRoot
        @param {String} absoluteUrl
        @return {String} server root of url
        @private
        */
        getServerRoot: function (absoluteUrl) {
            var urlParts = absoluteUrl.split("/");
            return urlParts[0] + "//" + urlParts[2];
        }
    };
}());
