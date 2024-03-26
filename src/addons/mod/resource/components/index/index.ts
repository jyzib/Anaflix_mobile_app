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

import { CoreConstants } from '@/core/constants';
import { Component, OnDestroy, OnInit, Optional } from '@angular/core';
import { CoreError } from '@classes/errors/error';
import { CoreCourseModuleMainResourceComponent } from '@features/course/classes/main-resource-component';
import { CoreCourseContentsPage } from '@features/course/pages/contents/contents';
import { CoreCourse } from '@features/course/services/course';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreNetwork } from '@services/network';
import { CoreFileHelper } from '@services/file-helper';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreMimetypeUtils } from '@services/utils/mimetype';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils, OpenFileAction } from '@services/utils/utils';
import { NgZone, Translate } from '@singletons';
import { Subscription } from 'rxjs';
import {
    AddonModResource,
    AddonModResourceCustomData,
    AddonModResourceProvider,
} from '../../services/resource';
import { AddonModResourceHelper } from '../../services/resource-helper';
import { CorePlatform } from '@services/platform';

/**
 * Component that displays a resource.
 */
@Component({
    selector: 'addon-mod-resource-index',
    templateUrl: 'addon-mod-resource-index.html',
    styleUrls: ['index.scss'],
})
export class AddonModResourceIndexComponent extends CoreCourseModuleMainResourceComponent implements OnInit, OnDestroy {

    component = AddonModResourceProvider.COMPONENT;
    pluginName = 'resource';

    mode = '';
    src = '';
    contentText = '';
    displayDescription = true;
    warning = '';
    isIOS = false;
    openFileAction = OpenFileAction;
    isOnline = false;
    isStreamedFile = false;
    shouldOpenInBrowser = false;

    // Variables for 'external' mode.
    type = '';
    readableSize = '';
    timecreated = -1;
    timemodified = -1;
    isExternalFile = false;
    outdatedStatus = CoreConstants.OUTDATED;

    protected onlineObserver?: Subscription;

    constructor(@Optional() courseContentsPage?: CoreCourseContentsPage) {
        super('AddonModResourceIndexComponent', courseContentsPage);
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        super.ngOnInit();

        this.isIOS = CorePlatform.isIOS();
        this.isOnline = CoreNetwork.isOnline();

        // Refresh online status when changes.
        this.onlineObserver = CoreNetwork.onChange().subscribe(() => {
            // Execute the callback in the Angular zone, so change detection doesn't stop working.
            NgZone.run(() => {
                this.isOnline = CoreNetwork.isOnline();
            });
        });

        await this.loadContent();
    }

    /**
     * @inheritdoc
     */
    protected async invalidateContent(): Promise<void> {
        return AddonModResource.invalidateContent(this.module.id, this.courseId);
    }

    /**
     * @inheritdoc
     */
    protected async fetchContent(refresh?: boolean): Promise<void> {
        // Load module contents if needed. Passing refresh is needed to force reloading contents.
        const contents = await CoreCourse.getModuleContents(this.module, undefined, undefined, false, refresh);

        if (!contents.length) {
            throw new CoreError(Translate.instant('core.filenotfound'));
        }

        this.module.afterlink = await AddonModResourceHelper.getAfterLinkDetails(this.module, this.courseId);

        // Get the resource instance to get the latest name/description and to know if it's embedded.
        const resource = await AddonModResource.getResourceData(this.courseId, this.module.id);
        this.description = resource.intro || '';
        const options: AddonModResourceCustomData =
            resource.displayoptions ? CoreTextUtils.unserialize(resource.displayoptions) : {};

        this.displayDescription = options.printintro === undefined || !!options.printintro;
        this.dataRetrieved.emit(resource);

        this.setStatusListener();

        if (AddonModResourceHelper.isDisplayedInIframe(this.module)) {

            const downloadResult = await this.downloadResourceIfNeeded(refresh, true);
            const src = await AddonModResourceHelper.getIframeSrc(this.module);
            this.mode = 'iframe';

            if (this.src && src.toString() == this.src.toString()) {
                // Re-loading same page.
                // Set it to empty and then re-set the src in the next digest so it detects it has changed.
                this.src = '';
                setTimeout(() => {
                    this.src = src;
                });
            } else {
                this.src = src;
            }

            // Never show description on iframe.
            this.displayDescription = false;

            this.warning = downloadResult.failed
                ? this.getErrorDownloadingSomeFilesMessage(downloadResult.error ?? '')
                : '';

            return;
        }

        if (resource && 'display' in resource && AddonModResourceHelper.isDisplayedEmbedded(this.module, resource.display)) {
            this.mode = 'embedded';
            this.warning = '';

            this.contentText = await AddonModResourceHelper.getEmbeddedHtml(this.module);
            this.mode = this.contentText.length > 0 ? 'embedded' : 'external';
        } else {
            this.mode = 'external';
            this.warning = '';
            let mimetype: string;

            // Always show description on external.
            this.displayDescription = true;

            if (this.isIOS) {
                this.shouldOpenInBrowser = CoreFileHelper.shouldOpenInBrowser(contents[0]);
            }

            if ('contentsinfo' in this.module && this.module.contentsinfo) {
                mimetype = this.module.contentsinfo.mimetypes[0];
                this.readableSize = CoreTextUtils.bytesToSize(this.module.contentsinfo.filessize, 1);
                this.timemodified = this.module.contentsinfo.lastmodified * 1000;
            } else {
                mimetype = await CoreUtils.getMimeTypeFromUrl(CoreFileHelper.getFileUrl(contents[0]));
                this.readableSize = CoreTextUtils.bytesToSize(contents[0].filesize, 1);
                this.timemodified = contents[0].timemodified * 1000;
            }

            this.timecreated = contents[0].timecreated * 1000;
            this.isExternalFile = !!contents[0].isexternalfile;
            this.type = CoreMimetypeUtils.getMimetypeDescription(mimetype);
            this.isStreamedFile = CoreMimetypeUtils.isStreamedMimetype(mimetype);
        }
    }

    /**
     * @inheritdoc
     */
    protected async logActivity(): Promise<void> {
        await CoreUtils.ignoreErrors(AddonModResource.logView(this.module.instance));

        this.analyticsLogEvent('mod_resource_view_resource');
    }

    /**
     * Opens a file.
     *
     * @param iOSOpenFileAction Action to do in iOS.
     * @returns Promise resolved when done.
     */
    async open(iOSOpenFileAction?: OpenFileAction): Promise<void> {
        let downloadable = await CoreCourseModulePrefetchDelegate.isModuleDownloadable(this.module, this.courseId);

        if (downloadable) {
            // Check if the main file is downloadle.
            // This isn't done in "isDownloadable" to prevent extra WS calls in the course page.
            downloadable = await AddonModResourceHelper.isMainFileDownloadable(this.module);

            if (downloadable) {
                if (this.currentStatus === CoreConstants.OUTDATED && !this.isOnline && !this.isExternalFile) {
                    // Warn the user that the file isn't updated.
                    const alert = await CoreDomUtils.showAlert(
                        undefined,
                        Translate.instant('addon.mod_resource.resourcestatusoutdatedconfirm'),
                    );

                    await alert.onWillDismiss();
                }

                return AddonModResourceHelper.openModuleFile(this.module, this.courseId, { iOSOpenFileAction });
            }
        }

        // The resource cannot be downloaded, open the activity in browser.
        await CoreSites.getCurrentSite()?.openInBrowserWithAutoLogin(this.module.url || '');
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        super.ngOnDestroy();
        this.onlineObserver?.unsubscribe();
    }

}
