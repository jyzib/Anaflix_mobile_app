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
import { FileEntry } from '@awesome-cordova-plugins/file/ngx';

import { CoreFileUploader, CoreFileUploaderTypeList } from '@features/fileuploader/services/fileuploader';
import { CoreSites } from '@services/sites';
import { CoreTextUtils } from '@services/utils/text';
import { Translate } from '@singletons';
import { CoreNetwork } from '@services/network';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreFileUploaderHelper } from '@features/fileuploader/services/fileuploader-helper';
import { CoreFileEntry } from '@services/file-helper';
import { CoreCourses } from '@features/courses/services/courses';
import { CoreUtils } from '@services/utils/utils';

/**
 * Component to render attachments, allow adding more and delete the current ones.
 *
 * All the changes done will be applied to the "files" input array, no file will be uploaded. The component using this
 * component should be the one uploading and moving the files.
 *
 * All the files added will be copied to the app temporary folder, so they should be deleted after uploading them
 * or if the user cancels the action.
 *
 * <core-attachments [files]="files" [maxSize]="configs.maxsubmissionsizebytes" [maxSubmissions]="configs.maxfilesubmissions"
 *     [component]="component" [componentId]="assign.cmid" [acceptedTypes]="configs.filetypeslist" [allowOffline]="allowOffline">
 * </core-attachments>
 */
@Component({
    selector: 'core-attachments',
    templateUrl: 'core-attachments.html',
    styleUrls: ['attachments.scss'],
})
export class CoreAttachmentsComponent implements OnInit {

    @Input() files: CoreFileEntry[] = []; // List of attachments. New attachments will be added to this array.
    @Input() maxSize?: number; // Max size. -1 means unlimited, 0 means course/user max size, not defined means unknown.
    @Input() maxSubmissions?: number; // Max number of attachments. -1 means unlimited, not defined means unknown limit.
    @Input() component?: string; // Component the downloaded files will be linked to.
    @Input() componentId?: string | number; // Component ID.
    @Input() allowOffline?: boolean | string; // Whether to allow selecting files in offline.
    @Input() acceptedTypes?: string; // List of supported filetypes. If undefined, all types supported.
    @Input() required?: boolean; // Whether to display the required mark.
    @Input() courseId?: number; // Course ID.

    maxSizeReadable?: string;
    maxSubmissionsReadable?: string;
    unlimitedFiles?: boolean;
    fileTypes?: CoreFileUploaderTypeList;
    loaded = false;

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        this.files = this.files || [];
        this.maxSize = this.maxSize !== null ? Number(this.maxSize) : NaN;

        if (this.maxSize === 0) {
            await this.getMaxSizeOfArea();
        } else if (this.maxSize > 0) {
            this.maxSizeReadable = CoreTextUtils.bytesToSize(this.maxSize, 2);
        } else if (this.maxSize === -1) {
            this.maxSizeReadable = Translate.instant('core.unlimited');
        } else {
            this.maxSizeReadable = Translate.instant('core.unknown');
        }

        if (this.maxSubmissions === undefined || this.maxSubmissions < 0) {
            this.maxSubmissionsReadable = this.maxSubmissions === undefined ?
                Translate.instant('core.unknown') : undefined;
            this.unlimitedFiles = true;
        } else {
            this.maxSubmissionsReadable = String(this.maxSubmissions);
        }

        this.acceptedTypes = this.acceptedTypes?.trim();

        if (this.acceptedTypes && this.acceptedTypes != '*') {
            this.fileTypes = CoreFileUploader.prepareFiletypeList(this.acceptedTypes);
        }

        this.loaded = true;
    }

    /**
     * Get max size of the area.
     *
     * @returns Promise resolved when done.
     */
    protected async getMaxSizeOfArea(): Promise<void> {
        if (this.courseId) {
            // Check course max size.
            const course = await CoreUtils.ignoreErrors(CoreCourses.getCourseByField('id', this.courseId));

            if (course?.maxbytes) {
                this.maxSize = course.maxbytes;
                this.maxSizeReadable = CoreTextUtils.bytesToSize(this.maxSize, 2);

                return;
            }
        }

        // Check user max size.
        const currentSite = CoreSites.getCurrentSite();
        const siteInfo = currentSite?.getInfo();

        if (siteInfo?.usermaxuploadfilesize) {
            this.maxSize = siteInfo.usermaxuploadfilesize;
            this.maxSizeReadable = CoreTextUtils.bytesToSize(this.maxSize, 2);
        } else {
            this.maxSizeReadable = Translate.instant('core.unknown');
        }
    }

    /**
     * Add a new attachment.
     */
    async add(): Promise<void> {
        const allowOffline = !!this.allowOffline && this.allowOffline !== 'false';

        if (!allowOffline && !CoreNetwork.isOnline()) {
            CoreDomUtils.showErrorModal('core.fileuploader.errormustbeonlinetoupload', true);

            return;
        }

        const mimetypes = this.fileTypes && this.fileTypes.mimetypes;

        try {
            const result = await CoreFileUploaderHelper.selectFile(this.maxSize, allowOffline, undefined, mimetypes);

            this.files?.push(result);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error selecting file.');
        }
    }

    /**
     * Delete a file from the list.
     *
     * @param index The index of the file.
     * @param askConfirm Whether to ask confirm.
     */
    async delete(index: number, askConfirm?: boolean): Promise<void> {

        if (askConfirm) {
            try {
                await CoreDomUtils.showDeleteConfirm('core.confirmdeletefile');
            } catch {
                // User cancelled.
                return;
            }
        }

        // Remove the file from the list.
        this.files?.splice(index, 1);
    }

    /**
     * A file was renamed.
     *
     * @param index Index of the file.
     * @param data The data received.
     */
    renamed(index: number, data: { file: FileEntry }): void {
        this.files[index] = data.file;
    }

}
