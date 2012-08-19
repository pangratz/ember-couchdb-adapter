Ember.ENV.TESTING = true;

var get = Ember.get;
var set = Ember.set;

var adapter;
var store;
var ajaxUrl;
var ajaxType;
var ajaxHash;

var person;
var Person, Article, Tag;

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
  equal(get(p, flag), value, "the state is " + (value === false ? "not ": "") + state);
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
      name: DS.attr('string')
    });
    Person.toString = function() { return 'Person'; };

    Tag = DS.Model.extend({
      label: DS.attr('string')
    });
    Tag.toString = function() { return 'Tag'; };

    Article = DS.Model.extend({
      label: DS.attr('string'),
      tags: DS.hasMany(Tag)
    });
    Article.toString = function() { return 'Article'; };
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

test("stringForType by default returns the value of toString", function() {
  equal(adapter.stringForType(Person), 'Person');
});

test("finding a person makes a GET to /DB_NAME/:id", function() {
  person = store.find(Person, 1);

  expectState('loaded', false);
  expectUrl('/DB_NAME/1');

  ajaxHash.success({
    _id: 1,
    _rev: 'abc',
    name: 'Hansi Hinterseer'
  });

  equal(person.get('id'), 1);
  equal(person.get('data.rev'), 'abc');
  equal(person.get('name'), 'Hansi Hinterseer');
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
    name: "Tobias Fünke",
    ember_type: 'Person',
  });

  ajaxHash.success({
    ok: true,
    id: "abc",
    rev: "1-abc"
  });
  expectState('saving', false);

  equal(person, store.find(Person, 'abc'), "it's possible to find the person by the returned ID");
  equal(get(person, 'data.rev'), '1-abc', "the revision is stored on the data");
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
    ember_type: 'Person',
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
  equal(get(person, 'data.rev'), '2-def', "the revision is updated");
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

test("findMany makes a POST to /DB_NAME/_all_docs?include_docs=true", function() {
  var persons = store.findMany(Person, [1, 2]);

  expectUrl('/DB_NAME/_all_docs?include_docs=true');
  expectType('POST');
  expectData({
    keys: [1, 2]
  });

  ajaxHash.success({
    rows: [{
      doc: { _id: 1, _rev: 'abc', name: 'first'}
    }, {
      doc: { _id: 2, _rev: 'def', name: 'second'}
    }]
  });

  equal(store.find(Person, 1).get('name'), 'first');
  equal(store.find(Person, 1).get('data.rev'), 'abc');

  equal(store.find(Person, 2).get('name'), 'second');
  equal(store.find(Person, 2).get('data.rev'), 'def');
});

test("findAll makes a POST to /DB_NAME/_design/DESIGN_DOC/_view/by-ember-type", function() {
  var allPersons = store.findAll(Person);

  expectUrl('/DB_NAME/_design/DESIGN_DOC/_view/by-ember-type?include_docs=true&key="Person"');
  expectType('GET');
  equal(allPersons.get('length'), 0);

  ajaxHash.success({
    rows: [
      { doc: { _id: 1, _rev: 'a', name: 'first' } },
      { doc: { _id: 2, _rev: 'b', name: 'second' } },
      { doc: { _id: 3, _rev: 'c', name: 'third' } }
    ]
  });

  equal(allPersons.get('length'), 3);

  equal(store.find(Person, 1).get('name'), 'first');
  equal(store.find(Person, 1).get('data.rev'), 'a');

  equal(store.find(Person, 2).get('name'), 'second');
  equal(store.find(Person, 2).get('data.rev'), 'b');

  equal(store.find(Person, 3).get('name'), 'third');
  equal(store.find(Person, 3).get('data.rev'), 'c');
});

test("a view is requested via findQuery of type 'view'", function() {
  var persons = store.findQuery(Person, {
    type: 'view',
    viewName: 'PERSONS_VIEW'
  });

  expectUrl('/DB_NAME/_design/DESIGN_DOC/_view/PERSONS_VIEW');
  expectType('GET');
});

test("hasMany relationship dirties parent if child is added", function() {
  store.load(Tag, {id: 't1', rev: 't1rev', label: 'tag 1'});
  store.load(Tag, {id: 't2', rev: 't2rev', label: 'tag 2'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', tags: ['t1']});

  var article = store.find(Article, 'a1');
  ok(article);
  equal(article.get('tags.length'), 1);
  expectState('dirty', false, article);

  var t2 = store.find(Tag, 't2');
  ok(t2);
  article.get('tags').pushObject(t2);
  // FIXME remove
  article.get('stateManager').goToState('updated');

  equal(article.get('tags.length'), 2);
  expectState('dirty', true, article);

  store.commit();

  expectUrl('/DB_NAME/a1');
  expectType('PUT');
  expectData({
    "_id": "a1",
    "_rev": "a1rev",
    ember_type: 'Article',
    label: "article",
    tags: ['t1', 't2']
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a2rev2'
  });

  equal(article.get('data.rev'), 'a2rev2');
});

test("hasMany relationship dirties parent if child is removed", function() {
  store.load(Tag, {id: 't1', rev: 't1rev', label: 'tag 1'});
  store.load(Tag, {id: 't2', rev: 't2rev', label: 'tag 2'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', tags: ['t1', 't2']});

  var article = store.find(Article, 'a1');
  ok(article);
  equal(article.get('tags.length'), 2);
  expectState('dirty', false, article);

  var t2 = store.find(Tag, 't2');
  ok(t2);
  article.get('tags').removeObject(t2);
  // FIXME remove
  article.get('stateManager').goToState('updated');

  equal(article.get('tags.length'), 1);
  expectState('dirty', true, article);

  store.commit();

  expectUrl('/DB_NAME/a1');
  expectType('PUT');
  expectData({
    "_id": "a1",
    "_rev": "a1rev",
    ember_type: 'Article',
    label: "article",
    tags: ['t1']
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a2rev2'
  });

  expectState('dirty', false, article);
  equal(article.get('data.rev'), 'a2rev2');
});

test("hasMany relationshipd dirties child if child is updated", function() {
  store.load(Tag, {id: 't1', rev: 't1rev', label: 'tag 1'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', tags: ['t1']});

  var article = store.find(Article, 'a1');
  var tag = store.find(Tag, 't1');
  ok(tag);
  expectState('dirty', false, tag);

  tag.set('label', 'tag 1 updated');

  expectState('dirty', false, article);
  expectState('dirty', true, tag);

  store.commit();

  expectUrl('/DB_NAME/t1');
  expectType('PUT');
  expectData({
    "_id": "t1",
    "_rev": "t1rev",
    ember_type: 'Tag',
    label: "tag 1 updated"
  });

  ajaxHash.success({
    ok: true,
    id: 't1',
    rev: 't1rev2'
  });

  expectState('dirty', false, tag);
  equal(tag.get('data.rev'), 't1rev2');  
});