const Flickr = require('flickr-sdk');
const http = require('http');
const path = require('path');
const fs = require('fs');
const download = require('download');
const parse = require('url').parse;

const API_KEY = '4c60b89801a88d85bcda4455c0947bb2';
const SECRET = '3619d8cbed0d3786';
const USER_ID = '9264072@N05';

const db = {
    users: new Map(),
    oauth: new Map()
};

const DEBUG = false;
const CACHE_PATH = './data';
const PHOTOS_PATH = './photos';
const BATCH_SIZE = 40;

const oauth = new Flickr.OAuth(API_KEY, SECRET);

class Cache {
    static get(cacheFile, cachePath = CACHE_PATH) {
        return new Promise((resolve) => {
            fs.readFile(`${cachePath}/${cacheFile}`, 'utf8', (err, contents) => {
                if (err) {
                    console.log(`Cache file for key ${cacheFile} does not exist`);
                    return resolve(null);
                }
                DEBUG && console.log(`Cache file for key ${cacheFile} exists, returning...`);

                let parsedContents;
                try {
                    parsedContents = JSON.parse(contents);
                } catch (e) {
                    console.error(`Could parse cached file ${cacheFile}, so assuming this does not exist`);
                    resolve(null);
                }
                return resolve(parsedContents);
            });
        });
    }

    static put(cacheFile, contents, cachePath = CACHE_PATH) {
        return new Promise((resolve, reject) => {
            fs.writeFile(`${cachePath}/${cacheFile}`, JSON.stringify(contents), (err) => {
                if (err) {
                    return reject(err);
                }

                DEBUG && console.log(`Cache file for key ${cacheFile} saved!`);
                return resolve();
            });
        });
    }
}

const processPhotos = (flickr, photosetId, title, allPhotos = [], page = 1) => {
    return flickr.photosets.getPhotos({ user_id: USER_ID, photoset_id: photosetId, page }).then((contents) => {
        allPhotos = allPhotos.concat(contents.body.photoset.photo);

        return {
            done: allPhotos.length === contents.body.photoset.total
        };
    }).then(({ done }) => {
        if (!done) {
            console.info(`Received ${allPhotos.length} for photoset ${title}, getting page ${page + 1}`);
            return processPhotos(flickr, photosetId, title, allPhotos, ++page);
        } else {
            return allPhotos;
        }
    });
};

const processPhotosets = async (flickr, photosets) => {
    for (const photoset of photosets) {
        const key = `photoset-${photoset.id}`;
        Cache.get(key).then(async info => {
            const title = photoset.title._content;
            const photosDir = `${PHOTOS_PATH}/${title.replace('/', '-')}`;
            if (!fs.existsSync(photosDir)) {
                fs.mkdirSync(photosDir, { recursive: true });
            }

            if (!info) {
                const photos = await processPhotos(flickr, photoset.id, title);
                Cache.put(key, photos).then(async () => {
                    console.info(`saved ${photos.length} photos for photoset ${title}`);
                    await getPhotos(flickr, photoset.id, photosDir, photos);
                }).catch(e => {
                    console.error(`Could not save photos for photoset ${title}`, e);
                });
            } else {
                console.info(`Got already for photoset ${key}`);
                await getPhotos(flickr, photoset.id, photosDir, info);
            }
        });
    }
};

const getPhotoUrl = (flickr, photoId) => {
    return flickr.photos.getSizes({ photo_id: photoId }).then((res) => {
        const sizes = res.body.sizes.size;
        let original = sizes.find(s => s.label === 'Video Original');
        if (!original) {
            original = sizes.find(s => s.label === 'Video Original' || s.label === 'Original');
            if (!original) {
                original = sizes[sizes.length - 1];
            }
        }

        if (original) {
            return original.source;
        } else {
            debugger;
        }
    });
};

const processBatch = async (flickr, batch, photosDir, photoCacheKey, cache) => {
    return new Promise((resolve) => {
        let count = BATCH_SIZE;
        batch.forEach(async (photo) => {
            if (!cache.includes(photo.id)) {
                try {
                    const url = await getPhotoUrl(flickr, photo.id);
                    const ext = path.extname(url);

                    let filename;
                    if (photo.title) {
                        filename = photo.title;
                        if (!photo.title.includes('.')) {
                            filename += ext;
                        }
                    }

                    await download(url, photosDir, { filename: filename || undefined });
                    cache.push(photo.id);
                    Cache.put(photoCacheKey, cache);
                    console.info(`Saved image ${filename || url} to ${photosDir}`);
                } catch (e) {
                    console.error(`could not download image ${photo.title} for dir ${photosDir}`, e);
                }
            }
            if (--count === 0) {
                return resolve();
            }
        });
    });
};

const getPhotos = (flickr, photosetId, photosDir, photos) => {
    const photoCacheKey = `photos-save-${photosetId}`;

    Cache.get(photoCacheKey).then(async (info) => {
        let cache = [];
        if (info) {
            cache = info;
            console.info(`Already have a photos cache file for ${photosDir} - contains ${cache.length}`);
        } else {
            Cache.put(photoCacheKey, cache);
        }

        do {
            const batch = photos.splice(0, BATCH_SIZE);
            await processBatch(flickr, batch, photosDir, photoCacheKey, cache);

        } while (photos.length > 0);

        console.info(`FINISHED A PHOTOSET FOR ${photosDir} `);


    }).catch(e => {
        console.error(`Could not get photos saved cache for ${photoCacheKey}`, e);
    });
};

const startRetrieval = (flickr) => {
    Cache.get('photosets').then(photosets => {
        if (photosets) {
            processPhotosets(flickr, photosets);
        } else {
            flickr.photosets.getList({ user_id: USER_ID }).then((res) => {
                Cache.put('photosets', res.body.photosets.photoset).then(() => {
                    processPhotosets(flickr, res.body.photosets.photoset);

                }).catch(err => {
                    console.error(`Could not get photosets!! ${err}`);
                });
            });
        }
    });
};

const getRequestToken = (req, res) => {
    oauth.request('http://localhost:3000/oauth/callback').then((_res) => {
        const requestToken = _res.body.oauth_token;
        const requestTokenSecret = _res.body.oauth_token_secret;

        // store the request token and secret in the database
        db.oauth.set(requestToken, requestTokenSecret);

        // redirect the user to flickr and ask them to authorize your app.
        // perms default to "read", but you may specify "write" or "delete".
        res.statusCode = 302;
        res.setHeader('location', oauth.authorizeUrl(requestToken, 'write'));
        res.end();
    }).catch(function (err) {
        res.statusCode = 400;
        res.end(err.message);
    });
};

const verifyRequestToken = (req, res, query) => {
    const requestToken = query.oauth_token;
    const oauthVerifier = query.oauth_verifier;

    // retrieve the request secret from the database
    const requestTokenSecret = db.oauth.get(requestToken);

    oauth.verify(requestToken, oauthVerifier, requestTokenSecret).then((_res) => {
        const userNsid = _res.body.user_nsid;
        const oauthToken = _res.body.oauth_token;
        const oauthTokenSecret = _res.body.oauth_token_secret;
        let flickr;

        // store the oauth token and secret in the database
        db.users.set(userNsid, {
            oauthToken: oauthToken,
            oauthTokenSecret: oauthTokenSecret
        });

        // we no longer need the request token and secret so we can delete them
        db.oauth.delete(requestToken);

        // log our oauth token and secret for debugging
        console.log('oauth token:', oauthToken);
        console.log('oauth token secret:', oauthTokenSecret);

        // create a new Flickr API client using the oauth plugin
        flickr = new Flickr(oauth.plugin(
            oauthToken,
            oauthTokenSecret
        ));

        Cache.put('oath').then(() => {
            startRetrieval(flickr);
        }).catch(err => {
            console.err(`Could not store cache file for oath!! ${err}`);
        });


    }).catch((err) => {
        res.statusCode = 400;
        res.end(err.message);
    });
};

Cache.get('oath').then(loginParts => {
    if (loginParts) {
        console.log(loginParts);

        const flickr = new Flickr(oauth.plugin(
            loginParts.oauthToken,
            loginParts.oauthTokenSecret
        ));

        startRetrieval(flickr);
    } else {
        console.info('No credentials file, so login');

        http.createServer((req, res) => {
            const url = parse(req.url, true);

            switch (url.pathname) {
                case '/':
                    return getRequestToken(req, res);
                case '/oauth/callback':
                    return verifyRequestToken(req, res, url.query);
                default:
                    res.statusCode = 404;
                    res.end();
            }
        }).listen(3000, () => {
            console.log('Open your browser to http://localhost:3000');
        });
    }
});
