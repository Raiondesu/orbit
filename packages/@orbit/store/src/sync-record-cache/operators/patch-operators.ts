import { Dict, clone, deepGet, deepSet } from '@orbit/utils';
import {
  cloneRecordIdentity,
  equalRecordIdentities,
  mergeRecords,
  Record,
  RecordIdentity,
  RecordOperation,
  AddRecordOperation,
  ReplaceRecordOperation,
  RemoveRecordOperation,
  ReplaceKeyOperation,
  ReplaceAttributeOperation,
  AddToRelatedRecordsOperation,
  RemoveFromRelatedRecordsOperation,
  ReplaceRelatedRecordsOperation,
  ReplaceRelatedRecordOperation
} from '@orbit/data';
import { SyncRecordCache } from '../sync-record-cache';

const EMPTY = () => {};

export interface PatchOperator {
  (cache: SyncRecordCache, op: RecordOperation): PatchResultData;
}

export type PatchResultData = Record | RecordIdentity | null;

export interface PatchResult {
  inverse: RecordOperation[],
  data: PatchResultData[]
}

export const PatchOperators: Dict<PatchOperator> = {
  addRecord(cache: SyncRecordCache, op: AddRecordOperation): PatchResultData {
    const { record } = op;
    cache.setRecord(record);

    if (cache.keyMap) {
      cache.keyMap.pushRecord(record);
    }

    return record;
  },

  replaceRecord(cache: SyncRecordCache, op: ReplaceRecordOperation): PatchResultData {
    const { record } = op;
    const currentRecord = cache.getRecord(record);
    const mergedRecord = mergeRecords(currentRecord, record);
    cache.setRecord(mergedRecord);

    if (cache.keyMap) {
      cache.keyMap.pushRecord(mergedRecord);
    }

    return mergedRecord;
  },

  removeRecord(cache: SyncRecordCache, op: RemoveRecordOperation): PatchResultData {
    return cache.removeRecord(op.record);
  },

  replaceKey(cache: SyncRecordCache, op: ReplaceKeyOperation): PatchResultData {
    let record = cache.getRecord(op.record);

    if (record) {
      record = clone(record);
    } else {
      record = cloneRecordIdentity(op.record);
    }

    deepSet(record, ['keys', op.key], op.value);
    cache.setRecord(record);

    if (cache.keyMap) {
      cache.keyMap.pushRecord(record);
    }

    return record;
  },

  replaceAttribute(cache: SyncRecordCache, op: ReplaceAttributeOperation): PatchResultData {
    let record = cache.getRecord(op.record);

    if (record) {
      record = clone(record);
    } else {
      record = cloneRecordIdentity(op.record);
    }

    deepSet(record, ['attributes', op.attribute], op.value);
    cache.setRecord(record);

    return record;
  },

  addToRelatedRecords(cache: SyncRecordCache, op: AddToRelatedRecordsOperation): PatchResultData {
    let record = cache.getRecord(op.record);
    const { relationship, relatedRecord } = op;

    if (record) {
      record = clone(record);
    } else {
      record = cloneRecordIdentity(op.record);
    }

    const relatedRecords: RecordIdentity[] = deepGet(record, ['relationships', relationship, 'data']) || [];
    relatedRecords.push(relatedRecord);

    deepSet(record, ['relationships', relationship, 'data'], relatedRecords);
    cache.setRecord(record);

    return record;
  },

  removeFromRelatedRecords(cache: SyncRecordCache, op: RemoveFromRelatedRecordsOperation): PatchResultData {
    let record = cache.getRecord(op.record);
    const { relationship, relatedRecord } = op;

    if (record) {
      record = clone(record);
      let relatedRecords: RecordIdentity[] = deepGet(record, ['relationships', relationship, 'data']);
      if (relatedRecords) {
        relatedRecords = relatedRecords.filter(r => !equalRecordIdentities(r, relatedRecord));

        if (deepSet(record, ['relationships', relationship, 'data'], relatedRecords)) {
          cache.setRecord(record);
        }
      }
      return record;
    }

    return null;
  },

  replaceRelatedRecords(cache: SyncRecordCache, op: ReplaceRelatedRecordsOperation): PatchResultData {
    let record = cache.getRecord(op.record);
    const { relationship, relatedRecords } = op;

    if (record) {
      record = clone(record);
    } else {
      record = cloneRecordIdentity(op.record);
    }

    if (deepSet(record, ['relationships', relationship, 'data'], relatedRecords)) {
      cache.setRecord(record);
    }

    return record;
  },

  replaceRelatedRecord(cache: SyncRecordCache, op: ReplaceRelatedRecordOperation): PatchResultData {
    let record = cache.getRecord(op.record);
    const { relationship, relatedRecord } = op;

    if (record) {
      record = clone(record);
    } else {
      record = cloneRecordIdentity(op.record);
    }

    if (deepSet(record, ['relationships', relationship, 'data'], relatedRecord)) {
      cache.setRecord(record);
    }

    return record;
  }
};
