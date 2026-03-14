(function () {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const searchLoading = document.getElementById('searchLoading');
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
    let debounceTimer;
    let activeSearchController;

    if (!searchInput || !searchResults) {
        return;
    }

    function showFlash(message, isError) {
        const container = document.createElement('div');
        container.className = 'flash ' + (isError ? 'error' : 'success');
        container.innerHTML = '<span>' + message + '</span><button type="button" class="flash-close" aria-label="Dismiss message">x</button>';
    container.role = 'status';

        const existingWrap = document.querySelector('.flash-wrap');
        if (existingWrap) {
            existingWrap.prepend(container);
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'flash-wrap';
        wrap.appendChild(container);
        const host = document.querySelector('.page-wrap');
        host.insertBefore(wrap, host.children[1]);
    }

    function renderSearchSkeleton(show) {
        if (!searchLoading) {
            return;
        }
        searchLoading.hidden = !show;
        searchResults.classList.toggle('active', !show && searchResults.children.length > 0);
    }

    function showTabSkeleton(panel, show) {
        const skeleton = panel.querySelector('.tab-skeleton');
        const tableWrap = panel.querySelector('.table-wrap');
        const emptyState = panel.querySelector('.empty');

        if (!skeleton) {
            return;
        }

        skeleton.hidden = !show;
        if (tableWrap) {
            tableWrap.hidden = show;
        }
        if (emptyState) {
            emptyState.hidden = show;
        }
    }

    function userAvatarMarkup(user) {
        if (user.profile_pic_url) {
            return '<img class="avatar-mini" src="' + user.profile_pic_url + '" alt="' + user.full_name + '">';
        }
        return '<span class="avatar-mini" aria-hidden="true">' + user.full_name.charAt(0).toUpperCase() + '</span>';
    }

    function renderAction(user) {
        if (user.is_friend) {
            return '<button type="button" class="btn btn-ghost" disabled>Friend</button>';
        }
        if (user.request_status === 'pending') {
            return '<button type="button" class="btn btn-ghost" disabled>Pending</button>';
        }
        return '<button type="button" class="btn btn-primary" data-add="' + user.username + '">Add Friend</button>';
    }

    function renderSearchResults(results) {
        if (!results || results.length === 0) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }

        searchResults.innerHTML = results.map(function (user) {
            const rowClass = user.is_friend ? 'result-item friend-result' : 'result-item';
            return '<div class="' + rowClass + '">'
                + '<div class="result-user">'
                + userAvatarMarkup(user)
                + '<div><p class="result-name">' + user.username + '</p><p class="result-sub">' + user.full_name + '</p></div>'
                + '</div>'
                + renderAction(user)
                + '</div>';
        }).join('');

        searchResults.classList.add('active');
    }

    async function fetchJson(url, options) {
        const requestOptions = options || {};
        const controller = requestOptions.signal ? null : new AbortController();
        const signal = requestOptions.signal || (controller ? controller.signal : undefined);
        const timeoutId = controller
            ? setTimeout(function () {
                controller.abort();
            }, 10000)
            : null;

        try {
            const response = await fetch(url, {
                method: requestOptions.method || 'GET',
                headers: Object.assign({
                    'Accept': 'application/json'
                }, requestOptions.headers || {}),
                body: requestOptions.body,
                credentials: 'same-origin',
                cache: 'no-store',
                signal: signal
            });

            let data = {};
            const contentType = response.headers.get('content-type') || '';

            if (contentType.indexOf('application/json') >= 0) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { error: text || 'Unexpected server response' };
            }

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            if (error && error.name === 'AbortError') {
                if (requestOptions.signal) {
                    throw error;
                }
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    async function searchUsers(term) {
        if (!navigator.onLine) {
            throw new Error('You appear to be offline. Reconnect and try again.');
        }

        if (activeSearchController) {
            activeSearchController.abort();
        }

        activeSearchController = new AbortController();
        renderSearchSkeleton(true);

        try {
            const data = await fetchJson('/api/search-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search_term: term }),
                signal: activeSearchController.signal
            });

            renderSearchSkeleton(false);
            renderSearchResults(data.results);
        } catch (error) {
            renderSearchSkeleton(false);
            if (error && error.name === 'AbortError') {
                return;
            }
            throw error;
        } finally {
            activeSearchController = null;
        }
    }

    async function sendFriendRequest(username) {
        if (!navigator.onLine) {
            throw new Error('You appear to be offline. Reconnect and try again.');
        }

        await fetchJson('/api/send-friend-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiver_name: username })
        });
    }

    async function updateRequest(sender, action) {
        if (!navigator.onLine) {
            throw new Error('You appear to be offline. Reconnect and try again.');
        }

        const endpoint = action === 'accept' ? '/api/accept-friend-request' : '/api/reject-friend-request';
        await fetchJson(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_name: sender })
        });
    }

    tabButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            const tab = button.getAttribute('data-tab');
            const activePanel = document.getElementById(tab);

            tabButtons.forEach(function (item) {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            tabPanels.forEach(function (panel) {
                panel.classList.remove('active');
            });

            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            activePanel.classList.add('active');

            showTabSkeleton(activePanel, true);
            setTimeout(function () {
                showTabSkeleton(activePanel, false);
            }, 280);
        });
    });

    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        const term = searchInput.value.trim();

        if (!term) {
            renderSearchSkeleton(false);
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(function () {
            searchUsers(term).catch(function (error) {
                renderSearchSkeleton(false);
                showFlash(error.message, true);
            });
        }, 280);
    });

    searchResults.addEventListener('click', function (event) {
        const addButton = event.target.closest('[data-add]');
        if (!addButton) {
            return;
        }

        const username = addButton.getAttribute('data-add');
        sendFriendRequest(username)
            .then(function () {
                showFlash('Friend request sent to @' + username, false);
                searchInput.value = '';
                searchResults.classList.remove('active');
                searchResults.innerHTML = '';
                setTimeout(function () {
                    window.location.reload();
                }, 800);
            })
            .catch(function (error) {
                showFlash(error.message, true);
            });
    });

    document.addEventListener('click', function (event) {
        const actionButton = event.target.closest('[data-action][data-sender]');
        if (actionButton) {
            const senderName = actionButton.getAttribute('data-sender');
            const action = actionButton.getAttribute('data-action');

            updateRequest(senderName, action)
                .then(function () {
                    const verb = action === 'accept' ? 'accepted' : 'rejected';
                    showFlash('Request from @' + senderName + ' ' + verb + '.', false);
                    setTimeout(function () {
                        window.location.reload();
                    }, 700);
                })
                .catch(function (error) {
                    showFlash(error.message, true);
                });
        }

        if (!event.target.closest('.friend-search')) {
            searchResults.classList.remove('active');
        }
    });
})();
