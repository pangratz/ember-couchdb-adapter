require('#{APPNAME}/core');
require('#{APPNAME}/couchdb_adapter');

Ember.View.create({
  templateName: '#{APPNAME}/~templates/main_page'
}).append();