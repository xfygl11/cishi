(function (window) {
    'use strict';

    var NCMovieEngine = {
        version: '1.0.0',

        config: {
            ffzyApi: 'https://json.ffzyapi.com/api.php/provide/vod/',
            configSources: [
                'https://饭太硬.top/tv',
                'https://饭太硬.ml/tv'
            ],
            parsers: [
                { name: '解析1', url: 'https://jx.xmflv.com/?url=' },
                { name: '解析2', url: 'https://jx.playerjy.com/?url=' },
                { name: '解析3', url: 'https://www.yemu.xyz/?url=' }
            ],
            cacheTime: 30 * 60 * 1000,
            pageSize: 20
        },

        state: {
            categories: [],
            currentList: [],
            currentDetail: null,
            currentEpisodes: [],
            currentParserIdx: 0,
            currentVideo: null,
            playHistory: [],
            favorites: [],
            configLoaded: false,
            loadedConfig: null
        },

        cache: {
            get: function (key) {
                try {
                    var data = localStorage.getItem('nc_movie_cache_' + key);
                    if (!data) return null;
                    var obj = JSON.parse(data);
                    if (obj.expire && Date.now() > obj.expire) {
                        localStorage.removeItem('nc_movie_cache_' + key);
                        return null;
                    }
                    return obj.data;
                } catch (e) {
                    return null;
                }
            },
            set: function (key, data, ttl) {
                try {
                    var obj = {
                        data: data,
                        expire: ttl ? Date.now() + ttl : null
                    };
                    localStorage.setItem('nc_movie_cache_' + key, JSON.stringify(obj));
                } catch (e) {}
            },
            remove: function (key) {
                try {
                    localStorage.removeItem('nc_movie_cache_' + key);
                } catch (e) {}
            },
            clear: function () {
                try {
                    for (var i = localStorage.length - 1; i >= 0; i--) {
                        var key = localStorage.key(i);
                        if (key && key.indexOf('nc_movie_cache_') === 0) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {}
            }
        },

        storage: {
            getHistory: function () {
                try {
                    var data = localStorage.getItem('nc_movie_history');
                    return data ? JSON.parse(data) : [];
                } catch (e) {
                    return [];
                }
            },
            saveHistory: function (list) {
                try {
                    localStorage.setItem('nc_movie_history', JSON.stringify(list));
                } catch (e) {}
            },
            addHistory: function (video, epIdx, progress) {
                var history = this.getHistory();
                var idx = -1;
                for (var i = 0; i < history.length; i++) {
                    if (history[i].id === video.id) {
                        idx = i;
                        break;
                    }
                }
                var item = {
                    id: video.id,
                    name: video.name,
                    pic: video.pic,
                    epIdx: epIdx || 0,
                    epName: video.episodes && video.episodes[epIdx] ? video.episodes[epIdx].name : '',
                    progress: progress || 0,
                    duration: 0,
                    lastPlay: Date.now()
                };
                if (idx >= 0) {
                    history[idx] = item;
                } else {
                    history.unshift(item);
                }
                if (history.length > 100) {
                    history = history.slice(0, 100);
                }
                this.saveHistory(history);
                NCMovieEngine.state.playHistory = history;
            },
            removeHistory: function (id) {
                var history = this.getHistory();
                history = history.filter(function (item) {
                    return item.id !== id;
                });
                this.saveHistory(history);
                NCMovieEngine.state.playHistory = history;
            },
            clearHistory: function () {
                this.saveHistory([]);
                NCMovieEngine.state.playHistory = [];
            },
            getProgress: function (id, epIdx) {
                try {
                    var key = 'nc_movie_progress_' + id + '_' + epIdx;
                    var data = localStorage.getItem(key);
                    return data ? JSON.parse(data) : { progress: 0, duration: 0 };
                } catch (e) {
                    return { progress: 0, duration: 0 };
                }
            },
            saveProgress: function (id, epIdx, progress, duration) {
                try {
                    var key = 'nc_movie_progress_' + id + '_' + epIdx;
                    localStorage.setItem(key, JSON.stringify({
                        progress: progress || 0,
                        duration: duration || 0,
                        updateTime: Date.now()
                    }));
                } catch (e) {}
            },
            getFavorites: function () {
                try {
                    var data = localStorage.getItem('nc_movie_favorites');
                    return data ? JSON.parse(data) : [];
                } catch (e) {
                    return [];
                }
            },
            saveFavorites: function (list) {
                try {
                    localStorage.setItem('nc_movie_favorites', JSON.stringify(list));
                } catch (e) {}
            },
            addFavorite: function (video) {
                var favorites = this.getFavorites();
                var exists = favorites.some(function (item) {
                    return item.id === video.id;
                });
                if (!exists) {
                    favorites.unshift({
                        id: video.id,
                        name: video.name,
                        pic: video.pic,
                        type: video.type || '',
                        addTime: Date.now()
                    });
                    this.saveFavorites(favorites);
                    NCMovieEngine.state.favorites = favorites;
                }
                return !exists;
            },
            removeFavorite: function (id) {
                var favorites = this.getFavorites();
                favorites = favorites.filter(function (item) {
                    return item.id !== id;
                });
                this.saveFavorites(favorites);
                NCMovieEngine.state.favorites = favorites;
            },
            isFavorite: function (id) {
                var favorites = this.getFavorites();
                return favorites.some(function (item) {
                    return item.id === id;
                });
            }
        },

        http: {
            useNative: function () {
                return typeof window.NativeHttp !== 'undefined' &&
                    typeof window.NativeHttp.httpGet === 'function';
            },
            get: function (url, options) {
                var self = this;
                options = options || {};
                return new Promise(function (resolve, reject) {
                    if (self.useNative()) {
                        try {
                            var result = window.NativeHttp.httpGet(url);
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
                        xhr.timeout = options.timeout || 15000;
                        if (options.headers) {
                            for (var key in options.headers) {
                                if (options.headers.hasOwnProperty(key)) {
                                    xhr.setRequestHeader(key, options.headers[key]);
                                }
                            }
                        }
                        xhr.onload = function () {
                            if (xhr.status >= 200 && xhr.status < 300) {
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
            },
            post: function (url, body, options) {
                var self = this;
                options = options || {};
                return new Promise(function (resolve, reject) {
                    if (self.useNative() && typeof window.NativeHttp.httpPost === 'function') {
                        try {
                            var result = window.NativeHttp.httpPost(url, body || '');
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
                        xhr.timeout = options.timeout || 15000;
                        if (options.headers) {
                            for (var key in options.headers) {
                                if (options.headers.hasOwnProperty(key)) {
                                    xhr.setRequestHeader(key, options.headers[key]);
                                }
                            }
                        }
                        if (!options.headers || !options.headers['Content-Type']) {
                            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                        }
                        xhr.onload = function () {
                            if (xhr.status >= 200 && xhr.status < 300) {
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
                        xhr.send(body || '');
                    }
                });
            },
            getJSON: function (url, options) {
                return this.get(url, options).then(function (text) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error('JSON parse error: ' + e.message);
                    }
                });
            },
            postJSON: function (url, body, options) {
                return this.post(url, body, options).then(function (text) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error('JSON parse error: ' + e.message);
                    }
                });
            }
        },

        ffzy: {
            buildUrl: function (params) {
                var base = NCMovieEngine.config.ffzyApi;
                var query = [];
                for (var key in params) {
                    if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
                        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                    }
                }
                if (query.length > 0) {
                    base += (base.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
                }
                return base;
            },

            request: function (params) {
                var url = this.buildUrl(params);
                var cacheKey = 'ffzy_' + btoa(unescape(encodeURIComponent(url))).slice(0, 64);
                var cached = NCMovieEngine.cache.get(cacheKey);
                if (cached) {
                    return Promise.resolve(cached);
                }
                return NCMovieEngine.http.getJSON(url).then(function (data) {
                    NCMovieEngine.cache.set(cacheKey, data, NCMovieEngine.config.cacheTime);
                    return data;
                });
            },

            getCategories: function () {
                return this.request({ ac: 'list' }).then(function (data) {
                    var list = [];
                    if (data && data.class) {
                        list = data.class.map(function (item) {
                            return {
                                id: item.type_id,
                                name: item.type_name,
                                type_id: item.type_id,
                                type_name: item.type_name
                            };
                        });
                    }
                    NCMovieEngine.state.categories = list;
                    return list;
                });
            },

            getList: function (cat, page, pagesize) {
                var params = {
                    ac: 'list',
                    pg: page || 1,
                    t: cat || '',
                    limit: pagesize || NCMovieEngine.config.pageSize
                };
                return this.request(params).then(function (data) {
                    var result = {
                        list: [],
                        total: 0,
                        page: page || 1,
                        pagecount: 0,
                        limit: pagesize || NCMovieEngine.config.pageSize
                    };
                    if (data) {
                        result.total = data.total || 0;
                        result.pagecount = data.pagecount || 0;
                        if (data.list) {
                            result.list = data.list.map(function (item) {
                                return NCMovieEngine.ffzy.normalizeVideo(item);
                            });
                        }
                    }
                    NCMovieEngine.state.currentList = result.list;
                    return result;
                });
            },

            search: function (kw, page) {
                var params = {
                    ac: 'list',
                    wd: kw,
                    pg: page || 1
                };
                var url = this.buildUrl(params);
                return NCMovieEngine.http.getJSON(url).then(function (data) {
                    var result = {
                        list: [],
                        total: 0,
                        page: page || 1
                    };
                    if (data) {
                        result.total = data.total || 0;
                        if (data.list) {
                            result.list = data.list.map(function (item) {
                                return NCMovieEngine.ffzy.normalizeVideo(item);
                            });
                        }
                    }
                    return result;
                });
            },

            getDetail: function (ids) {
                var params = {
                    ac: 'detail',
                    ids: ids
                };
                return this.request(params).then(function (data) {
                    if (data && data.list && data.list.length > 0) {
                        var detail = NCMovieEngine.ffzy.normalizeDetail(data.list[0]);
                        NCMovieEngine.state.currentDetail = detail;
                        NCMovieEngine.state.currentEpisodes = detail.episodes || [];
                        return detail;
                    }
                    return null;
                });
            },

            normalizeVideo: function (item) {
                return {
                    id: item.vod_id,
                    name: item.vod_name,
                    pic: item.vod_pic,
                    pic_thumb: item.vod_pic_thumb || item.vod_pic,
                    type: item.type_name || '',
                    type_id: item.type_id || 0,
                    year: item.vod_year || '',
                    area: item.vod_area || '',
                    actor: item.vod_actor || '',
                    director: item.vod_director || '',
                    content: item.vod_content || item.vod_blurb || '',
                    remark: item.vod_remarks || '',
                    score: item.vod_score || 0,
                    time: item.vod_time || item.vod_addtime || 0
                };
            },

            normalizeDetail: function (item) {
                var video = this.normalizeVideo(item);
                video.content = item.vod_content || video.content;
                video.director = item.vod_director || video.director;
                video.actor = item.vod_actor || video.actor;
                video.year = item.vod_year || video.year;
                video.area = item.vod_area || video.area;
                video.lang = item.vod_lang || '';
                video.state = item.vod_state || '';
                video.tags = item.vod_tag || '';

                var episodes = [];
                if (item.vod_play_url) {
                    var sources = item.vod_play_url.split('$$$');
                    var sourceNames = item.vod_play_from ? item.vod_play_from.split('$$$') : [];
                    for (var s = 0; s < sources.length; s++) {
                        var sourceName = sourceNames[s] || '线路' + (s + 1);
                        var epList = sources[s].split('#').filter(function (ep) {
                            return ep && ep.indexOf('$') >= 0;
                        }).map(function (ep, idx) {
                            var parts = ep.split('$');
                            return {
                                name: parts[0] || ('第' + (idx + 1) + '集'),
                                url: parts[1] || '',
                                source: sourceName,
                                sourceIdx: s
                            };
                        });
                        if (s === 0) {
                            episodes = epList;
                        }
                        video['source_' + s] = {
                            name: sourceName,
                            list: epList
                        };
                    }
                }
                video.episodes = episodes;
                video.sources = item.vod_play_from ? item.vod_play_from.split('$$$').length : 1;
                return video;
            }
        },

        cms: {
            request: function (apiUrl, type, params) {
                var url = apiUrl;
                if (type === 'xml') {
                    return NCMovieEngine.http.get(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ac=' + (params.ac || 'list')).then(function (text) {
                        return NCMovieEngine.cms.parseXml(text);
                    });
                } else {
                    var query = [];
                    if (params) {
                        for (var key in params) {
                            if (params.hasOwnProperty(key) && params[key] !== undefined && params[key] !== null) {
                                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                            }
                        }
                    }
                    if (query.length > 0) {
                        url += (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
                    }
                    return NCMovieEngine.http.getJSON(url);
                }
            },

            parseXml: function (xmlStr) {
                try {
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
                    var result = {};
                    var classNodes = xmlDoc.getElementsByTagName('class');
                    if (classNodes.length > 0) {
                        result.class = [];
                        for (var i = 0; i < classNodes.length; i++) {
                            result.class.push({
                                type_id: classNodes[i].getAttribute('id') || classNodes[i].getAttribute('ty') || '',
                                type_name: classNodes[i].textContent || classNodes[i].getAttribute('name') || ''
                            });
                        }
                    }
                    var videoNodes = xmlDoc.getElementsByTagName('video');
                    if (videoNodes.length > 0) {
                        result.list = [];
                        for (var j = 0; j < videoNodes.length; j++) {
                            var vid = {};
                            var children = videoNodes[j].children;
                            for (var k = 0; k < children.length; k++) {
                                var tag = children[k].tagName.toLowerCase();
                                vid[tag] = children[k].textContent;
                            }
                            result.list.push(vid);
                        }
                    }
                    return result;
                } catch (e) {
                    return { list: [], class: [] };
                }
            }
        },

        configLoader: {
            parseConfig: function (text) {
                var result = {
                    sites: [],
                    parsers: [],
                    flags: {}
                };
                try {
                    var json = typeof text === 'string' ? JSON.parse(text) : text;
                    if (json.sites) {
                        result.sites = json.sites;
                    }
                    if (json.parses) {
                        result.parsers = json.parses.map(function (p) {
                            return {
                                name: p.name || '',
                                url: p.url || p.api || ''
                            };
                        });
                    }
                    if (json.flags) {
                        result.flags = json.flags;
                    }
                    return result;
                } catch (e) {
                    var lines = text.split('\n');
                    var mode = '';
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (!line || line.indexOf('//') === 0) continue;
                        if (line === '[sites]') {
                            mode = 'sites';
                            continue;
                        }
                        if (line === '[parses]') {
                            mode = 'parses';
                            continue;
                        }
                        if (line.indexOf('[') === 0 && line.indexOf(']') > 0) {
                            mode = '';
                            continue;
                        }
                        if (mode === 'sites' && line.indexOf('$') >= 0) {
                            var parts = line.split('$');
                            result.sites.push({
                                name: parts[0] || '',
                                api: parts[1] || '',
                                type: parts[2] || 'json',
                                searchable: parts[3] !== '0'
                            });
                        }
                        if (mode === 'parses' && line.indexOf('$') >= 0) {
                            var pParts = line.split('$');
                            result.parsers.push({
                                name: pParts[0] || '',
                                url: pParts[1] || ''
                            });
                        }
                    }
                    return result;
                }
            },

            load: function () {
                var sources = NCMovieEngine.config.configSources;
                var index = 0;
                var tryLoad = function () {
                    if (index >= sources.length) {
                        NCMovieEngine.state.configLoaded = true;
                        return Promise.resolve(null);
                    }
                    var url = sources[index++];
                    return NCMovieEngine.http.get(url).then(function (text) {
                        var config = NCMovieEngine.configLoader.parseConfig(text);
                        if (config && (config.sites.length > 0 || config.parsers.length > 0)) {
                            NCMovieEngine.state.loadedConfig = config;
                            NCMovieEngine.state.configLoaded = true;
                            if (config.parsers.length > 0) {
                                NCMovieEngine.config.parsers = config.parsers;
                            }
                            return config;
                        }
                        return tryLoad();
                    }).catch(function () {
                        return tryLoad();
                    });
                };
                return tryLoad();
            }
        },

        isDirectVideoUrl: function (url) {
            if (!url) return false;
            var u = url.toLowerCase();
            var directPatterns = [
                '.m3u8', '.mp4', '.flv', '.webm', '.mkv', '.mov',
                '.avi', '.wmv', '.rmvb', '.ts', '.m4v',
                '/m3u8/', '/play/', '/video/',
                'blob:', 'data:video'
            ];
            for (var i = 0; i < directPatterns.length; i++) {
                if (u.indexOf(directPatterns[i]) >= 0) {
                    return true;
                }
            }
            if (/^https?:\/\/[^\/]+\/\d+\.(m3u8|mp4|flv)/i.test(url)) {
                return true;
            }
            return false;
        },

        resolvePlayUrl: function (url, parserIdx) {
            if (!url) return '';
            if (this.isDirectVideoUrl(url)) {
                return url;
            }
            var idx = parserIdx !== undefined ? parserIdx : this.state.currentParserIdx;
            var parsers = this.config.parsers;
            if (idx >= 0 && idx < parsers.length && parsers[idx].url) {
                return parsers[idx].url + encodeURIComponent(url);
            }
            return url;
        },

        loadMovieConfig: function () {
            return this.configLoader.load();
        },

        ffzyFetch: function (params) {
            return this.ffzy.request(params);
        },

        loadMovieList: function (cat, page) {
            return this.ffzy.getList(cat, page || 1);
        },

        searchMovieRemote: function (kw, page) {
            return this.ffzy.search(kw, page || 1);
        },

        loadMovieDetail: function (id) {
            return this.ffzy.getDetail(id);
        },

        loadCategories: function () {
            return this.ffzy.getCategories();
        },

        moviePlay: function (id, epIdx) {
            var self = this;
            return this.ffzy.getDetail(id).then(function (detail) {
                if (!detail) {
                    throw new Error('影片不存在');
                }
                var episodes = detail.episodes || [];
                var startIdx = epIdx || 0;
                if (startIdx >= episodes.length) {
                    startIdx = 0;
                }
                self.state.currentVideo = detail;
                self.state.currentEpisodes = episodes;
                if (typeof window.NativePlayer !== 'undefined' &&
                    typeof window.NativePlayer.play === 'function') {
                    var epJson = JSON.stringify(episodes);
                    var parserJson = JSON.stringify(self.config.parsers);
                    window.NativePlayer.play(
                        detail.name,
                        epJson,
                        parserJson,
                        startIdx
                    );
                } else {
                    self.openVideoModal(detail, episodes);
                }
                self.storage.addHistory(detail, startIdx, 0);
                return detail;
            });
        },

        openVideoModal: function (v, eps) {
            this.state.currentVideo = v;
            this.state.currentEpisodes = eps || v.episodes || [];
            var modal = document.getElementById('video-modal');
            if (modal) {
                modal.style.display = 'flex';
            }
            if (typeof this.onOpenVideoModal === 'function') {
                this.onOpenVideoModal(v, eps);
            }
        },

        closeVideoModal: function () {
            var modal = document.getElementById('video-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            var video = document.getElementById('video-player');
            if (video) {
                video.pause();
                video.src = '';
            }
        },

        player: {
            videoElement: null,
            container: null,
            currentUrl: '',
            isPlaying: false,
            isFullscreen: false,
            playbackRate: 1,
            duration: 0,
            currentTime: 0,

            init: function (videoEl, container) {
                this.videoElement = videoEl;
                this.container = container || videoEl.parentElement;
                this.bindEvents();
            },

            bindEvents: function () {
                var self = this;
                if (!this.videoElement) return;

                this.videoElement.addEventListener('play', function () {
                    self.isPlaying = true;
                    if (typeof NCMovieEngine.onPlay === 'function') {
                        NCMovieEngine.onPlay();
                    }
                });

                this.videoElement.addEventListener('pause', function () {
                    self.isPlaying = false;
                    if (typeof NCMovieEngine.onPause === 'function') {
                        NCMovieEngine.onPause();
                    }
                });

                this.videoElement.addEventListener('timeupdate', function () {
                    self.currentTime = self.videoElement.currentTime;
                    self.duration = self.videoElement.duration || self.duration;
                    if (typeof NCMovieEngine.onTimeUpdate === 'function') {
                        NCMovieEngine.onTimeUpdate(self.currentTime, self.duration);
                    }
                    if (NCMovieEngine.state.currentVideo && NCMovieEngine.state.currentEpisodes.length > 0) {
                        var video = NCMovieEngine.state.currentVideo;
                        var epIdx = NCMovieEngine.state.currentParserIdx || 0;
                        NCMovieEngine.storage.saveProgress(
                            video.id,
                            epIdx,
                            self.currentTime,
                            self.duration
                        );
                    }
                });

                this.videoElement.addEventListener('loadedmetadata', function () {
                    self.duration = self.videoElement.duration;
                    if (typeof NCMovieEngine.onLoadedMetadata === 'function') {
                        NCMovieEngine.onLoadedMetadata(self.duration);
                    }
                });

                this.videoElement.addEventListener('ended', function () {
                    self.isPlaying = false;
                    if (typeof NCMovieEngine.onEnded === 'function') {
                        NCMovieEngine.onEnded();
                    }
                });

                this.videoElement.addEventListener('error', function () {
                    if (typeof NCMovieEngine.onError === 'function') {
                        NCMovieEngine.onError(self.videoElement.error);
                    }
                });
            },

            play: function (url) {
                if (!this.videoElement) return;
                if (url) {
                    this.currentUrl = url;
                    this.videoElement.src = url;
                }
                this.videoElement.play().catch(function () {});
            },

            pause: function () {
                if (this.videoElement) {
                    this.videoElement.pause();
                }
            },

            togglePlay: function () {
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            },

            seek: function (time) {
                if (this.videoElement) {
                    this.videoElement.currentTime = Math.max(0, Math.min(time, this.duration));
                }
            },

            setPlaybackRate: function (rate) {
                if (this.videoElement) {
                    this.playbackRate = rate;
                    this.videoElement.playbackRate = rate;
                }
            },

            toggleFullscreen: function () {
                if (!this.container) return;
                if (!document.fullscreenElement) {
                    if (this.container.requestFullscreen) {
                        this.container.requestFullscreen();
                    } else if (this.container.webkitRequestFullscreen) {
                        this.container.webkitRequestFullscreen();
                    }
                    this.isFullscreen = true;
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                    this.isFullscreen = false;
                }
            },

            getProgress: function () {
                return {
                    current: this.currentTime,
                    duration: this.duration,
                    percent: this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
                };
            }
        },

        init: function (options) {
            if (options) {
                if (options.ffzyApi) this.config.ffzyApi = options.ffzyApi;
                if (options.configSources) this.config.configSources = options.configSources;
                if (options.parsers) this.config.parsers = options.parsers;
                if (options.cacheTime) this.config.cacheTime = options.cacheTime;
            }
            this.state.playHistory = this.storage.getHistory();
            this.state.favorites = this.storage.getFavorites();
            this.state.playHistory = this.storage.getHistory();
            this.state.favorites = this.storage.getFavorites();
            this.loadCategories().catch(function () {});
            return this;
        }
    };

    window.NCMovieEngine = NCMovieEngine;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NCMovieEngine;
    }

})(window);
