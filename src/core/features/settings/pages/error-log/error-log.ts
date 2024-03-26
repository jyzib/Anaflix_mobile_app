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

import { Component, OnInit } from '@angular/core';
import { CoreUtils } from '@services/utils/utils';
import { CoreErrorLogs, CoreSettingsErrorLog } from '@singletons/error-logs';

/**
 * Page that displays the error logs.
 */
@Component({
    selector: 'page-core-app-settings-error-log',
    templateUrl: 'error-log.html',
})
export class CoreSettingsErrorLogPage implements OnInit {

    errorLogs: CoreSettingsErrorLog[] = [];

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.errorLogs = CoreErrorLogs.getErrorLogs();
    }

    /**
     * Copy Info of all the errors.
     */
    async copyError(error?: CoreSettingsErrorLog): Promise<void> {
        if (error) {
            await CoreUtils.copyToClipboard(JSON.stringify(error));
        } else {
            await CoreUtils.copyToClipboard(JSON.stringify({ errors: this.errorLogs }));
        }
    }

}
