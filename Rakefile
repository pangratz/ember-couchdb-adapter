APPNAME = 'ember_couchdb_adapter'

require 'colored'
require 'rake-pipeline'

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

def setup_uploader(root=Dir.pwd)
  require './lib/github_uploader'

  login = origin = nil

  Dir.chdir(root) do
    # get the github user name
    login = `git config github.user`.chomp

    # get repo from git config's origin url
    origin = `git config remote.origin.url`.chomp # url to origin
    # extract USERNAME/REPO_NAME
    # sample urls: https://github.com/emberjs/ember.js.git
    #              git://github.com/emberjs/ember.js.git
    #              git@github.com:emberjs/ember.js.git
    #              git@github.com:emberjs/ember.js
  end

  repoUrl = origin.match(/github\.com[\/:]((.+?)\/(.+?))(\.git)?$/)
  username = repoUrl[2] # username part of origin url
  repo = repoUrl[3] # repository name part of origin url

  token = ENV["GH_OAUTH_TOKEN"]
  uploader = GithubUploader.new(login, username, repo, token)
  uploader.authorize

  uploader
end

def upload_file(uploader, filename, description, file)
  print "Uploading #{filename}..."
  if uploader.upload_file(filename, description, file)
    puts "Success"
  else
    puts "Failure"
  end
end

desc "Upload latest build of #{APPNAME} to GitHub repository"
task :upload_latest do
  uploader = setup_uploader

  upload_file(uploader, "#{APPNAME}-latest.js", "#{APPNAME} Master", "app/lib/#{APPNAME}.js")
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
