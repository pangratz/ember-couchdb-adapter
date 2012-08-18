CouchDBAdapter for ember data
=============================

CouchDBAdapter for [Ember Data](https://github.com/emberjs/data). This adapter communicates with a CouchDB backend as specified in http://wiki.apache.org/couchdb/HTTP_Document_API. It currently offers support for the basic operations to create, update and delete a record. `find` and `findMany` are also implemented out of the box. To make `findAll` working, you need to add a view named `by-ember-type` in your design document, which' `map` function should look like this:

``` javascript
function(doc) {
  emit(doc.ember_type);
}
```

where the `ember_type` property represents the type of entity for the specific document.

Because CouchDB expects the revision of a document to be submitted on every update of a document, it needs to be specified on every model. There is a mixin `CouchDBModel` for that:

``` javascript
App.MyModel = DS.Model(CouchDBModel, {
  name: DS.attr('string')
});
```

This will add a property `rev` of type `string` to the `App.MyModel` definition.

Now you're setup to use the CouchDBAdapter in your Ember.js application:

``` javascript
App = Ember.Application.create();
App.Store = DS.Store.create({
  adapter: DS.CouchDBAdapter.create({
    db: 'db-name',
    designDoc: 'app'
  }),
  revision: 4
});
```

You have to specify the name of the database with the `db` property - and if you want to use `findAll`, you'll have to set the name of the design document with the `designDoc` property.


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

    $ open http://localhost:9292/tests/index.html && bundle exec rackup

or

    $ bundle exec rake autotest # if you're on a Mac

Upload latest version to GitHub
-------------------------------

Invoke `rake upload_latest` to upload the latest version to GitHub Downloads.

-----------------------------------------------

This library is based on the [ember-library-template](https://github.com/pangratz/ember-library-template).