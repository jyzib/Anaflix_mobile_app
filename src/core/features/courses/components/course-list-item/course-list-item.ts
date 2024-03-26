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
import {
    Component,
    ElementRef,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
} from '@angular/core';
import {
    CoreCourseProvider,
    CoreCourse,
} from '@features/course/services/course';
import {
    CoreCourseHelper,
    CorePrefetchStatusInfo,
} from '@features/course/services/course-helper';
import { CoreUser } from '@features/user/services/user';
import { CoreNavigator } from '@services/navigator';
import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { Translate } from '@singletons';
import { CoreColors } from '@singletons/colors';
import {
    CoreEventCourseStatusChanged,
    CoreEventObserver,
    CoreEvents,
} from '@singletons/events';
import {
    CoreCourseListItem,
    CoreCourses,
    CoreCoursesProvider,
} from '../../services/courses';
import {
    CoreCoursesHelper,
    CoreEnrolledCourseDataWithExtraInfoAndOptions,
} from '../../services/courses-helper';
import { CoreCoursesCourseOptionsMenuComponent } from '../course-options-menu/course-options-menu';
import { CoreEnrolHelper } from '@features/enrol/services/enrol-helper';

/**
 * This directive is meant to display an item for a list of courses.
 *
 * Example usage:
 *
 * <core-courses-course-list-item [course]="course"></core-courses-course-list-item>
 */
@Component({
    selector: 'core-courses-course-list-item',
    templateUrl: 'core-courses-course-list-item.html',
    styleUrls: ['course-list-item.scss'],
})
export class CoreCoursesCourseListItemComponent
    implements OnInit, OnDestroy, OnChanges
{
    @Input() course!: CoreCourseListItem; // The course to render.
    @Input() showDownload = false; // If true, will show download button.
    @Input() layout: 'listwithenrol' | 'summarycard' | 'list' | 'card' =
        'listwithenrol';

    enrolmentIcons: CoreCoursesEnrolmentIcons[] = [];
    isEnrolled = false;
    prefetchCourseData: CorePrefetchStatusInfo = {
        icon: '',
        statusTranslatable: 'core.loading',
        status: '',
        loading: true,
    };

    showSpinner = false;
    courseOptionMenuEnabled = false;
    progress = -1;
    completionUserTracked: boolean | undefined = false;

    protected courseStatus = CoreConstants.NOT_DOWNLOADED;
    protected isDestroyed = false;
    protected courseStatusObserver?: CoreEventObserver;

    protected element: HTMLElement;

    constructor(element: ElementRef) {
        this.element = element.nativeElement;
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        this.setCourseColor();

        // Assume is enroled if mode is not listwithenrol.
        this.isEnrolled =
            this.layout != 'listwithenrol' ||
            this.course.progress !== undefined;

        if (!this.isEnrolled) {
            try {
                const course = await CoreCourses.getUserCourse(this.course.id);
                this.course = Object.assign(this.course, course);
                this.updateCourseFields();

                this.isEnrolled = true;
            } catch {
                this.isEnrolled = false;
            }
        }

        if (this.isEnrolled) {
            // This field is only available from 3.6 onwards.
            this.courseOptionMenuEnabled =
                this.layout != 'listwithenrol' &&
                this.layout != 'summarycard' &&
                this.course.isfavourite !== undefined;

            this.initPrefetchCourse();
        } else if ('enrollmentmethods' in this.course) {
            this.enrolmentIcons = await CoreEnrolHelper.getEnrolmentIcons(
                this.course.enrollmentmethods,
                this.course.id
            );
        }
    }

    /**
     * Removes the course image set because it cannot be loaded and set the fallback icon color.
     */
    loadFallbackCourseIcon(): void {
        this.course.courseimage = undefined;

        // Set the color because it won't be set at this point.
        this.setCourseColor();
    }

    /**
     * Set course color.
     */
    protected async setCourseColor(): Promise<void> {
        await CoreCoursesHelper.loadCourseColorAndImage(this.course);

        if (this.course.color) {
            this.element.style.setProperty('--course-color', this.course.color);

            const tint = CoreColors.lighter(this.course.color, 50);
            this.element.style.setProperty('--course-color-tint', tint);
        } else if (this.course.colorNumber !== undefined) {
            this.element.classList.add(
                'course-color-' + this.course.colorNumber
            );
        }
    }

    /**
     * @inheritdoc
     */
    ngOnChanges(): void {
        this.initPrefetchCourse();

        this.updateCourseFields();
    }

    /**
     * Helper function to update course fields.
     */
    protected updateCourseFields(): void {
        this.progress =
            'progress' in this.course && typeof this.course.progress == 'number'
                ? this.course.progress
                : -1;
        this.completionUserTracked =
            'completionusertracked' in this.course &&
            this.course.completionusertracked;
    }

    /**
     * Open a course.
     */
    openCourse(): void {
        if (this.isEnrolled) {
            CoreCourseHelper.openCourse(this.course, {
                params: { isGuest: false },
            });
        } else {
            CoreNavigator.navigateToSitePath(
                `/course/${this.course.id}/summary`,
                { params: { course: this.course } }
            );
        }
    }

    /**
     * Initialize prefetch course.
     *
     * @param forceInit Force initialization of prefetch course info.
     */
    async initPrefetchCourse(forceInit = false): Promise<void> {
        if (
            !this.isEnrolled ||
            !this.showDownload ||
            (this.courseOptionMenuEnabled && !forceInit)
        ) {
            return;
        }

        if (this.courseStatusObserver !== undefined) {
            // Already initialized.
            return;
        }

        // Listen for status change in course.
        this.courseStatusObserver = CoreEvents.on(
            CoreEvents.COURSE_STATUS_CHANGED,
            (data: CoreEventCourseStatusChanged) => {
                if (
                    data.courseId == this.course.id ||
                    data.courseId == CoreCourseProvider.ALL_COURSES_CLEARED
                ) {
                    this.updateCourseStatus(data.status);
                }
            },
            CoreSites.getCurrentSiteId()
        );

        // Determine course prefetch icon.
        const status = await CoreCourse.getCourseStatus(this.course.id);

        this.updateCourseStatus(status);

        if (this.prefetchCourseData.loading) {
            // Course is being downloaded. Get the download promise.
            const promise = CoreCourseHelper.getCourseDownloadPromise(
                this.course.id
            );
            if (promise) {
                // There is a download promise. If it fails, show an error.
                promise.catch((error) => {
                    if (!this.isDestroyed) {
                        CoreDomUtils.showErrorModalDefault(
                            error,
                            'core.course.errordownloadingcourse',
                            true
                        );
                    }
                });
            } else {
                // No download, this probably means that the app was closed while downloading. Set previous status.
                CoreCourse.setCoursePreviousStatus(this.course.id);
            }
        }
    }

    /**
     * Update the course status icon and title.
     *
     * @param status Status to show.
     */
    protected updateCourseStatus(status: string): void {
        const statusData = CoreCourseHelper.getCoursePrefetchStatusInfo(status);

        this.courseStatus = status;
        this.prefetchCourseData.status = statusData.status;
        this.prefetchCourseData.icon = statusData.icon;
        this.prefetchCourseData.statusTranslatable =
            statusData.statusTranslatable;
        this.prefetchCourseData.loading = statusData.loading;
        this.prefetchCourseData.downloadSucceeded =
            status === CoreConstants.DOWNLOADED;
    }

    /**
     * Prefetch the course.
     *
     * @param event Click event.
     */
    async prefetchCourse(event?: Event): Promise<void> {
        event?.preventDefault();
        event?.stopPropagation();

        try {
            await CoreCourseHelper.confirmAndPrefetchCourse(
                this.prefetchCourseData,
                this.course
            );
        } catch (error) {
            if (!this.isDestroyed) {
                CoreDomUtils.showErrorModalDefault(
                    error,
                    'core.course.errordownloadingcourse',
                    true
                );
            }
        }
    }

    /**
     * Delete course stored data.
     */
    async deleteCourseStoredData(): Promise<void> {
        try {
            await CoreDomUtils.showDeleteConfirm(
                'addon.storagemanager.confirmdeletedatafrom',
                { name: this.course.displayname || this.course.fullname }
            );
        } catch (error) {
            if (!CoreDomUtils.isCanceledError(error)) {
                throw error;
            }

            return;
        }

        const modal = await CoreDomUtils.showModalLoading();

        try {
            await CoreCourseHelper.deleteCourseFiles(this.course.id);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(
                error,
                Translate.instant('core.errordeletefile')
            );
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Show the context menu.
     *
     * @param event Click Event.
     */
    async showCourseOptionsMenu(event: Event): Promise<void> {
        event.preventDefault();
        event.stopPropagation();

        this.initPrefetchCourse(true);

        const popoverData = await CoreDomUtils.openPopover<string>({
            component: CoreCoursesCourseOptionsMenuComponent,
            componentProps: {
                course: this.course,
                prefetch: this.prefetchCourseData,
            },
            event: event,
        });

        switch (popoverData) {
            case 'download':
                if (!this.prefetchCourseData.loading) {
                    this.prefetchCourse(event);
                }
                break;
            case 'delete':
                if (
                    this.courseStatus == CoreConstants.DOWNLOADED ||
                    this.courseStatus == CoreConstants.OUTDATED
                ) {
                    this.deleteCourseStoredData();
                }
                break;
            case 'hide':
                this.setCourseHidden(true);
                break;
            case 'show':
                this.setCourseHidden(false);
                break;
            case 'favourite':
                this.setCourseFavourite(true);
                break;
            case 'unfavourite':
                this.setCourseFavourite(false);
                break;
            default:
                break;
        }
    }

    /**
     * Hide/Unhide the course from the course list.
     *
     * @param hide True to hide and false to show.
     */
    protected async setCourseHidden(hide: boolean): Promise<void> {
        this.showSpinner = true;

        // We should use null to unset the preference.
        try {
            await CoreUser.updateUserPreference(
                'block_myoverview_hidden_course_' + this.course.id,
                hide ? '1' : undefined
            );

            this.course.hidden = hide;

            (<CoreEnrolledCourseDataWithExtraInfoAndOptions>(
                this.course
            )).hidden = hide;
            CoreEvents.trigger(
                CoreCoursesProvider.EVENT_MY_COURSES_UPDATED,
                {
                    courseId: this.course.id,
                    course: this.course,
                    action: CoreCoursesProvider.ACTION_STATE_CHANGED,
                    state: CoreCoursesProvider.STATE_HIDDEN,
                    value: hide,
                },
                CoreSites.getCurrentSiteId()
            );
        } catch (error) {
            if (!this.isDestroyed) {
                CoreDomUtils.showErrorModalDefault(
                    error,
                    'Error changing course visibility.'
                );
            }
        } finally {
            this.showSpinner = false;
        }
    }

    /**
     * Favourite/Unfavourite the course from the course list.
     *
     * @param favourite True to favourite and false to unfavourite.
     */
    protected async setCourseFavourite(favourite: boolean): Promise<void> {
        this.showSpinner = true;

        try {
            await CoreCourses.setFavouriteCourse(this.course.id, favourite);

            this.course.isfavourite = favourite;
            CoreEvents.trigger(
                CoreCoursesProvider.EVENT_MY_COURSES_UPDATED,
                {
                    courseId: this.course.id,
                    course: this.course,
                    action: CoreCoursesProvider.ACTION_STATE_CHANGED,
                    state: CoreCoursesProvider.STATE_FAVOURITE,
                    value: favourite,
                },
                CoreSites.getCurrentSiteId()
            );
        } catch (error) {
            if (!this.isDestroyed) {
                CoreDomUtils.showErrorModalDefault(
                    error,
                    'Error changing course favourite attribute.'
                );
            }
        } finally {
            this.showSpinner = false;
        }
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.courseStatusObserver?.off();
    }
}

/**
 * Enrolment icons to show on the list with a label.
 */
export type CoreCoursesEnrolmentIcons = {
    label: string;
    icon: string;
};
