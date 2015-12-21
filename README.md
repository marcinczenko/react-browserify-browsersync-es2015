# react-browserify-browsersync-es2015

This is a very simple starter project for working with React, Browserify, and BrowserSync using ES2015 profile.
It also includes some basic documentation on how the gulp file, and provides some reasoning why some of the packages
are being used.

It expects the Google Chrome browser to be installed and was tested with Node version 5.3.0.

## Installing modules

Just issue:

    npm install

You may also want to install gulp globally:

    npm install gulp --global

## Running

Just run:

    gulp

It will automatically open the browser (Google Chrome) and it will automatically reload the contents every time you change
any thing in the source files.

## Build System

We use gulp for build orchestration and we use browserify to create a single file Javascript bundle. The following sections
provide more detailed description.

### Creating the bundle

This starter project creates a single Javascript file that contains all the required Javascript code, potentially minified.
To make this happen we use [browserify]. Browserify takes the list of your Javascript files and outputs a single file, 
which can be additionally uglified/minified using additional plugins. When creating this single output file it inspects which
other Javascript modules are required by the provided input files. 

In the heart of the browserify API is the `browserify` function that takes two arguments: list of files
that should be processed, and an object with options. Both arguments are optional: the list of files can also be provided 
through the `options` argument or through the `add(file, opts)` function. For instance, in order to create a bundler instance for
a single input file, `app/js/app.js`, we can do:

    var browserify = require('browserify');
    var bundler = browserify('app/js/app.js');
    
We could also write:

    var browserify = require('browserify');
    var bundler = browserify();
    bundler.add('app/js/app.js');

or:

    var browserify = require('browserify');
    var bundler = browserify({
        entries: ['app/js/app'],
        extensions: ['.js', '.es6.js', '.jsx'],
        debug: true
    });
 
In this last time, we demonstrate how one can specify supported extensions through `extensions` option - this is handy,
you can specify the extensions directly through the `entries` parameter. We also can specify if we want browserify to include
source maps in the build stream (we will take advantage of it later).

Once we have the browserify object, we can apply transformations. In our case, we need to _babelify_ the output of the
result of basic bundling as we want to take advantage of the new ES2015 Javascript specification. We simply plug the
babel transformation using the browserify `transform` function:

    bundler.transform(babelify.configure({presets: ["es2015", "react"]}));
    
> Babel is not the only choice of _transpilers_ that can transform es2015 into regular ES5, 
but babel also supports JSX which we take advantage of when working with React. Read more in [Tooling Integration].
For more information about using babel browserify transform, consult [babelify].

Having the browserify instance configured, we can start the actual bundling by calling the `bundle` function on the 
browserify instance:

    bundler.bundle();
    
`bundler.bundle()` returns a standard Node readable stream, which means we conveniently connect other useful gulp plugins:

    bundler.bundle()
        .on('error', function(err) {
          gutil.log(err.message);
          browserSync.notify('Browserify error!');
          this.emit('end');
        })
        .pipe(mold.transformSourcesRelativeTo('app/js'))
        .pipe(exorcist('dist/js/bundle.js.map'))
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('dist/js'));

Here, we use [mold-source-map], to adjust the base directory used in the source maps, [exorcist] to put the source maps
in a separate file `bundle.js.map`, and [vinyl-source-stream] to associate a file name with the readable stream containing
the transformed Javascript. Finally, we write the output to `dist/js`.

### BrowserSync

[BrowserSync] is a great utility that allows you reload the browser contents everytime something changes in your source code.
It is replaces the well-known (although I've never used it) [live-reload]. BrowserSync is very easy to use with gulp. There are
just a couple of simple things you should know to get started.

The most natural way to _inject_ the changes into the browser, is to add one more element to our gulp stream transformation
chain: `.pipe(browserSync.stream({once: true}))` The `once: true` options assures that reload will happen at most once
per stream. Out complete chain, wrapped as a gulp task, would look like this:

    gulp.task('bundle', function() {
        bundler.bundle()
            .on('error', function(err) {
              gutil.log(err.message);
              browserSync.notify('Browserify error!');
              this.emit('end');
            })
            .pipe(mold.transformSourcesRelativeTo('app/js'))
            .pipe(exorcist('dist/js/bundle.js.map'))
            .pipe(source('bundle.js'))
            .pipe(gulp.dest('dist/js'))
            .pipe(browserSync.stream({once: true}));
    });

Then in our `default` task we can initialize BrowserSync and make sure that the actual transformation is run as
a dependency:

    gulp.task('default', ['bundle'], function() {
      browserSync.init({
        server: 'dist',
        middleware : [ historyApiFallback() ],
        ghostMode: false,
        browser: "google chrome"
      });
    });

The `historyApiFallback` middleware ([connect-history-api-fallback]) is an add-on to the History API that we will use in
React to support browser history. [connect-history-api-fallback] will allow the user to enter a direct link to a page other
than the landing page (index.html), e.g. `/help` or `/help/online`.
    
Of course, we still need to make sure that bundle gets recreated when any of our source Javascript file change. We can use
the [watchify] plugin which is specially made to watch browserify builds. It is as easy as wrapping the call to `browserify`
within `watchify`:

    var bundler = watchify(browserify('app/js/app.js', {
      cache: {},
      packageCache: {},
      debug: true
    }));

The documentation of `watchify` says we should set the `cache` and `packageCache` properties. `bundler` continues to behave 
like a browserify instance except that it caches file contents and emits an `update` event when a file changes:
 
    bundler.on('update', bundle);
    
    function bundle() {
      gutil.log('Compiling JS...');
    
      return bundler.bundle()
        .on('error', function(err) {
          gutil.log(err.message);
          browserSync.notify('Browserify error!');
          this.emit('end');
        })
        .pipe(mold.transformSourcesRelativeTo('app/js'))
        .pipe(exorcist('dist/js/bundle.js.map'))
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('dist/js'))
        .pipe(browserSync.stream({once: true}));
    }
    
    gulp.task('bundle', function() {
      return bundle();
    });

We extracted the body of the `bundle` gulp task into a function so that it can also be registered for the `update` event.

### index.html

For watching changes in the `index.html` we use a standard gulp watch functionality and define a separate gulp task:

    gulp.task('html', function() {
      "use strict";
      return gulp.src('app/index.html')
        .pipe(gulp.dest('dist'))
        .pipe(browserSync.stream());
    });

    gulp.task('default', ['bundle', 'html'], function() {
      gulp.watch('app/index.html', ['html']);
      browserSync.init({
        server: 'dist',
        middleware : [ historyApiFallback() ],
        ghostMode: false,
        browser: "google chrome"
      });
    });

This gives us a working environment for basic React-based apps.

[browserify]: http://browserify.org
[Tooling Integration]: https://facebook.github.io/react/docs/tooling-integration.html
[babelify]: https://github.com/babel/babelify
[mold-source-map]: https://github.com/thlorenz/mold-source-map
[exorcist]: https://github.com/thlorenz/exorcist
[vinyl-source-stream]: https://github.com/hughsk/vinyl-source-stream
[BrowserSync]: https://www.browsersync.io
[live-reload]: http://livereload.com
[watchify]: https://github.com/substack/watchify
[connect-history-api-fallback]: https://github.com/bripkens/connect-history-api-fallback
