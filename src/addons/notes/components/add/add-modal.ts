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

import { AddonNotes, AddonNotesPublishState } from '@addons/notes/services/notes';
import { Component, ViewChild, ElementRef, Input } from '@angular/core';
import { CoreApp } from '@services/app';
import { CoreSites } from '@services/sites';
import { CoreDomUtils, ToastDuration } from '@services/utils/dom';
import { CoreForms } from '@singletons/form';
import { ModalController } from '@singletons';

/**
 * Component that displays a text area for composing a note.
 */
@Component({
    templateUrl: 'add-modal.html',
})
export class AddonNotesAddComponent {

    @ViewChild('itemEdit') formElement?: ElementRef;

    @Input() courseId!: number;
    @Input() userId?: number;
    @Input() type: AddonNotesPublishState = 'personal';
    text = '';
    processing = false;

    /**
     * Send the note or store it offline.
     *
     * @param e Event.
     */
    async addNote(e: Event): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        CoreApp.closeKeyboard();
        const loadingModal = await CoreDomUtils.showModalLoading('core.sending', true);

        // Freeze the add note button.
        this.processing = true;
        try {
            this.userId = this.userId || CoreSites.getCurrentSiteUserId();
            const sent = await AddonNotes.addNote(this.userId, this.courseId, this.type, this.text);

            CoreForms.triggerFormSubmittedEvent(this.formElement, sent, CoreSites.getCurrentSiteId());

            ModalController.dismiss(<AddonNotesAddModalReturn>{ type: this.type, sent: true }).finally(() => {
                CoreDomUtils.showToast(sent ? 'addon.notes.eventnotecreated' : 'core.datastoredoffline', true, ToastDuration.LONG);
            });
        } catch (error){
            CoreDomUtils.showErrorModal(error);
            this.processing = false;
        } finally {
            loadingModal.dismiss();
        }
    }

    /**
     * Close modal.
     */
    closeModal(): void {
        CoreForms.triggerFormCancelledEvent(this.formElement, CoreSites.getCurrentSiteId());

        ModalController.dismiss(<AddonNotesAddModalReturn>{ type: this.type });
    }

}

export type AddonNotesAddModalReturn = {
    type: AddonNotesPublishState;
    sent?: boolean;
};
