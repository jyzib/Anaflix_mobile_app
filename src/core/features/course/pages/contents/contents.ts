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

import { Component, ViewChild, OnInit, OnDestroy, forwardRef, ChangeDetectorRef } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { CoreDomUtils } from '@services/utils/dom';
import { CoreUtils } from '@services/utils/utils';
import { CoreCourses, CoreCourseAnyCourseData } from '@features/courses/services/courses';
import {
    CoreCourse,
    CoreCourseCompletionActivityStatus,
} from '@features/course/services/course';
import {
    CoreCourseHelper,
    CoreCourseModuleCompletionData,
    CoreCourseSection,
} from '@features/course/services/course-helper';
import { CoreCourseFormatDelegate } from '@features/course/services/format-delegate';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreCourseSync, CoreCourseSyncProvider } from '@features/course/services/sync';
import { CoreCourseFormatComponent } from '../../components/course-format/course-format';
import {
    CoreEvents,
    CoreEventObserver,
} from '@singletons/events';
import { CoreNavigator } from '@services/navigator';
import { CoreRefreshContext, CORE_REFRESH_CONTEXT } from '@/core/utils/refresh-context';

/**
 * Page that displays the contents of a course.
 */
@Component({
    selector: 'page-core-course-contents',
    templateUrl: 'contents.html',
    providers: [{
        provide: CORE_REFRESH_CONTEXT,
        useExisting: forwardRef(() => CoreCourseContentsPage),
    }],
})
export class CoreCourseContentsPage implements OnInit, OnDestroy, CoreRefreshContext {

    @ViewChild(IonContent) content?: IonContent;
    @ViewChild(CoreCourseFormatComponent) formatComponent?: CoreCourseFormatComponent;

    course!: CoreCourseAnyCourseData;
    sections?: CoreCourseSection[];
    sectionId?: number;
    sectionNumber?: number;
    blockInstanceId?: number;
    dataLoaded = false;
    updatingData = false;
    downloadCourseEnabled = false;
    moduleId?: number;
    displayEnableDownload = false;
    displayRefresher = false;
    isGuest?: boolean;

    protected formatOptions?: Record<string, unknown>;
    protected completionObserver?: CoreEventObserver;
    protected manualCompletionObserver?: CoreEventObserver;
    protected syncObserver?: CoreEventObserver;
    protected isDestroyed = false;
    protected modulesHaveCompletion = false;
    protected debouncedUpdateCachedCompletion?: () => void; // Update the cached completion after a certain time.

    constructor(protected changeDetectorRef: ChangeDetectorRef) {}

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {

        try {
            this.course = CoreNavigator.getRequiredRouteParam<CoreCourseAnyCourseData>('course');
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }

        this.sectionId = CoreNavigator.getRouteNumberParam('sectionId');
        this.sectionNumber = CoreNavigator.getRouteNumberParam('sectionNumber');
        this.blockInstanceId = CoreNavigator.getRouteNumberParam('blockInstanceId');
        this.moduleId = CoreNavigator.getRouteNumberParam('moduleId');
        this.isGuest = CoreNavigator.getRouteBooleanParam('isGuest');

        this.debouncedUpdateCachedCompletion = CoreUtils.debounce(() => {
            if (this.modulesHaveCompletion) {
                CoreUtils.ignoreErrors(CoreCourse.getSections(this.course.id, false, true));
            } else {
                CoreUtils.ignoreErrors(CoreCourse.getActivitiesCompletionStatus(
                    this.course.id,
                    undefined,
                    undefined,
                    false,
                    false,
                    false,
                ));
            }
        }, 30000);

        this.initListeners();

        await this.loadData(false, true);

        this.dataLoaded = true;
    }

    /**
     * Init listeners.
     *
     * @returns Promise resolved when done.
     */
    protected async initListeners(): Promise<void> {
        if (this.completionObserver) {
            return; // Already initialized.
        }

        // Check if the course format requires the view to be refreshed when completion changes.
        const shouldRefresh = await CoreCourseFormatDelegate.shouldRefreshWhenCompletionChanges(this.course);
        if (!shouldRefresh) {
            return;
        }

        this.completionObserver = CoreEvents.on(
            CoreEvents.COMPLETION_MODULE_VIEWED,
            (data) => {
                if (data && data.courseId == this.course.id) {
                    this.showLoadingAndRefresh(true, false);
                }
            },
        );

        this.manualCompletionObserver = CoreEvents.on(CoreEvents.MANUAL_COMPLETION_CHANGED, (data) => {
            this.onCompletionChange(data.completion);
        });

        this.syncObserver = CoreEvents.on(CoreCourseSyncProvider.AUTO_SYNCED, (data) => {
            if (!data || data.courseId != this.course.id) {
                return;
            }

            this.showLoadingAndRefresh(false, false);

            if (data.warnings && data.warnings[0]) {
                CoreDomUtils.showAlert(undefined, data.warnings[0].message);
            }
        });
    }

    /**
     * Fetch and load all the data required for the view.
     *
     * @param refresh If it's refreshing content.
     * @param sync If it should try to sync.
     * @returns Promise resolved when done.
     */
    protected async loadData(refresh?: boolean, sync?: boolean): Promise<void> {
        // First of all, get the course because the data might have changed.
        const result = await CoreUtils.ignoreErrors(CoreCourseHelper.getCourse(this.course.id));

        if (result) {
            if (this.course.id === result.course.id && 'displayname' in this.course && !('displayname' in result.course)) {
                result.course.displayname = this.course.displayname;
            }
            this.course = result.course;
        }

        if (sync) {
            // Try to synchronize the course data.
            // For now we don't allow manual syncing, so ignore errors.
            const result = await CoreUtils.ignoreErrors(CoreCourseSync.syncCourse(
                this.course.id,
                this.course.displayname || this.course.fullname,
            ));
            if (result?.warnings?.length) {
                CoreDomUtils.showAlert(undefined, result.warnings[0].message);
            }
        }

        try {
            await Promise.all([
                this.loadSections(refresh),
                this.loadCourseFormatOptions(),
            ]);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.course.couldnotloadsectioncontent', true);
        }
    }

    /**
     * Load course sections.
     *
     * @param refresh If it's refreshing content.
     * @returns Promise resolved when done.
     */
    protected async loadSections(refresh?: boolean): Promise<void> {
        // Get all the sections.
        const sections = await CoreCourse.getSections(this.course.id, false, true);

        if (refresh) {
            // Invalidate the recently downloaded module list. To ensure info can be prefetched.
            const modules = CoreCourse.getSectionsModules(sections);

            await CoreCourseModulePrefetchDelegate.invalidateModules(modules, this.course.id);
        }

        let completionStatus: Record<string, CoreCourseCompletionActivityStatus> = {};

        // Get the completion status.
        if (this.course.enablecompletion !== false) {
            const sectionWithModules = sections.find((section) => section.modules.length > 0);

            if (sectionWithModules && sectionWithModules.modules[0].completion !== undefined) {
                // The module already has completion (3.6 onwards). Load the offline completion.
                this.modulesHaveCompletion = true;

                await CoreUtils.ignoreErrors(CoreCourseHelper.loadOfflineCompletion(this.course.id, sections));
            } else {
                const fetchedData = await CoreUtils.ignoreErrors(
                    CoreCourse.getActivitiesCompletionStatus(this.course.id),
                );

                completionStatus = fetchedData || completionStatus;
            }
        }

        // Add handlers
        const result = await CoreCourseHelper.addHandlerDataForModules(
            sections,
            this.course.id,
            completionStatus,
            this.course.fullname,
            true,
        );
        this.sections = result.sections;

        if (CoreCourseFormatDelegate.canViewAllSections(this.course)) {
            // Add a fake first section (all sections).
            this.sections.unshift(CoreCourseHelper.createAllSectionsSection());
        }

        // Get whether to show the refresher now that we have sections.
        this.displayRefresher = CoreCourseFormatDelegate.displayRefresher(this.course, this.sections);
    }

    /**
     * Load course format options if needed.
     *
     * @returns Promise resolved when done.
     */
    protected async loadCourseFormatOptions(): Promise<void> {

        // Load the course format options when course completion is enabled to show completion progress on sections.
        if (!this.course.enablecompletion) {
            return;
        }

        if ('courseformatoptions' in this.course && this.course.courseformatoptions) {
            // Already loaded.
            this.formatOptions = CoreUtils.objectToKeyValueMap(this.course.courseformatoptions, 'name', 'value');

            return;
        }

        const course = await CoreUtils.ignoreErrors(CoreCourses.getCourseByField('id', this.course.id));

        course && Object.assign(this.course, course);

        if (course?.courseformatoptions) {
            this.formatOptions = CoreUtils.objectToKeyValueMap(course.courseformatoptions, 'name', 'value');
        }
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     * @returns Promise resolved when done.
     */
    async doRefresh(refresher?: HTMLIonRefresherElement): Promise<void> {
        await CoreUtils.ignoreErrors(this.invalidateData());

        try {
            await this.loadData(true, true);
        } finally {
            // Do not call doRefresh on the format component if the refresher is defined in the format component
            // to prevent an infinite loop.
            if (this.displayRefresher && this.formatComponent) {
                await CoreUtils.ignoreErrors(this.formatComponent.doRefresh(refresher));
            }

            refresher?.complete();
        }
    }

    /**
     * The completion of any of the modules has changed.
     *
     * @param completionData Completion data.
     * @returns Promise resolved when done.
     */
    async onCompletionChange(completionData: CoreCourseModuleCompletionData): Promise<void> {
        const shouldReload = completionData.valueused === undefined || completionData.valueused;

        if (!shouldReload) {
            // Invalidate the completion.
            await CoreUtils.ignoreErrors(CoreCourse.invalidateSections(this.course.id));

            this.debouncedUpdateCachedCompletion?.();

            return;
        }

        await CoreUtils.ignoreErrors(this.invalidateData());

        await this.showLoadingAndRefresh(true, false);
    }

    /**
     * Invalidate the data.
     *
     * @returns Promise resolved when done.
     */
    protected async invalidateData(): Promise<void> {
        const promises: Promise<void>[] = [];

        promises.push(CoreCourse.invalidateSections(this.course.id));
        promises.push(CoreCourses.invalidateUserCourses());
        promises.push(CoreCourseFormatDelegate.invalidateData(this.course, this.sections || []));

        if (this.sections) {
            promises.push(CoreCourseModulePrefetchDelegate.invalidateCourseUpdates(this.course.id));
        }

        await Promise.all(promises);
    }

    /**
     * Refresh list after a completion change since there could be new activities.
     *
     * @param sync If it should try to sync.
     * @param invalidateData Whether to invalidate data. Set it to false if data has already been invalidated.
     * @returns Promise resolved when done.
     */
    protected async showLoadingAndRefresh(sync = false, invalidateData = true): Promise<void> {
        // Try to keep current scroll position.
        const scrollElement = await CoreUtils.ignoreErrors(this.content?.getScrollElement());
        const scrollTop = scrollElement?.scrollTop ?? -1;

        this.updatingData = true;
        this.changeDetectorRef.detectChanges();

        try {
            if (invalidateData) {
                await CoreUtils.ignoreErrors(this.invalidateData());
            }

            await this.loadData(true, sync);

            await this.formatComponent?.doRefresh(undefined, undefined, true);
        } finally {
            this.updatingData = false;
            this.changeDetectorRef.detectChanges();

            if (scrollTop > 0) {
                await CoreUtils.nextTick();
                this.content?.scrollToPoint(0, scrollTop, 0);
            }
        }
    }

    /**
     * @inheritdoc
     */
    async refreshContext(): Promise<void> {
        await this.showLoadingAndRefresh(true, true);
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.completionObserver?.off();
        this.manualCompletionObserver?.off();
        this.syncObserver?.off();
    }

    /**
     * User entered the page.
     */
    ionViewDidEnter(): void {
        this.formatComponent?.ionViewDidEnter();
    }

    /**
     * User left the page.
     */
    ionViewDidLeave(): void {
        this.formatComponent?.ionViewDidLeave();
    }

}
