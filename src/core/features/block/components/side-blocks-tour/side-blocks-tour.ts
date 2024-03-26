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

import { Component } from '@angular/core';
import { CoreUserTours } from '@features/usertours/services/user-tours';

/**
 * Component showing the User Tour for the Side Blocks feature.
 */
@Component({
    selector: 'core-block-side-blocks-tour',
    templateUrl: 'side-blocks-tour.html',
    styleUrls: ['side-blocks-tour.scss'],
})
export class CoreBlockSideBlocksTourComponent {

    /**
     * Dismiss User Tour.
     */
    async dismiss(): Promise<void> {
        await CoreUserTours.dismiss();
    }

}
