// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { SQLiteDB } from '@classes/sqlitedb';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

/**
 * SQlite database stub.
 */
export class SQLiteDBStub extends SQLiteDB {

    /**
     * @inheritdoc
     */
    async createDatabase(): Promise<SQLiteObject> {
        return new Proxy({
            executeSql: () => Promise.resolve({ insertId: Math.random().toString() }),
        }, {}) as unknown as SQLiteObject;
    }

}
