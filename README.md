CouchDBAdapter for ember data
=============================

CouchDBAdapter for [Ember Data](https://github.com/emberjs/data). This adapter communicates with a CouchDB backend as specified in http://wiki.apache.org/couchdb/HTTP_Document_API. It currently offers support for the basic operations to create, update and delete a record. `findMany` and `findAll` are also implemented. So the latter can work, you need to add a view named `by-ember-type` in your design document. The views' `map` function should look like this:

``` javascript
function(doc) {
  emit(doc.ember_type);
}
```

where the `ember_type` property represents the type of entity for the specific document.

Because CouchDB expects the revision of a document to be submitted on every update of a document, it needs to be specified on every model. There is a mixin `CouchDBModel` for that:

    App.MyModel = DS.Model(CouchDBModel, {
      name: DS.attr('string)
    });

This will add a property `rev` of type `string` to the `App.MyModel` definition.


Get started
-----------

    $ git clone git@github.com:pangratz/ember-couchdb-adapter.git
    $ cd ember-couchdb-adapter
    $ bundle install

Now the project is initialized.

Run the tests
-------------

    $ bundle exec rake test

or

    $ bundle exec rackup && open http://localhost:9292/tests/index.html

or

    $ bundle exec rake autotest # if you're on a Mac

Upload latest version to GitHub
-------------------------------

Invoke `rake upload_latest` to upload the latest version to GitHub Downloads.

-----------------------------------------------

This library is based on the [ember-library-template](https://github.com/pangratz/ember-library-template).