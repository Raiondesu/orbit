import { Dict, isObject, isNone, merge } from '@orbit/utils';

export interface RecordIdentity {
  type: string;
  id: string;
}

export interface RecordHasOneRelationship {
  data: RecordIdentity | null;
}

export interface RecordHasManyRelationship {
  data: RecordIdentity[];
}

export type RecordRelationship = RecordHasOneRelationship | RecordHasManyRelationship;

export interface Record extends RecordIdentity {
  keys?: Dict<string>;
  attributes?: Dict<any>;
  relationships?: Dict<RecordRelationship>;
}

export interface RecordInitializer {
  initializeRecord(record: Record): void;
}

export function cloneRecordIdentity(identity: RecordIdentity): RecordIdentity {
  const { type, id } = identity;
  return { type, id };
}

export function equalRecordIdentities(record1: RecordIdentity, record2: RecordIdentity): boolean {
  return (isNone(record1) && isNone(record2)) ||
         (isObject(record1) && isObject(record2) &&
          record1.type === record2.type &&
          record1.id === record2.id);
}

export function equalRecordIdentitySets(set1: RecordIdentity[], set2: RecordIdentity[]): boolean {
  if (set1.length === set2.length) {
    if (set1.length === 0) {
      return true;
    }

    const serialized1 = serializeRecordIdentities(set1);
    const serialized2 = serializeRecordIdentities(set2);

    return exclusiveIdentities(serialized1, serialized2).length === 0 &&
           exclusiveIdentities(serialized2, serialized1).length === 0;
  }
  return false;
}

export function exclusiveOfRecordIdentitySet(set1: RecordIdentity[], set2: RecordIdentity[]): RecordIdentity[] {
  return exclusiveIdentities(serializeRecordIdentities(set1),
                             serializeRecordIdentities(set2))
    .map(id => deserializeRecordIdentity(id));
}

export function recordIdentitySetIncludes(set: RecordIdentity[], record: RecordIdentity): boolean {
  for (let r of set) {
    if (equalRecordIdentities(r, record)) {
      return true;
    }
  }
  return false;
}

export function mergeRecords(current: Record | null, updates: Record): Record {
  if (current) {
    let record = cloneRecordIdentity(current);

    ['attributes', 'keys', 'relationships'].forEach(grouping => {
      if (current[grouping] && updates[grouping]) {
        record[grouping] = merge({}, current[grouping], updates[grouping]);
      } else if (current[grouping]) {
        record[grouping] = merge({}, current[grouping]);
      } else if (updates[grouping]) {
        record[grouping] = merge({}, updates[grouping]);
      }
    });

    return record;
  } else {
    return updates;
  }
}

function serializeRecordIdentity(record: RecordIdentity): string {
  return `${record.type}:${record.id}`;
}

function deserializeRecordIdentity(identity: string): RecordIdentity {
  const [type, id] = identity.split(':');
  return { type, id };
}

function serializeRecordIdentities(recordIdentities: RecordIdentity[]): string[] {
  return recordIdentities.map(r => serializeRecordIdentity(r));
}

function exclusiveIdentities(identities1: string[], identities2: string[]): string[] {
  return identities1.filter(i => !identities2.includes(i));
}
