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

import { Component, ElementRef, HostBinding, Input, OnChanges, OnInit, SimpleChange } from '@angular/core';
import { FormControl } from '@angular/forms';

/**
 * Component to show errors if an input isn't valid.
 *
 * @description
 * The purpose of this component is to make easier and consistent the validation of forms.
 *
 * It should be applied next to the input element (ion-input, ion-select, ...). In case of ion-checkbox, it should be in another
 * item, placing it in the same item as the checkbox will cause problems.
 *
 * Please notice that the inputs need to have a FormControl to make it work. That FormControl needs to be passed to this component.
 *
 * Example usage:
 *
 * <ion-item class="ion-text-wrap">
 *     <ion-input type="text" name="username" formControlName="username" required="true"></ion-input>
 *     <core-input-errors [control]="myForm.controls.username" [errorMessages]="usernameErrors"></core-input-errors>
 * </ion-item>
 */
@Component({
    selector: 'core-input-errors',
    templateUrl: 'core-input-errors.html',
    styleUrls: ['input-errors.scss'],
})
export class CoreInputErrorsComponent implements OnInit, OnChanges {

    @Input() control?: FormControl; // Needed to be able to check the validity of the input.
    @Input() errorMessages: Record<string, string> = {}; // Error messages to show. Keys must be the name of the error.
    @Input() errorText = ''; // Set other non automatic errors.
    errorKeys: string[] = [];

    protected hostElement: HTMLElement;

    @HostBinding('class.has-errors')
    get hasErrors(): boolean {
        return (this.control && this.control.dirty && !this.control.valid) || !!this.errorText;
    }

    @HostBinding('role') role = 'alert';

    constructor(
        element: ElementRef,
    ) {
        this.hostElement = element.nativeElement;
    }

    /**
     * Initialize some common errors if they aren't set.
     */
    protected initErrorMessages(): void {
        this.errorMessages = {
            required: this.errorMessages.required || 'core.required',
            email: this.errorMessages.email || 'core.login.invalidemail',
            date: this.errorMessages.date || 'core.login.invaliddate',
            datetime: this.errorMessages.datetime || 'core.login.invaliddate',
            datetimelocal: this.errorMessages.datetimelocal || 'core.login.invaliddate',
            time: this.errorMessages.time || 'core.login.invalidtime',
            url: this.errorMessages.url || 'core.login.invalidurl',
            // Set empty values by default, the default error messages will be built in the template when needed.
            max: this.errorMessages.max || '',
            min: this.errorMessages.min || '',
        };

        this.errorMessages.requiredTrue = this.errorMessages.required;

        this.errorKeys = Object.keys(this.errorMessages);
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        const parent = this.hostElement.parentElement;
        let item: HTMLElement | null = null;

        if (parent?.tagName === 'ION-ITEM') {
            item = parent;

            // Get all elements on the parent and wrap them with a div.
            // This is needed because otherwise the error message will be shown on the right of the input. Or overflowing the item.
            const wrapper = document.createElement('div');

            wrapper.classList.add('core-input-errors-wrapper');

            Array.from(parent.children).forEach((child) => {
                if (!child.slot) {
                    wrapper.appendChild(child);
                }
            });

            parent.appendChild(wrapper);
        } else {
            item = this.hostElement.closest('ion-item');
        }

        item?.classList.add('has-core-input-errors');

    }

    /**
     * @inheritdoc
     */
    ngOnChanges(changes: { [name: string]: SimpleChange }): void {
        if ((changes.control || changes.errorMessages) && this.control) {
            this.initErrorMessages();
        }
    }

}
