# gulp-ng-fixtures

[![npm version](https://badge.fury.io/js/gulp-ng-fixtures.svg)](https://badge.fury.io/js/gulp-ng-fixtures)
[![Dependency Status](https://www.versioneye.com/user/projects/56992b57af789b0043001517/badge.svg?style=flat)](https://www.versioneye.com/user/projects/56992b57af789b0043001517)

> Run your AngularJS app using mock data in place of your back-end

Avoid monkey patching your AngularJS app when back-end services are unavailble or down. With `gulp-ng-fixtures` you can easily serve a version of your app that uses mock data in place of your back-end.



## Installation

Install `gulp-ng-fixtures` as a development dependency:

```shell
npm install --save-dev gulp-ng-fixtures
```



## Usage

### Minimal example: in your `Gulpfile.js`:

> Note: The html file passed to `gulp.src` must contain the `ng-app` directive for your AngularJS app.

```javascript
var ngFixtures = require('gulp-ng-fixtures');

gulp.src('app/index.html')
  .pipe(ngFixtures({
    appModule: 'myapp',
    fixtures: [
      {
        req: '/users/ryandrewjohnson',
        res: { name: 'Ryan Johnson', email: 'myemail@email.com' }
      },
      {
        req: /views\/*.html/
      }
    ]
  })
  .pipe(gulp.dest('.tmp/serve'));
```


### Creating your [fixtures](#optionsfixtures)

Because the plugin uses Angular's [$httpBackend](https://code.angularjs.org/1.4.8/docs/api/ngMock/service/$httpBackend) service **all** http requests will be captured by default. This means you are responsible for capturing and providing a response for each of these requests. Failure to do so will result in an error like `Error: Unexpected request: GET views/main.html`.

Having to create a [fixture](#fixture-object) for each and every http request would be cumbersome. Good news is this is not necessary and quite easy to avoid.

###### Example targeting single http request

By using regex we can target all requests with a single pattern `/*./` and then omit the `res` property to have the request [passThrough](https://docs.angularjs.org/api/ngMockE2E/service/$httpBackend).

> Note: Order of fixtures is important. Any "catch all" fixtures should go at the end of the array.

```javascript
ngFixtures({
  appModule: 'myapp',
  fixtures: [
    {
      req: '/users/ryandrewjohnson',
      res: { name: 'Ryan Johnson', email: 'myemail@email.com' }
    },
    {
      req: /*./
    }
  ]
})
```


### Removing fixtures
It is recommended that you set your `gulp.dest` to be different than your `gulp.src` since `ngFixtures` injects JS into the outputted html file that should not be considered permenant.

```javascript
/* avoid */
gulp.src('app/index.html')
  .pipe(ngFixtures({
    ...
  })
  .pipe(gulp.dest('app'));

/* recommended */
gulp.src('app/index.html')
  .pipe(ngFixtures({
    ...
  })
  .pipe(gulp.dest('.tmp/serve'));
```

If you are unable to follow the recommended example `ngFixtures` does have an **undo** option that will remove all the changes made to the outputted html file. Instead of passing an options object to `ngFixtures` you just pass in the `appModule` name.

###### Example removing fixtures

```javascript
/* add fixtures */
gulp.src('app/index.html')
  .pipe(ngFixtures({
    appModule: 'myapp'
    ...
  })
  .pipe(gulp.dest('app'));

/* remove fixtures */
gulp.src('app/index.html')
  .pipe(ngFixtures('myapp')
  .pipe(gulp.dest('app'));
```



## Options

### ngFixtures(options)

### options.appModule

Type: `string` required

The name of your AngularJS app module which can be found in the `ng-app` directive of your main html file.


### options.fixtures

Type: `array` required

An array of [fixture](#fixture-object) object's where each object represents a http request you want to intercept.

###### Example fixtures array:
```javascript
[
  {
    req: '/users/ryandrewjohnson',
    res: { name: 'Ryan Johnson', email: 'myemail@email.com' }
  },
  {
    req: '/user/issues',
    res: '/app/fixtures/issues.json',
    method: 'POST',
    status: 200
  },
  {
    req: /views\/*.html/
  }
]
```

### options.ngversion

Type: `string`
Default: `'1.4.8'`

The AngularJS version your app is using. The plugin loads `angular-mocks.js` from [cdnjs.com](https://cdnjs.com/) and requires the version number to load the correct file. Example of cdnjs url `//cdnjs.cloudflare.com/ajax/libs/angular.js/{{version}}/angular-mocks.js` where `{{version}}` will be replaced with `options.ngversion`.


### ngFixtures(appModule)
This syntax is used to [remove fixtures](#example-removing-fixtures) that were added to an html file by ngFixtures.

### appModule

Type: `string` required

The name of your AngularJS app module.



## Fixture Object

```javascript
{
  req: '/users/ryandrewjohnson',
  res: { name: 'Ryan Johnson', email: 'myemail@email.com' },
  method: 'POST',
  status: 200
}
```

### req

Type: (`string`|`RegExp`) required

Will match the http request you are trying to intercept. If you pass in a `string` it will try to match the url exactly, where if you use a regular expression it will intercept all url's that match the pattern.


### res

Type: `any`
Default: `null`

The mock data you want the request to return.

###### Simple responses:
```javascript
{ req: ..., res: 'success' }
{ req: ..., res: 500 }
{ req: ..., ['apples', 'oranges', 'pears'] }
{ req: ..., { name: 'testy', email: 'myemail@email.com' } }
```

###### Complex responses:
For large data responses e.g. (20 user objects) you can move this data into an external `.json` file. Then provide the relative path to the file as the value for `res`. The json file will be parsed and returned as the response for the request. If you have existing json fixtures for your unit tests you can reuse them here.

> The following assumes a `users.json` file exists in a folder called fixtures in the project root.

```javascript
{
  req: 'get/users',
  res: 'fixtures/users.json'
}
```

###### PassThrough responses:
If you don't want to return any data omit the `res` property from your [fixture](#fixture-object) object.

```javascript
{
  req: /views\/*.html/
}
```


### method

Type: `string`
Default: `GET`

The http method for your request. Valid values include `GET, POST, PUT, DELETE, HEAD`.


### status

Type: `number`
Default: `200`

The http status code for your request. Valid values include `200, 400, 401` etc..



## Gotchas

* Your AngularJS app must have a main html file with an `ng-app` directive.
* Only tested in Angular 1.x





