require('#{APPNAME}/core');
require('#{APPNAME}/#{APPNAME}');

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
    adapter = CouchDBAdapter.create({
      ajax: function(url, type, hash) {
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
      name: DS.attr('string')
    });
  },

  teardown: function() {
    adapter.destroy();
    store.destroy();
  }
});

test("is defined",
function() {
  ok(CouchDBAdapter !== undefined, "CouchDBAdapter is undefined");
});

test("is a subclass of DS.Adapter",
function() {
  ok(DS.Adapter.detect(CouchDBAdapter), "CouchDBAdapter is a subclass of DS.Adapter");
});

test("creating a person makes a POST to /db with data hash",
function() {
  person = store.createRecord(Person, {
    name: 'Tobias Fünke'
  });

  expectState('new');
  store.commit();
  expectState('saving');

  expectUrl('/db', 'the database name');
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
  equal(get(person, '_rev'), '1-abc', "the revision is stored on the data");
});

test("updating a person makes a PUT to /db/:id with data hash",
function() {
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

  expectUrl('/db/abc', 'the database name with the record ID');
  expectType('PUT');
  expectData({
    "_id": "abc",
    "_rev": "1-abc",
    name: "Tobias Fünke"
  });

  ajaxHash.success({
    ok: true,
    id: 'abc',
    rev: '2-def'
  });
  expectState('saving', false);

  equal(person, store.find(Person, 'abc'), "the same person is retrieved by the same ID");
  equal(get(person, 'name'), 'Nelly Fünke', "the data is preserved");
  equal(get(person, '_rev'), '2-def', "the revision is updated");
});

test("deleting a person makes a DELETE to /db/:id",
function() {
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

  expectUrl("/db/abc?rev=1-abc", "the database name with the record ID and rev as parameter");
  expectType("DELETE");

  ajaxHash.success({
    ok: true,
    rev: '2-abc'
  });
  expectState('deleted');
});
