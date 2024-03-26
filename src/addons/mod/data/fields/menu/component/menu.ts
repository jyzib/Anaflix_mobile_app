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
import { AddonModDataFieldPluginBaseComponent } from '../../../classes/base-field-plugin-component';

/**
 * Component to render data menu field.
 */
@Component({
    selector: 'addon-mod-data-field-menu',
    templateUrl: 'addon-mod-data-field-menu.html',
})
export class AddonModDataFieldMenuComponent extends AddonModDataFieldPluginBaseComponent {

    options: string[] = [];

    /**
     * Initialize field.
     */
    protected init(): void {
        if (this.displayMode) {
            return;
        }

        this.options = this.field.param1.split('\n');

        let val: string | undefined;
        if (this.editMode && this.value) {
            val = this.value.content;
        }

        this.addControl('f_' + this.field.id, val);
    }

}
