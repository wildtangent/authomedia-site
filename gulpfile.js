'use strict'

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var awspublishRouter = require("gulp-awspublish-router");
var cloudfront = require('gulp-cloudfront-invalidate-aws-publish');
var args = require('yargs').argv;
var gutil = require('gulp-util');
var parallelize = require("concurrent-transform");

var config = {
  isDevelopment: true,
  site: args.site,
  cacheTime: 300,
  sites: {
    authomedia: {
      bucket: 'authomedia.co.uk',
      url: 'https://authomedia.co.uk',
      accessKeyId: 'AKIAJJ6YX25PCBNFOSOQ',
      secretAccessKey: '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',
      region: 'eu-west-1',
      distribution: 'EG6TZMSV5581T'
    }
  }
}

gulp.task('server', function() {
  gulp.src('./src')
  .pipe(plugins.serverLivereload({
    host: "0.0.0.0",
    port: 3000,
    livereload: true
  }));
});

gulp.task('publish', function() {
  var site = config.sites[config.site];

  console.log(site.bucket);
  console.log(site.accessKeyId);
  console.log(site.secretAccessKey);

  gutil.log("--- Copying " + config.site + " to production ---");
  plugins.notify("--- Copying " + config.site + " to production ---");

  var publisher = plugins.awspublish.create({
    params: {
      Bucket: site.bucket
    },
    accessKeyId: site.accessKeyId,
    secretAccessKey: site.secretAccessKey,
    region: site.region
  });

  var cloudfrontSettings = {
    distribution: site.distribution,
    accessKeyId: site.accessKeyId,
    secretAccessKey: site.secretAccessKey,
    wait: false
  };

  return gulp.src("./src/**").pipe(awspublishRouter({
    cache: {
      cacheTime: config.cacheTime
    },
    routes: {
      "^(css|js|fonts|img)/(?:.+)\\.(?:js|css|gif|jpg|png|svg|woff|woff2|ttf|eot)$": {
        gzip: true,
        cacheTime: config.cacheTime
      },
      "^.+\\.html": {
        gzip: true
      },
      "^README$": {
        headers: {
          "Content-Type": "text/plain"
        }
      },
      "^.+$": "$&"
    }
  }))
  .pipe(publisher.cache())
  .pipe(parallelize(publisher.publish(), 50))
  .pipe(publisher.sync())
  .pipe(plugins.awspublish.reporter())
  .pipe(cloudfront(cloudfrontSettings))
  .on("error", function(err) {
    return console.error(err);
  });
});

// Clean, build, watch folders and start dev server
gulp.task('default', function() {
  plugins.runSequence('server');
});

gulp.task('deploy', function() {
  config.isDevelopment = false;
  if (config.site !== undefined) {
    return plugins.runSequence('publish');
  } else {
    return gutil.log("Error: No site defined, ie. gulp deploy --site [authomedia]");
  }
});