import { deepGet, isArray } from '@orbit/utils';
import {
  KeyMap,
  Record,
  Schema,
  equalRecordIdentities,
  exclusiveOfRecordIdentitySet,
  recordIdentitySetIncludes,
  RecordIdentity
} from '@orbit/data';

export interface RelatedRecordIdentity {
  record: RecordIdentity;
  relationship: string;
}

export interface SyncRecordAccessorSettings {
  schema?: Schema;
  keyMap?: KeyMap;
}

export abstract class SyncRecordAccessor {
  protected _keyMap: KeyMap;
  protected _schema: Schema;

  // Abstract methods for getting records and relationships
  abstract getRecord(recordIdentity: RecordIdentity): Record;
  abstract getRecords(type: string): Record[];
  abstract getInverselyRelatedRecords(recordIdentity: RecordIdentity): RelatedRecordIdentity[];

  // Abstract methods for setting records and relationships
  abstract setRecord(record: Record): void;
  abstract setRecords(type: string, records: Record[]): void;
  abstract removeRecord(recordIdentity: RecordIdentity): null | Record;
  abstract removeRecords(type: string, recordIdentities: RecordIdentity[]): Record[];
  abstract addInverselyRelatedRecord(recordIdentity: RecordIdentity, relatedRecordIdentity: RelatedRecordIdentity): void;
  abstract removeInverselyRelatedRecord(recordIdentity: RecordIdentity, relatedRecordIdentity: RelatedRecordIdentity): void;
  abstract removeInverseRelationships(recordIdentity: RecordIdentity): void;

  constructor(settings: SyncRecordAccessorSettings) {
    this._schema = settings.schema;
    this._keyMap = settings.keyMap;
  }

  get keyMap(): KeyMap {
    return this._keyMap;
  }

  get schema(): Schema {
    return this._schema;
  }

  getRelatedRecord(identity: RecordIdentity, relationship: string): RecordIdentity | null {
    const record = this.getRecord(identity);
    const relatedRecord = record && deepGet(record, ['relationships', relationship, 'data']);
    return relatedRecord || null;
  }

  getRelatedRecords(identity: RecordIdentity, relationship: string): RecordIdentity[] {
    const record = this.getRecord(identity);
    const relatedRecords = record && deepGet(record, ['relationships', relationship, 'data']);
    return relatedRecords || [];
  }

  relatedRecordEquals(identity: RecordIdentity, relationship: string, match: RecordIdentity): boolean {
    return equalRecordIdentities(this.getRelatedRecord(identity, relationship), match);
  }

  relatedRecordsInclude(identity: RecordIdentity, relationship: string, match: RecordIdentity | RecordIdentity[]): boolean {
    if (isArray(match)) {
      return exclusiveOfRecordIdentitySet(match as RecordIdentity[], this.getRelatedRecords(identity, relationship)).length === 0;
    } else {
      return recordIdentitySetIncludes(this.getRelatedRecords(identity, relationship), match as RecordIdentity);
    }
  }
};
