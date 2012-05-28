require('#{APPNAME}/library');

module("library");

test("Library is defined", function () {
  ok(Library !== undefined, "Library is undefined");
});
