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

import { Component, Input, Output, OnInit, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { FileEntry } from '@awesome-cordova-plugins/file/ngx';

import { CoreIonLoadingElement } from '@classes/ion-loading';
import { CoreFile } from '@services/file';
import { CoreFileHelper } from '@services/file-helper';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreMimetypeUtils } from '@services/utils/mimetype';
import { CoreTextUtils } from '@services/utils/text';
import { CoreTimeUtils } from '@services/utils/time';
import { CoreUtils, CoreUtilsOpenFileOptions, OpenFileAction } from '@services/utils/utils';
import { CoreForms } from '@singletons/form';
import { CorePath } from '@singletons/path';
import { CorePlatform } from '@services/platform';

/**
 * Component to handle a local file. Only files inside the app folder can be managed.
 *
 * Shows the file name, icon (depending on extension), size and time modified.
 * Also, if managing is enabled it will also show buttons to rename and delete the file.
 */
@Component({
    selector: 'core-local-file',
    templateUrl: 'core-local-file.html',
})
export class CoreLocalFileComponent implements OnInit {

    @Input() file?: FileEntry; // A fileEntry retrieved using CoreFileProvider.getFile or similar.
    @Input() manage?: boolean | string; // Whether the user can manage the file (edit and delete).
    @Input() overrideClick?: boolean | string; // Whether the default item click should be overridden.
    @Output() onDelete = new EventEmitter<void>(); // Will notify when the file is deleted.
    @Output() onRename = new EventEmitter<{ file: FileEntry }>(); // Will notify when the file is renamed.
    @Output() onClick = new EventEmitter<void>(); // Will notify when the file is clicked. Only if overrideClick is true.

    @ViewChild('nameForm') formElement?: ElementRef;

    fileName?: string;
    fileIcon?: string;
    fileExtension?: string;
    size?: string;
    timemodified?: string;
    newFileName = '';
    editMode = false;
    relativePath = '';
    isIOS = false;
    openButtonIcon = '';
    openButtonLabel = '';

    protected defaultIsOpenWithPicker = false;

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        this.manage = CoreUtils.isTrueOrOne(this.manage);

        if (!this.file) {
            return;
        }

        this.loadFileBasicData(this.file);

        // Get the size and timemodified.
        const metadata = await CoreFile.getMetadata(this.file);
        if (metadata.size >= 0) {
            this.size = CoreTextUtils.bytesToSize(metadata.size, 2);
        }

        this.timemodified = CoreTimeUtils.userDate(metadata.modificationTime.getTime(), 'core.strftimedatetimeshort');

        this.isIOS = CorePlatform.isIOS();
        this.defaultIsOpenWithPicker = CoreFileHelper.defaultIsOpenWithPicker();
        this.openButtonIcon = this.defaultIsOpenWithPicker ? 'fas-file' : 'fas-share-from-square';
        this.openButtonLabel = this.defaultIsOpenWithPicker ? 'core.openfile' : 'core.openwith';
    }

    /**
     * Load the basic data for the file.
     */
    protected loadFileBasicData(file: FileEntry): void {
        this.fileName = file.name;
        this.fileIcon = CoreMimetypeUtils.getFileIcon(file.name);
        this.fileExtension = CoreMimetypeUtils.getFileExtension(file.name);

        // Let's calculate the relative path for the file.
        this.relativePath = CoreFile.removeBasePath(file.toURL());
        if (!this.relativePath) {
            // Didn't find basePath, use fullPath but if the user tries to manage the file it'll probably fail.
            this.relativePath = file.fullPath;
        }
    }

    /**
     * Open file.
     *
     * @param e Click event.
     * @param isOpenButton Whether the open button was clicked.
     */
    async openFile(e: Event, isOpenButton = false): Promise<void> {
        if (this.editMode || !this.file) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (!isOpenButton && CoreUtils.isTrueOrOne(this.overrideClick) && this.onClick.observed) {
            this.onClick.emit();

            return;
        }

        if (!CoreFileHelper.isOpenableInApp(this.file)) {
            try {
                await CoreFileHelper.showConfirmOpenUnsupportedFile(false, this.file);
            } catch (error) {
                return; // Cancelled, stop.
            }
        }

        const options: CoreUtilsOpenFileOptions = {};
        if (isOpenButton) {
            // Use the non-default method.
            options.iOSOpenFileAction = this.defaultIsOpenWithPicker ? OpenFileAction.OPEN : OpenFileAction.OPEN_WITH;
        }

        CoreUtils.openFile(this.file.toURL(), options);
    }

    /**
     * Activate the edit mode.
     *
     * @param e Click event.
     */
    activateEdit(e: Event): void {
        if (!this.file) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.editMode = true;
        this.newFileName = this.file.name;
    }

    /**
     * Rename the file.
     *
     * @param newName New name.
     * @param e Click event.
     */
    async changeName(newName: string, e: Event): Promise<void> {
        if (!this.file) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (newName == this.file.name) {
            // Name hasn't changed, stop.
            this.editMode = false;
            CoreForms.triggerFormCancelledEvent(this.formElement, CoreSites.getCurrentSiteId());

            return;
        }

        const modal = await CoreDomUtils.showModalLoading();
        const fileAndDir = CoreFile.getFileAndDirectoryFromPath(this.relativePath);
        const newPath = CorePath.concatenatePaths(fileAndDir.directory, newName);

        try {
            // Check if there's a file with this name.
            await CoreFile.getFile(newPath);

            // There's a file with this name, show error and stop.
            CoreDomUtils.showErrorModal('core.errorfileexistssamename', true);
        } catch {
            try {
                // File doesn't exist, move it.
                const fileEntry = await CoreFile.moveFile(this.relativePath, newPath);

                CoreForms.triggerFormSubmittedEvent(this.formElement, false, CoreSites.getCurrentSiteId());

                this.editMode = false;
                this.file = fileEntry;
                this.loadFileBasicData(this.file);
                this.onRename.emit({ file: this.file });
            } catch (error) {
                CoreDomUtils.showErrorModalDefault(error, 'core.errorrenamefile', true);
            }
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Delete the file.
     *
     * @param e Click event.
     */
    async deleteFile(e: Event): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        let modal: CoreIonLoadingElement | undefined;

        try {
            // Ask confirmation.
            await CoreDomUtils.showDeleteConfirm('core.confirmdeletefile');

            modal = await CoreDomUtils.showModalLoading('core.deleting', true);

            await CoreFile.removeFile(this.relativePath);

            this.onDelete.emit();
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.errordeletefile', true);
        } finally {
            modal?.dismiss();
        }
    }

}
