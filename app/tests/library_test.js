require('#{APPNAME}/library');

module("library");

test("CouchDBAdapter is defined",
function() {
  ok(CouchDBAdapter !== undefined, "CouchDBAdapter is undefined");
});
