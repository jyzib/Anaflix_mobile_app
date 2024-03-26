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

import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IonContent } from '@ionic/angular';

import { CoreError } from '@classes/errors/error';
import { CanLeave } from '@guards/can-leave';
import { CoreNetwork } from '@services/network';
import { CoreNavigator } from '@services/navigator';
import { CoreSites, CoreSitesCommonWSOptions, CoreSitesReadingStrategy } from '@services/sites';
import { CoreSync } from '@services/sync';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreUtils } from '@services/utils/utils';
import { CoreWSExternalFile } from '@services/ws';
import { ModalController, Translate } from '@singletons';
import { CoreEvents } from '@singletons/events';
import { AddonModLessonMenuModalPage } from '../../components/menu-modal/menu-modal';
import {
    AddonModLesson,
    AddonModLessonEOLPageDataEntry,
    AddonModLessonFinishRetakeResponse,
    AddonModLessonGetAccessInformationWSResponse,
    AddonModLessonGetPageDataWSResponse,
    AddonModLessonGetPagesPageWSData,
    AddonModLessonLaunchAttemptWSResponse,
    AddonModLessonLessonWSData,
    AddonModLessonMessageWSData,
    AddonModLessonPageWSData,
    AddonModLessonPossibleJumps,
    AddonModLessonProcessPageOptions,
    AddonModLessonProcessPageResponse,
    AddonModLessonProvider,
} from '../../services/lesson';
import {
    AddonModLessonActivityLink,
    AddonModLessonHelper,
    AddonModLessonPageButton,
    AddonModLessonQuestion,
} from '../../services/lesson-helper';
import { AddonModLessonOffline } from '../../services/lesson-offline';
import { AddonModLessonSync } from '../../services/lesson-sync';
import { CoreFormFields, CoreForms } from '@singletons/form';
import { CoreAnalytics, CoreAnalyticsEventType } from '@services/analytics';

/**
 * Page that allows attempting and reviewing a lesson.
 */
@Component({
    selector: 'page-addon-mod-lesson-player',
    templateUrl: 'player.html',
    styleUrls: ['player.scss'],
})
export class AddonModLessonPlayerPage implements OnInit, OnDestroy, CanLeave {

    @ViewChild(IonContent) content?: IonContent;
    @ViewChild('questionFormEl') formElement?: ElementRef;

    component = AddonModLessonProvider.COMPONENT;
    readonly LESSON_EOL = AddonModLessonProvider.LESSON_EOL;
    questionForm?: FormGroup; // The FormGroup for question pages.
    title?: string; // The page title.
    lesson?: AddonModLessonLessonWSData; // The lesson object.
    currentPage?: number; // Current page being viewed.
    review?: boolean; // Whether the user is reviewing.
    messages: AddonModLessonMessageWSData[] = []; // Messages to display to the user.
    canManage?: boolean; // Whether the user can manage the lesson.
    retake?: number; // Current retake number.
    showRetake?: boolean; // Whether the retake number needs to be displayed.
    lessonWidth?: string; // Width of the lesson (if slideshow mode).
    lessonHeight?: string; // Height of the lesson (if slideshow mode).
    endTime?: number; // End time of the lesson if it's timed.
    pageData?: AddonModLessonGetPageDataWSResponse; // Current page data.
    pageContent?: string; // Current page contents.
    pageButtons?: AddonModLessonPageButton[]; // List of buttons of the current page.
    question?: AddonModLessonQuestion; // Question of the current page (if it's a question page).
    eolData?: Record<string, AddonModLessonEOLPageDataEntry>; // Data for EOL page (if current page is EOL).
    processData?: AddonModLessonProcessPageResponse; // Data to display after processing a page.
    processDataButtons: ProcessDataButton[] = []; // Buttons to display after processing a page.
    loaded?: boolean; // Whether data has been loaded.
    displayMenu?: boolean; // Whether the lesson menu should be displayed.
    originalData?: CoreFormFields; // Original question data. It is used to check if data has changed.
    reviewPageId?: number; // Page to open if the user wants to review the attempt.
    courseId!: number; // The course ID the lesson belongs to.
    lessonPages?: AddonModLessonPageWSData[]; // Lesson pages (for the lesson menu).
    loadingMenu?: boolean; // Whether the lesson menu is being loaded.
    mediaFile?: CoreWSExternalFile; // Media file of the lesson.
    activityLink?: AddonModLessonActivityLink; // Next activity link data.
    cmId!: number; // Course module ID.

    protected password?: string; // Lesson password (if any).
    protected forceLeave = false; // If true, don't perform any check when leaving the view.
    protected offline?: boolean; // Whether we are in offline mode.
    protected accessInfo?: AddonModLessonGetAccessInformationWSResponse; // Lesson access info.
    protected jumps?: AddonModLessonPossibleJumps; // All possible jumps.
    protected firstPageLoaded?: boolean; // Whether the first page has been loaded.
    protected retakeToReview?: number; // Retake to review.
    protected menuShown = false; // Whether menu is shown.

    constructor(
        protected changeDetector: ChangeDetectorRef,
        protected formBuilder: FormBuilder,
    ) {
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        try {
            this.cmId = CoreNavigator.getRequiredRouteNumberParam('cmId');
            this.courseId = CoreNavigator.getRequiredRouteNumberParam('courseId');
            this.password = CoreNavigator.getRouteParam('password');
            this.review = !!CoreNavigator.getRouteBooleanParam('review');
            this.currentPage = CoreNavigator.getRouteNumberParam('pageId');
            this.retakeToReview = CoreNavigator.getRouteNumberParam('retake');
        } catch (error) {
            CoreDomUtils.showErrorModal(error);

            CoreNavigator.back();

            return;
        }

        try {
            // Fetch the Lesson data.
            const success = await this.fetchLessonData();
            if (success) {
                // Review data loaded or new retake started, remove any retake being finished in sync.
                AddonModLessonSync.deleteRetakeFinishedInSync(this.lesson!.id);
            }
        } finally {
            this.loaded = true;
        }
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        if (this.lesson) {
            // Unblock the lesson so it can be synced.
            CoreSync.unblockOperation(this.component, this.lesson.id);
        }
    }

    /**
     * Check if we can leave the page or not.
     *
     * @returns Resolved if we can leave it, rejected if not.
     */
    async canLeave(): Promise<boolean> {
        if (this.forceLeave || !this.questionForm) {
            return true;
        }

        if (this.question && !this.eolData && !this.processData && this.originalData) {
            // Question shown. Check if there is any change.
            if (!CoreUtils.basicLeftCompare(this.questionForm.getRawValue(), this.originalData, 3)) {
                await CoreDomUtils.showConfirm(Translate.instant('core.confirmcanceledit'));
            }
        }

        CoreForms.triggerFormCancelledEvent(this.formElement, CoreSites.getCurrentSiteId());

        return true;
    }

    /**
     * Runs when the page is about to leave and no longer be the active page.
     */
    ionViewWillLeave(): void {
        if (this.menuShown) {
            ModalController.dismiss();
        }
    }

    /**
     * A button was clicked.
     *
     * @param data Button data.
     */
    buttonClicked(data: Record<string, string>): void {
        this.processPage(data);
    }

    /**
     * Call a function and go offline if allowed and the call fails.
     *
     * @param func Function to call.
     * @param options Options passed to the function.
     * @returns Promise resolved in success, rejected otherwise.
     */
    protected async callFunction<T>(func: () => Promise<T>, options: CommonOptions): Promise<T> {
        try {
            return await func();
        } catch (error) {
            if (this.offline || this.review || !AddonModLesson.isLessonOffline(this.lesson!)) {
                // Already offline or not allowed.
                throw error;
            }

            if (CoreUtils.isWebServiceError(error)) {
                // WebService returned an error, cannot perform the action.
                throw error;
            }

            // Go offline and retry.
            this.offline = true;

            // Get the possible jumps now.
            this.jumps = await AddonModLesson.getPagesPossibleJumps(this.lesson!.id, {
                cmId: this.cmId,
                readingStrategy: CoreSitesReadingStrategy.PREFER_CACHE,
            });

            // Call the function again with offline mode and the new jumps.
            options.readingStrategy = CoreSitesReadingStrategy.PREFER_CACHE;
            options.jumps = this.jumps;
            options.offline = true;

            return func();
        }
    }

    /**
     * Change the page from menu or when continuing from a feedback page.
     *
     * @param pageId Page to load.
     * @param ignoreCurrent If true, allow loading current page.
     * @returns Promise resolved when done.
     */
    async changePage(pageId: number, ignoreCurrent?: boolean): Promise<void> {
        if (!ignoreCurrent && !this.eolData && this.currentPage == pageId) {
            // Page already loaded, stop.
            return;
        }

        this.loaded = true;
        this.messages = [];

        try {
            await this.loadPage(pageId);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error loading page');
        } finally {
            this.loaded = true;
        }
    }

    /**
     * Get the lesson data and load the page.
     *
     * @returns Promise resolved with true if success, resolved with false otherwise.
     */
    protected async fetchLessonData(): Promise<boolean> {
        try {
            this.lesson = await AddonModLesson.getLesson(this.courseId, this.cmId);

            this.title = this.lesson.name; // Temporary title.

            // Block the lesson so it cannot be synced.
            CoreSync.blockOperation(this.component, this.lesson.id);

            // Wait for any ongoing sync to finish. We won't sync a lesson while it's being played.
            await AddonModLessonSync.waitForSync(this.lesson.id);

            // If lesson has offline data already, use offline mode.
            this.offline = await AddonModLessonOffline.hasOfflineData(this.lesson.id);

            if (!this.offline && !CoreNetwork.isOnline() && AddonModLesson.isLessonOffline(this.lesson) && !this.review) {
                // Lesson doesn't have offline data, but it allows offline and the device is offline. Use offline mode.
                this.offline = true;
            }

            const lessonId = this.lesson.id;
            const options = {
                cmId: this.cmId,
                readingStrategy: this.offline ? CoreSitesReadingStrategy.PREFER_CACHE : CoreSitesReadingStrategy.ONLY_NETWORK,
            };
            this.accessInfo = await this.callFunction<AddonModLessonGetAccessInformationWSResponse>(
                () => AddonModLesson.getAccessInformation(lessonId, options),
                options,
            );

            const promises: Promise<void>[] = [];
            this.canManage = this.accessInfo.canmanage;
            this.retake = this.accessInfo.attemptscount;
            this.showRetake = !this.currentPage && this.retake > 0; // Only show it in first page if it isn't the first retake.

            if (this.accessInfo.preventaccessreasons.length) {
                // If it's a password protected lesson and we have the password, allow playing it.
                const preventReason = AddonModLesson.getPreventAccessReason(this.accessInfo, !!this.password, this.review);
                if (preventReason) {
                    // Lesson cannot be played, show message and go back.
                    throw new CoreError(preventReason.message);
                }
            }

            if (this.review && this.retakeToReview != this.accessInfo.attemptscount - 1) {
                // Reviewing a retake that isn't the last one. Error.
                throw new CoreError(Translate.instant('addon.mod_lesson.errorreviewretakenotlast'));
            }

            if (this.password) {
                // Lesson uses password, get the whole lesson object.
                const options = {
                    password: this.password,
                    cmId: this.cmId,
                    readingStrategy: this.offline ? CoreSitesReadingStrategy.PREFER_CACHE : CoreSitesReadingStrategy.ONLY_NETWORK,
                };
                promises.push(this.callFunction<AddonModLessonLessonWSData>(
                    () => AddonModLesson.getLessonWithPassword(lessonId, options),
                    options,
                ).then((lesson) => {
                    this.lesson = lesson;

                    return;
                }));
            }

            if (this.offline) {
                // Offline mode, get the list of possible jumps to allow navigation.
                promises.push(AddonModLesson.getPagesPossibleJumps(this.lesson.id, {
                    cmId: this.cmId,
                    readingStrategy: CoreSitesReadingStrategy.PREFER_CACHE,
                }).then((jumpList) => {
                    this.jumps = jumpList;

                    return;
                }));
            }

            await Promise.all(promises);

            this.mediaFile = this.lesson.mediafiles?.[0];
            this.lessonWidth = this.lesson.slideshow ? CoreDomUtils.formatPixelsSize(this.lesson.mediawidth!) : '';
            this.lessonHeight = this.lesson.slideshow ? CoreDomUtils.formatPixelsSize(this.lesson.mediaheight!) : '';

            await this.launchRetake(this.currentPage);

            return true;
        } catch (error) {

            if (this.review && this.retakeToReview && CoreUtils.isWebServiceError(error)) {
                // The user cannot review the retake. Unmark the retake as being finished in sync.
                await AddonModLessonSync.deleteRetakeFinishedInSync(this.lesson!.id);
            }

            CoreDomUtils.showErrorModalDefault(error, 'core.course.errorgetmodule', true);
            this.forceLeave = true;
            CoreNavigator.back();

            return false;
        }
    }

    /**
     * Finish the retake.
     *
     * @param outOfTime Whether the retake is finished because the user ran out of time.
     * @returns Promise resolved when done.
     */
    protected async finishRetake(outOfTime?: boolean): Promise<void> {
        if (!this.lesson) {
            return;
        }

        const lesson = this.lesson;
        this.messages = [];

        if (this.offline && CoreNetwork.isOnline()) {
            // Offline mode but the app is online. Try to sync the data.
            const result = await CoreUtils.ignoreErrors(
                AddonModLessonSync.syncLesson(lesson.id, true, true),
            );

            if (result?.warnings?.length) {
                // Some data was deleted. Check if the retake has changed.
                const info = await AddonModLesson.getAccessInformation(lesson.id, {
                    cmId: this.cmId,
                });

                if (info.attemptscount != this.accessInfo!.attemptscount) {
                    // The retake has changed. Leave the view and show the error.
                    this.forceLeave = true;
                    CoreNavigator.back();

                    throw new CoreError(result.warnings[0]);
                }

                // Retake hasn't changed, show the warning and finish the retake in offline.
                CoreDomUtils.showAlert(undefined, result.warnings[0]);
            }

            this.offline = false;
        }

        // Now finish the retake.
        const options = {
            password: this.password,
            outOfTime,
            review: this.review,
            offline: this.offline,
            accessInfo: this.accessInfo,
        };
        const data = await this.callFunction<AddonModLessonFinishRetakeResponse>(
            () => AddonModLesson.finishRetake(lesson, this.courseId, options),
            options,
        );

        this.title = lesson.name;
        this.eolData = data.data;
        this.messages = this.messages.concat(data.messages);
        this.processData = undefined;
        this.endTime = undefined;

        CoreEvents.trigger(CoreEvents.ACTIVITY_DATA_SENT, { module: 'lesson' });

        // Format activity link if present.
        if (this.eolData.activitylink) {
            this.activityLink = AddonModLessonHelper.formatActivityLink(<string> this.eolData.activitylink.value);
        } else {
            this.activityLink = undefined;
        }

        // Format review lesson if present.
        if (this.eolData.reviewlesson) {
            const params = CoreUrlUtils.extractUrlParams(<string> this.eolData.reviewlesson.value);

            if (!params || !params.pageid) {
                // No pageid in the URL, the user cannot review (probably didn't answer any question).
                delete this.eolData.reviewlesson;
            } else {
                this.reviewPageId = Number(params.pageid);
            }
        }

        this.logPageLoaded(AddonModLessonProvider.LESSON_EOL, Translate.instant('addon.mod_lesson.congratulations'));
    }

    /**
     * Jump to a certain page after performing an action.
     *
     * @param pageId The page to load.
     * @returns Promise resolved when done.
     */
    protected async jumpToPage(pageId: number): Promise<void> {
        if (pageId === 0) {
            // Not a valid page, return to entry view.
            // This happens, for example, when the user clicks to go to previous page and there is no previous page.
            this.forceLeave = true;
            CoreNavigator.back();

            return;
        } else if (pageId == AddonModLessonProvider.LESSON_EOL) {
            // End of lesson reached.
            return this.finishRetake();
        }

        // Load new page.
        this.messages = [];

        return this.loadPage(pageId);
    }

    /**
     * Start or continue a retake.
     *
     * @param pageId The page to load.
     * @returns Promise resolved when done.
     */
    protected async launchRetake(pageId?: number): Promise<void> {
        let data: AddonModLessonLaunchAttemptWSResponse | undefined;

        if (this.review) {
            // Review mode, no need to launch the retake.
        } else if (!this.offline) {
            // Not in offline mode, launch the retake.
            data = await AddonModLesson.launchRetake(this.lesson!.id, this.password, pageId);
        } else {
            // Check if there is a finished offline retake.
            const finished = await AddonModLessonOffline.hasFinishedRetake(this.lesson!.id);
            if (finished) {
                // Always show EOL page.
                pageId = AddonModLessonProvider.LESSON_EOL;
            }
        }

        this.currentPage = pageId || this.accessInfo!.firstpageid;
        this.messages = data?.messages || [];

        if (this.lesson!.timelimit && !this.accessInfo!.canmanage) {
            // Get the last lesson timer.
            const timers = await AddonModLesson.getTimers(this.lesson!.id, {
                cmId: this.cmId,
                readingStrategy: CoreSitesReadingStrategy.ONLY_NETWORK,
            });

            this.endTime = timers[timers.length - 1].starttime + this.lesson!.timelimit;
        }

        return this.loadPage(this.currentPage);
    }

    /**
     * Load the lesson menu.
     *
     * @returns Promise resolved when done.
     */
    protected async loadMenu(): Promise<void> {
        if (this.loadingMenu || !this.lesson) {
            // Already loading.
            return;
        }

        try {
            this.loadingMenu = true;
            const lessonId = this.lesson.id;
            const options = {
                password: this.password,
                cmId: this.cmId,
                readingStrategy: this.offline ? CoreSitesReadingStrategy.PREFER_CACHE : CoreSitesReadingStrategy.ONLY_NETWORK,
            };

            const pages = await this.callFunction<AddonModLessonGetPagesPageWSData[]>(
                () => AddonModLesson.getPages(lessonId, options),
                options,
            );

            this.lessonPages = pages.map((entry) => entry.page);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error loading menu.');
        } finally {
            this.loadingMenu = false;
        }
    }

    /**
     * Load a certain page.
     *
     * @param pageId The page to load.
     * @returns Promise resolved when done.
     */
    protected async loadPage(pageId: number): Promise<void> {
        if (pageId == AddonModLessonProvider.LESSON_EOL) {
            // End of lesson reached.
            return this.finishRetake();
        } else if (!this.lesson) {
            return;
        }

        const lesson = this.lesson;
        const options = {
            password: this.password,
            review: this.review,
            includeContents: true,
            cmId: this.cmId,
            readingStrategy: this.offline ? CoreSitesReadingStrategy.PREFER_CACHE : CoreSitesReadingStrategy.ONLY_NETWORK,
            accessInfo: this.accessInfo,
            jumps: this.jumps,
            includeOfflineData: true,
        };

        const data = await this.callFunction<AddonModLessonGetPageDataWSResponse>(
            () => AddonModLesson.getPageData(lesson, pageId, options),
            options,
        );

        if (data.newpageid == AddonModLessonProvider.LESSON_EOL) {
            // End of lesson reached.
            return this.finishRetake();
        }

        this.pageData = data;
        this.title = data.page!.title;
        this.pageContent = AddonModLessonHelper.getPageContentsFromPageData(data);
        this.loaded = true;
        this.currentPage = pageId;
        this.messages = this.messages.concat(data.messages);

        // Page loaded, hide EOL and feedback data if shown.
        this.eolData = this.processData = undefined;

        if (AddonModLesson.isQuestionPage(data.page!.type)) {
            // Create an empty FormGroup without controls, they will be added in getQuestionFromPageData.
            this.questionForm = this.formBuilder.group({});
            this.pageButtons = [];
            this.question = AddonModLessonHelper.getQuestionFromPageData(this.questionForm, data);
            this.originalData = this.questionForm.getRawValue(); // Use getRawValue to include disabled values.
        } else {
            this.pageButtons = AddonModLessonHelper.getPageButtonsFromHtml(data.pagecontent || '');
            this.question = undefined;
            this.originalData = undefined;
        }

        // Don't display the navigation menu in review mode, using them displays errors.
        if (data.displaymenu && !this.displayMenu && !this.review) {
            // Load the menu.
            this.loadMenu();
        }
        this.displayMenu = !this.review && !!data.displaymenu;

        if (!this.firstPageLoaded) {
            this.firstPageLoaded = true;
        } else {
            this.showRetake = false;
        }

        this.logPageLoaded(pageId, data.page?.title ?? '');
    }

    /**
     * Log page loaded.
     *
     * @param pageId Page ID.
     */
    protected logPageLoaded(pageId: number, title: string): void {
        if (!this.lesson) {
            return;
        }

        CoreAnalytics.logEvent({
            type: CoreAnalyticsEventType.VIEW_ITEM,
            ws: 'mod_lesson_get_page_data',
            name: this.lesson.name + ': ' + title,
            data: { id: this.lesson.id, pageid: pageId, category: 'lesson' },
            url: `/mod/lesson/view.php?id=${this.lesson.id}&pageid=${pageId}`,
        });
    }

    /**
     * Log continue page.
     */
    protected logContinuePageLoaded(): void {
        if (!this.lesson) {
            return;
        }

        CoreAnalytics.logEvent({
            type: CoreAnalyticsEventType.VIEW_ITEM,
            ws: 'mod_lesson_process_page',
            name: this.lesson.name + ': ' + Translate.instant('addon.mod_lesson.continue'),
            data: { id: this.lesson.id, category: 'lesson' },
            url: '/mod/lesson/continue.php',
        });
    }

    /**
     * Process a page, sending some data.
     *
     * @param data The data to send.
     * @param formSubmitted Whether a form was submitted.
     * @returns Promise resolved when done.
     */
    protected async processPage(data: CoreFormFields, formSubmitted?: boolean): Promise<void> {
        if (!this.lesson || !this.pageData) {
            return;
        }

        this.loaded = false;

        const lesson = this.lesson;
        const pageData = this.pageData;
        const options: AddonModLessonProcessPageOptions = {
            password: this.password,
            review: this.review,
            offline: this.offline,
            accessInfo: this.accessInfo,
            jumps: this.jumps,
        };

        try {
            const result = await this.callFunction<AddonModLessonProcessPageResponse>(
                () => AddonModLesson.processPage(
                    lesson,
                    this.courseId,
                    pageData,
                    data,
                    options,
                ),
                options,
            );

            if (formSubmitted) {
                CoreForms.triggerFormSubmittedEvent(
                    this.formElement,
                    result.sent,
                    CoreSites.getCurrentSiteId(),
                );
            }

            if (!this.offline && !this.review && AddonModLesson.isLessonOffline(lesson)) {
                // Lesson allows offline and the user changed some data in server. Update cached data.
                const retake = this.accessInfo!.attemptscount;
                const options = {
                    cmId: this.cmId,
                    readingStrategy: CoreSitesReadingStrategy.ONLY_NETWORK,
                };

                // Update in background the list of content pages viewed or question attempts.
                if (AddonModLesson.isQuestionPage(this.pageData?.page?.type || -1)) {
                    AddonModLesson.getQuestionsAttemptsOnline(lesson.id, retake, options);
                } else {
                    AddonModLesson.getContentPagesViewedOnline(lesson.id, retake, options);
                }
            }

            if (result.nodefaultresponse || result.inmediatejump) {
                // Don't display feedback or force a redirect to a new page. Load the new page.
                return await this.jumpToPage(result.newpageid);
            }

            // Not inmediate jump, show the feedback.
            result.feedback = AddonModLessonHelper.removeQuestionFromFeedback(result.feedback);
            this.messages = result.messages;
            this.processData = result;
            this.processDataButtons = [];

            if (lesson.review && !result.correctanswer && !result.noanswer && !result.isessayquestion &&
                    !result.maxattemptsreached && !result.reviewmode) {
                // User can try again, show button to do so.
                this.processDataButtons.push({
                    label: 'addon.mod_lesson.reviewquestionback',
                    pageId: this.currentPage!,
                });
            }

            // Button to continue.
            if (lesson.review && !result.correctanswer && !result.noanswer && !result.isessayquestion &&
                    !result.maxattemptsreached) {
                /* If both the "Yes, I'd like to try again" and "No, I just want to go on to the next question" point to the
                    same page then don't show the "No, I just want to go on to the next question" button. It's confusing. */
                if (pageData.page?.id != result.newpageid) {
                    // Button to continue the lesson (the page to go is configured by the teacher).
                    this.processDataButtons.push({
                        label: 'addon.mod_lesson.reviewquestioncontinue',
                        pageId: result.newpageid,
                    });
                }
            } else {
                this.processDataButtons.push({
                    label: 'addon.mod_lesson.continue',
                    pageId: result.newpageid,
                });
            }

            this.logContinuePageLoaded();
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error processing page');
        } finally {
            this.loaded = true;
        }
    }

    /**
     * Review the lesson.
     *
     * @param pageId Page to load.
     */
    async reviewLesson(pageId: number): Promise<void> {
        this.loaded = false;
        this.review = true;
        this.offline = false; // Don't allow offline mode in review.

        try {
            await this.loadPage(pageId);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error loading page');
        } finally {
            this.loaded = true;
        }
    }

    /**
     * Submit a question.
     *
     * @param e Event.
     */
    submitQuestion(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        this.loaded = false;

        // Use getRawValue to include disabled values.
        const data = AddonModLessonHelper.prepareQuestionData(this.question!, this.questionForm!.getRawValue());

        this.processPage(data, true).finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Time up.
     */
    async timeUp(): Promise<void> {
        // Time up called, hide the timer.
        this.endTime = undefined;
        this.loaded = false;

        try {
            await this.finishRetake(true);
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'Error finishing attempt');
        } finally {
            this.loaded = true;
        }
    }

    /**
     * Show the navigation modal.
     *
     * @returns Promise resolved when done.
     */
    async showMenu(): Promise<void> {
        this.menuShown = true;

        await CoreDomUtils.openSideModal({
            component: AddonModLessonMenuModalPage,
            componentProps: {
                pageInstance: this,
            },
        });

        this.menuShown = false;
    }

}

/**
 * Common options for functions called using callFunction.
 */
type CommonOptions = CoreSitesCommonWSOptions & {
    jumps?: AddonModLessonPossibleJumps;
    offline?: boolean;
};

/**
 * Button displayed after processing a page.
 */
type ProcessDataButton = {
    label: string;
    pageId: number;
};
