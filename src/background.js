chrome.webRequest.onHeadersReceived.addListener(info => {
    const headers = info.responseHeaders; // original headers


    console.log(headers);
    // return modified headers
    return {responseHeaders: headers};
}, {
    urls: [ "*://*/*" ], // match all pages
    types: [ "sub_frame" ] // for framing only
}, ["blocking", "responseHeaders"])