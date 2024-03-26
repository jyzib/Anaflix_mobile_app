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

import { Component, Input, OnInit, AfterViewInit, ElementRef } from '@angular/core';

import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { Translate } from '@singletons';

/**
 * Directive to add a red asterisk for required input fields.
 *
 * @description
 * For forms with required and not required fields, it is recommended to use this directive to mark the required ones.
 *
 * This directive should be applied in the label. Example:
 *
 * <p slot="label" [core-mark-required]="true">Username</p>
 */
@Component({
    selector: '[core-mark-required]',
    templateUrl: 'core-mark-required.html',
    styleUrls: ['mark-required.scss'],
})
export class CoreMarkRequiredComponent implements OnInit, AfterViewInit {

    @Input('core-mark-required') coreMarkRequired: boolean | string = true;

    protected hostElement: HTMLElement;
    requiredLabel = Translate.instant('core.required');

    constructor(
        element: ElementRef,
    ) {
        this.hostElement = element.nativeElement;
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.coreMarkRequired = CoreUtils.isTrueOrOne(this.coreMarkRequired);
    }

    /**
     * @inheritdoc
     */
    ngAfterViewInit(): void {
        if (this.coreMarkRequired) {
            // Add the "required" to the aria-label.
            const ariaLabel = this.hostElement.getAttribute('aria-label') ||
                CoreTextUtils.cleanTags(this.hostElement.innerHTML, { singleLine: true });
            if (ariaLabel) {
                this.hostElement.setAttribute('aria-label', ariaLabel + '. ' + this.requiredLabel);
            }
        } else {
            // Remove the "required" from the aria-label.
            const ariaLabel = this.hostElement.getAttribute('aria-label');
            if (ariaLabel) {
                this.hostElement.setAttribute('aria-label', ariaLabel.replace('. ' + this.requiredLabel, ''));
            }
        }

        const input = this.hostElement.closest('ion-input, ion-textarea');
        input?.setAttribute('required', this.coreMarkRequired ? 'true' : 'false');
    }

}
