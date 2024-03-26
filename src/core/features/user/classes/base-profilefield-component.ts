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

import { Component, Input, OnInit } from '@angular/core';
import { FormGroup, Validators, FormControl } from '@angular/forms';

import { AuthEmailSignupProfileField } from '@features/login/services/login-helper';
import { CoreUserProfileField } from '@features/user/services/user';

/**
 * Base class for components to render a user profile field.
 */
@Component({
    template: '',
})
export abstract class CoreUserProfileFieldBaseComponent implements OnInit {

    @Input() field?: AuthEmailSignupProfileField | CoreUserProfileField; // The profile field to be rendered.
    @Input() signup = false; // True if editing the field in signup. Defaults to false.
    @Input() edit = false; // True if editing the field. Defaults to false.
    @Input() disabled = false; // True if disabled. Defaults to false.
    @Input() form?: FormGroup; // Form where to add the form control. Required if edit=true or signup=true.
    @Input() registerAuth?: string; // Register auth method. E.g. 'email'.
    @Input() contextLevel?: string; // The context level.
    @Input() contextInstanceId?: number; // The instance ID related to the context.
    @Input() courseId?: number; // Course ID the field belongs to (if any). It can be used to improve performance with filters.

    control?: FormControl;
    modelName = '';
    value?: string;
    required?: boolean;
    valueNotFiltered?: boolean;

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        if (!this.field) {
            return;
        }

        if (!this.edit && 'value' in this.field) {
            this.initForNonEdit(this.field);

            return;
        }

        if (this.edit && 'required' in this.field) {
            this.initForEdit(this.field);

            return;
        }
    }

    /**
     * Init the data when the field is meant to be displayed without editing.
     *
     * @param field Field to render.
     */
    protected initForNonEdit(field: CoreUserProfileField): void {
        this.value = field.displayvalue ?? field.value;
        this.valueNotFiltered = field.displayvalue === undefined || field.displayvalue === null;
    }

    /**
     * Init the data when the field is meant to be displayed for editing.
     *
     * @param field Field to render.
     */
    protected initForEdit(field: AuthEmailSignupProfileField): void {
        this.modelName = 'profile_field_' + field.shortname;
        this.required = !!field.required;

        this.control = this.createFormControl(field);
        this.form?.addControl(this.modelName, this.control);
    }

    /**
     * Create the Form control.
     *
     * @returns Form control.
     */
    protected createFormControl(field: AuthEmailSignupProfileField): FormControl {
        const formData = {
            value: field.defaultdata,
            disabled: this.disabled,
        };

        return new FormControl(formData, this.required && !field.locked ? Validators.required : null);
    }

}
