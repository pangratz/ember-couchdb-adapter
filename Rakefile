APPNAME = 'ember-couchdb-adapter'

require 'colored'
require 'rake-pipeline'
require 'github_downloads'

desc "Run tests with PhantomJS"
task :test do
  unless system("which phantomjs > /dev/null 2>&1")
    abort "PhantomJS is not installed. Download from http://phantomjs.org/"
  end

  cmd = "phantomjs tests/qunit/run-qunit.js \"file://#{File.dirname(__FILE__)}/tests/index.html\""

  # Run the tests
  puts "Running #{APPNAME} tests"
  success = system(cmd)

  if success
    puts "Tests Passed".green
  else
    puts "Tests Failed".red
    exit(-1)
  end
end

desc "Automatically run tests (Mac OS X only)"
task :autotest do
  system("kicker -e 'rake test' library")
end

desc "Upload latest build of #{APPNAME} to GitHub repository"
task :upload_latest do
  uploader = GithubDownloads::Uploader.new
  uploader.authorize

  uploader.upload_file("#{APPNAME}-latest.js", "#{APPNAME} Master", "library/couchdb_adapter.js")
end

namespace :upgrade do
  task :data do
    ref = ENV["REF"] || "master"
    FileUtils.rm_rf "tmp/data"
    `git clone https://github.com/emberjs/data tmp/data`
    Dir.chdir("tmp/data") do
      `git checkout #{ref}`
      `bundle install`
      `bundle exec rake dist`
    end
    FileUtils.copy "tmp/data/dist/ember-data.js", "library/vendor/ember-data.js"
    FileUtils.copy "tmp/data/packages/ember/lib/main.js", "library/vendor/ember.js"
    FileUtils.rm_rf "tmp/data"
  end

  task :qunit do
    FileUtils.rm_rf "tmp/qunit"
    `git clone https://github.com/jquery/qunit tmp/qunit`
    Dir.chdir("tmp/qunit") do
      latest_tag = `git describe --abbrev=0 --tags`
      system "git checkout #{latest_tag}"
    end
    FileUtils.cp_r "tmp/qunit/qunit/.", "tests/qunit"
    FileUtils.rm_rf "tmp/qunit"
  end

  task :all => [:data, :qunit]
end
