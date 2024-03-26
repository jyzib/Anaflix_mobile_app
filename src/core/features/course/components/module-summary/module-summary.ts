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
import { AddonBlog } from '@addons/blog/services/blog';
import { AddonBlogMainMenuHandlerService } from '@addons/blog/services/handlers/mainmenu';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Params } from '@angular/router';
import { CoreCourse } from '@features/course/services/course';
import { CoreCourseHelper, CoreCourseModuleData } from '@features/course/services/course-helper';
import { CoreCourseModuleDelegate } from '@features/course/services/module-delegate';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreCourses, CoreEnrolledCourseData } from '@features/courses/services/courses';
import { CoreGradesFormattedRow, CoreGradesFormattedTableRow, CoreGradesHelper } from '@features/grades/services/grades-helper';
import { CoreNetwork } from '@services/network';
import { CoreFilepool } from '@services/filepool';
import { CoreNavigator } from '@services/navigator';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { ModalController, NgZone } from '@singletons';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { Subscription } from 'rxjs';

/**
 * Component to display a module summary modal.
 */
@Component({
    selector: 'core-course-module-summary',
    templateUrl: 'module-summary.html',
    styleUrls: ['module-summary.scss'],
})
export class CoreCourseModuleSummaryComponent implements OnInit, OnDestroy {

    @Input() module?: CoreCourseModuleData; // The module of the component.
    @Input() courseId = 0; // Course ID the component belongs to.
    @Input() moduleId = 0; // Module ID the component belongs to.
    @Input() component = ''; // Component name.
    @Input() description = ''; // Module description.
    @Input() hasOffline = false; // If it has offline data to be synced.
    @Input() displayOptions: CoreCourseModuleSummaryDisplayOptions = {};

    loaded = false; // If the component has been loaded.
    componentId?: number; // Component ID.

    // Data for context menu.
    externalUrl?: string; // External URL to open in browser.

    removeFilesLoading = false;
    prefetchLoading = false;
    canPrefetch = false;
    prefetchDisabled = false;
    size?: number; // Size in bytes
    downloadTimeReadable = ''; // Last download time in a readable format.
    grades?: CoreGradesFormattedRow[];
    blog = false; // If blog is available.
    isOnline = false; // If the app is online or not.
    course?: CoreEnrolledCourseData;
    modicon = '';
    moduleNameTranslated = '';

    protected onlineSubscription: Subscription; // It will observe the status of the network connection.
    protected packageStatusObserver?: CoreEventObserver; // Observer of package status.
    protected fileStatusObserver?: CoreEventObserver; // Observer of file status.
    protected siteId: string;
    protected isDestroyed = false;

    constructor() {
        this.siteId = CoreSites.getCurrentSiteId();
        this.isOnline = CoreNetwork.isOnline();

        // Refresh online status when changes.
        this.onlineSubscription = CoreNetwork.onChange().subscribe(() => {
            // Execute the callback in the Angular zone, so change detection doesn't stop working.
            NgZone.run(() => {
                this.isOnline = CoreNetwork.isOnline();
            });
        });
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        if (!this.module) {
            this.closeModal();

            return;
        }

        this.displayOptions = Object.assign({
            displayOpenInBrowser: !!CoreSites.getCurrentSite()?.shouldDisplayInformativeLinks(),
            displayDescription: true,
            displayRefresh: true,
            displayPrefetch: true,
            displaySize: true,
            displayBlog: true,
            displayGrades: true,
        }, this.displayOptions);

        this.displayOptions.displayGrades = this.displayOptions.displayGrades &&
            CoreCourseModuleDelegate.supportsFeature(this.module.modname, CoreConstants.FEATURE_GRADE_HAS_GRADE, true);

        this.displayOptions.displayDescription = this.displayOptions.displayDescription &&
            CoreCourseModuleDelegate.supportsFeature(this.module.modname, CoreConstants.FEATURE_SHOW_DESCRIPTION, true);

        this.fetchContent();

        if (this.component) {
            this.packageStatusObserver = CoreEvents.on(
                CoreEvents.PACKAGE_STATUS_CHANGED,
                (data) => {
                    if (data.componentId == module.id && data.component == this.component) {
                        this.getPackageStatus();
                    }
                },
                this.siteId,
            );

            // Debounce the update size function to prevent too many calls when downloading or deleting a whole activity.
            const debouncedUpdateSize = CoreUtils.debounce(async () => {
                if (!this.module) {
                    return;
                }

                const moduleSize = await CoreCourseModulePrefetchDelegate.getModuleStoredSize(this.module, this.courseId);

                if (moduleSize) {
                    this.size = moduleSize;
                }
            }, 1000);

            this.fileStatusObserver = CoreEvents.on(
                CoreEvents.COMPONENT_FILE_ACTION,
                (data) => {
                    if (data.component != this.component || data.componentId != module.id) {
                        // The event doesn't belong to this component, ignore.
                        return;
                    }

                    if (!CoreFilepool.isFileEventDownloadedOrDeleted(data)) {
                        return;
                    }

                    // Update the module size.
                    debouncedUpdateSize();
                },
                this.siteId,
            );
        }

    }

    /**
     * Fetch content to populate the page.
     */
    protected async fetchContent(): Promise<void> {
        if (!this.module) {
            return;
        }

        this.componentId = this.module.id;
        this.externalUrl = this.module.url;
        this.courseId = this.courseId || this.module.course;
        this.moduleNameTranslated = CoreCourse.translateModuleName(this.module.modname, this.module.modplural);

        this.blog = await AddonBlog.isPluginEnabled();

        try {
            await Promise.all([
                this.loadModIcon(),
                this.getPackageStatus(),
                this.fetchGrades(),
                this.fetchCourse(),
            ]);
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
        }

        this.loaded = true;
    }

    /**
     * Load the module icon.
     */
    protected async loadModIcon(): Promise<void> {
        if (!this.module) {
            return;
        }

        this.modicon = await CoreCourseModuleDelegate.getModuleIconSrc(this.module.modname, this.module.modicon, this.module);
    }

    /**
     * Updage package status.
     *
     * @param refresh If prefetch info has to be refreshed.
     */
    protected async getPackageStatus(refresh = false): Promise<void> {
        if (!this.module) {
            return;
        }

        const moduleInfo =
            await CoreCourseHelper.getModulePrefetchInfo(this.module, this.courseId, refresh, this.component);

        this.canPrefetch = moduleInfo.status != CoreConstants.NOT_DOWNLOADABLE;
        this.downloadTimeReadable = '';

        if (this.canPrefetch) {
            if (moduleInfo.downloadTime && moduleInfo.downloadTime > 0) {
                this.downloadTimeReadable = CoreTextUtils.ucFirst(moduleInfo.downloadTimeReadable);
            }
            this.prefetchLoading = moduleInfo.status == CoreConstants.DOWNLOADING;
            this.prefetchDisabled = moduleInfo.status == CoreConstants.DOWNLOADED;
        }

        if (moduleInfo.size && moduleInfo.size > 0) {
            this.size = moduleInfo.size;
        }
    }

    /**
     * Go to blog posts.
     */
    async gotoBlog(): Promise<void> {
        const params: Params = { cmId: this.moduleId };

        await CoreNavigator.navigateToSitePath(AddonBlogMainMenuHandlerService.PAGE_NAME, { params });
    }

    /**
     * Fetch grade module info.
     */
    protected async fetchGrades(): Promise<void> {
        if (!this.displayOptions.displayGrades) {
            return;
        }

        try {
            this.grades = await CoreGradesHelper.getModuleGrades(this.courseId, this.moduleId);
        } catch {
            // Cannot get grades, don't display them.
        }
    }

    /**
     * Toggle grades expand.
     *
     * @param grade Row to expand.
     */
    toggleGrade(grade: CoreGradesFormattedTableRow): void {
        grade.expanded = !grade.expanded;
    }

    /**
     * Fetch course.
     */
    protected async fetchCourse(): Promise<void> {
        // Fix that.
        try {
            this.course = await CoreCourses.getUserCourse(this.courseId, true);
        } catch {
            // The user is not enrolled in the course. Use getCourses to see if it's an admin/manager and can see the course.
            this.course = await CoreCourses.getCourse(this.courseId);
        }
    }

    /**
     * Open course.
     */
    openCourse(): void {
        if (!this.course) {
            return;
        }

        CoreCourse.openCourse(
            this.course,
            {
                replace: true,
                animationDirection: 'back',
                params: {
                    module: this.module,
                    openModule: false,
                },
            },
        );
    }

    /**
     * Prefetch the module.
     */
    async prefetch(): Promise<void> {
        if (!this.module) {
            return;
        }

        this.prefetchLoading = true; // Show spinner since this operation might take a while.

        try {
            // We need to call getDownloadSize, the package might have been updated.
            const size = await CoreCourseModulePrefetchDelegate.getModuleDownloadSize(this.module, this.courseId, true);

            await CoreDomUtils.confirmDownloadSize(size);

            await CoreCourseModulePrefetchDelegate.prefetchModule(this.module, this.courseId, true);

            await this.getPackageStatus(true);
        } catch (error) {
            this.prefetchLoading = false;

            if (!this.isDestroyed) {
                CoreDomUtils.showErrorModalDefault(error, 'core.errordownloading', true);
            }
        }
    }

    /**
     * Confirm and remove downloaded files.
     */
    async removeFiles(): Promise<void> {
        if (!this.module) {
            return;
        }

        if (this.prefetchLoading) {
            CoreDomUtils.showAlertTranslated(undefined, 'core.course.cannotdeletewhiledownloading');

            return;
        }

        try {
            await CoreDomUtils.showDeleteConfirm('addon.storagemanager.confirmdeletedatafrom', { name: this.module.name });

            this.removeFilesLoading = true;

            await CoreCourseHelper.removeModuleStoredData(this.module, this.courseId);

        } catch (error) {
            if (!this.isDestroyed &&error) {
                CoreDomUtils.showErrorModal(error);
            }
        } finally {
            this.removeFilesLoading = false;
            delete this.size;
        }

        await this.getPackageStatus();
    }

    /**
     * Refresh the data.
     */
    async refresh(): Promise<void> {
        if (!this.module) {
            return;
        }

        ModalController.dismiss({ action: 'refresh' });
    }

    /**
     * Sync the data.
     */
    async sync(): Promise<void> {
        if (!this.module) {
            return;
        }

        ModalController.dismiss({ action: 'sync' });
    }

    /**
     * Close the modal.
     */
    closeModal(): void {
        ModalController.dismiss();
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.packageStatusObserver?.off();
        this.fileStatusObserver?.off();
        this.onlineSubscription.unsubscribe();
    }

}

export type CoreCourseModuleSummaryResult = {
    action: 'sync'|'refresh';
};

export type CoreCourseModuleSummaryDisplayOptions = {
    displayOpenInBrowser?: boolean;
    displayDescription?: boolean;
    displayRefresh?: boolean;
    displayPrefetch?: boolean;
    displaySize?: boolean;
    displayBlog?: boolean;
    displayGrades?: boolean;
};
