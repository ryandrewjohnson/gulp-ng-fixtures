'use strict';

var should      = require('chai').should();
var gutil       = require('gulp-util');
var PluginError = gutil.PluginError;
var ngFixtures  = require('../');
var fs          = require('fs');
var File        = require('gulp-util').File;
var gulp        = require('gulp');
var assert      = require('stream-assert');
var dummyJson   = require('../test/fixtures/dummy.json');

describe('gulp-ng-fixtures', function() {
  var paths,
      options,
      mockFixtures;

  paths = {
    inputHtml: 'test/fixtures/input.html',
    outputHtml: 'test/fixtures/output.html'
  };

  options = {
    appModule: 'myapp',
    fixtures: []
  };

  mockFixtures = [
    {
      req: '/api/call/fake',
      res: 'success',
      method: 'post'
    },
    {
      req: /\/api\/call\/fake/,
      method: 'put',
      res: {test: 'this'}
    },
    {
      req: '/api/call/fake/200',
      status: 401,
      res: 200
    },
    {
      req: '/api/tester'
    },
    {
      req: 'test/json/response',
      res: 'test/fixtures/dummy.json'
    }
  ];

  beforeEach(function() {
  });

  it('should throw error missing appModule option', function() {
    (function() {
      ngFixtures({});
    })
    .should.throw(/appModule option is required/);
  });

  it('should throw error missing fixtures option', function() {
    (function() {
      ngFixtures(options);
    })
    .should.throw(/fixtures options is required/);
  });

  it('should remove ng-app attribute and replace with custom attr', function(done) {
    options.fixtures = mockFixtures;

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.not.match(/ng-app="myapp"/);
      d.contents.toString().should.match(/data-ng-fixtures="myapp"/);
    }))
    .pipe(assert.end(done));
  });

  it('should insert default ngMocks script tag', function(done) {
    options.fixtures = mockFixtures;

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.match(/<script src="\/\/cdnjs.cloudflare.com\/ajax\/libs\/angular.js\/1.4.8\/angular-mocks.js">/);
    }))
    .pipe(assert.end(done));
  });

  it('should override default ngMocks script tag', function(done) {
    options.fixtures = mockFixtures;
    options.ngversion = '1.5.0';

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.match(/<script src="\/\/cdnjs.cloudflare.com\/ajax\/libs\/angular.js\/1.5.0\/angular-mocks.js">/);
    }))
    .pipe(assert.end(done));
  });

  it('should add fixtures js before <body> tag', function(done) {
    options.fixtures = mockFixtures;

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.match(/<!-- ng:fixtures -->(.|\n)*<!-- endfixtures -->\n<\/body>/gmi);
      d.contents.toString().should.match(/module\('fixtures\.app', \['myapp', 'fixtures\.service'\]\)/);
    }))
    .pipe(assert.end(done));
  });

  it('should add $httpBackend call for each fixture item', function(done) {
    var pattern = getFixtureRegex(mockFixtures);

    options.fixtures = mockFixtures;

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.match(new RegExp(pattern, 'gmi'));
    }))
    .pipe(assert.end(done));
  });

  it('should remove custom attr and replace with original ng-app attribute', function(done) {
    gulp.src(paths.outputHtml)
    .pipe(ngFixtures('myapp'))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.match(/ng-app="myapp"/);
      d.contents.toString().should.not.match(/data-ng-fixtures="myapp"/);
    }))
    .pipe(assert.end(done));
  });

  it('should remove fixtures js before <body> tag', function(done) {
    gulp.src(paths.outputHtml)
    .pipe(ngFixtures('myapp'))
    .pipe(assert.first(function(d) {
      d.contents.toString().should.not.match(/<!-- ng:fixtures -->(.|\n)*<!-- endfixtures -->\n<\/body>/gmi);
      d.contents.toString().should.not.match(/module\('fixtures\.app', \['myapp', 'fixtures\.service'\]\)/);
    }))
    .pipe(assert.end(done));
  });

  it('should throw error on bad json file', function(done) {
    options.fixtures = [{
      req: '/fake/url',
      res: 'bad.json'
    }];

    gulp.src(paths.inputHtml)
    .pipe(ngFixtures(options))
    .on('error', function(err) {
      err.message.should.match(/unable to read json file/);
      done();
    });
  });

  it('should emit error on streamed file', function (done) {
    options.fixtures = mockFixtures;

    gulp.src(paths.inputHtml, { buffer: false })
      .pipe(ngFixtures(options))
      .on('error', function (err) {
        err.message.should.match(/Streaming not supported/);
        done();
      });
  });

});

function getFixtureRegex(fixtures) {
  var tmpl1 = '$httpBackend.when("{method}", {url}).respond({status}, {res});';
  var tmpl2 = '$httpBackend.whenGET({url}).passThrough();';
  var match = '';


  fixtures.forEach(function(item) {
    var req = typeof item.req === 'string' ? '"' + item.req + '"' : item.req;
    var result = '';

    item.method = item.method || 'get';
    item.status = item.status || 200;


    if (item.res) {
      var res = (typeof item.res === 'string' && item.res.indexOf('.json') >= 0) ?
        formatJson(JSON.stringify(dummyJson)) :
        JSON.stringify(item.res);

      result += tmpl1.replace(/\{url\}/, req)
                    .replace(/\{method\}/, item.method)
                    .replace(/\{status\}/, item.status)
                    .replace(/\{res\}/, res);
    }
    else {
      result += tmpl2.replace(/\{url\}/, req);
    }

    match += escapeRegExp(result) + '(.|[\\r\\n])*';
  });


  return match;
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function formatJson(str) {
  return '"' + str.replace(/["]/g, '\\"') + '"';
}




