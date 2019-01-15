# flickr_retriever
Retrieve all of your flickr photos with resume support + batching

I created this to download my photos (over 150GB) from flickr before the 5th of Feb. This script will cache all of your photosets and photos and will remember where it got up to last time. If any photos fail to download (500 errors etc), this will not be cached so that they next run of the script will attempt to download it again. 

Note that you need to register an application within Flickr so get a API Key and Secret which you will need to put at the top of index.js. Once you've done this, you can run the script, which will prompt you to load a URL in the browser. Do this and authenticate with Flickr. You will only need to do this on the first run of the script since the auth result is cached. 

## Assumptions

This assumes that all of your photos are orgainised into albums / photosets. I'll probably add a post process that will attempt to download anything else into a separate folder, but this is currently a TODO item.

## Installing and Running

* Ensure you have a recent version of node (8+ I suspect)
* Create an app and get your API key and secret here - https://www.flickr.com/services/apps/create/
* ```npm install```
* modify index.js and add your API_KEY and SECRET as well as your USER_ID to the consts. You will probably want to use https://www.webfx.com/tools/idgettr/ to get your user id. 
* run ```node index.js``` and sit back!

Photos will be downloaded to the ```photos``` dir into folders as they appear in your flickr albums. The ```data``` dir contains the cache of what has been downloaded and the oath cache. If you need to clear it out, you probably want to keep the ```oath``` file and delete everything else.

If you see any Internal Server Error messages, you probably want to re-run the script. It will only process and download things that it has never seen before. 
