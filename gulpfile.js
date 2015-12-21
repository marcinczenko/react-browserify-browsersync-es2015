var source = require('vinyl-source-stream');
var gulp = require('gulp');
var gutil = require('gulp-util');
var browserify = require('browserify');
var babelify = require('babelify');
var watchify = require('watchify');
var mold = require('mold-source-map');
var exorcist = require('exorcist');

var browserSync = require('browser-sync').create();
var historyApiFallback = require('connect-history-api-fallback')

watchify.args.debug = true;
var bundler = watchify(browserify('app/js/app.js', {
  cache: {},
  packageCache: {},
  debug: true
}));

bundler.transform(babelify.configure({presets: ["es2015", "react"]}));

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
