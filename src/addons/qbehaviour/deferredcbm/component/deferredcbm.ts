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

import { Component, Input, Output, EventEmitter } from '@angular/core';

import { CoreQuestionBehaviourButton, CoreQuestionQuestion } from '@features/question/services/question-helper';

/**
 * Component to render the deferred CBM in a question.
 */
@Component({
    selector: 'addon-qbehaviour-deferredcbm',
    templateUrl: 'addon-qbehaviour-deferredcbm.html',
})
export class AddonQbehaviourDeferredCBMComponent {

    @Input() question?: CoreQuestionQuestion; // The question.
    @Input() component?: string; // The component the question belongs to.
    @Input() componentId?: number; // ID of the component the question belongs to.
    @Input() attemptId?: number; // Attempt ID.
    @Input() offlineEnabled?: boolean | string; // Whether the question can be answered in offline.
    @Input() contextLevel?: string; // The context level.
    @Input() contextInstanceId?: number; // The instance ID related to the context.
    @Input() courseId?: number; // Course ID the question belongs to (if any). It can be used to improve performance with filters.
    @Input() review?: boolean; // Whether the user is in review mode.
    @Input() preferredBehaviour?: string; // Preferred behaviour.
    @Output() buttonClicked = new EventEmitter<CoreQuestionBehaviourButton>(); // Will emit when a behaviour button is clicked.
    @Output() onAbort = new EventEmitter<void>(); // Should emit an event if the question should be aborted.

}
