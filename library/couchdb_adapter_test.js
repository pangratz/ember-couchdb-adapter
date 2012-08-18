Ember.ENV.TESTING = true;

var get = Ember.get;
var set = Ember.set;

var adapter;
var store;
var ajaxUrl;
var ajaxType;
var ajaxHash;

var person;
var Person;

var createdPerson, updatedPerson, deletedPerson;

var expectUrl = function(url, desc) {
  equal(ajaxUrl, url, "the URL is " + desc);
};

var expectType = function(type) {
  equal(type, ajaxType, "the HTTP method is " + type);
};

var expectData = function(hash) {
  deepEqual(hash, ajaxHash.data, "the hash was passed along");
};

var expectState = function(state, value, p) {
  p = p || person;

  if (value === undefined) {
    value = true;
  }

  var flag = "is" + state.charAt(0).toUpperCase() + state.substr(1);
  equal(get(p, flag), value, "the person is " + (value === false ? "not ": "") + state);
};

module("CouchDBAdapter", {
  setup: function() {
    adapter = DS.CouchDBAdapter.create({
      db: 'DB_NAME',
      designDoc: 'DESIGN_DOC',
      _ajax: function(url, type, hash) {
        var success = hash.success,
        self = this;

        ajaxUrl = url;
        ajaxType = type;
        ajaxHash = hash;

        if (success) {
          hash.success = function(json) {
            success.call(self, json);
          };
        }
      }
    });

    store = DS.Store.create({
      adapter: adapter
    });

    Person = DS.Model.extend({
      name: DS.attr('string'),
      rev: DS.attr('string')
    });
  },

  teardown: function() {
    adapter.destroy();
    store.destroy();
  }
});

test("is defined", function() {
  ok(DS.CouchDBAdapter !== undefined, "DS.CouchDBAdapter is undefined");
});

test("is a subclass of DS.Adapter", function() {
  ok(DS.Adapter.detect(DS.CouchDBAdapter), "CouchDBAdapter is a subclass of DS.Adapter");
});

test("finding a person makes a GET to /DB_NAME/:id", function() {
  person = store.find(Person, 1);

  expectState('loaded', false);
  expectUrl('/DB_NAME/1');
});

test("creating a person makes a POST to /DB_NAME with data hash", function() {
  person = store.createRecord(Person, {
    name: 'Tobias Fünke'
  });

  expectState('new');
  store.commit();
  expectState('saving');

  expectUrl('/DB_NAME/', 'the database name');
  expectType('POST');
  expectData({
    name: "Tobias Fünke"
  });

  ajaxHash.success({
    ok: true,
    id: "abc",
    rev: "1-abc"
  });
  expectState('saving', false);

  equal(person, store.find(Person, 'abc'), "it's possible to find the person by the returned ID");
  equal(get(person, 'rev'), '1-abc', "the revision is stored on the data");
});

test("updating a person makes a PUT to /DB_NAME/:id with data hash", function() {
  store.load(Person, {
    id: 'abc',
    rev: '1-abc',
    name: 'Tobias Fünke'
  });

  person = store.find(Person, 'abc');

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  set(person, 'name', 'Nelly Fünke');

  expectState('dirty');
  store.commit();
  expectState('saving');

  expectUrl('/DB_NAME/abc', 'the database name with the record ID');
  expectType('PUT');
  expectData({
    "_id": "abc",
    "_rev": "1-abc",
    name: "Nelly Fünke"
  });

  ajaxHash.success({
    ok: true,
    id: 'abc',
    rev: '2-def'
  });
  expectState('saving', false);

  equal(person, store.find(Person, 'abc'), "the same person is retrieved by the same ID");
  equal(get(person, 'name'), 'Nelly Fünke', "the data is preserved");
  equal(get(person, 'rev'), '2-def', "the revision is updated");
});

test("deleting a person makes a DELETE to /DB_NAME/:id", function() {
  store.load(Person, {
    id: 'abc',
    rev: '1-abc',
    name: "Tobias Fünke"
  });

  person = store.find(Person, "abc");

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  person.deleteRecord();

  expectState('dirty');
  expectState('deleted');
  store.commit();
  expectState('saving');

  expectUrl("/DB_NAME/abc?rev=1-abc", "the database name with the record ID and rev as parameter");
  expectType("DELETE");

  ajaxHash.success({
    ok: true,
    rev: '2-abc'
  });
  expectState('deleted');
});

test("bulkCommit=true makes a POST to /DB_NAME/_bulk_docs", function() {
  createdPerson = store.createRecord(Person, {
    name: 'created person'
  });
  store.load(Person, {
    id: 'updatedId',
    rev: 'updatedRev',
    name: 'person name'
  });
  store.load(Person, {
    id: 'deletedId',
    rev: 'deletedRev',
    name: 'deleted person'
  });

  updatedPerson = store.find(Person, 'updatedId');
  deletedPerson = store.find(Person, 'deletedId');

  updatedPerson.set('name', 'updated name');
  deletedPerson.deleteRecord();

  expectState('new', true, createdPerson);
  expectState('dirty', true, updatedPerson);
  expectState('deleted', true, deletedPerson);

  adapter.set('bulkCommit', true);

  store.commit();

  expectState('saving', true, createdPerson);
  expectState('saving', true, updatedPerson);
  expectState('saving', true, deletedPerson);

  expectUrl('/DB_NAME/_bulk_docs', 'the database name');
  expectType('POST');
  expectData({
    docs: [{
      name: "created person"
    }, {
      _id: 'updatedId',
      _rev: 'updatedRev',
      name: 'updated name'
    }, {
      _id: 'deletedId',
      _rev: 'deletedRev',
      _deleted: true
    }]
  }
  );

  ajaxHash.success([{
    "id": 'abc',
    "rev": '1-abc'
  }, {
    "id": 'updatedId',
    "rev": 'updatedRev2'
  }, {
    ok: true,
    "rev": 'deletedRev2'
  }]);

  expectState('saving', false, createdPerson);
  expectState('saving', false, updatedPerson);
  expectState('saving', false, deletedPerson);

  equal(createdPerson, store.find(Person, 'abc'), "it's possible to find the person by the returned ID");
  equal(get(createdPerson, 'rev'), '1-abc', "the revision is stored on the data");

  equal(updatedPerson, store.find(Person, 'updatedId'));
  equal(get(updatedPerson, 'rev'), 'updatedRev2');
  equal(get(updatedPerson, 'name'), 'updated name');

  expectState('deleted', true, deletedPerson);
});

test("a view is requested via findQuery of type 'view'", function() {
  var persons = store.findQuery(Person, {
    type: 'view',
    viewName: 'PERSONS_VIEW'
  });

  expectUrl('/DB_NAME/_design/DESIGN_DOC/_view/PERSONS_VIEW');
  expectType('GET');
});


module("CouchDBModel");

test("is defined", function() {
  ok(CouchDBModel);
});

test("adds 'rev' property", function() {
  var MyModel = DS.Model.extend(CouchDBModel);
  var attrs = Ember.get(MyModel, 'attributes');

  var revAttr = attrs.get('rev');
  equal(revAttr.type, 'string');
  equal(revAttr.key(MyModel), 'rev');
});