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

import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    ValidatorFn,
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';

import { CoreApp } from '@services/app';
import { CoreNetwork } from '@services/network';
import { CoreConfig } from '@services/config';
import {
    CoreSites,
    CoreSiteCheckResponse,
    CoreLoginSiteInfo,
    CoreSitesDemoSiteData,
} from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreDomUtils } from '@services/utils/dom';
import {
    CoreLoginHelper,
    CoreLoginSiteFinderSettings,
    CoreLoginSiteSelectorListMethod,
} from '@features/login/services/login-helper';
import { CoreError } from '@classes/errors/error';
import { CoreConstants } from '@/core/constants';
import { Translate } from '@singletons';
import { CoreUrl } from '@singletons/url';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreLoginSiteHelpComponent } from '@features/login/components/site-help/site-help';
import { CoreLoginSiteOnboardingComponent } from '@features/login/components/site-onboarding/site-onboarding';
import { CoreNavigator } from '@services/navigator';
import {
    CoreCustomURLSchemes,
    CoreCustomURLSchemesHandleError,
} from '@services/urlschemes';
import { CoreTextUtils } from '@services/utils/text';
import { CoreForms } from '@singletons/form';
import { AlertButton } from '@ionic/core';
import { CoreSiteError } from '@classes/errors/siteerror';
import { CoreUserSupport } from '@features/user/services/support';
import { CoreErrorInfoComponent } from '@components/error-info/error-info';
import { CoreUserSupportConfig } from '@features/user/classes/support/support-config';
import { CoreUserGuestSupportConfig } from '@features/user/classes/support/guest-support-config';
import { CoreLoginError } from '@classes/errors/loginerror';
import { CorePlatform } from '@services/platform';
import { CoreReferrer } from '@services/referrer';
import { CoreSitesFactory } from '@services/sites-factory';
import { ONBOARDING_DONE } from '@features/login/constants';

/**
 * Site (url) chooser when adding a new site.
 */
@Component({
    selector: 'page-core-login-site',
    templateUrl: 'site.html',
    styleUrls: ['site.scss', '../../login.scss'],
})
export class CoreLoginSitePage implements OnInit {
    @ViewChild('siteFormEl') formElement?: ElementRef;

    siteForm!: FormGroup;
    fixedSites?: CoreLoginSiteInfoExtended[];
    filteredSites?: CoreLoginSiteInfoExtended[];
    siteSelector: CoreLoginSiteSelectorListMethod = 'sitefinder';
    showKeyboard = false;
    filter = '';
    sites: CoreLoginSiteInfoExtended[] = [];
    hasSites = false;
    loadingSites = false;
    searchFunction!: (search: string) => void;
    showScanQR!: boolean;
    enteredSiteUrl?: CoreLoginSiteInfoExtended;
    siteFinderSettings!: CoreLoginSiteFinderSettings;

    constructor(protected formBuilder: FormBuilder) {}

    /**
     * Initialize the component.
     */
    async ngOnInit(): Promise<void> {
        let url = '';
        this.siteSelector = CoreConstants.CONFIG.multisitesdisplay;

        const siteFinderSettings: Partial<CoreLoginSiteFinderSettings> =
            CoreConstants.CONFIG.sitefindersettings || {};
        this.siteFinderSettings = {
            displaysitename: true,
            displayimage: true,
            displayalias: true,
            displaycity: true,
            displaycountry: true,
            displayurl: true,
            ...siteFinderSettings,
        };

        // Load fixed sites if they're set.
        const sites = await CoreLoginHelper.getAvailableSites();

        if (sites.length) {
            url = await this.initSiteSelector();
        } else {
            url = (await this.consumeInstallReferrerUrl()) ?? '';

            const showOnboarding =
                CoreConstants.CONFIG.enableonboarding && !CorePlatform.isIOS();

            if (url) {
                this.connect(url);

                if (showOnboarding) {
                    // Don't display onboarding in this case, and don't display it again later.
                    CoreConfig.set(ONBOARDING_DONE, 1);
                }
            } else if (showOnboarding) {
                this.initOnboarding();
            }
        }

        this.showScanQR = CoreLoginHelper.displayQRInSiteScreen();

        this.siteForm = this.formBuilder.group({
            siteUrl: [url, this.moodleUrlValidator()],
        });

        this.searchFunction = CoreUtils.debounce(async (search: string) => {
            search = search.trim();

            if (search.length >= 3) {
                // Update the sites list.
                const sites = await CoreSites.findSites(search);

                // Add UI tweaks.
                this.sites = this.extendCoreLoginSiteInfo(
                    <CoreLoginSiteInfoExtended[]>sites
                );

                this.hasSites = !!this.sites.length;
            } else {
                // Not reseting the array to allow animation to be displayed.
                this.hasSites = false;
            }

            this.loadingSites = false;
        }, 1000);

        this.showKeyboard =
            !!CoreNavigator.getRouteBooleanParam('showKeyboard');
    }

    /**
     * Initialize the site selector.
     *
     * @returns URL of the first site.
     */
    protected async initSiteSelector(): Promise<string> {
        const availableSites = await CoreLoginHelper.getAvailableSites();
        this.fixedSites = this.extendCoreLoginSiteInfo(
            <CoreLoginSiteInfoExtended[]>availableSites
        );
        this.siteSelector = 'list'; // In case it's not defined

        // Do not show images if none are set.
        if (!this.fixedSites.some((site) => !!site.imageurl)) {
            this.siteFinderSettings.displayimage = false;
        }

        this.filteredSites = this.fixedSites;

        return this.fixedSites[0].url;
    }

    /**
     * Consume install referrer URL.
     *
     * @returns Referrer URL, undefined if no URL to use.
     */
    protected async consumeInstallReferrerUrl(): Promise<string | undefined> {
        const url = await CoreUtils.ignoreErrors(
            CoreUtils.timeoutPromise(
                CoreReferrer.consumeInstallReferrerUrl(),
                1000
            )
        );
        if (!url) {
            return;
        }

        const hasSites =
            (await CoreUtils.ignoreErrors(CoreSites.getSites(), [])).length > 0;
        if (hasSites) {
            // There are sites stored already, don't use the referrer URL since it's an update or a backup was restored.
            return;
        }

        return url;
    }

    /**
     * Initialize and show onboarding if needed.
     *
     * @returns Promise resolved when done.
     */
    protected async initOnboarding(): Promise<void> {
        const onboardingDone = await CoreConfig.get(ONBOARDING_DONE, false);

        if (!onboardingDone) {
            // Check onboarding.
            this.showOnboarding();
        }
    }

    /**
     * Extend info of Login Site Info to get UI tweaks.
     *
     * @param sites Sites list.
     * @returns Sites list with extended info.
     */
    protected extendCoreLoginSiteInfo(
        sites: CoreLoginSiteInfoExtended[]
    ): CoreLoginSiteInfoExtended[] {
        return sites.map((site) => {
            site.noProtocolUrl =
                this.siteFinderSettings.displayurl && site.url
                    ? CoreUrl.removeProtocol(site.url)
                    : '';

            const name = this.siteFinderSettings.displaysitename
                ? site.name
                : '';
            const alias =
                this.siteFinderSettings.displayalias && site.alias
                    ? site.alias
                    : '';

            // Set title with parenthesis if both name and alias are present.
            site.title =
                name && alias ? name + ' (' + alias + ')' : name + alias;

            const country =
                this.siteFinderSettings.displaycountry && site.countrycode
                    ? CoreUtils.getCountryName(site.countrycode)
                    : '';
            const city =
                this.siteFinderSettings.displaycity && site.city
                    ? site.city
                    : '';

            // Separate location with hiphen if both country and city are present.
            site.location =
                city && country ? city + ' - ' + country : city + country;

            if (
                CoreSites.hasDefaultImage(site) &&
                this.siteFinderSettings.defaultimageurl
            ) {
                site.imageurl = this.siteFinderSettings.defaultimageurl;
            }

            return site;
        });
    }

    /**
     * Validate Url.
     *
     * @returns {ValidatorFn} Validation results.
     */
    protected moodleUrlValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const value = control.value.trim();
            let valid = value.length >= 3 && CoreUrl.isValidMoodleUrl(value);

            if (!valid) {
                const demo = !!CoreSites.getDemoSiteData(value);

                if (demo) {
                    valid = true;
                }
            }

            return valid ? null : { siteUrl: { value: control.value } };
        };
    }

    /**
     * Show a help modal.
     */
    async showHelp(): Promise<void> {
        await CoreDomUtils.openModal({
            component: CoreLoginSiteHelpComponent,
            cssClass: 'core-modal-fullscreen',
        });
    }

    /**
     * Show an onboarding modal.
     */
    async showOnboarding(): Promise<void> {
        await CoreDomUtils.openModal({
            component: CoreLoginSiteOnboardingComponent,
            cssClass: 'core-modal-fullscreen',
        });
    }

    /**
     * Try to connect to a site.
     *
     * @param url The URL to connect to.
     * @param e Event (if any).
     * @returns Promise resolved when done.
     */
    async connect(url: string, e?: Event): Promise<void> {
        e?.preventDefault();
        e?.stopPropagation();

        CoreApp.closeKeyboard();

        if (!url) {
            CoreDomUtils.showErrorModal('core.login.siteurlrequired', true);

            return;
        }

        if (!CoreNetwork.isOnline()) {
            CoreDomUtils.showErrorModal('core.networkerrormsg', true);

            return;
        }

        url = url.trim();

        if (url.match(/^(https?:\/\/)?campus\.example\.edu/)) {
            this.showLoginIssue(
                null,
                new CoreError(Translate.instant('core.login.errorexampleurl'))
            );

            return;
        }

        const siteData = CoreSites.getDemoSiteData(url);

        if (siteData) {
            // It's a demo site.
            await this.loginDemoSite(siteData);
        } else {
            // Not a demo site.
            const modal = await CoreDomUtils.showModalLoading();

            let checkResult: CoreSiteCheckResponse;

            try {
                checkResult = await CoreSites.checkSite(url);
            } catch (error) {
                // Attempt guessing the domain if the initial check failed
                const domain = CoreUrl.guessMoodleDomain(url);

                if (domain && domain != url) {
                    try {
                        checkResult = await CoreSites.checkSite(domain);
                    } catch (secondError) {
                        // Try to use the first error.
                        modal.dismiss();

                        return this.showLoginIssue(url, error || secondError);
                    }
                } else {
                    modal.dismiss();

                    return this.showLoginIssue(url, error);
                }
            }

            await this.login(checkResult);

            modal.dismiss();
        }
    }

    /**
     * Authenticate in a demo site.
     *
     * @param siteData Site data.
     * @returns Promise resolved when done.
     */
    protected async loginDemoSite(
        siteData: CoreSitesDemoSiteData
    ): Promise<void> {
        const modal = await CoreDomUtils.showModalLoading();

        try {
            const data = await CoreSites.getUserToken(
                siteData.url,
                siteData.username,
                siteData.password
            );

            await CoreSites.newSite(
                data.siteUrl,
                data.token,
                data.privateToken
            );

            CoreForms.triggerFormSubmittedEvent(this.formElement, true);

            await CoreNavigator.navigateToSiteHome();

            return;
        } catch (error) {
            CoreLoginHelper.treatUserTokenError(
                siteData.url,
                error,
                siteData.username,
                siteData.password
            );

            if (error.loggedout) {
                CoreNavigator.navigate('/login/sites', { reset: true });
            }
        } finally {
            modal.dismiss();
        }
    }

    /**
     * Process login to a site.
     *
     * @param siteCheck Response obtained from the site check request.
     *
     * @returns Promise resolved after logging in.
     */
    protected async login(siteCheck: CoreSiteCheckResponse): Promise<void> {
        try {
            await CoreSites.checkApplication(siteCheck.config);

            CoreForms.triggerFormSubmittedEvent(this.formElement, true);

            CoreNavigator.navigate('/login/credentials', {
                params: { siteCheck },
            });
        } catch {
            // Ignore errors.
        }
    }

    /**
     * Show an error that aims people to solve the issue.
     *
     * @param url The URL the user was trying to connect to.
     * @param error Error to display.
     */
    protected async showLoginIssue(
        url: string | null,
        error: CoreError
    ): Promise<void> {
        let errorMessage = CoreDomUtils.getErrorMessage(error);
        let siteExists = false;
        let supportConfig: CoreUserSupportConfig | undefined = undefined;
        let errorTitle: string | undefined;
        let errorDetails: string | undefined;
        let errorCode: string | undefined;

        if (error instanceof CoreSiteError) {
            supportConfig = error.supportConfig;
            errorDetails = error.errorDetails;
            errorCode = error.errorcode;
            siteExists = supportConfig instanceof CoreUserGuestSupportConfig;
        }

        if (error instanceof CoreLoginError) {
            errorTitle = error.title;
        }

        if (errorDetails) {
            errorMessage = `<p>${errorMessage}</p><div class="core-error-info-container"></div>`;
        }

        const alertSupportConfig = supportConfig;
        const buttons = [
            {
                text: Translate.instant('core.tryagain'),
                role: 'cancel',
            },
            alertSupportConfig?.canContactSupport()
                ? {
                      text: Translate.instant('core.contactsupport'),
                      handler: () =>
                          CoreUserSupport.contact({
                              supportConfig: alertSupportConfig,
                              subject: Translate.instant('core.cannotconnect'),
                              message: `Error: ${errorCode}\n\n${errorDetails}`,
                          }),
                  }
                : !siteExists
                ? {
                      text: Translate.instant('core.needhelp'),
                      cssClass: 'core-login-need-help',
                      handler: () => this.showHelp(),
                  }
                : null,
        ].filter((button) => !!button);

        const alertElement = await CoreDomUtils.showAlertWithOptions({
            header: errorTitle ?? Translate.instant('core.cannotconnect'),
            message: errorMessage ?? Translate.instant('core.sitenotfoundhelp'),
            buttons: buttons as AlertButton[],
        });

        if (errorDetails) {
            // Avoid sanitizing JS.
            const containerElement = alertElement.querySelector(
                '.core-error-info-container'
            );
            if (containerElement) {
                containerElement.innerHTML = CoreErrorInfoComponent.render(
                    errorDetails,
                    errorCode
                );
            }
        }
    }

    /**
     * The filter has changed.
     *
     * @param event Received Event.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterChanged(event?: any): void {
        const newValue = event?.target.value?.trim().toLowerCase();
        if (!newValue || !this.fixedSites) {
            this.filteredSites = this.fixedSites;
        } else {
            this.filteredSites = this.fixedSites.filter(
                (site) =>
                    site.title.toLowerCase().indexOf(newValue) > -1 ||
                    site.noProtocolUrl.toLowerCase().indexOf(newValue) > -1 ||
                    site.location.toLowerCase().indexOf(newValue) > -1
            );
        }
    }

    /**
     * Find a site on the backend.
     *
     * @param e Event.
     * @param search Text to search.
     */
    searchSite(e: Event, search: string): void {
        this.loadingSites = true;

        search = search.trim();

        if (this.siteForm.valid && search.length >= 3) {
            this.enteredSiteUrl = {
                url: search,
                name: 'connect',
                title: '',
                location: '',
                noProtocolUrl: CoreUrl.removeProtocol(search),
            };
        } else {
            this.enteredSiteUrl = undefined;
        }

        this.searchFunction(search.trim());
    }

    /**
     * Show instructions and scan QR code.
     *
     * @returns Promise resolved when done.
     */
    async showInstructionsAndScanQR(): Promise<void> {
        try {
            await CoreLoginHelper.showScanQRInstructions();

            await this.scanQR();
        } catch {
            // Ignore errors.
        }
    }

    /**
     * Scan a QR code and put its text in the URL input.
     *
     * @returns Promise resolved when done.
     */
    async scanQR(): Promise<void> {
        // Scan for a QR code.
        const text = await CoreUtils.scanQR();

        if (!text) {
            return;
        }

        if (CoreCustomURLSchemes.isCustomURL(text)) {
            try {
                await CoreCustomURLSchemes.handleCustomURL(text);
            } catch (error) {
                if (
                    error &&
                    error.data &&
                    error.data.isAuthenticationURL &&
                    error.data.siteUrl
                ) {
                    // An error ocurred, but it's an authentication URL and we have the site URL.
                    this.treatErrorInAuthenticationCustomURL(text, error);
                } else {
                    CoreCustomURLSchemes.treatHandleCustomURLError(error);
                }
            }

            return;
        }

        // Not a custom URL scheme, check if it's a URL scheme to another app.
        const scheme = CoreUrlUtils.getUrlProtocol(text);

        if (scheme && scheme != 'http' && scheme != 'https') {
            CoreDomUtils.showErrorModal(
                Translate.instant('core.errorurlschemeinvalidscheme', {
                    $a: text,
                })
            );

            return;
        }

        const allowed = await CoreLoginHelper.isSiteUrlAllowed(text);
        if (allowed) {
            // Put the text in the field (if present).
            this.siteForm.controls.siteUrl.setValue(text);

            this.connect(text);
        } else {
            CoreDomUtils.showErrorModal('core.errorurlschemeinvalidsite', true);
        }
    }

    /**
     * Treat an error while handling a custom URL meant to perform an authentication.
     * If the site doesn't use SSO, the user will be sent to the credentials screen.
     *
     * @param customURL Custom URL handled.
     * @param error Error data.
     * @returns Promise resolved when done.
     */
    protected async treatErrorInAuthenticationCustomURL(
        customURL: string,
        error: CoreCustomURLSchemesHandleError
    ): Promise<void> {
        const siteUrl = error.data?.siteUrl || '';
        const modal = await CoreDomUtils.showModalLoading();

        // Set the site URL in the input.
        this.siteForm.controls.siteUrl.setValue(siteUrl);

        try {
            // Check if site uses SSO.
            const siteCheck = await CoreSites.checkSite(siteUrl);

            await CoreSites.checkApplication(siteCheck.config);

            if (!CoreLoginHelper.isSSOLoginNeeded(siteCheck.code)) {
                // No SSO, go to credentials page.
                await CoreNavigator.navigate('/login/credentials', {
                    params: { siteCheck },
                });
            }
        } catch {
            // Ignore errors.
        } finally {
            modal.dismiss();
        }

        // Now display the error.
        error.error = CoreTextUtils.addTextToError(
            error.error,
            '<br><br>' +
                Translate.instant(
                    'core.login.youcanstillconnectwithcredentials'
                )
        );

        CoreCustomURLSchemes.treatHandleCustomURLError(error);
    }

    /**
     * Open settings page.
     */
    openSettings(): void {
        CoreNavigator.navigate('/settings');
    }

    /**
     * Check whether site URL should be displayed.
     *
     * @param siteUrl Site URL.
     * @returns Whether to display URL.
     */
    displaySiteUrl(siteUrl: string): boolean {
        return CoreSitesFactory.makeUnauthenticatedSite(
            siteUrl
        ).shouldDisplayInformativeLinks();
    }
}

/**
 * Extended data for UI implementation.
 */
type CoreLoginSiteInfoExtended = CoreLoginSiteInfo & {
    noProtocolUrl: string; // Url wihtout protocol.
    location: string; // City + country.
    title: string; // Name + alias.
};
