/**
 * model/core/base.js
 */

/**
 * @type {RegExp}
 * @const
 */
var rgxEventSplitter = /[. :]+/;

/**
 * baseModel
 * @constructor
 */
var baseModel = {
    isModel: true,
    make: function (opts) {
        var self = this;
        // Each TBone model/collection is an augmented copy of this TBoneModel function
        var instance = function TBoneModel (arg0, arg1, arg2) {
            if (typeof arg0 === 'function') {
                return autorun(arg0, arg1, arg2);
            } else if (typeof arg1 === 'function' && !isQueryable(arg1)) {
                return instance['query'](arg0, boundModel.extend({ 'state': arg1 }).make());
            } else {
                return (arguments.length === 0 ? instance['query']() :
                        arguments.length === 1 ? instance['query'](arg0) :
                        arguments.length === 2 ? instance['query'](arg0, arg1) :
                                                 instance['query'](arg0, arg1, arg2));
            }
        };
        _.extend(instance, self, isFunction(opts) ? { 'state': opts } : opts || {});

        // Initialize the model instance
        delete instance['tboneid'];
        delete instance['attributes'];
        instance._events = {};
        instance._removeCallbacks = {};
        uniqueId(instance);
        instance['initialize']();

        return instance;
    },
    'extend': function (subclass) {
        return _.extend({}, this, subclass);
    },
    'initialize': noop,
    'on': function (name, callback, context) {
        var parts = name.split(rgxEventSplitter);
        var events = this._events;
        var arg;

        while ((arg = parts.shift()) != null) {
            if (arg === '') {
                continue;
            }
            if (!events[arg]) {
                events[arg] = {};
            }
            events = events[arg];
        }
        var callbacks = events[''];
        if (!callbacks) {
            callbacks = events[''] = [];
        }
        callbacks.push({ callback: callback, context: context });

        /**
         * Wake up and reset this and other models that may be sleeping because
         * they did not need to be updated.
         */
        this.wake({});
    },
    'off': function (name, callback, context) {
        // XXX name & callback not supported.
        // XXX doesn't clean up when callbacks list goes to zero length
        var stack = [ this._events ];
        var next, callbacks, k;

        while (!!(next = stack.pop())) {
            for (k in next) {
                if (k === '') {
                    var newCallbacks = [];
                    callbacks = next[''];
                    for (var i = 0; i < next[k].length; i++) {
                        if (callbacks[i].context !== context) {
                            newCallbacks.push(callbacks[i]);
                        }
                    }
                    next[''] = newCallbacks;
                } else {
                    stack.push(next[k]);
                }
            }
        }
    },
    'trigger': function (name) {
        var self = this;
        var events = self._events;
        var parts = name.split(rgxEventSplitter);
        var arg;
        while ((arg = parts.shift()) != null) {
            if (arg === '') {
                continue;
            }
            if (!events[arg]) {
                events[arg] = {};
            }
            events = events[arg];
        }
        var callbacks = events[QUERY_SELF] || [];
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i].callback.call(callbacks[i].context);
        }
    },

    'query': query,

    'queryModel': function (prop) {
        return this['query'](DONT_GET_DATA, prop);
    },

    'idAttribute': 'id',

    'queryId': function () {
        return this['query'](this['idAttribute']);
    },

    'toggle': function (prop) {
        this['query'](QUERY_TOGGLE, prop);
    },

    'push': function (prop, value) {
        if (arguments.length === 1) {
            value = prop;
            prop = '';
        }
        this['query'](QUERY_PUSH, prop, value);
    },

    'unshift': function (prop, value) {
        if (arguments.length === 1) {
            value = prop;
            prop = '';
        }
        this['query'](QUERY_UNSHIFT, prop, value);
    },

    'removeFirst': function (prop) {
        this['query'](QUERY_REMOVE_FIRST, prop);
    },

    'removeLast': function (prop) {
        this['query'](QUERY_REMOVE_LAST, prop);
    },

    'unset': function (prop) {
        this['query'](QUERY_UNSET, prop);
    },

    'increment': function (prop, value) {
        this['query'](QUERY_INCREMENT, prop, value != null ? value : 1);
    },

    'clear': function () {
        this['query']('', undefined);
    },

    'toJSON': function () {
        return this.attributes;
    },

    wake: noop,

    'queryText': queryText, // deprecated
    'text': queryText, // deprecated
    'lookup': query, // deprecated
    'lookupText': queryText, // deprecated
    'set': query, // deprecated
    'get': query // deprecated
};

if (TBONE_DEBUG) {
    baseModel['find'] = function (obj) {
        function recurse(o, depth) {
            if (depth > 10) {
                return [];
            }
            if (o === obj) {
                return [];
            }
            if (isQueryable(o)) {
                if (!!(result = recurse(o.attributes, depth + 1))) {
                    return result;
                }
            } else if (o !== null && typeof o === 'object') {
                var result;
                if (o.push) {
                    for (var i = 0; i < o.length; i++) {
                        if (!!(result = recurse(o[i], depth + 1))) {
                            result.unshift(k);
                            return result;
                        }
                    }
                } else {
                    for (var k in o) {
                        if (!!(result = recurse(o[k], depth + 1))) {
                            result.unshift(k);
                            return result;
                        }
                    }
                }
            }
        }
        var result = recurse(this.attributes, 0);
        return result ? result.join('.') : null;
    };
}