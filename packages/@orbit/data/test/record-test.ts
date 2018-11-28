import { cloneRecordIdentity, equalRecordIdentities, equalRecordIdentitySets, exclusiveOfRecordIdentitySet, recordIdentitySetIncludes } from '../src/record';
import './test-helper';

const { module, test } = QUnit;

module('Record', function() {
  test('`cloneRecordIdentity` returns a simple { type, id } identity object from any object with a `type` and `id`', function(assert) {
    assert.deepEqual(cloneRecordIdentity({ type: 'planet', id: '1' }), { type: 'planet', id: '1' });
  });

  test('`equalRecordIdentities` compares the type/id identity of two objects', function(assert) {
    assert.ok(equalRecordIdentities({ type: 'planet', id: '1' }, { type: 'planet', id: '1' }), 'identities match');
    assert.ok(equalRecordIdentities(null, null), 'identities match');
    assert.ok(!equalRecordIdentities({ type: 'planet', id: '1' }, { type: 'moon', id: '1' }), 'identities do not match');
    assert.ok(!equalRecordIdentities({ type: 'planet', id: '1' }, null), 'identities do not match');
    assert.ok(!equalRecordIdentities(null, { type: 'planet', id: '1' }), 'identities do not match');
  });

  test('`equalRecordIdentitySets` compares two arrays of identity objects', function(assert) {
    assert.ok(equalRecordIdentitySets([], []), 'empty sets are equal');
    assert.ok(equalRecordIdentitySets([{ type: 'planet', id: 'p1' }], [{ type: 'planet', id: 'p1' }]), 'equal sets with one member');
    assert.ok(equalRecordIdentitySets([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                      [{ type: 'moon', id: 'm1' }, { type: 'planet', id: 'p1' }]), 'equal sets with two members out of order');
    assert.notOk(equalRecordIdentitySets([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                         [{ type: 'moon', id: 'm1' }]), 'unequal sets 1');
    assert.notOk(equalRecordIdentitySets([{ type: 'planet', id: 'p1' }],
                                         [{ type: 'moon', id: 'm1' }, { type: 'planet', id: 'p1' }]), 'unequal sets 2');
  });

  test('`exclusiveOfRecordIdentitySet` returns the identities in the first set that are not in the second', function(assert) {
    assert.deepEqual(exclusiveOfRecordIdentitySet([], []), [], 'empty sets are equal');
    assert.deepEqual(exclusiveOfRecordIdentitySet([{ type: 'planet', id: 'p1' }], [{ type: 'planet', id: 'p1' }]), [], 'equal sets with one member');
    assert.deepEqual(exclusiveOfRecordIdentitySet([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                                  [{ type: 'moon', id: 'm1' }, { type: 'planet', id: 'p1' }]), [], 'equal sets with two members out of order');
    assert.deepEqual(exclusiveOfRecordIdentitySet([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                                  [{ type: 'moon', id: 'm1' }]),
                     [{ type: 'planet', id: 'p1' }],
                     'unequal sets 1');
    assert.deepEqual(exclusiveOfRecordIdentitySet([{ type: 'planet', id: 'p1' }],
                                                  [{ type: 'moon', id: 'm1' }, { type: 'planet', id: 'p1' }]),
                     [],
                     'unequal sets 2');
  });

  test('`recordIdentitySetIncludes` checks for the presence of an identity in an array of identity objects', function(assert) {
    assert.notOk(recordIdentitySetIncludes([], { type: 'planet', id: 'p1' }), 'empty set');
    assert.ok(recordIdentitySetIncludes([{ type: 'planet', id: 'p1' }], { type: 'planet', id: 'p1' }), 'set with one member');
    assert.ok(recordIdentitySetIncludes([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                         { type: 'moon', id: 'm1' }), 'set with two members');
    assert.notOk(recordIdentitySetIncludes([{ type: 'planet', id: 'p1' }, { type: 'moon', id: 'm1' }],
                                           { type: 'foo', id: 'bar' }), 'set with two members and no matches');
  });
});
