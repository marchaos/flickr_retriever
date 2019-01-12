# flickr_retriever
Retrieve all of your flickr photos with resume support + batching

I created this to download my photos (over 100GB) from flickr before the 12th of Feb. This script will cache all of your photosets and photos and will remember where it got up to last time. If any photos fail to download (500 errors etc), this will not be cached so that they next run of the script will attempt to download it again. 

Note that you need to register an application within Flickr so get a API Key and Secret which you will need to put at the top of index.js. Once you've done this, you can run the script, which will prompt you to load a URL in the browser. Do this and authenticate with Flickr. You will only need to do this on the first run of the script since the auth result is cached. 
