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

import { AddonModQuizAttemptWSData, AddonModQuizQuizWSData } from '@addons/mod/quiz/services/quiz';
import { AddonModQuizSync } from '@addons/mod/quiz/services/quiz-sync';
import { Component, OnInit, Input } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';

/**
 * Component to render the preflight for offline attempts.
 */
@Component({
    selector: 'addon-mod-quiz-access-offline-attempts',
    templateUrl: 'addon-mod-quiz-access-offline-attempts.html',
})
export class AddonModQuizAccessOfflineAttemptsComponent implements OnInit {

    @Input() rule?: string; // The name of the rule.
    @Input() quiz?: AddonModQuizQuizWSData; // The quiz the rule belongs to.
    @Input() attempt?: AddonModQuizAttemptWSData; // The attempt being started/continued.
    @Input() prefetch?: boolean; // Whether the user is prefetching the quiz.
    @Input() siteId?: string; // Site ID.
    @Input() form?: FormGroup; // Form where to add the form control.

    syncTimeReadable = '';

    constructor(private fb: FormBuilder) { }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        // Always set confirmdatasaved to 1. Sending the data means the user accepted.
        this.form?.addControl('confirmdatasaved', this.fb.control(1));

        if (!this.quiz) {
            return;
        }

        const time = await AddonModQuizSync.getSyncTime(this.quiz.id);

        this.syncTimeReadable = AddonModQuizSync.getReadableTimeFromTimestamp(time);
    }

}
