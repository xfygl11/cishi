(function (global) {
    'use strict';

    function safeJsonParse(str, fallback) {
        if (typeof str !== 'string') {
            return fallback !== undefined ? fallback : null;
        }
        try {
            return JSON.parse(str);
        } catch (e) {
            return fallback !== undefined ? fallback : null;
        }
    }

    function httpGet(url) {
        return new Promise(function (resolve, reject) {
            if (global.NativeHttp && typeof global.NativeHttp.httpGet === 'function') {
                try {
                    var result = global.NativeHttp.httpGet(url);
                    if (typeof result === 'string' && result.indexOf('__ERROR__') === 0) {
                        reject(new Error(result.substring(9)));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(e);
                }
            } else {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = 15000;
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error('HTTP ' + xhr.status));
                    }
                };
                xhr.onerror = function () {
                    reject(new Error('Network error'));
                };
                xhr.ontimeout = function () {
                    reject(new Error('Timeout'));
                };
                xhr.send();
            }
        });
    }

    function httpPost(url, body) {
        return new Promise(function (resolve, reject) {
            if (global.NativeHttp && typeof global.NativeHttp.httpPost === 'function') {
                try {
                    var result = global.NativeHttp.httpPost(url, body);
                    if (typeof result === 'string' && result.indexOf('__ERROR__') === 0) {
                        reject(new Error(result.substring(9)));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(e);
                }
            } else {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.timeout = 15000;
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error('HTTP ' + xhr.status));
                    }
                };
                xhr.onerror = function () {
                    reject(new Error('Network error'));
                };
                xhr.ontimeout = function () {
                    reject(new Error('Timeout'));
                };
                xhr.send(body);
            }
        });
    }

    var STORAGE_KEYS = {
        SITES: 'nc_repo_sites',
        CURRENT_SITE: 'nc_repo_current_site',
        HISTORY: 'nc_repo_history'
    };

    var PRESET_REPOS = [
        {
            name: '饭太硬',
            url: 'http://饭太硬.top/tv',
            type: 'tvbox'
        },
        {
            name: '饭太硬备用',
            url: 'http://xn--2sxr36hcz9a.top/tv',
            type: 'tvbox'
        },
        {
            name: '饭太硬加速',
            url: 'https://gh.con.sh/https://raw.githubusercontent.com/饭太硬/TV/main/tv.json',
            type: 'tvbox'
        }
    ];

    var NcRepo = function () {
        this.sites = [];
        this.currentSite = null;
        this.history = [];
        this.repoConfig = null;
        this._init();
    };

    NcRepo.prototype._init = function () {
        this._loadFromStorage();
        if (this.sites.length === 0) {
            this.sites = PRESET_REPOS.map(function (repo, idx) {
                return {
                    id: 'preset_' + idx,
                    name: repo.name,
                    url: repo.url,
                    type: repo.type,
                    preset: true
                };
            });
            this._saveSites();
        }
        if (!this.currentSite && this.sites.length > 0) {
            this.currentSite = this.sites[0];
            this._saveCurrentSite();
        }
    };

    NcRepo.prototype._loadFromStorage = function () {
        try {
            var sitesStr = localStorage.getItem(STORAGE_KEYS.SITES);
            if (sitesStr) {
                this.sites = safeJsonParse(sitesStr, []) || [];
            }
            var currentStr = localStorage.getItem(STORAGE_KEYS.CURRENT_SITE);
            if (currentStr) {
                this.currentSite = safeJsonParse(currentStr, null);
            }
            var historyStr = localStorage.getItem(STORAGE_KEYS.HISTORY);
            if (historyStr) {
                this.history = safeJsonParse(historyStr, []) || [];
            }
        } catch (e) {
            console.warn('Load storage failed:', e);
        }
    };

    NcRepo.prototype._saveSites = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(this.sites));
        } catch (e) {
            console.warn('Save sites failed:', e);
        }
    };

    NcRepo.prototype._saveCurrentSite = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_SITE, JSON.stringify(this.currentSite));
        } catch (e) {
            console.warn('Save current site failed:', e);
        }
    };

    NcRepo.prototype._saveHistory = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history.slice(0, 50)));
        } catch (e) {
            console.warn('Save history failed:', e);
        }
    };

    NcRepo.prototype._addToHistory = function (site) {
        if (!site || !site.url) return;
        var exists = this.history.findIndex(function (h) {
            return h.url === site.url;
        });
        if (exists >= 0) {
            this.history.splice(exists, 1);
        }
        this.history.unshift({
            name: site.name,
            url: site.url,
            type: site.type,
            time: Date.now()
        });
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        this._saveHistory();
    };

    NcRepo.prototype.getPresetRepos = function () {
        return PRESET_REPOS.slice();
    };

    NcRepo.prototype.getSites = function () {
        return this.sites.slice();
    };

    NcRepo.prototype.getCurrentSite = function () {
        return this.currentSite;
    };

    NcRepo.prototype.getHistory = function () {
        return this.history.slice();
    };

    NcRepo.prototype.addSite = function (name, url, type) {
        if (!name || !url) {
            throw new Error('Name and url are required');
        }
        var exists = this.sites.some(function (s) {
            return s.url === url;
        });
        if (exists) {
            throw new Error('Site already exists');
        }
        var newSite = {
            id: 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            url: url,
            type: type || 'tvbox',
            preset: false
        };
        this.sites.push(newSite);
        this._saveSites();
        return newSite;
    };

    NcRepo.prototype.removeSite = function (siteId) {
        var idx = this.sites.findIndex(function (s) {
            return s.id === siteId;
        });
        if (idx < 0) {
            throw new Error('Site not found');
        }
        var site = this.sites[idx];
        if (site.preset) {
            throw new Error('Cannot remove preset site');
        }
        this.sites.splice(idx, 1);
        if (this.currentSite && this.currentSite.id === siteId) {
            this.currentSite = this.sites.length > 0 ? this.sites[0] : null;
            this._saveCurrentSite();
        }
        this._saveSites();
        return true;
    };

    NcRepo.prototype.switchSite = function (siteId) {
        var site = this.sites.find(function (s) {
            return s.id === siteId;
        });
        if (!site) {
            throw new Error('Site not found');
        }
        this.currentSite = site;
        this._saveCurrentSite();
        this._addToHistory(site);
        return site;
    };

    NcRepo.prototype.loadConfig = function (url) {
        var self = this;
        var targetUrl = url || (this.currentSite && this.currentSite.url);
        if (!targetUrl) {
            return Promise.reject(new Error('No repo url available'));
        }
        return httpGet(targetUrl).then(function (text) {
            var config = safeJsonParse(text, null);
            if (!config) {
                throw new Error('Invalid config format');
            }
            self.repoConfig = config;
            return config;
        });
    };

    NcRepo.prototype.getRepoConfig = function () {
        return this.repoConfig;
    };

    NcRepo.prototype.getVideoSites = function () {
        if (!this.repoConfig || !this.repoConfig.sites) {
            return [];
        }
        return this.repoConfig.sites.filter(function (site) {
            return site && site.key && site.api;
        });
    };

    NcRepo.prototype.getLiveSources = function () {
        var sources = [];
        if (this.repoConfig) {
            if (this.repoConfig.lives && Array.isArray(this.repoConfig.lives)) {
                this.repoConfig.lives.forEach(function (live) {
                    if (live && live.url) {
                        sources.push({
                            name: live.name || '直播源',
                            url: live.url,
                            type: live.type || 'txt'
                        });
                    }
                });
            }
            if (this.repoConfig.live && typeof this.repoConfig.live === 'string') {
                sources.push({
                    name: '直播',
                    url: this.repoConfig.live,
                    type: 'txt'
                });
            }
        }
        return sources;
    };

    NcRepo.prototype.getParsers = function () {
        if (!this.repoConfig || !this.repoConfig.parses) {
            return [];
        }
        return this.repoConfig.parses.filter(function (p) {
            return p && p.url;
        });
    };

    NcRepo.prototype.clearHistory = function () {
        this.history = [];
        this._saveHistory();
    };

    NcRepo.httpGet = httpGet;
    NcRepo.httpPost = httpPost;
    NcRepo.safeJsonParse = safeJsonParse;

    global.NcRepo = NcRepo;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NcRepo;
    }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
