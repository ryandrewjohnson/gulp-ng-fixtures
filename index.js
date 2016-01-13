'use strict';

var fs          = require('fs');
var through     = require('through2');
var gutil       = require('gulp-util');
var PluginError = gutil.PluginError;
var Rx          = require('rx');
var handlebars  = require('handlebars');
var magenta     = gutil.colors.magenta;
var cyan        = gutil.colors.cyan;
var red         = gutil.colors.red;

var defaults,
    readFile,
    NG_MOCKS_URL,
    PLUGIN_NAME,
    HTTP_METHODS;


defaults = {
  ngversion: '1.4.8',
  method: 'GET',
  status: 200
};

NG_MOCKS_URL = '//cdnjs.cloudflare.com/ajax/libs/angular.js/{{version}}/angular-mocks.js';

PLUGIN_NAME = 'gulp-ng-fixtures';

HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'HEAD'
];

readFile = Rx.Observable.fromNodeCallback(fs.readFile);


module.exports = function(opts) {
  var options = merge_options(defaults, opts);

  if (typeof opts === 'string') {
    var appModule = opts;
    return removeFixtures(appModule);
  }

  return addFixtures(options);
};


function addFixtures(opts) {
  var fixturesStream,
      readTplStream;

  if (!opts.appModule) {
    throw new PluginError(PLUGIN_NAME, 'appModule option is required');
  }

  if (!opts.fixtures || opts.fixtures.length === 0) {
    throw new PluginError(PLUGIN_NAME, 'fixtures options is required');
  }

  fixturesStream = readFixtures(opts.fixtures);
  readTplStream  = readFile(__dirname + '/template.html');

  return through.obj(function(file, encoding, callback) {
    var self = this;

    gutil.log(magenta(PLUGIN_NAME), 'adding ' + cyan(opts.fixtures.length) + ' fixtures to ' + cyan(file.relative));

    if (file.isStream()) {
      self.emit('error', new PluginError(PLUGIN_NAME,  'Streaming not supported'));
      callback();
      return;
    }

    var stream = fixturesStream
      .concat(readTplStream)
      .concat(removeAppFromIndex(file, opts.appModule))
      .toArray()
      .catch(onStreamError.bind(self));

    stream.subscribe(function(results) {
      var contents = parseIndexFile(results, opts);
      file.contents = new Buffer(contents);
      callback(null, file);
    });
  });
}

function onStreamError(err) {
  if (err.code === 'ENOENT') {
    this.emit('error', new PluginError(PLUGIN_NAME, 'unable to read json file ("'+ err.path +'")!'));
  }
  return err;
}


function removeFixtures(appModule) {
  return through.obj(function(file, encoding, callback) {
    var contents = file.contents.toString();

    gutil.log(magenta(PLUGIN_NAME), 'removing fixtures from ' + cyan(file.relative));

    contents = contents.replace(/^<!-- ng:fixtures -->(.|[\r\n])*<!-- endfixtures -->$/gmi, '');
    contents = contents.replace('data-ng-fixtures="'+ appModule +'"', 'ng-app="'+ appModule +'"');

    file.contents = new Buffer(contents);
    callback(null, file);
  });
}



function parseIndexFile(results, opts) {
  var fixtures    = results[0],
      template    = results[1],
      indexFile   = results[2],
      scriptsTpl,
      hbOptions;

  hbOptions = {
    appmodule:    opts.appModule,
    angularmocks: NG_MOCKS_URL.replace('{{version}}', opts.ngversion),
    fixtures:     fixtures
  };

  // render scripts template inserting fixture data
  scriptsTpl = handlebars.compile(template.toString());
  scriptsTpl = scriptsTpl(hbOptions);

  // insert scripts template into bottom of index.html
  return insertTemplate(indexFile, scriptsTpl);
}

function removeAppFromIndex(file, appModule) {
  return Rx.Observable.just(file)
    .pluck('contents')
    .map(function(contents) {
      contents = contents.toString();
      return removeNgApp(contents, appModule);
    });
}

function readFixtures(fixtures) {
  var fixturesStream,
      jsonFixtures,
      jsonReadFixtures,
      jsonCombined,
      otherFixtures;

  fixturesStream = Rx.Observable.from(fixtures)
    .map(function(fixture) {
      fixture.method = parseHttpMethod(fixture.method);
      fixture.status = fixture.status || defaults.status;
      return fixture;
    });

  // filter out fixtures that are json files
  jsonFixtures = fixturesStream
    .filter(function(fixture) {
      return isJsonPath(fixture.res);
    });

  // for each json fixture read file data
  jsonReadFixtures = jsonFixtures
    .concatMap(function(fixture) {
      return readFile(fixture.res);
    })
    .map(function(data, idx, obs) {
      return data.toString();
    });

  // set each fixture.res equal to the json data returned from readfile
  jsonCombined = jsonFixtures.zip(jsonReadFixtures, function(fixture, data) {
    fixture.res = data;
    return fixture;
  });

  // gather non-json fixture response types
  otherFixtures = fixturesStream
    .filter(function(fixture) {
      return !isJsonPath(fixture.res);
    });

  // combine json and non-json fixtures
  return jsonCombined.merge(otherFixtures).toArray();
}

function removeNgApp(html, appModule) {
  return html.replace('ng-app="'+ appModule +'"', 'data-ng-fixtures="'+ appModule +'"');
}

function insertTemplate(html, tpl) {
  var tpl = tpl + '</body>';
  return html.replace('</body>', tpl);
}

function isJsonPath(value) {
  if ((typeof value === 'string') === false) { return false; }
  return (value.indexOf('.json') >= 0);
}

function parseHttpMethod(value) {
  var method = defaults.method;

  if (value === undefined) { return method; }

  HTTP_METHODS.some(function(verb) {
    if (verb === value.toString().toUpperCase()) {
      method = verb;
      return true;
    }
  });

  return method;
}

function merge_options(obj1, obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

handlebars.registerHelper('parseReq', function(context) {
    if (context instanceof RegExp) { return context; }
    return '"' + context + '"';
});

