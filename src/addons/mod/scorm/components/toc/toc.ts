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
import { ModalController } from '@singletons';
import { AddonModScormGetScormAccessInformationWSResponse, AddonModScormProvider } from '../../services/scorm';
import { AddonModScormTOCScoWithIcon } from '../../services/scorm-helper';

/**
 * Modal to display the TOC of a SCORM.
 */
@Component({
    selector: 'addon-mod-scorm-toc',
    templateUrl: 'toc.html',
})
export class AddonModScormTocComponent implements OnInit {

    @Input() toc: AddonModScormTOCScoWithIcon[] = [];
    @Input() attemptToContinue?: number;
    @Input() selected?: number;
    @Input() moduleId!: number;
    @Input() courseId!: number;
    @Input() accessInfo!: AddonModScormGetScormAccessInformationWSResponse;
    @Input() mode = '';

    isBrowse = false;
    isReview = false;

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.isBrowse = this.mode === AddonModScormProvider.MODEBROWSE;
        this.isReview = this.mode === AddonModScormProvider.MODEREVIEW;
    }

    /**
     * Function called when a SCO is clicked.
     *
     * @param sco Clicked SCO.
     */
    loadSco(sco: AddonModScormTOCScoWithIcon): void {
        if (!sco.prereq || !sco.isvisible || !sco.launch) {
            return;
        }

        ModalController.dismiss(sco);
    }

    /**
     * Close modal.
     */
    closeModal(): void {
        ModalController.dismiss();
    }

}
