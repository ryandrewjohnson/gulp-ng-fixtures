/**
 * What I need to know from the user:
 * - the index.html file for app
 * - the main app module name
 * - a config with http req and res data
 *
 * What I need to output?
 * - a script tag with angular mocks and the new module
 * - generating angular service and injecting it
 *
 * TODO:
 * - add gulp logging and error handling
 * - throw error if isStream
 * - add error handling for if JSON file not found
 * - move to isolated project and rename everything - DONE
 * - add comments
 * - write tests - WIP
 */

'use strict';

var fs          = require('fs');
var through     = require('through2');
var gutil       = require('gulp-util');
var PluginError = gutil.PluginError;
var Rx          = require('rx');
var handlebars  = require('handlebars');

var defaults,
    readFile,
    HTTP_METHODS;

defaults = {
  angularMocksUrl: '//cdnjs.cloudflare.com/ajax/libs/angular.js/1.5.0-beta.2/angular-mocks.js',
  method: 'get',
  status: 200
};

HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'head'
];

readFile = Rx.Observable.fromNodeCallback(fs.readFile);

/*
var opts = {
  appModule: '',
  fixtures: [
    {
      req: '',
      res: 'either a path or object',
      statusCode: '',
      method: 'get,post,etc..'
    }
  ],
  ignore: [
    ''
  ]
};
*/


module.exports = function(opts) {
  var options = merge_options(defaults, opts);

  if (typeof opts === 'string') {
    return removeFixtures(opts);
  }

  return addFixtures(options);
};


function addFixtures(opts) {
  var fixturesStream,
      readTplStream;

  if (!opts.appModule) {
    throw new PluginError('gulp-ng-fixtures', 'appModule option is required');
  }

  gutil.log('Add fixtures for app module', gutil.colors.magenta(opts.appModule));

  fixturesStream = readFixtures(opts.fixtures);
  readTplStream  = readFile('./template.html');

  return through.obj(function(file, encoding, callback) {
    var stream = fixturesStream
      .concat(readTplStream)
      .concat(removeAppFromIndex(file, opts.appModule))
      .toArray();

    stream.subscribe(function(results) {
      var contents = parseIndexFile(results, opts);
      file.contents = new Buffer(contents);
      callback(null, file);
    });
  });
}


function removeFixtures(appModule) {
  gutil.log('Remove fixtures for app module', gutil.colors.magenta(appModule));

  return through.obj(function(file, encoding, callback) {
    var contents = file.contents.toString();

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
    angularmocks: opts.angularMocksUrl,
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
    .flatMap(function(fixture) {
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
    if (verb === value.toString().toLowerCase()) {
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

