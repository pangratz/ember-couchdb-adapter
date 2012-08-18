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
  def download_ember(repo_name, source = repo_name, target = repo_name)
    FileUtils.rm_rf "tmp/#{repo_name}"
    `git clone https://github.com/emberjs/#{repo_name} tmp/#{repo_name}`
    Dir.chdir("tmp/#{repo_name}") do
      `bundle install`
      `rake dist`
    end
    FileUtils.copy "tmp/#{repo_name}/dist/#{source}", "library/vendor/#{target}"
    FileUtils.rm_rf "tmp/#{repo_name}"
  end
  
  task :ember do
    download_ember("ember.js")
  end

  task :data do
    download_ember("data", "ember-data.js", "ember-data.js")
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

  task :all => [:ember, :data, :qunit]
end
