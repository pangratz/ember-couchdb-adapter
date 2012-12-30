Ember.ENV.TESTING = true;

var get = Ember.get;
var set = Ember.set;

var adapter;
var store;
var ajaxUrl;
var ajaxType;
var ajaxHash;

var person;
var Person, Article, Comment;

var expectUrl = function(url, desc) {
  equal(ajaxUrl, url, "the URL is " + desc);
};

var expectType = function(type) {
  equal(type, ajaxType, "the HTTP method is " + type);
};

var expectData = function(hash) {
  deepEqual(ajaxHash.data, hash, "the hash was passed along");
};

var expectAjaxCall = function(type, url, data) {
  expectType(type);
  expectUrl(url);
  if (data) expectData(data);
};

var expectState = function(state, value, p) {
  p = p || person;

  if (value === undefined) {
    value = true;
  }

  var flag = "is" + state.charAt(0).toUpperCase() + state.substr(1);
  equal(get(p, flag), value, "the state is " + (value === false ? "not ": "") + state);
};

module("DS.CouchDBAdapter", {
  setup: function() {
    ajaxUrl = ajaxType = ajaxHash = "AJAX_NOT_INVOKED";

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

    Comment = DS.Model.extend({
      text: DS.attr('string')
    });
    Comment.toString = function() { return 'Comment'; };

    Article = DS.Model.extend({
      label: DS.attr('string')
    });
    Article.toString = function() { return 'Article'; };

    Article.reopen({
      writer: DS.belongsTo(Person),
      comments: DS.hasMany(Comment)
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

test("finding a record makes a GET to /DB_NAME/:id", function() {
  person = store.find(Person, 1);

  expectAjaxCall('GET', '/DB_NAME/1');
  expectState('loaded', false);

  ajaxHash.success({
    _id: 1,
    _rev: 'abc',
    name: 'Hansi Hinterseer'
  });

  expectState('loaded');
  expectState('dirty', false);

  equal(person.get('id'), 1);
  equal(person.get('name'), 'Hansi Hinterseer');
});

test("creating a person makes a POST to /DB_NAME with data hash", function() {
  person = store.createRecord(Person, {
    name: 'Tobias Fünke'
  });

  expectState('new');
  store.commit();
  expectState('saving');

  expectAjaxCall('POST', '/DB_NAME/', {
    name: "Tobias Fünke",
    ember_type: 'Person'
  });

  ajaxHash.success({
    ok: true,
    id: "abc",
    rev: "1-abc"
  });
  expectState('saving', false);
  expectState('loaded', true);
  expectState('dirty', false);

  equal(person.get('name'), "Tobias Fünke");

  set(person, 'name', "Dr. Funky");
  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/abc', {
    _id: "abc",
    _rev: "1-abc",
    ember_type: 'Person',
    name: "Dr. Funky"
  });
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

  expectAjaxCall('PUT', '/DB_NAME/abc', {
    _id: "abc",
    _rev: "1-abc",
    ember_type: 'Person',
    name: "Nelly Fünke"
  });

  ajaxHash.success({
    ok: true,
    id: 'abc',
    rev: '2-def'
  });

  expectState('saving', false);
  expectState('loaded', true);
  expectState('dirty', false);

  equal(get(person, 'name'), 'Nelly Fünke', "the data is preserved");

  set(person, 'name', "Dr. Funky");
  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/abc', {
    _id: "abc",
    _rev: "2-def",
    ember_type: 'Person',
    name: "Dr. Funky"
  });
});

test("updating with a conflicting revision", function() {
  store.load(Person, {
    id: 'abc',
    rev: '1-abc',
    name: 'Tobias Fünke'
  });
  person = store.find(Person, 'abc');
  set(person, 'name', 'Nelly Fünke');
  store.commit();

  ajaxHash.error.call(ajaxHash.context, {
    status: 409,
    responseText: JSON.stringify({
      error: "conflict",
      reason: "Document update conflict"
    })
  });

  expectState('valid', false);
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

  expectAjaxCall('DELETE', "/DB_NAME/abc?rev=1-abc");

  ajaxHash.success({
    ok: true,
    rev: '2-abc'
  });
  expectState('deleted');
});

test("findMany makes a POST to /DB_NAME/_all_docs?include_docs=true", function() {
  var persons = store.findMany(Person, ['1', '2']);

  expectAjaxCall('POST', '/DB_NAME/_all_docs', {
    include_docs: true,
    keys: ['1', '2']
  });

  ajaxHash.success({
    rows: [{
      doc: { _id: 1, _rev: 'abc', name: 'first'}
    }, {
      doc: { _id: 2, _rev: 'def', name: 'second'}
    }]
  });

  equal(store.find(Person, 1).get('name'), 'first');
  equal(store.find(Person, 2).get('name'), 'second');
});

test("findAll makes a GET to /DB_NAME/_design/DESIGN_DOC/_view/by-ember-type", function() {
  var allPersons = store.findAll(Person);

  expectAjaxCall('GET', '/DB_NAME/_design/DESIGN_DOC/_view/by-ember-type', {
    include_docs: true,
    key: '%22Person%22'
  });
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
  equal(store.find(Person, 2).get('name'), 'second');
  equal(store.find(Person, 3).get('name'), 'third');
});

test("findAll calls viewForType if useCustomTypeLookup is set to true", function() {
  expect(2);

  adapter.set('customTypeLookup', true);
  adapter.reopen({
    viewForType: function(type, viewParams) {
      equal(type, Person);
      ok(viewParams);
    }
  });

  store.findAll(Person);
});

test("findAll does a GET to view name returned by viewForType if useCustomTypeLookup is set to true", function() {
  adapter.set('customTypeLookup', true);
  adapter.reopen({
    viewForType: function(type, viewParams) {
      equal(typeof viewParams, 'object', 'viewParams is an object');
      viewParams.key = "myPersonKey";
      viewParams.include_docs = false;
      return 'myPersonView';
    }
  });

  var allPersons = store.findAll(Person);

  expectAjaxCall('GET', '/DB_NAME/_design/DESIGN_DOC/_view/myPersonView', {
    key: 'myPersonKey',
    include_docs: true // include_docs is overridden
  });

  ajaxHash.success({
    rows: [
      { doc: { _id: 1, _rev: 'a', name: 'first' } },
      { doc: { _id: 2, _rev: 'b', name: 'second' } },
      { doc: { _id: 3, _rev: 'c', name: 'third' } }
    ]
  });

  equal(allPersons.get('length'), 3);

  equal(store.find(Person, 1).get('name'), 'first');
  equal(store.find(Person, 2).get('name'), 'second');
  equal(store.find(Person, 3).get('name'), 'third');
});

test("a view is requested via findQuery of type 'view'", function() {
  var persons = store.findQuery(Person, {
    type: 'view',
    viewName: 'PERSONS_VIEW'
  });

  expectAjaxCall('GET', '/DB_NAME/_design/DESIGN_DOC/_view/PERSONS_VIEW');
  expectState('loaded', false, persons);

  ajaxHash.success({
    rows: [
      { doc: { _id: 1, _rev: 'a', name: 'first' } },
      { doc: { _id: 2, _rev: 'b', name: 'second' } },
      { doc: { _id: 3, _rev: 'c', name: 'third' } }
    ]
  });

  expectState('loaded', true, persons);
  equal(persons.get('length'), 3);

  equal(store.find(Person, 1).get('name'), 'first');
  equal(store.find(Person, 2).get('name'), 'second');
  equal(store.find(Person, 3).get('name'), 'third');
});

test("a view adds the query options as parameters", function() {
  store.findQuery(Person, {
    type: 'view',
    viewName: 'PERSONS_VIEW',
    options: {
      keys: ['a', 'b'],
      limit: 10,
      skip: 42
    }
  });

  expectAjaxCall('GET', '/DB_NAME/_design/DESIGN_DOC/_view/PERSONS_VIEW', {
    keys: ['a', 'b'],
    limit: 10,
    skip: 42
  });
});

test("hasMany relationship dirties parent if child is added", function() {
  store.load(Comment, {id: 'c1', rev: 'c1rev', text: 'comment 1'});
  store.load(Comment, {id: 'c2', rev: 'c2rev', text: 'comment 2'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', comments: ['c1']});

  var article = store.find(Article, 'a1');
  ok(article);
  equal(article.get('comments.length'), 1);
  expectState('dirty', false, article);

  var c2 = store.find(Comment, 'c2');
  ok(c2);
  expectState('dirty', false, c2);
  article.get('comments').pushObject(c2);

  equal(article.get('comments.length'), 2);
  expectState('dirty', true, article);
  expectState('dirty', false, c2);

  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/a1', {
    _id: "a1",
    _rev: "a1rev",
    ember_type: 'Article',
    label: "article",
    comments: ['c1', 'c2']
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a2rev2'
  });
});

test("hasMany relationship dirties parent if child is removed", function() {
  store.load(Comment, {id: 'c1', rev: 'c1rev', text: 'comment 1'});
  store.load(Comment, {id: 'c2', rev: 'c2rev', text: 'comment 2'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', comments: ['c1', 'c2']});

  var article = store.find(Article, 'a1');
  ok(article);
  equal(article.get('comments.length'), 2);
  expectState('dirty', false, article);

  var c2 = store.find(Comment, 'c2');
  ok(c2);
  article.get('comments').removeObject(c2);

  equal(article.get('comments.length'), 1);
  expectState('dirty', true, article);
  expectState('dirty', false, c2);

  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/a1', {
    _id: "a1",
    _rev: "a1rev",
    ember_type: 'Article',
    label: "article",
    comments: ['c1']
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a2rev2'
  });

  expectState('dirty', false, article);
});

test("hasMany relationship works with a newly created parent", function() {
  store.load(Comment, {id: 'c1', rev: 'c1rev', text: 'comment 1'});
  store.load(Comment, {id: 'c2', rev: 'c2rev', text: 'comment 2'});

  var article = store.createRecord(Article, {
    label: 'article'
  });
  article.get('comments').pushObjects([store.find(Comment, 'c1'), store.find(Comment, 'c2')]);

  expectState('dirty', true, article);
  expectState('new', true, article);

  store.commit();

  expectState('saving', true, article);

  expectAjaxCall('POST', '/DB_NAME/', {
    ember_type: 'Article',
    label: "article",
    comments: ['c1', 'c2']
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a1rev'
  });

  expectState('dirty', false, article);
  expectState('new', false, article);
  expectState('loaded', true, article);
});

test("hasMany relationship dirties child if child is updated", function() {
  store.load(Comment, {id: 'c1', rev: 'c1rev', text: 'comment 1'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', comments: ['c1']});

  var article = store.find(Article, 'a1');
  var comment = store.find(Comment, 'c1');
  ok(comment);

  expectState('dirty', false, article);
  expectState('dirty', false, comment);

  comment.set('text', 'comment 1 updated');

  expectState('dirty', false, article);
  expectState('dirty', true, comment);

  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/c1', {
    _id: "c1",
    _rev: "c1rev",
    ember_type: 'Comment',
    text: "comment 1 updated"
  });

  ajaxHash.success({
    ok: true,
    id: 'c1',
    rev: 'c1rev2'
  });

  expectState('dirty', false, comment);
});

test("belongsTo relationship dirties if item is deleted", function() {
  store.load(Person, {id: 'p1', rev: 'p1rev', name: 'author'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', writer: 'p1'});

  var article = store.find(Article, 'a1');
  var person = store.find(Person, 'p1');
  ok(article);
  ok(person);
  expectState('dirty', false, article);
  expectState('dirty', false, person);

  article.set('writer', null);

  expectState('dirty', false, person);
  expectState('dirty', true, article);

  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/a1', {
    _id: "a1",
    _rev: "a1rev",
    ember_type: 'Article',
    label: "article"
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a1rev2'
  });

  expectState('dirty', false, article);
});

test("belongsTo relationship dirties parent if item is updated", function() {
  store.load(Person, {id: 'p1', rev: 'p1rev', name: 'author 1'});
  store.load(Person, {id: 'p2', rev: 'p2rev', name: 'author 2'});
  store.load(Article, {id: 'a1', rev: 'a1rev', label: 'article', writer: 'p1'});

  var article = store.find(Article, 'a1');
  var person = store.find(Person, 'p2');
  ok(article);
  ok(person);
  expectState('dirty', false, article);
  expectState('dirty', false, person);

  article.set('writer', person);

  expectState('dirty', false, person);
  expectState('dirty', true, article);

  store.commit();

  expectAjaxCall('PUT', '/DB_NAME/a1', {
    _id: "a1",
    _rev: "a1rev",
    ember_type: 'Article',
    label: "article",
    writer: "p2"
  });

  ajaxHash.success({
    ok: true,
    id: 'a1',
    rev: 'a1rev2'
  });

  expectState('dirty', false, article);
});

var serializer;

module("DS.CouchDBSerializer", {
  setup: function() {
    serializer = DS.CouchDBSerializer.create();
  },
  teardown: function() {
    serializer.destroy();
  }
});

test("it exists", function() {
  ok(DS.CouchDBSerializer !== undefined, "DS.CouchDBSerializer is undefined");
});

test("it is a DS.JSONSerializer", function() {
  ok(DS.JSONSerializer.detect(DS.CouchDBSerializer), "DS.CouchDBSerializer is a DS.JSONSerializer");
});