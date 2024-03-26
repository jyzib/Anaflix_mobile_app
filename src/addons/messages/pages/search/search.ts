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

import { Component, OnDestroy, ViewChild } from '@angular/core';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreSites } from '@services/sites';
import {
    AddonMessagesProvider,
    AddonMessagesConversationMember,
    AddonMessagesMessageAreaContact,
    AddonMessages,
} from '../../services/messages';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreApp } from '@services/app';
import { CoreNavigator } from '@services/navigator';
import { CoreScreen } from '@services/screen';
import { CoreSplitViewComponent } from '@components/split-view/split-view';

/**
 * Page for searching users.
 */
@Component({
    selector: 'page-addon-messages-search',
    templateUrl: 'search.html',
})
export class AddonMessagesSearchPage implements OnDestroy {

    @ViewChild(CoreSplitViewComponent) splitView!: CoreSplitViewComponent;

    disableSearch = false;
    displaySearching = false;
    displayResults = false;
    query = '';
    contacts: AddonMessagesSearchResults = {
        type: 'contacts',
        titleString: 'addon.messages.contacts',
        results: [],
        canLoadMore: false,
        loadingMore: false,
    };

    nonContacts: AddonMessagesSearchResults = {
        type: 'noncontacts',
        titleString: 'addon.messages.noncontacts',
        results: [],
        canLoadMore: false,
        loadingMore: false,
    };

    messages: AddonMessagesSearchMessageResults = {
        type: 'messages',
        titleString: 'addon.messages.messages',
        results: [],
        canLoadMore: false,
        loadingMore: false,
        loadMoreError: false,
    };

    selectedResult?: AddonMessagesConversationMember | AddonMessagesMessageAreaContact;

    protected memberInfoObserver: CoreEventObserver;

    constructor() {
        // Update block status of a user.
        this.memberInfoObserver = CoreEvents.on(
            AddonMessagesProvider.MEMBER_INFO_CHANGED_EVENT,
            (data) => {
                if (!data.userBlocked && !data.userUnblocked) {
                    // The block status has not changed, ignore.
                    return;
                }

                const contact = this.contacts.results.find((user) => user.id == data.userId);
                if (contact) {
                    contact.isblocked = !!data.userBlocked;
                } else {
                    const nonContact = this.nonContacts.results.find((user) => user.id == data.userId);
                    if (nonContact) {
                        nonContact.isblocked = !!data.userBlocked;
                    }
                }

                this.messages.results.forEach((message: AddonMessagesMessageAreaContact): void => {
                    if (message.userid == data.userId) {
                        message.isblocked = !!data.userBlocked;
                    }
                });
            },
            CoreSites.getCurrentSiteId(),
        );
    }

    /**
     * Clear search.
     */
    clearSearch(): void {
        this.query = '';
        this.displayResults = false;

        // Empty details.
        const path = CoreNavigator.getRelativePathToParent('/messages/search');
        if (path) {
            CoreNavigator.navigate(path);
        }
    }

    /**
     * Start a new search or load more results.
     *
     * @param query Text to search for.
     * @param loadMore Load more contacts, noncontacts or messages. If undefined, start a new search.
     * @param infiniteComplete Infinite scroll complete function. Only used from core-infinite-loading.
     * @returns Resolved when done.
     */
    async search(query: string, loadMore?: 'contacts' | 'noncontacts' | 'messages', infiniteComplete?: () => void): Promise<void> {
        CoreApp.closeKeyboard();

        this.query = query;
        this.disableSearch = true;
        this.displaySearching = !loadMore;

        const promises: Promise<void>[] = [];
        let newContacts: AddonMessagesConversationMember[] = [];
        let newNonContacts: AddonMessagesConversationMember[] = [];
        let newMessages: AddonMessagesMessageAreaContact[] = [];
        let canLoadMoreContacts = false;
        let canLoadMoreNonContacts = false;
        let canLoadMoreMessages = false;

        if (!loadMore || loadMore == 'contacts' || loadMore == 'noncontacts') {
            const limitNum = loadMore ? AddonMessagesProvider.LIMIT_SEARCH : AddonMessagesProvider.LIMIT_INITIAL_USER_SEARCH;
            let limitFrom = 0;
            if (loadMore == 'contacts') {
                limitFrom = this.contacts.results.length;
                this.contacts.loadingMore = true;
            } else if (loadMore == 'noncontacts') {
                limitFrom = this.nonContacts.results.length;
                this.nonContacts.loadingMore = true;
            }

            promises.push(
                AddonMessages.searchUsers(query, limitFrom, limitNum).then((result) => {
                    if (!loadMore || loadMore == 'contacts') {
                        newContacts = result.contacts;
                        canLoadMoreContacts = result.canLoadMoreContacts;
                    }
                    if (!loadMore || loadMore == 'noncontacts') {
                        newNonContacts = result.nonContacts;
                        canLoadMoreNonContacts = result.canLoadMoreNonContacts;
                    }

                    return;
                }),
            );
        }

        if (!loadMore || loadMore == 'messages') {
            let limitFrom = 0;
            if (loadMore == 'messages') {
                limitFrom = this.messages.results.length;
                this.messages.loadingMore = true;
            }

            promises.push(
                AddonMessages.searchMessages(query, undefined, limitFrom).then((result) => {
                    newMessages = result.messages;
                    canLoadMoreMessages = result.canLoadMore;

                    return;
                }),
            );
        }

        try {
            await Promise.all(promises);
            if (!loadMore) {
                this.contacts.results = [];
                this.nonContacts.results = [];
                this.messages.results = [];
            }

            this.displayResults = true;

            if (!loadMore || loadMore == 'contacts') {
                this.contacts.results.push(...newContacts);
                this.contacts.canLoadMore = canLoadMoreContacts;
                this.setHighlight(newContacts, true);
            }

            if (!loadMore || loadMore == 'noncontacts') {
                this.nonContacts.results.push(...newNonContacts);
                this.nonContacts.canLoadMore = canLoadMoreNonContacts;
                this.setHighlight(newNonContacts, true);
            }

            if (!loadMore || loadMore == 'messages') {
                this.messages.results.push(...newMessages);
                this.messages.canLoadMore = canLoadMoreMessages;
                this.messages.loadMoreError = false;
                this.setHighlight(newMessages, false);
            }

            if (!loadMore) {
                if (this.contacts.results.length > 0) {
                    this.openConversation(this.contacts.results[0], true);
                } else if (this.nonContacts.results.length > 0) {
                    this.openConversation(this.nonContacts.results[0], true);
                } else if (this.messages.results.length > 0) {
                    this.openConversation(this.messages.results[0], true);
                }
            }
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingusers', true);

            if (loadMore == 'messages') {
                this.messages.loadMoreError = true;
            }
        } finally {
            this.disableSearch = false;
            this.displaySearching = false;

            if (loadMore == 'contacts') {
                this.contacts.loadingMore = false;
            } else if (loadMore == 'noncontacts') {
                this.nonContacts.loadingMore = false;
            } else if (loadMore == 'messages') {
                this.messages.loadingMore = false;
            }

            infiniteComplete && infiniteComplete();
        }
    }

    /**
     * Open a conversation in the split view.
     *
     * @param result User or message.
     * @param onInit Whether the tser was selected on initial load.
     */
    openConversation(result: AddonMessagesConversationMember | AddonMessagesMessageAreaContact, onInit: boolean = false): void {
        if (!onInit || CoreScreen.isTablet) {
            this.selectedResult = result;

            let conversationId: number | undefined;
            let userId: number | undefined;
            if ('conversationid' in result) {
                conversationId = result.conversationid;
            } else {
                userId = result.id;
            }

            const path = CoreNavigator.getRelativePathToParent('/messages/search') + 'discussion/' +
                (conversationId ? conversationId : `user/${userId}`);

            CoreNavigator.navigate(path, {
                reset: CoreScreen.isTablet && !!this.splitView && !this.splitView.isNested,
            });
        }
    }

    /**
     * Set the highlight values for each entry.
     *
     * @param results Results to highlight.
     * @param isUser Whether the results are from a user search or from a message search.
     */
    setHighlight(
        results: (AddonMessagesConversationMemberWithHighlight | AddonMessagesMessageAreaContactWithHighlight)[],
        isUser = false,
    ): void {
        results.forEach((result) => {
            result.highlightName = isUser ? this.query : undefined;
            result.highlightMessage = !isUser ? this.query : undefined;
        });
    }

    /**
     * Component destroyed.
     */
    ngOnDestroy(): void {
        this.memberInfoObserver?.off();
    }

}

type AddonMessagesSearchResults = {
    type: string;
    titleString: string;
    results: AddonMessagesConversationMemberWithHighlight[];
    canLoadMore: boolean;
    loadingMore: boolean;
};

type AddonMessagesSearchMessageResults = {
    type: string;
    titleString: string;
    results: AddonMessagesMessageAreaContactWithHighlight[];
    canLoadMore: boolean;
    loadingMore: boolean;
    loadMoreError: boolean;
};

type AddonMessagesSearchResultHighlight = {
    highlightName?: string;
    highlightMessage?: string;
};

type AddonMessagesConversationMemberWithHighlight = AddonMessagesConversationMember & AddonMessagesSearchResultHighlight;
type AddonMessagesMessageAreaContactWithHighlight = AddonMessagesMessageAreaContact & AddonMessagesSearchResultHighlight;
