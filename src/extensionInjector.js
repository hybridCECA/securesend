"use strict";

function addScript(src, onload) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = chrome.extension.getURL(src);
    (document.body || document.head || document.documentElement).appendChild(script);

    script.onload = onload;
}

function onExtensionLoad() {
    var dialog = chrome.runtime.getURL("html/dialog.html");
    var upload = chrome.runtime.getURL("html/upload.html");
    var permissions = chrome.runtime.getURL("html/permissions.html");
    var urls = { dialog, upload, permissions };

    var event = document.createEvent("CustomEvent");
    event.initCustomEvent("securesendUiSrcTransfer", true, true, urls);
    document.dispatchEvent(event);
}

addScript("dist/gmailJsLoader.js");
addScript("dist/extension.js", onExtensionLoad);
