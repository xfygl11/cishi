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
        SOURCES: 'nc_live_sources',
        CURRENT_SOURCE: 'nc_live_current_source',
        CURRENT_CHANNEL: 'nc_live_current_channel',
        CURRENT_GROUP: 'nc_live_current_group'
    };

    var API_TYPES = {
        CMS_JSON: 'cms_json',
        CMS_XML: 'cms_xml',
        TXT: 'txt',
        M3U: 'm3u'
    };

    var NcLive = function () {
        this.sources = [];
        this.currentSource = null;
        this.currentChannel = null;
        this.currentGroup = null;
        this.channels = [];
        this.groups = [];
        this._init();
    };

    NcLive.prototype._init = function () {
        this._loadFromStorage();
    };

    NcLive.prototype._loadFromStorage = function () {
        try {
            var sourcesStr = localStorage.getItem(STORAGE_KEYS.SOURCES);
            if (sourcesStr) {
                this.sources = safeJsonParse(sourcesStr, []) || [];
            }
            var currentSourceStr = localStorage.getItem(STORAGE_KEYS.CURRENT_SOURCE);
            if (currentSourceStr) {
                this.currentSource = safeJsonParse(currentSourceStr, null);
            }
            var currentChannelStr = localStorage.getItem(STORAGE_KEYS.CURRENT_CHANNEL);
            if (currentChannelStr) {
                this.currentChannel = safeJsonParse(currentChannelStr, null);
            }
            var currentGroupStr = localStorage.getItem(STORAGE_KEYS.CURRENT_GROUP);
            if (currentGroupStr) {
                this.currentGroup = safeJsonParse(currentGroupStr, null);
            }
        } catch (e) {
            console.warn('Load storage failed:', e);
        }
    };

    NcLive.prototype._saveSources = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(this.sources));
        } catch (e) {
            console.warn('Save sources failed:', e);
        }
    };

    NcLive.prototype._saveCurrentSource = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_SOURCE, JSON.stringify(this.currentSource));
        } catch (e) {
            console.warn('Save current source failed:', e);
        }
    };

    NcLive.prototype._saveCurrentChannel = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_CHANNEL, JSON.stringify(this.currentChannel));
        } catch (e) {
            console.warn('Save current channel failed:', e);
        }
    };

    NcLive.prototype._saveCurrentGroup = function () {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_GROUP, JSON.stringify(this.currentGroup));
        } catch (e) {
            console.warn('Save current group failed:', e);
        }
    };

    NcLive.prototype.getSources = function () {
        return this.sources.slice();
    };

    NcLive.prototype.getCurrentSource = function () {
        return this.currentSource;
    };

    NcLive.prototype.getCurrentChannel = function () {
        return this.currentChannel;
    };

    NcLive.prototype.getCurrentGroup = function () {
        return this.currentGroup;
    };

    NcLive.prototype.getChannels = function () {
        return this.channels.slice();
    };

    NcLive.prototype.getGroups = function () {
        return this.groups.slice();
    };

    NcLive.prototype.addSource = function (name, url, type) {
        if (!name || !url) {
            throw new Error('Name and url are required');
        }
        var exists = this.sources.some(function (s) {
            return s.url === url;
        });
        if (exists) {
            throw new Error('Source already exists');
        }
        var newSource = {
            id: 'live_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            url: url,
            type: type || this._detectType(url)
        };
        this.sources.push(newSource);
        this._saveSources();
        return newSource;
    };

    NcLive.prototype.removeSource = function (sourceId) {
        var idx = this.sources.findIndex(function (s) {
            return s.id === sourceId;
        });
        if (idx < 0) {
            throw new Error('Source not found');
        }
        this.sources.splice(idx, 1);
        if (this.currentSource && this.currentSource.id === sourceId) {
            this.currentSource = this.sources.length > 0 ? this.sources[0] : null;
            this._saveCurrentSource();
            this.channels = [];
            this.groups = [];
            this.currentChannel = null;
            this.currentGroup = null;
        }
        this._saveSources();
        return true;
    };

    NcLive.prototype.switchSource = function (sourceId) {
        var source = this.sources.find(function (s) {
            return s.id === sourceId;
        });
        if (!source) {
            throw new Error('Source not found');
        }
        this.currentSource = source;
        this._saveCurrentSource();
        this.channels = [];
        this.groups = [];
        this.currentChannel = null;
        this.currentGroup = null;
        return source;
    };

    NcLive.prototype._detectType = function (url) {
        if (!url) return API_TYPES.TXT;
        var lower = url.toLowerCase();
        if (lower.endsWith('.m3u') || lower.endsWith('.m3u8') || lower.indexOf('.m3u') > -1) {
            return API_TYPES.M3U;
        }
        if (lower.indexOf('xml') > -1 || lower.endsWith('.xml')) {
            return API_TYPES.CMS_XML;
        }
        if (lower.indexOf('json') > -1 || lower.endsWith('.json')) {
            return API_TYPES.CMS_JSON;
        }
        return API_TYPES.TXT;
    };

    NcLive.prototype.loadChannels = function (sourceUrl, sourceType) {
        var self = this;
        var url = sourceUrl || (this.currentSource && this.currentSource.url);
        var type = sourceType || (this.currentSource && this.currentSource.type) || this._detectType(url);
        if (!url) {
            return Promise.reject(new Error('No source url available'));
        }
        return httpGet(url).then(function (text) {
            var result;
            switch (type) {
                case API_TYPES.M3U:
                    result = self._parseM3u(text);
                    break;
                case API_TYPES.CMS_JSON:
                    result = self._parseCmsJson(text);
                    break;
                case API_TYPES.CMS_XML:
                    result = self._parseCmsXml(text);
                    break;
                case API_TYPES.TXT:
                default:
                    result = self._parseTxt(text);
                    break;
            }
            self.channels = result.channels;
            self.groups = result.groups;
            if (self.groups.length > 0 && !self.currentGroup) {
                self.currentGroup = self.groups[0];
                self._saveCurrentGroup();
            }
            return {
                channels: self.channels,
                groups: self.groups
            };
        });
    };

    NcLive.prototype._parseTxt = function (text) {
        var channels = [];
        var groups = [];
        var groupMap = {};
        var currentGroup = '默认';
        var lines = text.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.indexOf('#') === 0) continue;
            if (line.indexOf('//') === 0) continue;
            var commaIdx = line.indexOf(',');
            if (commaIdx > 0) {
                var name = line.substring(0, commaIdx).trim();
                var url = line.substring(commaIdx + 1).trim();
                if (name && url && (url.indexOf('http') === 0 || url.indexOf('rtmp') === 0)) {
                    var groupName = currentGroup;
                    if (groupMap[groupName]) {
                        groupMap[groupName].count++;
                    } else {
                        groupMap[groupName] = {
                            name: groupName,
                            count: 1
                        };
                        groups.push(groupMap[groupName]);
                    }
                    channels.push({
                        id: 'ch_' + channels.length,
                        name: name,
                        url: url,
                        group: groupName
                    });
                }
            } else {
                var groupMatch = line.match(/^(.+?)\s*[:：]\s*$/);
                if (groupMatch) {
                    currentGroup = groupMatch[1].trim();
                } else if (line.indexOf('http') === 0 || line.indexOf('rtmp') === 0) {
                    var chName = '频道' + (channels.length + 1);
                    var chUrl = line;
                    if (groupMap[currentGroup]) {
                        groupMap[currentGroup].count++;
                    } else {
                        groupMap[currentGroup] = {
                            name: currentGroup,
                            count: 1
                        };
                        groups.push(groupMap[currentGroup]);
                    }
                    channels.push({
                        id: 'ch_' + channels.length,
                        name: chName,
                        url: chUrl,
                        group: currentGroup
                    });
                }
            }
        }
        return {
            channels: channels,
            groups: groups
        };
    };

    NcLive.prototype._parseM3u = function (text) {
        var channels = [];
        var groups = [];
        var groupMap = {};
        var currentGroup = '默认';
        var currentName = null;
        var lines = text.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.indexOf('#EXTINF') === 0) {
                var nameMatch = line.match(/,(.+)$/);
                if (nameMatch) {
                    currentName = nameMatch[1].trim();
                }
                var groupMatch = line.match(/group-title="([^"]+)"/);
                if (groupMatch) {
                    currentGroup = groupMatch[1].trim();
                }
            } else if (line.indexOf('#') !== 0 && (line.indexOf('http') === 0 || line.indexOf('rtmp') === 0)) {
                var chName = currentName || '频道' + (channels.length + 1);
                var chUrl = line;
                if (groupMap[currentGroup]) {
                    groupMap[currentGroup].count++;
                } else {
                    groupMap[currentGroup] = {
                        name: currentGroup,
                        count: 1
                    };
                    groups.push(groupMap[currentGroup]);
                }
                channels.push({
                    id: 'ch_' + channels.length,
                    name: chName,
                    url: chUrl,
                    group: currentGroup
                });
                currentName = null;
            }
        }
        return {
            channels: channels,
            groups: groups
        };
    };

    NcLive.prototype._parseCmsJson = function (text) {
        var channels = [];
        var groups = [];
        var data = safeJsonParse(text, null);
        if (data && data.lives && Array.isArray(data.lives)) {
            for (var i = 0; i < data.lives.length; i++) {
                var live = data.lives[i];
                var groupName = live.group || live.name || '默认';
                groups.push({
                    name: groupName,
                    count: live.channels ? live.channels.length : 0
                });
                if (live.channels && Array.isArray(live.channels)) {
                    for (var j = 0; j < live.channels.length; j++) {
                        var ch = live.channels[j];
                        var url = Array.isArray(ch.urls) ? (ch.urls[0] || '') : (ch.url || '');
                        channels.push({
                            id: 'ch_' + channels.length,
                            name: ch.name || ch.titles || '频道' + (channels.length + 1),
                            url: url,
                            urls: Array.isArray(ch.urls) ? ch.urls : [url],
                            group: groupName
                        });
                    }
                }
            }
        }
        return {
            channels: channels,
            groups: groups
        };
    };

    NcLive.prototype._parseCmsXml = function (text) {
        var channels = [];
        var groups = [];
        var groupMap = {};
        var currentGroup = '默认';
        try {
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(text, 'text/xml');
            var liveItems = xmlDoc.getElementsByTagName('live');
            for (var i = 0; i < liveItems.length; i++) {
                var live = liveItems[i];
                var groupName = live.getAttribute('group') || '默认';
                currentGroup = groupName;
                var channelItems = live.getElementsByTagName('channel');
                var count = 0;
                for (var j = 0; j < channelItems.length; j++) {
                    var ch = channelItems[j];
                    var chName = ch.getAttribute('name') || '频道' + (channels.length + 1);
                    var chUrl = '';
                    var urls = [];
                    var urlItems = ch.getElementsByTagName('url');
                    for (var k = 0; k < urlItems.length; k++) {
                        var u = urlItems[k].textContent || urlItems[k].innerHTML || '';
                        if (u) urls.push(u.trim());
                    }
                    if (urls.length === 0) {
                        var urlMatch = ch.innerHTML.match(/(https?:\/\/[^\s<]+)/);
                        if (urlMatch) {
                            chUrl = urlMatch[1];
                            urls.push(chUrl);
                        }
                    } else {
                        chUrl = urls[0];
                    }
                    if (chUrl) {
                        count++;
                        channels.push({
                            id: 'ch_' + channels.length,
                            name: chName,
                            url: chUrl,
                            urls: urls,
                            group: currentGroup
                        });
                    }
                }
                if (count > 0) {
                    if (groupMap[currentGroup]) {
                        groupMap[currentGroup].count += count;
                    } else {
                        groupMap[currentGroup] = {
                            name: currentGroup,
                            count: count
                        };
                        groups.push(groupMap[currentGroup]);
                    }
                }
            }
        } catch (e) {
            console.warn('Parse XML failed:', e);
        }
        return {
            channels: channels,
            groups: groups
        };
    };

    NcLive.prototype.getChannelsByGroup = function (groupName) {
        if (!groupName) return this.channels.slice();
        return this.channels.filter(function (ch) {
            return ch.group === groupName;
        });
    };

    NcLive.prototype.switchGroup = function (groupName) {
        var group = this.groups.find(function (g) {
            return g.name === groupName;
        });
        if (!group) {
            throw new Error('Group not found');
        }
        this.currentGroup = group;
        this._saveCurrentGroup();
        return group;
    };

    NcLive.prototype.playChannel = function (channelId) {
        var channel = this.channels.find(function (ch) {
            return ch.id === channelId;
        });
        if (!channel) {
            var byName = this.channels.find(function (ch) {
                return ch.name === channelId;
            });
            if (!byName) {
                throw new Error('Channel not found');
            }
            channel = byName;
        }
        this.currentChannel = channel;
        this._saveCurrentChannel();
        return channel;
    };

    NcLive.prototype.play = function (videoElement, channelId) {
        var channel = this.playChannel(channelId);
        if (videoElement && channel.url) {
            videoElement.src = channel.url;
            videoElement.play().catch(function (e) {
                console.warn('Auto play failed:', e);
            });
        }
        return channel;
    };

    NcLive.prototype.getNextChannel = function () {
        var groupChannels = this.getChannelsByGroup(this.currentGroup ? this.currentGroup.name : null);
        if (groupChannels.length === 0) return null;
        if (!this.currentChannel) {
            return groupChannels[0];
        }
        var currentIdx = groupChannels.findIndex(function (ch) {
            return ch.id === this.currentChannel.id;
        }.bind(this));
        var nextIdx = (currentIdx + 1) % groupChannels.length;
        return groupChannels[nextIdx];
    };

    NcLive.prototype.getPrevChannel = function () {
        var groupChannels = this.getChannelsByGroup(this.currentGroup ? this.currentGroup.name : null);
        if (groupChannels.length === 0) return null;
        if (!this.currentChannel) {
            return groupChannels[0];
        }
        var currentIdx = groupChannels.findIndex(function (ch) {
            return ch.id === this.currentChannel.id;
        }.bind(this));
        var prevIdx = (currentIdx - 1 + groupChannels.length) % groupChannels.length;
        return groupChannels[prevIdx];
    };

    NcLive.prototype.searchChannels = function (keyword) {
        if (!keyword) return this.channels.slice();
        var lower = keyword.toLowerCase();
        return this.channels.filter(function (ch) {
            return ch.name.toLowerCase().indexOf(lower) >= 0;
        });
    };

    NcLive.API_TYPES = API_TYPES;
    NcLive.httpGet = httpGet;
    NcLive.httpPost = httpPost;
    NcLive.safeJsonParse = safeJsonParse;

    global.NcLive = NcLive;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NcLive;
    }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
