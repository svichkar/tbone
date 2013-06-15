#!/usr/bin/env node
process.title = 'tbonetest';

var _ = require('underscore')._;
_.mixin(require('underscore.string'));
var express = require('express');
var app = express();
var utils = require('../autorun/utils.js');
var util = require('util');
var async = require('async');

app.use(express.static(__dirname + '/static'));
var server = app.listen(9238, runtests);
var running = true;

process.on('SIGHUP', function () {
  try {
    server.close(function() {
      process.exit(0);
    });
  } catch(e) {
    process.exit(0);
  }
});

function formatTime(t) {
  return Math.round(t * 10) / 10;
}

function runtests() {
  var phantom = require('node-phantom');
  _.each(['debug', 'release'], function(mode) {
    phantom.create(function(err, ph) {
      ph.createPage(function(err, page) {
        function log(msg) {
          info('<<magenta>>' + _.pad(mode, 8) + ': <<grey>>' + msg);
        }
        page.open("http://localhost:9238/?mode=" + mode, function(err, status) {
          function loadQUnitResults() {
            page.evaluate(function(err) {
              return window.qunit_results;
            }, function(err, results) {
              if (results) {
                var fail_color = results.failed ? '<<red>>' : '';
                var msg = '<<green>>' + results.passed + ' passed<<grey>>, ' + fail_color +
                          results.failed + ' failed <<gray>>out of <<blue>>' + results.total +
                          ' tests<<gray>> in <<blue>>' + results.runtime + ' ms<<gray>>.';
                log(msg);
                _.each(results.failures, function(failure) {
                  log(failure);
                });
              } else {
                setTimeout(loadQUnitResults, 50);
              }
            });
          }
          loadQUnitResults();

          var times = [];
          function timestr(time) {
            return (
              time < 0.0000005 ? formatTime(time * 1e9) + 'ns' :
              time < 0.001 ? formatTime(time * 1e6) + '\u03BCs' :
              time < 1 ? formatTime(time * 1e3) + 'ms' :
              formatTime(time) + 's');
          }
          function loadJSLitmusResults() {
            page.evaluate(function(err) {
              var rval = {
                tests: window.jslitmus_tests,
                done: window.jslitmus_done
              };
              window.jslitmus_tests = [];
              return rval;
            }, function(err, rval) {
              var tests = rval.tests;
              _.each(tests || [], function(test) {
                var time = test.period;
                if (time && !test.name.match(/calibrating (loop|function)/)) {
                  times.push(time);
                  log('<<green>>' + _.pad(timestr(time), 7) +
                      ' <<blue>>' + test.name);
                }
              });
              if (!rval.done) {
                setTimeout(loadJSLitmusResults, 50);
              } else {
                var meanTime = _.reduce(times, function (memo, time) {
                  return memo + time;
                }, 0) / times.length;
                log('<<green>>' + _.pad(timestr(meanTime), 7) +
                    ' <<blue>> mean');
              }
            });
          }
          loadJSLitmusResults();
        });
      });
    });
  });
}
